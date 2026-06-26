import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

loadLocalEnvFiles();
const siteUrl = normalizeSiteUrl(process.env.SITE_URL ?? "https://soup-rolls.github.io/commercefix-csv-repair");
const basePath = new URL(siteUrl).pathname.replace(/\/$/, "");
const indexNowKey = process.env.INDEXNOW_KEY ?? "a72c9b5f0e134d76a8b4c2f1930dce61";
const supportEmail = process.env.SUPPORT_EMAIL ?? process.env.DELIVERY_REPLY_TO ?? process.env.SMTP_USER ?? "shichenghao321@gmail.com";
const apiBaseUrl = process.env.VITE_COMMERCEFIX_API_BASE_URL ?? process.env.COMMERCEFIX_API_BASE_URL ?? "https://commercefix-backend.onrender.com";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const publicDir = path.join(projectRoot, "01_app", "public");

async function main() {
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, "privacy.html"), page("Privacy Policy", "How CommerceFix handles browser-based Shopify CSV scans and paid repair delivery data.", privacy()), "utf8");
  await writeFile(path.join(publicDir, "terms.html"), page("Terms of Service", "CommerceFix service scope, paid repair files, refund boundaries, and Shopify CSV repair limitations.", terms()), "utf8");
  await writeFile(path.join(publicDir, "contact.html"), page("Contact CommerceFix", "Support path for Shopify CSV repair checkout, delivery, refund review, and file-scope questions.", contact()), "utf8");
  await writeFile(path.join(publicDir, "sample-report.html"), page("Sample Repair Package", "Preview the CommerceFix paid package: fixed_import_safe.csv, seo_patch_only.csv, error_report.xlsx, and before_after_preview.html.", sampleReport()), "utf8");
  await writeFile(path.join(publicDir, "checkout.html"), page("Repair Checkout Status", "Check CommerceFix payment, repair package, and delivery status after PayPal checkout.", checkout(), false), "utf8");
  await writeFile(path.join(publicDir, "404.html"), page("Page Not Found", "The requested CommerceFix page was not found.", notFound(), false), "utf8");
  await writeFile(path.join(publicDir, "health.txt"), "ok\n", "utf8");
  await writeFile(path.join(publicDir, `${indexNowKey}.txt`), indexNowKey, "utf8");
  console.log(`Generated CommerceFix support pages and IndexNow key ${indexNowKey}`);
}

function page(title: string, description: string, body: string, index = true) {
  const canonicalPath = title === "Page Not Found" ? "/404.html" : `/${slugForTitle(title)}.html`;
  const canonical = `${siteUrl}${canonicalPath}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} | CommerceFix</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="${index ? "index,follow" : "noindex"}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" type="image/svg+xml" href="${sitePath("/favicon.svg")}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="CommerceFix" />
    <meta property="og:title" content="${title} | CommerceFix" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <script type="application/ld+json">
      ${JSON.stringify(webPageJsonLd(title, description, canonical))}
    </script>
    <style>${css()}</style>
  </head>
  <body>
    <header>
      <a href="${sitePath("/")}">CommerceFix</a>
      <span>Shopify CSV Repair File Generator</span>
      <a class="button" href="${sitePath("/#scan")}">Scan CSV</a>
    </header>
    <main>
      <section class="panel">
        <p class="eyebrow">File-in / file-out repair tool</p>
        <h1>${title}</h1>
        ${body}
      </section>
    </main>
    <footer>
      <a href="${sitePath("/privacy.html")}">Privacy</a>
      <a href="${sitePath("/terms.html")}">Terms</a>
      <a href="${sitePath("/contact.html")}">Contact</a>
      <a href="${sitePath("/sample-report.html")}">Sample package</a>
      <a href="${sitePath("/checkout.html")}">Order status</a>
    </footer>
  </body>
</html>
`;
}

function privacy() {
  return `
<p>CommerceFix scans Shopify product CSV files in the browser for the free preview. The free preview is limited to issue counts, issue categories, and the first five examples.</p>
<h2>What the tool handles</h2>
<ul>
  <li>Shopify product CSV files selected by the user.</li>
  <li>CSV headers and rows needed to show the limited preview.</li>
  <li>Checkout and delivery metadata only when the user starts a paid repair flow.</li>
</ul>
<h2>What CommerceFix does not need</h2>
<ul>
  <li>No Shopify login.</li>
  <li>No Shopify API token.</li>
  <li>No automatic import into Shopify.</li>
  <li>No permanent storage of full CSV files unless a paid delivery workflow explicitly requires it.</li>
</ul>
<p>Checkout metadata is used to create a PayPal-hosted payment session and link a verified payment event to the uploaded CSV.</p>
<p>Paid repair generation runs behind a trusted payment event and controlled generation endpoint.</p>
`;
}

