import { createTransport } from "nodemailer";
import type { AutomationConfig, DeliveryFailedEvent, StoredOrder } from "./automationTypes";
import { resolveGmailProxyUrl } from "./proxySupport";

export async function sendRepairPackageEmail(args: {
  config: AutomationConfig;
  order: StoredOrder;
  packagePath: string;
  downloadUrl?: string;
}) {
  const proxyUrl = resolveGmailProxyUrl(args.config.gmailProxyUrl);
  const transportOptions = {
    host: args.config.smtpHost,
    port: args.config.smtpPort,
    secure: args.config.smtpSecure,
    auth: {
      user: args.config.smtpUser,
      pass: args.config.smtpAppPassword
    }
  } as {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    proxy?: string;
  };
  if (proxyUrl) transportOptions.proxy = proxyUrl;

  const transporter = createTransport(transportOptions);

  const to = args.order.delivery_email ?? args.order.payer_email;
  if (!to) throw new Error("Cannot send delivery email without payer_email or delivery_email.");

  const html = renderDeliveryHtml(args.order, args.downloadUrl);
  const text = renderDeliveryText(args.order, args.downloadUrl);

  await transporter.sendMail({
    from: args.config.deliveryFrom,
    to,
    replyTo: args.config.deliveryReplyTo,
    subject: `CommerceFix repair package for ${args.order.original_file_name}`,
    text,
    html,
    attachments: [
      {
        filename: `commercefix_${args.order.order_id}_repair_package.zip`,
        path: args.packagePath,
        contentType: "application/zip"
      }
    ]
  });
}

export async function sendDeliveryFailureAlert(args: {
  config: AutomationConfig;
  event: DeliveryFailedEvent;
}) {
  if (!args.config.smtpUser || !args.config.smtpAppPassword || !args.config.deliveryReplyTo) return;

  const proxyUrl = resolveGmailProxyUrl(args.config.gmailProxyUrl);
  const transportOptions = {
    host: args.config.smtpHost,
    port: args.config.smtpPort,
    secure: args.config.smtpSecure,
    auth: {
      user: args.config.smtpUser,
      pass: args.config.smtpAppPassword
    }
  } as {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    proxy?: string;
  };
  if (proxyUrl) transportOptions.proxy = proxyUrl;

  const transporter = createTransport(transportOptions);
  await transporter.sendMail({
    from: args.config.deliveryFrom,
    to: args.config.deliveryReplyTo,
    replyTo: args.config.deliveryReplyTo,
    subject: `CommerceFix delivery failed: ${args.event.payload.reason}`,
    text: failureAlertText(args.event),
    html: `<pre>${escapeHtml(failureAlertText(args.event))}</pre>`
  });
}

function failureAlertText(event: DeliveryFailedEvent) {
  return [
      "CommerceFix delivery failed.",
      "",
      `Order: ${event.payload.order_id}`,
      `Scan: ${event.payload.scan_id}`,
      `Reason: ${event.payload.reason}`,
      event.payload.payer_email ? `Payer: ${event.payload.payer_email}` : undefined,
      "",
      event.payload.customer_visible_message
    ].filter(Boolean).join("\n")
}

function renderDeliveryText(order: StoredOrder, downloadUrl?: string) {
  return [
    "Your CommerceFix Shopify CSV repair package is ready.",
    "",
    `Order: ${order.order_id}`,
    `Plan: ${order.plan}`,
    `Source file: ${order.original_file_name}`,
    "",
    "Included files:",
    "- fixed_import_safe.csv",
    "- seo_patch_only.csv",
    "- error_report.xlsx",
    "- before_after_preview.html",
    "",
    downloadUrl ? `Download URL: ${downloadUrl}` : "The repair package is attached to this email.",
    "",
    "Review the files before importing into Shopify. CommerceFix does not log into Shopify, call the Shopify API, automatically import products, or guarantee SEO rankings."
  ].join("\n");
}

function renderDeliveryHtml(order: StoredOrder, downloadUrl?: string) {
  return `<!doctype html>
<html lang="en">
  <body style="font-family:Arial,sans-serif;color:#14201a;line-height:1.5">
    <h1>Your CommerceFix repair package is ready</h1>
    <p><strong>Order:</strong> ${escapeHtml(order.order_id)}</p>
    <p><strong>Plan:</strong> ${escapeHtml(order.plan)}</p>
    <p><strong>Source file:</strong> ${escapeHtml(order.original_file_name)}</p>
    <h2>Included files</h2>
    <ul>
      <li><code>fixed_import_safe.csv</code></li>
      <li><code>seo_patch_only.csv</code></li>
      <li><code>error_report.xlsx</code></li>
      <li><code>before_after_preview.html</code></li>
    </ul>
    ${downloadUrl ? `<p><a href="${escapeHtml(downloadUrl)}">Download repair package</a></p>` : "<p>The repair package is attached to this email.</p>"}
    <p>Review the files before importing into Shopify. CommerceFix does not log into Shopify, call the Shopify API, automatically import products, or guarantee SEO rankings.</p>
  </body>
</html>`;
}

function escapeHtml(input: string) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
