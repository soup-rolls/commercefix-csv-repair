import { fulfillPaidOrder } from "./fulfillmentService";
import { paymentPaidEventFromPayPal, verifyPayPalWebhookSignature } from "./paypalWebhook";
import type { AutomationConfig, DeliveryFailedEvent, PayPalWebhookHeaders } from "./automationTypes";

export async function handlePayPalWebhook(args: {
  config: AutomationConfig;
  headers: PayPalWebhookHeaders;
  rawBody: string;
}) {
  const signatureOk = await verifyPayPalWebhookSignature(args);
  if (!signatureOk) {
    return failureFromRawBody(args.rawBody, "paypal_signature_invalid", "Payment verification failed. No repair files were generated.");
  }

  const paidEvent = paymentPaidEventFromPayPal(args.rawBody);
  if (!paidEvent) {
    return {
      ignored: true,
      reason: "not_payment_capture_completed"
    };
  }

  return fulfillPaidOrder(args.config, paidEvent);
}

function failureFromRawBody(
  rawBody: string,
  reason: DeliveryFailedEvent["payload"]["reason"],
  customerVisibleMessage: string
): DeliveryFailedEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = {};
  }

  const resource = typeof parsed === "object" && parsed && "resource" in parsed ? parsed.resource : {};
  const scanId =
    typeof resource === "object" && resource && "custom_id" in resource && typeof resource.custom_id === "string"
      ? resource.custom_id
      : "unknown";
  const orderId =
    typeof resource === "object" &&
    resource &&
    "supplementary_data" in resource &&
    typeof resource.supplementary_data === "object" &&
    resource.supplementary_data &&
    "related_ids" in resource.supplementary_data &&
    typeof resource.supplementary_data.related_ids === "object" &&
    resource.supplementary_data.related_ids &&
    "order_id" in resource.supplementary_data.related_ids &&
    typeof resource.supplementary_data.related_ids.order_id === "string"
      ? resource.supplementary_data.related_ids.order_id
      : "unknown";

  return {
    event_type: "delivery_failed",
    business_id: "commercefix",
    created_at: new Date().toISOString(),
    payload: {
      scan_id: scanId,
      order_id: orderId,
      reason,
      customer_visible_message: customerVisibleMessage
    }
  };
}