function terms() {
  return `
<p>CommerceFix sells downloadable Shopify-ready repair files, not SEO ranking guarantees or Shopify account services.</p>
<h2>Scope</h2>
<ul>
  <li>Free scan: issue counts, categories, and first five examples.</li>
  <li>Repair Lite: report and SEO patch CSV for eligible row counts.</li>
  <li>Repair Pro: import-safe repair package for eligible row counts.</li>
</ul>
<h2>Paid files</h2>
<ul>
  <li><code>fixed_import_safe.csv</code></li>
  <li><code>seo_patch_only.csv</code></li>
  <li><code>error_report.xlsx</code></li>
  <li><code>before_after_preview.html</code></li>
</ul>
<h2>Boundaries</h2>
<ul>
  <li>CommerceFix is not Shopify and is not an official Shopify app.</li>
  <li>It does not log into stores, call the Shopify API, or upload products automatically.</li>
  <li>It does not guarantee search rankings, traffic, or marketplace outcomes.</li>
</ul>
<h2>Hosted payment mode</h2>
<p>Hosted PayPal checkout is the payment authority. No paid files are delivered until a verified capture event is received by the CommerceFix backend.</p>
<h2>Refund review</h2>
<p>Refunds are reviewed manually for duplicate payments, failed delivery, or clear file-generation failure. CSV content disputes, ranking outcomes, and Shopify import decisions require human review and are not automatically refunded.</p>
`;
}

function contact() {
  return `
<p>Use this page as the support path for checkout questions, delivery issues, refund review, or CSV repair scope questions.</p>
<h2>Support email</h2>
<p><a href="mailto:${supportEmail}">${supportEmail}</a></p>
<h2>Support details to include</h2>
<ul>
  <li>Order email or payment reference.</li>
  <li>Selected plan: Repair Lite or Repair Pro.</li>
  <li>CSV row count and issue summary if available.</li>
  <li>Whether the issue is checkout, generation, delivery, or file content.</li>
</ul>
<p>For payment receipts, delivery failures, or CSV edge cases, include the order id shown on the checkout status page.</p>
`;
}

function sampleReport() {
  return `
<p>This sample shows the paid output shape. It is not a full repaired customer CSV, but it mirrors the files delivered after a verified payment event.</p>
<div class="notice">Paid delivery is file-in / file-out: upload a Shopify product CSV, unlock repair generation after payment, receive a zip package.</div>
<h2>Package contents</h2>
<table>
  <tr><th>File</th><th>What it contains</th><th>Who needs it</th></tr>
  <tr><td><code>fixed_import_safe.csv</code></td><td>Shopify-ready CSV with safe repairs for import risks, handles, options, image URL format, and metadata columns.</td><td>Repair Pro</td></tr>
  <tr><td><code>seo_patch_only.csv</code></td><td>SEO title, SEO description, and image alt text patch data without changing unrelated product fields.</td><td>Lite + Pro</td></tr>
  <tr><td><code>error_report.xlsx</code></td><td>Row, field, issue category, severity, and suggested repair for review before import.</td><td>Lite + Pro</td></tr>
  <tr><td><code>before_after_preview.html</code></td><td>Inspectable before/after repair preview for the changed rows and fields.</td><td>Repair Pro</td></tr>
</table>
<h2>Example row-level repair</h2>
<table>
  <tr><th>Row</th><th>Field</th><th>Before</th><th>After</th></tr>
  <tr><td>14</td><td><code>Handle</code></td><td>empty</td><td><code>ceramic-mug</code></td></tr>
  <tr><td>14</td><td><code>Image Src</code></td><td><code>cdn.example.com/mug.jpg</code></td><td><code>https://cdn.example.com/mug.jpg</code></td></tr>
  <tr><td>14</td><td><code>Metafield: title_tag [string]</code></td><td>empty</td><td><code>Ceramic Mug - Studio Ware</code></td></tr>
</table>
<h2>Free preview limit</h2>
<p>The free scan proves the file is worth repairing. It does not export complete repaired files.</p>
<p><a class="button" href="${sitePath("/#scan")}">Scan your Shopify CSV</a></p>
`;
}

