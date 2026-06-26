# CommerceFix Payment Event Schema

CommerceFix only generates full repair files after a trusted `payment_paid` event.

## `checkout_started`

```json
{
  "event_type": "checkout_started",
  "business_id": "commercefix",
  "created_at": "2026-06-24T16:00:00+08:00",
  "payload": {
    "scan_id": "scan_001",
    "email": "customer@example.com",
    "plan": "Repair Pro",
    "amount": 39,
    "currency": "USD"
  }
}
```

## Hosted Checkout Config

The scanner UI should redirect to provider-hosted checkout pages, not simulate payment state.

```json
{
  "Repair Lite": {
    "price": 19,
    "env": "VITE_REPAIR_LITE_CHECKOUT_URL"
  },
  "Repair Pro": {
    "price": 39,
    "env": "VITE_REPAIR_PRO_CHECKOUT_URL"
  }
}
```

## `payment_paid`

```json
{
  "event_type": "payment_paid",
  "business_id": "commercefix",
  "created_at": "2026-06-24T16:03:00+08:00",
  "source": "payment_provider",
  "payload": {
    "scan_id": "scan_001",
    "order_id": "ord_001",
    "email": "customer@example.com",
    "plan": "Repair Pro",
    "amount": 39,
    "currency": "USD",
    "payment_status": "paid"
  }
}
```

## `repair_generation_ready`

```json
{
  "event_type": "repair_generation_ready",
  "business_id": "commercefix",
  "created_at": "2026-06-24T16:04:00+08:00",
  "payload": {
    "scan_id": "scan_001",
    "order_id": "ord_001",
    "delivery_status": "ready",
    "files": [
      "fixed_import_safe.csv",
      "seo_patch_only.csv",
      "error_report.xlsx",
      "before_after_preview.html"
    ]
  }
}
```

## Rule

If `payment_status` is not `paid`, generation remains locked.

The frontend must not be treated as the payment authority. Only the payment provider webhook or trusted order service can emit the event that unlocks package generation.

## PayPal Mapping

CommerceFix should treat this PayPal event as the paid trigger:

```text
PAYMENT.CAPTURE.COMPLETED
```

Required PayPal fields to capture:

- `resource.id` -> `provider_capture_id`
- `resource.supplementary_data.related_ids.order_id` -> `provider_order_id` / `order_id`
- `resource.amount.value` -> `amount`
- `resource.amount.currency_code` -> `currency`
- `resource.payer.email_address` -> `payer_email`
- `resource.custom_id` -> `scan_id` and plan metadata

Ignored or non-unlocking events:

- `CHECKOUT.ORDER.APPROVED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.DENIED`
- any webhook with invalid signature

Server files added for the PayPal automation boundary:

- `04_payment_delivery/server/paypalWebhook.ts`
- `04_payment_delivery/server/paypalFulfillmentHandler.ts`
- `04_payment_delivery/server/fulfillmentService.ts`
- `04_payment_delivery/server/emailDelivery.ts`
- `04_payment_delivery/server/orderIntake.ts`
