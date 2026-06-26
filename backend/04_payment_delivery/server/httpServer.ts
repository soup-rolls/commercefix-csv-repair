import "./nodeModulePath";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAutomationConfig } from "./automationConfig";
import { createPendingOrder } from "./orderIntake";
import { appendEvent, readOrder, writeOrder } from "./orderStore";
import { createPayPalCheckout } from "./paypalWebhook";
import type { CommerceFixPlan, PayPalWebhookHeaders } from "./automationTypes";

const config = loadAutomationConfig();

const server = createServer(async (request, response) => {
  try {
    setCors(response);
    if (request.method === "OPTIONS") return sendJson(response, 204, {});

    const url = new URL(request.url ?? "/", config.publicBaseUrl);
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { ok: true, service: "commercefix-automation" });
    }

    if (request.method === "GET" && url.pathname === "/api/commercefix/runtime-check") {
      return sendJson(response, 200, {
        ok: true,
        paypal_env: config.paypalEnv,
        paypal_client_id_configured: Boolean(config.paypalClientId),
        paypal_client_secret_configured: Boolean(config.paypalClientSecret),
        paypal_webhook_id_configured: Boolean(config.paypalWebhookId),
        storage: {
          orders: storageKind(config.orderStorageDir),
          uploads: storageKind(config.csvStorageDir),
          packages: storageKind(config.packageStorageDir)
        }
      });
    }

    if (request.method === "POST" && url.pathname === "/api/commercefix/upload") {
      return await handleUpload(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/commercefix/checkout") {
      return await handleCheckout(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/commercefix/paypal/webhook") {
      return await handleWebhook(request, response);
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/commercefix/download/")) {
      return await handleDownload(url, response);
    }

    if (request.method === "GET" && url.pathname === "/api/commercefix/failures") {
      return await handleFailures(response);
    }

    return sendJson(response, 404, { error: "not_found" });
  } catch (error) {
    return sendJson(response, 500, {
      error: "server_error",
      message: error instanceof Error ? error.message : "Unknown server error"
    });
  }
});

async function handleUpload(request: IncomingMessage, response: ServerResponse) {
  const body = await readJson<{
    csv_text?: string;
    original_file_name?: string;
    plan?: CommerceFixPlan;
    payer_email?: string;
  }>(request);

  if (!body.csv_text || !body.original_file_name) {
    return sendJson(response, 400, { error: "missing_csv_text_or_file_name" });
  }

  const plan = parsePlan(body.plan);
  if (!plan) return sendJson(response, 400, { error: "invalid_plan" });

  const order = await createPendingOrder({
    config,
    csvText: body.csv_text,
    originalFileName: body.original_file_name,
    plan,
    payerEmail: body.payer_email
  });

  await writeOrder(config.orderStorageDir, {
    ...order,
    intake_source: "web_upload"
  });

  return sendJson(response, 201, {
    business_id: "commercefix",
    order_id: order.order_id,
    scan_id: order.scan_id,
    plan: order.plan,
    amount: order.amount,
    currency: order.currency,
    payment_status: order.payment_status
  });
}

async function handleCheckout(request: IncomingMessage, response: ServerResponse) {
  const body = await readJson<{
    order_id?: string;
    return_url?: string;
    cancel_url?: string;
  }>(request);

  if (!body.order_id) return sendJson(response, 400, { error: "missing_order_id" });
  const order = await readOrder(config.orderStorageDir, body.order_id);
  if (!order) return sendJson(response, 404, { error: "order_not_found" });
  if (order.payment_status === "paid") return sendJson(response, 409, { error: "already_paid" });

  const checkout = await createPayPalCheckout({
    config,
    orderId: order.order_id,
    scanId: order.scan_id,
    plan: order.plan,
    amount: order.amount,
    currency: order.currency,
    returnUrl: body.return_url ?? `${config.publicBaseUrl.replace(/\/$/, "")}/checkout.html?status=paid&order_id=${encodeURIComponent(order.order_id)}`,
    cancelUrl: body.cancel_url ?? `${config.publicBaseUrl.replace(/\/$/, "")}/checkout.html?status=cancelled&order_id=${encodeURIComponent(order.order_id)}`
  });

  await writeOrder(config.orderStorageDir, {
    ...order,
    provider_order_id: checkout.providerOrderId
  });

  return sendJson(response, 200, {
    business_id: "commercefix",
    order_id: order.order_id,
    scan_id: order.scan_id,
    provider: "paypal",
    provider_order_id: checkout.providerOrderId,
    checkout_url: checkout.approveUrl,
    status: checkout.status
  });
}

async function handleWebhook(request: IncomingMessage, response: ServerResponse) {
  const rawBody = await readRawBody(request);
  const { handlePayPalWebhook } = await import("./paypalFulfillmentHandler");
  const result = await handlePayPalWebhook({
    config,
    headers: paypalHeaders(request),
    rawBody
  });

  if ("event_type" in result && result.event_type === "delivery_failed" && result.payload.reason === "paypal_signature_invalid") {
    await appendEvent(config.orderStorageDir, result);
  }
  return sendJson(response, 200, result);
}

async function handleDownload(url: URL, response: ServerResponse) {
  const orderId = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  const order = await readOrder(config.orderStorageDir, orderId);
  if (!order) return sendJson(response, 404, { error: "order_not_found" });
  if (order.payment_status !== "paid" || !order.package_path) {
    return sendJson(response, 402, { error: "payment_required" });
  }

  const bytes = await readFile(order.package_path);
  response.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${path.basename(order.package_path)}"`,
    "Cache-Control": "private, max-age=300"
  });
  response.end(bytes);
}

async function handleFailures(response: ServerResponse) {
  const eventsDir = path.join(config.orderStorageDir, "events");
  try {
    const names = await readdir(eventsDir);
    const failed = names.filter((name) => name.endsWith("_delivery_failed.json")).slice(-50);
    return sendJson(response, 200, { failures: failed });
  } catch {
    return sendJson(response, 200, { failures: [] });
  }
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const raw = await readRawBody(request);
  return JSON.parse(raw || "{}") as T;
}

async function readRawBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function paypalHeaders(request: IncomingMessage): PayPalWebhookHeaders {
  return {
    authAlgo: String(request.headers["paypal-auth-algo"] ?? ""),
    certUrl: String(request.headers["paypal-cert-url"] ?? ""),
    transmissionId: String(request.headers["paypal-transmission-id"] ?? ""),
    transmissionSig: String(request.headers["paypal-transmission-sig"] ?? ""),
    transmissionTime: String(request.headers["paypal-transmission-time"] ?? "")
  };
}

function parsePlan(input: unknown): CommerceFixPlan | null {
  if (input === "Repair Lite" || input === "Repair Pro") return input;
  return null;
}

function setCors(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, PayPal-Auth-Algo, PayPal-Cert-Url, PayPal-Transmission-Id, PayPal-Transmission-Sig, PayPal-Transmission-Time");
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function storageKind(input: string) {
  if (input.startsWith("/tmp/commercefix")) return "render_tmp";
  if (input.startsWith("/var/data")) return "render_disk";
  if (/^[A-Za-z]:[\\/]/.test(input)) return "local_windows";
  return "custom";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(config.serverPort, "0.0.0.0", () => {
    console.log(`CommerceFix automation server listening on http://0.0.0.0:${config.serverPort}`);
  });
}

export { server };
