import net from "node:net";
import tls from "node:tls";
import { execFileSync } from "node:child_process";

export type ProxySettings = {
  proxyUrl?: string;
  resolvedHost?: string;
};

export function resolveGmailProxyUrl(input?: string) {
  const value = (input ?? "").trim();
  if (!value || value.toLowerCase() === "none" || value.toLowerCase() === "false") return undefined;
  if (value.toLowerCase() !== "auto") return normalizeProxyUrl(value);
  return readWindowsProxyUrl();
}

export function resolveHostWithWindowsDns(host: string) {
  try {
    const output = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `$r=Resolve-DnsName -Name ${quotePowerShell(host)} -Type A -ErrorAction Stop | Where-Object {$_.IPAddress} | Select-Object -First 1 -ExpandProperty IPAddress; if($r){$r}`
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10000 }
    ).trim();
    return output || undefined;
  } catch {
    return undefined;
  }
}

export async function connectTlsWithOptionalProxy(args: {
  host: string;
  port: number;
  servername: string;
  proxyUrl?: string;
  resolvedHost?: string;
  timeoutMs?: number;
}) {
  if (!args.proxyUrl) {
    return tlsConnect({
      host: args.resolvedHost ?? args.host,
      port: args.port,
      servername: args.servername,
      timeoutMs: args.timeoutMs
    });
  }

  const proxy = parseProxyUrl(args.proxyUrl);
  const targetHost = args.resolvedHost ?? args.host;
  const rawSocket = proxy.protocol.startsWith("socks")
    ? await connectSocks5(proxy, targetHost, args.port, args.timeoutMs)
    : await connectHttpProxy(proxy, targetHost, args.port, args.host, args.timeoutMs);

  return tlsConnect({
    socket: rawSocket,
    servername: args.servername,
    timeoutMs: args.timeoutMs
  });
}

function readWindowsProxyUrl() {
  try {
    const output = execFileSync(
      "reg",
      ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings", "/v", "ProxyServer"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 }
    );
    const match = /ProxyServer\s+REG_\w+\s+(.+)/i.exec(output);
    if (!match) return undefined;
    return proxyServerToUrl(match[1].trim());
  } catch {
    return undefined;
  }
}

function proxyServerToUrl(value: string) {
  if (!value) return undefined;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return normalizeProxyUrl(value);

  const parts = Object.fromEntries(
    value
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf("=");
        return eq === -1 ? ["default", part] : [part.slice(0, eq).toLowerCase(), part.slice(eq + 1)];
      })
  );

  const selected = parts.socks ?? parts.https ?? parts.http ?? parts.default ?? value;
  if (!selected) return undefined;
  const scheme = selected === parts.socks ? "socks5" : "http";
  return normalizeProxyUrl(`${scheme}://${selected}`);
}

function normalizeProxyUrl(value: string) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  return `http://${value}`;
}

function parseProxyUrl(proxyUrl: string) {
  const parsed = new URL(proxyUrl);
  return {
    protocol: parsed.protocol.replace(":", "").toLowerCase(),
    host: parsed.hostname,
    port: Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80)),
    username: decodeURIComponent(parsed.username || ""),
    password: decodeURIComponent(parsed.password || "")
  };
}

function connectHttpProxy(
  proxy: ReturnType<typeof parseProxyUrl>,
  targetHost: string,
  targetPort: number,
  tlsHost: string,
  timeoutMs = 30000
) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(proxy.port, proxy.host);
    let buffer = "";
    const auth = proxy.username
      ? `Proxy-Authorization: Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64")}\r\n`
      : "";

    const cleanup = () => {
      socket.off("error", reject);
      socket.off("data", onData);
      socket.off("timeout", onTimeout);
    };
    const onTimeout = () => {
      cleanup();
      socket.destroy();
      reject(new Error("Proxy CONNECT timed out."));
    };
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (!buffer.includes("\r\n\r\n")) return;
      if (!/^HTTP\/\d(?:\.\d)? 2\d\d/i.test(buffer)) {
        cleanup();
        socket.destroy();
        reject(new Error(`Proxy CONNECT failed: ${buffer.split(/\r?\n/)[0]}`));
        return;
      }
      cleanup();
      resolve(socket);
    };

    socket.setTimeout(timeoutMs);
    socket.once("error", reject);
    socket.once("timeout", onTimeout);
    socket.on("data", onData);
    socket.once("connect", () => {
      socket.write(`CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${tlsHost}:${targetPort}\r\n${auth}\r\n`);
    });
  });
}

function connectSocks5(proxy: ReturnType<typeof parseProxyUrl>, targetHost: string, targetPort: number, timeoutMs = 30000) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(proxy.port, proxy.host);
    let stage: "hello" | "connect" = "hello";
    let buffer = Buffer.alloc(0);

    const cleanup = () => {
      socket.off("error", reject);
      socket.off("data", onData);
      socket.off("timeout", onTimeout);
    };
    const onTimeout = () => {
      cleanup();
      socket.destroy();
      reject(new Error("SOCKS5 proxy timed out."));
    };
    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (stage === "hello" && buffer.length >= 2) {
        if (buffer[1] !== 0x00) {
          cleanup();
          socket.destroy();
          reject(new Error("SOCKS5 proxy requires unsupported authentication."));
          return;
        }
        stage = "connect";
        buffer = Buffer.alloc(0);
        socket.write(socksConnectRequest(targetHost, targetPort));
        return;
      }

      if (stage === "connect" && buffer.length >= 5) {
        if (buffer[1] !== 0x00) {
          cleanup();
          socket.destroy();
          reject(new Error(`SOCKS5 connect failed with code ${buffer[1]}.`));
          return;
        }
        cleanup();
        resolve(socket);
      }
    };

    socket.setTimeout(timeoutMs);
    socket.once("error", reject);
    socket.once("timeout", onTimeout);
    socket.on("data", onData);
    socket.once("connect", () => {
      socket.write(Buffer.from([0x05, 0x01, 0x00]));
    });
  });
}

function socksConnectRequest(host: string, port: number) {
  const portBuffer = Buffer.alloc(2);
  portBuffer.writeUInt16BE(port, 0);
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (ipv4) {
    return Buffer.concat([
      Buffer.from([0x05, 0x01, 0x00, 0x01]),
      Buffer.from(host.split(".").map((part) => Number(part))),
      portBuffer
    ]);
  }

  const hostBuffer = Buffer.from(host);
  return Buffer.concat([
    Buffer.from([0x05, 0x01, 0x00, 0x03, hostBuffer.length]),
    hostBuffer,
    portBuffer
  ]);
}

function tlsConnect(args: {
  host?: string;
  port?: number;
  socket?: net.Socket;
  servername: string;
  timeoutMs?: number;
}) {
  return new Promise<tls.TLSSocket>((resolve, reject) => {
    const socket = tls.connect({
      host: args.host,
      port: args.port,
      socket: args.socket,
      servername: args.servername
    });
    socket.once("secureConnect", () => resolve(socket));
    socket.once("error", reject);
    socket.setTimeout(args.timeoutMs ?? 30000, () => {
      socket.destroy(new Error("TLS connection timed out."));
    });
  });
}

function quotePowerShell(input: string) {
  return `'${input.replace(/'/g, "''")}'`;
}
