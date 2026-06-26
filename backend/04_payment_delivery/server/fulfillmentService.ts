import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPaidRepairPackageBytes } from "./serverRepairPackage";
import { sendDeliveryFailureAlert, sendRepairPackageEmail } from "./emailDelivery";
import { appendEvent, readOrder, safeFileName, writeOrder } from "./orderStore";
import type { AutomationConfig, DeliveryFailedEvent, DeliverySentEvent, PaymentPaidEvent, StoredOrder } from "./automationTypes";

const PAID_FILES = [
  "fixed_import_safe.csv",
  "seo_patch_only.csv",
  "error_report.xlsx",
  "before_after_preview.html"
];

export async function fulfillPaidOrder(config: AutomationConfig, event: PaymentPaidEvent) {
  await appendEvent(config.orderStorageDir, event);

  const order = await readOrder(config.orderStorageDir, event.payload.order_id);
  if (!order) {
    const failed = deliveryFailed(event, "order_not_found", "Your order was paid, but the matching CSV upload was not found.");
    await recordFailure(config, failed);
    return failed;
  }

  try {
    const paidOrder: StoredOrder = {
      ...order,
      payment_status: "paid",
      payer_email: event.payload.payer_email,
      provider_capture_id: event.payload.provider_capture_id,
      provider_order_id: event.payload.provider_order_id,
      paid_at: event.created_at
    };

    const csvText = await readFile(paidOrder.csv_storage_path, "utf8");
    const packageBytes = await buildPaidRepairPackageBytes(csvText, paidOrder.original_file_name);
    const packagePath = await writePackage(config, paidOrder, packageBytes);
    const downloadUrl = config.downloadBaseUrl ? `${config.downloadBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(paidOrder.order_id)}` : undefined;

    const readyOrder: StoredOrder = {
      ...paidOrder,
      package_path: packagePath,
      download_url: downloadUrl
    };

    try {
      await sendRepairPackageEmail({
        config,
        order: readyOrder,
        packagePath,
        downloadUrl
      });
    } catch {
      await writeOrder(config.orderStorageDir, readyOrder);
      const failed = deliveryFailed(
        event,
        "email_delivery_failed",
        "Your repair package was generated, but email delivery failed. Use the secure download route or contact support with your order id."
      );
      await recordFailure(config, failed);
      return failed;
    }

    const deliveredOrder: StoredOrder = {
      ...readyOrder,
      delivered_at: new Date().toISOString()
    };
    await writeOrder(config.orderStorageDir, deliveredOrder);

    const sent: DeliverySentEvent = {
      event_type: "delivery_sent",
      business_id: "commercefix",
      created_at: deliveredOrder.delivered_at!,
      payload: {
        scan_id: event.payload.scan_id,
        order_id: event.payload.order_id,
        payer_email: event.payload.payer_email,
        delivery_status: "sent",
        package_path: packagePath,
        download_url: downloadUrl,
        files: PAID_FILES
      }
    };
    await appendEvent(config.orderStorageDir, sent);
    return sent;
  } catch (error) {
    const failed = deliveryFailed(
      event,
      isMissingCsvError(error) ? "csv_not_found" : "repair_generation_failed",
      "Your repair package needs manual review before delivery."
    );
    await recordFailure(config, failed);
    return failed;
  }
}

async function writePackage(config: AutomationConfig, order: StoredOrder, bytes: Uint8Array) {
  await mkdir(config.packageStorageDir, { recursive: true });
  const fileName = `${safeFileName(order.order_id)}_${safeFileName(order.scan_id)}_commercefix_repair_package.zip`;
  const packagePath = path.join(config.packageStorageDir, fileName);
  await writeFile(packagePath, bytes);
  return packagePath;
}

function deliveryFailed(
  event: PaymentPaidEvent,
  reason: DeliveryFailedEvent["payload"]["reason"],
  customerVisibleMessage: string
): DeliveryFailedEvent {
  return {
    event_type: "delivery_failed",
    business_id: "commercefix",
    created_at: new Date().toISOString(),
    payload: {
      scan_id: event.payload.scan_id,
      order_id: event.payload.order_id,
      payer_email: event.payload.payer_email,
      reason,
      customer_visible_message: customerVisibleMessage
    }
  };
}

function isMissingCsvError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function recordFailure(config: AutomationConfig, failed: DeliveryFailedEvent) {
  await appendEvent(config.orderStorageDir, failed);
  try {
    await sendDeliveryFailureAlert({ config, event: failed });
  } catch {
    // Alert delivery must not block PayPal webhook acknowledgement.
  }
}
