import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DeliveryFailedEvent, DeliverySentEvent, MailIntakeCreatedEvent, PaymentPaidEvent, StoredOrder } from "./automationTypes";

type CommerceFixEvent = PaymentPaidEvent | DeliverySentEvent | DeliveryFailedEvent | MailIntakeCreatedEvent;

export async function readOrder(orderStorageDir: string, orderId: string): Promise<StoredOrder | null> {
  try {
    const raw = await readFile(orderPath(orderStorageDir, orderId), "utf8");
    return JSON.parse(raw) as StoredOrder;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function writeOrder(orderStorageDir: string, order: StoredOrder) {
  await mkdir(orderStorageDir, { recursive: true });
  await writeFile(orderPath(orderStorageDir, order.order_id), `${JSON.stringify(order, null, 2)}\n`, "utf8");
}

export async function findOrderByProviderOrderId(orderStorageDir: string, providerOrderId: string): Promise<StoredOrder | null> {
  try {
    const names = await readdir(orderStorageDir);
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const raw = await readFile(path.join(orderStorageDir, name), "utf8");
      const order = JSON.parse(raw) as StoredOrder;
      if (order.provider_order_id === providerOrderId) return order;
    }
    return null;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function appendEvent(orderStorageDir: string, event: CommerceFixEvent) {
  const eventsDir = path.join(orderStorageDir, "events");
  await mkdir(eventsDir, { recursive: true });
  const stamp = event.created_at.replace(/[:.]/g, "-");
  const orderId = "order_id" in event.payload ? event.payload.order_id : "unknown";
  const fileName = `${stamp}_${orderId}_${event.event_type}.json`;
  await writeFile(path.join(eventsDir, fileName), `${JSON.stringify(event, null, 2)}\n`, "utf8");
}

export function orderPath(orderStorageDir: string, orderId: string) {
  return path.join(orderStorageDir, `${safeFileName(orderId)}.json`);
}

export function safeFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