function checkout() {
  const mailSubject = encodeURIComponent("CommerceFix CSV Request");
  const mailBody = encodeURIComponent([
    "Plan: Repair Pro or Repair Lite",
    "Shopify CSV row count:",
    "Main problem: import errors / SEO metadata / images / variants",
    "",
    "Attach your Shopify product CSV to this email.",
    "Do not include Shopify passwords, API tokens, cookies, or store admin access.",
    "",
    "I understand paid repair files are delivered only after payment is confirmed."
  ].join("\n"));
  const mailto = `mailto:${supportEmail}?subject=${mailSubject}&body=${mailBody}`;

  return `
<p>Use this page after PayPal checkout to verify payment, package generation, delivery status, and download availability.</p>
<div id="order-status" class="statusPanel" data-api-base="${escapeHtml(apiBaseUrl)}">
  <strong>Order status</strong>
  <p id="status-copy">Looking for an order id in the URL.</p>
  <dl id="status-fields"></dl>
  <p id="download-row"></p>
  <p id="action-row"></p>
</div>
<div class="notice">Paid files unlock only after a verified PayPal payment event. If the package is not ready yet, keep this order id and check again after a few minutes.</div>
<h2>Fallback support</h2>
<p>If checkout or delivery fails, send your order id and PayPal receipt to <a href="mailto:${supportEmail}">${supportEmail}</a>. If you have not uploaded a CSV yet, start from the scanner first.</p>
<p><a class="button" href="${mailto}">Email support</a> <a class="button secondary" href="${sitePath("/sample-report.html")}">View sample package</a></p>
<h2>Repair plans</h2>
<table>
  <tr><th>Plan</th><th>Price</th><th>Output</th></tr>
  <tr><td>Repair Lite</td><td>$19</td><td><code>seo_patch_only.csv</code> + <code>error_report.xlsx</code>, up to 2,000 rows.</td></tr>
  <tr><td>Repair Pro</td><td>$39</td><td>Full four-file repair package, up to 10,000 rows.</td></tr>
</table>
<h2>Payment boundary</h2>
<p>The browser preview does not unlock the paid package. Repair generation and delivery require a verified PayPal capture event.</p>
<p><a class="button" href="${sitePath("/#scan")}">Return to free scan</a></p>
<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var orderId = params.get("order_id");
  var statusCopy = document.getElementById("status-copy");
  var fields = document.getElementById("status-fields");
  var downloadRow = document.getElementById("download-row");
  var actionRow = document.getElementById("action-row");
  var panel = document.getElementById("order-status");
  var apiBase = panel.getAttribute("data-api-base").replace(/\\/$/, "");
  var checkoutStatus = params.get("status");

  function setFields(rows) {
    fields.innerHTML = rows.map(function (row) {
      return "<dt>" + escapeHtml(row[0]) + "</dt><dd>" + escapeHtml(row[1] || "-") + "</dd>";
    }).join("");
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  if (!orderId) {
    statusCopy.textContent = checkoutStatus === "cancelled"
      ? "Checkout was cancelled. No payment was captured and no repair files were generated."
      : "No order id found. Start from the CSV scanner or contact support with your PayPal receipt.";
    return;
  }

  statusCopy.textContent = "Checking order " + orderId + "...";
  fetch(apiBase + "/api/commercefix/order/" + encodeURIComponent(orderId))
    .then(function (response) {
      if (!response.ok) throw new Error("order_status_" + response.status);
      return response.json();
    })
    .then(function (order) {
      var ready = order.package_ready && !order.download_expired;
      if (ready) {
        statusCopy.textContent = "Repair package is ready.";
      } else if (order.download_expired) {
        statusCopy.textContent = "The secure download link has expired. Contact support with this order id.";
      } else if (checkoutStatus === "cancelled") {
        statusCopy.textContent = "Checkout was cancelled. The CSV scan is saved temporarily, but paid files remain locked.";
      } else if (order.payment_status === "paid") {
        statusCopy.textContent = "Payment is confirmed. Package generation or email delivery is still pending.";
      } else {
        statusCopy.textContent = order.customer_visible_message || "Payment is not confirmed yet.";
      }
      setFields([
        ["Order", order.order_id],
        ["Plan", order.plan],
        ["Amount", order.amount ? order.amount + " " + order.currency : ""],
        ["Payment", order.payment_status],
        ["Delivery", order.delivery_status],
        ["Source file", order.original_file_name],
        ["Download expires", order.download_expires_at],
        ["Expected files", (order.expected_files || order.files || []).join(", ")]
      ]);
      downloadRow.innerHTML = ready && order.download_url
        ? '<a class="button" href="' + escapeHtml(order.download_url) + '">Download repair package</a>'
        : "";
      actionRow.innerHTML = !ready && order.next_action === "restart_checkout"
        ? '<button class="button" id="retry-checkout" type="button">Restart hosted checkout</button>'
        : "";
      var retry = document.getElementById("retry-checkout");
      if (retry) {
        retry.addEventListener("click", function () {
          retry.setAttribute("disabled", "disabled");
          retry.textContent = "Opening checkout...";
          fetch(apiBase + "/api/commercefix/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: order.order_id,
              return_url: window.location.origin + window.location.pathname + "?status=paid&order_id=" + encodeURIComponent(order.order_id),
              cancel_url: window.location.origin + window.location.pathname + "?status=cancelled&order_id=" + encodeURIComponent(order.order_id)
            })
          })
            .then(function (response) {
              if (!response.ok) throw new Error("checkout_" + response.status);
              return response.json();
            })
            .then(function (checkout) {
              window.location.assign(checkout.checkout_url);
            })
            .catch(function () {
              retry.removeAttribute("disabled");
              retry.textContent = "Restart hosted checkout";
              statusCopy.textContent = "Could not restart checkout. Return to the scanner or contact support with this order id.";
            });
        });
      }
    })
    .catch(function () {
      statusCopy.textContent = "Could not read this order yet. Save the order id and contact support if it stays unavailable.";
      setFields([["Order", orderId]]);
    });
})();
</script>
`;
}

