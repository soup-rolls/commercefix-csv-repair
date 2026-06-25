import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadAutomationConfig } from "./automationConfig";
import { fetchImapMessages } from "./imapClient";
import { createPendingOrder } from "./orderIntake";
import { appendEvent, writeOrder } from "./orderStore";
import type { AutomationConfig, MailIntakeCreatedEvent } from "./automationTypes";

type IntakeMode = "dry-run" | "intake";

export async function runMailIntake(mode: IntakeMode, config: AutomationConfig = loadAutomationConfig()) {
  const checkpoint = await readCheckpoint(config.imapCheckpointPath);
  const messages = await fetchImapMessages({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    user: config.imapUser,
    password: config.imapAppPassword,
    mailbox: config.imapMailbox,
    searchQuery: config.imapSearchQuery,
    maxMessages: config.imapMaxMessages,
    proxyUrl: config.gmailProxyUrl
  });

  const processed = new Set(checkpoint.processedUids);
  const results = [];

  for (const message of messages) {
    if (processed.has(message.uid)) {
      results.push({ uid: message.uid, status: "already_processed" });
      continue;
    }

    const parsed = parseMail(message.raw);
    const csv = parsed.attachments.find((attachment) => attachment.fileName.toLowerCase().endsWith(".csv"));

    if (!csv) {
      results.push({ uid: message.uid, status: "ignored", reason: "no_csv_attachment", subject: parsed.subject });
      if (mode === "intake") {
        await appendEvent(config.orderStorageDir, mailEvent({
          mailUid: message.uid,
          fromEmail: parsed.fromEmail,
          subject: parsed.subject,
          status: "ignored",
          reason: "no_csv_attachment"
        }));
        processed.add(message.uid);
      }
      continue;
    }

    if (mode === "dry-run") {
      results.push({
        uid: message.uid,
        status: "candidate",
        from_email: parsed.fromEmail,
        subject: parsed.subject,
        csv_file_name: csv.fileName,
        csv_bytes: Buffer.byteLength(csv.text, "utf8")
      });
      continue;
    }

    try {
      const order = await createPendingOrder({
        config,
        csvText: csv.text,
        originalFileName: csv.fileName,
        plan: config.imapDefaultPlan,
        payerEmail: parsed.fromEmail
      });

      const intakeId = `mail_${randomUUID()}`;
      await writeOrder(config.orderStorageDir, {
        ...order,
        intake_source: "email",
        intake_id: intakeId,
        mail_uid: message.uid,
        delivery_email: parsed.fromEmail,
        customer_note: parsed.subject
      });

      await appendEvent(config.orderStorageDir, mailEvent({
        intakeId,
        mailUid: message.uid,
        fromEmail: parsed.fromEmail,
        subject: parsed.subject,
        csvFileName: csv.fileName,
        orderId: order.order_id,
        scanId: order.scan_id,
        status: "pending_payment"
      }));

      processed.add(message.uid);
      results.push({
        uid: message.uid,
        status: "pending_payment",
        order_id: order.order_id,
        scan_id: order.scan_id,
        plan: order.plan,
        csv_file_name: csv.fileName
      });
    } catch (error) {
      await appendEvent(config.orderStorageDir, mailEvent({
        mailUid: message.uid,
        fromEmail: parsed.fromEmail,
        subject: parsed.subject,
        csvFileName: csv.fileName,
        status: "failed",
        reason: "csv_parse_failed"
      }));
      results.push({
        uid: message.uid,
        status: "failed",
        reason: "csv_parse_failed",
        message: error instanceof Error ? error.message : "CSV intake failed"
      });
    }
  }

  if (mode === "intake") {
    await writeCheckpoint(config.imapCheckpointPath, { processedUids: Array.from(processed).sort(compareNumericStrings) });
  }

  return {
    ok: true,
    mode,
    mailbox: config.imapMailbox,
    search_query: config.imapSearchQuery,
    checked: messages.length,
    results
  };
}

