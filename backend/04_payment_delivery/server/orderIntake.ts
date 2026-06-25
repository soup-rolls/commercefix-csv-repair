import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { analyzeCsvText } from "../../02_repair_engine/src/repairEngine";
import { writeOrder } from "./orderStore";
import type { AutomationConfig, CommerceFixPlan, StoredOrder } from "./automationTypes";

const PLAN_LIMITS: Record<CommerceFixPlan, number> = {
  "Repair Lite": 2000,
  "Repair Pro": 10000
};

export async function createPendingOrder(args: {
  config: AutomationConfig;
  csvText: string;
  originalFileName: string;
  plan: CommerceFixPlan;
  payerEmail?: string;
}) {
  const { internal } = analyzeCsvText(args.csvText, args.originalFileName);
  const rowLimit = PLAN_LIMITS[args.plan];
  if (internal.rowCount > rowLimit) {
    throw new Error(`row_limit_exceeded:${internal.rowCount}:${rowLimit}`);
  }

  const scanId = `${args.plan === "Repair Lite" ? "repair_lite" : "repair_pro"}_${randomUUID()}`;
  const orderId = `cf_${randomUUID()}`;
  await mkdir(args.config.csvStorageDir, { recursive: true });
  const csvStoragePath = path.join(args.config.csvStorageDir, `${orderId}_${safeUploadName(args.originalFileName)}`);
  await writeFile(csvStoragePath, args.csvText, "utf8");

  const order: StoredOrder = {
    business_id: "commercefix",
    scan_id: scanId,
    order_id: orderId,
    plan: args.plan,
    payer_email: args.payerEmail,
    amount: args.plan === "Repair Lite" ? args.config.paypalLitePrice : args.config.paypalProPrice,
    currency: args.config.paypalCurrency,
    payment_provider: "paypal",
    payment_status: "pending",
    csv_storage_path: csvStoragePath,
    original_file_name: args.originalFileName,
    created_at: new Date().toISOString()
  };

  await writeOrder(args.config.orderStorageDir, order);
  return order;
}

function safeUploadName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "upload.csv";
}
