# CommerceFix Refund And Failure Path

## Human Confirmation Required

These actions must not be fully automated:

- refunds
- deleting customer files
- price changes
- promising Shopify import success
- promising SEO ranking outcomes
- sending dispute or complaint messages

## Delivery Failure

Use `delivery_failed` when:

- repair package generation fails
- email delivery fails
- payment succeeds but files cannot be created
- generated package fails QA

## Failure Payload

```json
{
  "event_type": "delivery_failed",
  "business_id": "commercefix",
  "payload": {
    "scan_id": "scan_001",
    "order_id": "ord_001",
    "reason": "repair_generation_failed",
    "customer_visible_message": "Your repair package needs manual review before delivery."
  }
}
```

## Refund Path

1. Mark delivery as `qa_required` or `failed`.
2. Review the original CSV and generated package.
3. Decide between regeneration, manual explanation, or refund.
4. Only after human approval, trigger refund through payment provider.