function parseMail(raw: string) {
  const headerText = raw.split(/\r?\n\r?\n/, 1)[0] ?? "";
  const subject = decodeHeader(headerValue(headerText, "Subject") ?? "");
  const from = decodeHeader(headerValue(headerText, "From") ?? "");
  const fromEmail = emailFromAddress(from);
  const attachments = parseCsvAttachments(raw);

  return {
    subject,
    fromEmail,
    attachments
  };
}

function parseCsvAttachments(raw: string) {
  const attachments: Array<{ fileName: string; text: string }> = [];
  const normalized = raw.replace(/\r\n/g, "\n");
  const filenameRegex = /filename\*?=(?:UTF-8''|")?([^"\n;]+)"?/gi;
  let match: RegExpExecArray | null;

  while ((match = filenameRegex.exec(normalized))) {
    const fileName = decodeURIComponent(match[1].trim());
    if (!fileName.toLowerCase().endsWith(".csv")) continue;

    const headerStart = normalized.lastIndexOf("\n--", match.index);
    const bodyStart = normalized.indexOf("\n\n", match.index);
    if (bodyStart === -1) continue;
    const nextBoundary = normalized.indexOf("\n--", bodyStart + 2);
    const partHeaders = normalized.slice(headerStart === -1 ? match.index : headerStart, bodyStart);
    const body = normalized.slice(bodyStart + 2, nextBoundary === -1 ? undefined : nextBoundary).trim();
    const encoding = (headerValue(partHeaders, "Content-Transfer-Encoding") ?? "").toLowerCase();
    const text = decodePartBody(body, encoding);
    attachments.push({ fileName, text });
  }

  return attachments;
}

function decodePartBody(body: string, encoding: string) {
  if (encoding.includes("base64")) return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
  if (encoding.includes("quoted-printable")) return decodeQuotedPrintable(body);
  return body;
}

function decodeQuotedPrintable(input: string) {
  return input
    .replace(/=\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function headerValue(headers: string, name: string) {
  const unfolded = headers.replace(/\n[ \t]+/g, " ");
  const match = new RegExp(`^${escapeRegExp(name)}:\\s*(.+)$`, "im").exec(unfolded);
  return match?.[1]?.trim();
}

function decodeHeader(input: string) {
  return input.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, charset: string, mode: string, value: string) => {
    const bytes = mode.toUpperCase() === "B"
      ? Buffer.from(value, "base64")
      : Buffer.from(value.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_m: string, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))), "binary");
    return bytes.toString(charset.toLowerCase() === "utf-8" ? "utf8" : "latin1");
  });
}

function emailFromAddress(input: string) {
  const angle = /<([^>]+)>/.exec(input)?.[1];
  const plain = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.exec(input)?.[0];
  return angle ?? plain;
}

function mailEvent(args: {
  intakeId?: string;
  mailUid: string;
  fromEmail?: string;
  subject?: string;
  csvFileName?: string;
  orderId?: string;
  scanId?: string;
  status: MailIntakeCreatedEvent["payload"]["status"];
  reason?: MailIntakeCreatedEvent["payload"]["reason"];
}): MailIntakeCreatedEvent {
  return {
    event_type: "mail_intake_created",
    business_id: "commercefix",
    created_at: new Date().toISOString(),
    payload: {
      intake_id: args.intakeId ?? `mail_${randomUUID()}`,
      mail_uid: args.mailUid,
      from_email: args.fromEmail,
      subject: args.subject,
      csv_file_name: args.csvFileName,
      order_id: args.orderId,
      scan_id: args.scanId,
      status: args.status,
      reason: args.reason
    }
  };
}

async function readCheckpoint(filePath: string): Promise<{ processedUids: string[] }> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as { processedUids?: string[] };
    return { processedUids: Array.isArray(parsed.processedUids) ? parsed.processedUids : [] };
  } catch {
    return { processedUids: [] };
  }
}

async function writeCheckpoint(filePath: string, checkpoint: { processedUids: string[] }) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

function compareNumericStrings(a: string, b: string) {
  return Number(a) - Number(b);
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
