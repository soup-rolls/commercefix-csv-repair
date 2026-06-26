import type { AutomationConfig } from "./automationTypes";
import { accessSync, constants, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

loadLocalEnvFiles();

export function loadAutomationConfig(env: Record<string, string | undefined> = process.env): AutomationConfig {
  return {
    paypalEnv: resolvePayPalEnv(env),
    paypalClientId: env.PAYPAL_CLIENT_ID?.trim() ?? "",
    paypalClientSecret: env.PAYPAL_CLIENT_SECRET?.trim() ?? "",
    paypalWebhookId: env.PAYPAL_WEBHOOK_ID?.trim() ?? "",
    paypalCurrency: env.PAYPAL_CURRENCY ?? "USD",
    paypalLitePrice: env.PAYPAL_LITE_PRICE ?? "19.00",
    paypalProPrice: env.PAYPAL_PRO_PRICE ?? "39.00",
    smtpHost: env.SMTP_HOST ?? "smtp.gmail.com",
    smtpPort: Number(env.SMTP_PORT ?? 587),
    smtpSecure: env.SMTP_SECURE === "true",
    smtpUser: env.SMTP_USER ?? "",
    smtpAppPassword: env.SMTP_APP_PASSWORD ?? "",
    gmailProxyUrl: env.GMAIL_PROXY_URL,
    deliveryFrom: env.DELIVERY_FROM ?? "CommerceFix <shichenghao321@gmail.com>",
    deliveryReplyTo: env.DELIVERY_REPLY_TO ?? "shichenghao321@gmail.com",
    orderStorageDir: writableDir(env.ORDER_STORAGE_DIR ?? "D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/orders", "orders"),
    csvStorageDir: writableDir(env.CSV_STORAGE_DIR ?? "D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/uploads", "uploads"),
    packageStorageDir: writableDir(env.PACKAGE_STORAGE_DIR ?? "D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/packages", "packages"),
    downloadBaseUrl: env.DOWNLOAD_BASE_URL,
    packageRetentionHours: Number(env.PACKAGE_RETENTION_HOURS ?? 72),
    publicBaseUrl: env.PUBLIC_BASE_URL ?? env.SITE_URL ?? "http://127.0.0.1:8787",
    serverPort: Number(env.PORT ?? env.COMMERCEFIX_SERVER_PORT ?? 8787),
    imapHost: env.IMAP_HOST ?? "imap.gmail.com",
    imapPort: Number(env.IMAP_PORT ?? 993),
    imapSecure: env.IMAP_SECURE !== "false",
    imapUser: env.IMAP_USER ?? env.SMTP_USER ?? "",
    imapAppPassword: env.IMAP_APP_PASSWORD ?? env.SMTP_APP_PASSWORD ?? "",
    imapMailbox: env.IMAP_MAILBOX ?? "INBOX",
    imapSearchQuery: env.IMAP_SEARCH_QUERY ?? 'SUBJECT "CommerceFix CSV Request"',
    imapMaxMessages: Number(env.IMAP_MAX_MESSAGES ?? 10),
    imapDefaultPlan: env.IMAP_DEFAULT_PLAN === "Repair Lite" ? "Repair Lite" : "Repair Pro",
    imapCheckpointPath: writableFile(
      env.IMAP_CHECKPOINT_PATH ?? "D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/imap-checkpoint.json",
      "imap-checkpoint.json"
    )
  };
}

function resolvePayPalEnv(env: Record<string, string | undefined>): "live" | "sandbox" {
  if (env.PAYPAL_WEBHOOK_ID?.trim() === "9T2439849D580342D") return "live";
  if (env.PAYPAL_ENV?.trim() === "live") return "live";
  if (env.NODE_ENV === "production" && env.ALLOW_PAYPAL_SANDBOX !== "true") return "live";
  if (env.PAYPAL_ENV?.trim() === "sandbox") return "sandbox";
  return "sandbox";
}

function writableDir(input: string, fallbackName: string) {
  if (!input.startsWith("/var/data")) return input;
  try {
    mkdirSync(input, { recursive: true });
    accessSync(input, constants.W_OK);
    return input;
  } catch {
    return path.posix.join("/tmp/commercefix", fallbackName);
  }
}

function writableFile(input: string, fallbackName: string) {
  if (!input.startsWith("/var/data")) return input;
  const parent = path.posix.dirname(input);
  try {
    mkdirSync(parent, { recursive: true });
    accessSync(parent, constants.W_OK);
    return input;
  } catch {
    return path.posix.join("/tmp/commercefix", fallbackName);
  }
}

function loadLocalEnvFiles() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "01_app", ".env.local"),
    path.resolve(process.cwd(), "01_app", ".env")
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    const raw = readFileSync(filePath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = unquote(trimmed.slice(eq + 1).trim());
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

function unquote(input: string) {
  if ((input.startsWith('"') && input.endsWith('"')) || (input.startsWith("'") && input.endsWith("'"))) {
    return input.slice(1, -1);
  }
  return input;
}

export function assertServerSecrets(config: AutomationConfig) {
  const missing = [
    ["PAYPAL_CLIENT_ID", config.paypalClientId],
    ["PAYPAL_CLIENT_SECRET", config.paypalClientSecret],
    ["PAYPAL_WEBHOOK_ID", config.paypalWebhookId],
    ["SMTP_USER", config.smtpUser],
    ["SMTP_APP_PASSWORD", config.smtpAppPassword]
  ].filter(([, value]) => !value);

  if (missing.length > 0) {
    throw new Error(`Missing server automation secrets: ${missing.map(([key]) => key).join(", ")}`);
  }
}