function notFound() {
  return `
<p>The page was not found. Return to the CommerceFix scanner or open the sitemap.</p>
<p><a class="button" href="${sitePath("/")}">Open scanner</a></p>
`;
}

function css() {
  return `
:root { color: #14201a; background: #eef1ed; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; }
header, footer { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 12px 16px; border-bottom: 1px solid #cfd7ce; background: #fbfcf9; }
footer { border-top: 1px solid #cfd7ce; border-bottom: 0; }
header span { color: #5f6f66; font-size: 13px; }
a { color: #173d30; font-weight: 800; text-decoration: none; }
main { max-width: 920px; margin: 0 auto; padding: 28px 14px 56px; }
.panel { padding: 24px; border: 1px solid #cfd7ce; border-radius: 8px; background: #fbfcf9; }
.eyebrow { color: #617168; font-size: 12px; font-weight: 850; text-transform: uppercase; }
h1, h2, p { margin: 0; letter-spacing: 0; }
h1 { margin-top: 6px; font-size: 32px; line-height: 1.08; }
h2 { margin-top: 24px; font-size: 18px; }
p, li, td, th { color: #42524a; font-size: 15px; line-height: 1.65; }
p { margin-top: 12px; }
ul { margin: 10px 0 0; padding-left: 20px; }
table { width: 100%; margin-top: 12px; border-collapse: collapse; background: #fff; }
td, th { padding: 10px; border: 1px solid #dfe6de; text-align: left; vertical-align: top; }
code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; color: #173d30; }
.button { display: inline-flex; align-items: center; justify-content: center; min-height: 34px; padding: 0 12px; border: 0; border-radius: 6px; background: #1f6b55; color: #fff; cursor: pointer; font-weight: 800; }
.button:disabled { cursor: wait; opacity: 0.72; }
.button.secondary { margin-left: 8px; background: #1d3d63; }
.notice { margin-top: 14px; padding: 12px; border: 1px solid #d8c68f; border-radius: 8px; background: #fff9e9; color: #5f4b20; font-size: 14px; line-height: 1.55; }
.statusPanel { margin-top: 16px; padding: 16px; border: 1px solid #b9c8c0; border-radius: 8px; background: #f7faf6; }
.statusPanel strong { display: block; font-size: 16px; }
dl { display: grid; grid-template-columns: minmax(120px, 180px) 1fr; gap: 8px 12px; margin: 14px 0 0; }
dt { color: #617168; font-weight: 800; }
dd { margin: 0; color: #14201a; overflow-wrap: anywhere; }
#status-fields:empty, #download-row:empty, #action-row:empty { display: none; }
`;
}

function slugForTitle(title: string) {
  if (title === "Privacy Policy") return "privacy";
  if (title === "Terms of Service") return "terms";
  if (title === "Contact CommerceFix") return "contact";
  if (title === "Sample Repair Package") return "sample-report";
  if (title === "Repair Checkout Status") return "checkout";
  return "index";
}

function webPageJsonLd(title: string, description: string, canonical: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${title} | CommerceFix`,
    description,
    url: canonical,
    publisher: {
      "@type": "Organization",
      name: "CommerceFix"
    }
  };
}

function normalizeSiteUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function sitePath(pathname: string) {
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (!basePath) return cleanPath;
  if (cleanPath === "/") return `${basePath}/`;
  return `${basePath}${cleanPath}`;
}

function escapeHtml(input: string) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadLocalEnvFiles() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "01_app", ".env.local"),
    path.resolve(process.cwd(), "01_app", ".env"),
    path.resolve(process.cwd(), "..", "01_app", ".env.local")
  ];

  for (const filePath of candidates) {
    try {
      const raw = readTextIfExists(filePath);
      if (!raw) continue;
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = unquote(trimmed.slice(eq + 1).trim());
        if (!(key in process.env)) process.env[key] = value;
      }
    } catch {
      // Local env loading is best-effort for static support pages.
    }
  }
}

function readTextIfExists(filePath: string) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function unquote(input: string) {
  if ((input.startsWith('"') && input.endsWith('"')) || (input.startsWith("'") && input.endsWith("'"))) {
    return input.slice(1, -1);
  }
  return input;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
