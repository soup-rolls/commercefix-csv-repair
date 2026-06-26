import "./nodeModulePath";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { loadAutomationConfig } from "./automationConfig";
import { createPendingOrder } from "./orderIntake";
import { readOrder } from "./orderStore";
import { fulfillPaidOrder } from "./fulfillmentService";
import type { PaymentPaidEvent } from "./automationTypes";

const sampleCsv = `Handle,Title,Vendor,Option1 Name,Option1 Value,Image Src,Image Alt Text,Metafield: title_tag [string],Metafield: description_tag [string]
linen-shirt,Linen Shirt,Northline,Size,,https://cdn.example.com/linen-shirt.jpg,,,
travel-tote,Travel Tote,Bright Co,,,https://cdn.example.com/tote.jpg,,,
`;

async function main() {
  const sendEmail = process.argv.includes("--send-email");
  const tmpRoot = path.resolve("D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/simulate-paid");
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(tmpRoot, { recursive: true });

  const config = loadAutomationConfig({
    ...process.env,
    ORDER_STORAGE_DIR: path.join(tmpRoot, "orders"),
    CSV_STORAGE_DIR: path.join(tmpRoot, "uploads"),
    PACKAGE_STORAGE_DIR: path.join(tmpRoot, "packages"),
    DOWNLOAD_BASE_URL: "https://commercefix-backend.onrender.com/api/commercefix/download",
    PUBLIC_BASE_URL: "https://commercefix-backend.onrender.com",
    SMTP_USER: sendEmail ? process.env.SMTP_USER : "",
    SMTP_APP_PASSWORD: sendEmail ? process.env.SMTP_APP_PASSWORD : ""
  });

  const order = await createPendingOrder({
    config,
    csvText: sampleCsv,
    originalFileName: "simulate-paid-shopify-products.csv",
    plan: "Repair Pro",
    payerEmail: sendEmail ? config.deliveryReplyTo : "simulate-paid@example.com"
  });

  const event: PaymentPaidEvent = {
    event_type: "payment_paid",
    business_id: "commercefix",
    created_at: new Date().toISOString(),
    source: "paypal",
    payload: {
      scan_id: order.scan_id,
      order_id: order.order_id,
      payer_email: order.payer_email ?? "simulate-paid@example.com",
      plan: order.plan,
      amount: order.amount,
      currency: order.currency,
      payment_status: "paid",
      provider_capture_id: `SIM_CAPTURE_${Date.now()}`,
      provider_order_id: `SIM_ORDER_${Date.now()}`
    }
  };

  const fulfillment = await fulfillPaidOrder(config, event);
  const updatedOrder = await readOrder(config.orderStorageDir, order.order_id);

  console.log(JSON.stringify({
    ok: fulfillment.event_type === "delivery_sent" || fulfillment.event_type === "delivery_failed",
    mode: sendEmail ? "simulate_paid_with_email" : "simulate_paid_no_email",
    fulfillment_event: fulfillment.event_type,
    failure_reason: fulfillment.event_type === "delivery_failed" ? fulfillment.payload.reason : undefined,
    order_id: order.order_id,
    scan_id: order.scan_id,
    payment_status: updatedOrder?.payment_status,
    package_ready: Boolean(updatedOrder?.package_path),
    delivered_at: updatedOrder?.delivered_at,
    package_path: updatedOrder?.package_path,
    download_url: updatedOrder?.download_url,
    storage_root: tmpRoot
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
