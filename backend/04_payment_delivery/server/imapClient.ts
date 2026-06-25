import tls from "node:tls";
import { connectTlsWithOptionalProxy, resolveGmailProxyUrl, resolveHostWithWindowsDns } from "./proxySupport";

type ImapMessage = {
  uid: string;
  raw: string;
};

export async function checkImapConnection(args: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  mailbox: string;
  searchQuery: string;
  proxyUrl?: string;
}) {
  const client = await ImapClient.connect(args);
  try {
    await client.login(args.user, args.password);
    await client.select(args.mailbox);
    const uids = await client.search(args.searchQuery);
    return {
      ok: true,
      mailbox: args.mailbox,
      matched: uids.length,
      latest_uid: uids.at(-1)
    };
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export async function fetchImapMessages(args: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  mailbox: string;
  searchQuery: string;
  maxMessages: number;
  proxyUrl?: string;
}) {
  const client = await ImapClient.connect(args);
  try {
    await client.login(args.user, args.password);
    await client.select(args.mailbox);
    const uids = (await client.search(args.searchQuery)).slice(-args.maxMessages);
    const messages: ImapMessage[] = [];
    for (const uid of uids) {
      messages.push({
        uid,
        raw: await client.fetchRaw(uid)
      });
    }
    return messages;
  } finally {
    await client.logout().catch(() => undefined);
  }
}

class ImapClient {
  private tagCounter = 1;
  private buffer = "";

  private constructor(private socket: tls.TLSSocket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      this.buffer += chunk;
    });
  }

  static connect(args: { host: string; port: number; secure: boolean; proxyUrl?: string }) {
    if (!args.secure) throw new Error("Only secure IMAP over TLS is supported for CommerceFix intake.");

    return new Promise<ImapClient>((resolve, reject) => {
      const proxyUrl = resolveGmailProxyUrl(args.proxyUrl);
      const resolvedHost = resolveHostWithWindowsDns(args.host);

      connectTlsWithOptionalProxy({
        host: args.host,
        port: args.port,
        servername: args.host,
        proxyUrl,
        resolvedHost,
        timeoutMs: 30000
      }).then(async (socket) => {
        const client = new ImapClient(socket);
        try {
          await client.waitForGreeting();
          resolve(client);
        } catch (error) {
          reject(error);
        }
      }).catch(reject);
    });
  }

  async login(user: string, password: string) {
    if (!user || !password) throw new Error("IMAP_USER and IMAP_APP_PASSWORD are required.");
    await this.command(`LOGIN ${quote(user)} ${quote(password)}`);
  }

  async select(mailbox: string) {
    await this.command(`SELECT ${quote(mailbox)}`);
  }

  async search(query: string) {
    const response = await this.command(`UID SEARCH ${query || "ALL"}`);
    const line = response.split(/\r?\n/).find((item) => item.startsWith("* SEARCH "));
    if (!line) return [];
    return line.replace("* SEARCH ", "").trim().split(/\s+/).filter(Boolean);
  }

  async fetchRaw(uid: string) {
    return this.command(`UID FETCH ${uid} (BODY.PEEK[])`, 15 * 1024 * 1024);
  }

  async logout() {
    await this.command("LOGOUT");
    this.socket.end();
  }

  private waitForGreeting() {
    return waitUntil(() => {
      if (this.buffer.includes("* OK")) {
        const greeting = this.buffer;
        this.buffer = "";
        return greeting;
      }
      return null;
    });
  }

  private async command(command: string, maxBytes = 2 * 1024 * 1024) {
    const tag = `A${String(this.tagCounter++).padStart(4, "0")}`;
    this.socket.write(`${tag} ${command}\r\n`);
    const response = await waitUntil(() => {
      if (this.buffer.length > maxBytes) throw new Error(`IMAP response exceeded ${maxBytes} bytes.`);
      if (new RegExp(`\\r?\\n${tag} (OK|NO|BAD)`).test(this.buffer)) {
        const out = this.buffer;
        this.buffer = "";
        return out;
      }
      return null;
    });

    if (new RegExp(`\\r?\\n${tag} (NO|BAD)`).test(response)) {
      throw new Error(`IMAP command failed: ${command.replace(/LOGIN .+/, "LOGIN <redacted>")}`);
    }
    return response;
  }
}

function quote(input: string) {
  return `"${input.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function waitUntil<T>(fn: () => T | null, timeoutMs = 15000): Promise<T> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const result = fn();
        if (result !== null) return resolve(result);
        if (Date.now() - started > timeoutMs) return reject(new Error("Timed out waiting for IMAP response."));
        setTimeout(tick, 25);
      } catch (error) {
        reject(error);
      }
    };
    tick();
  });
}
