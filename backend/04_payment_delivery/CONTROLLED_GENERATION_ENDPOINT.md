# Controlled Repair Generation Endpoint

The browser free scan is not a production paywall. Production repair package generation must happen behind a trusted `payment_paid` event.

## Required Endpoint

```text
POST /api/commercefix/repair-packages
```

## Preconditions

- `payment_status` is `paid`
- `order_id` exists
- `scan_id` exists
- uploaded CSV is available in temporary storage
- plan row limit is valid

## Request

```json
{
  "business_id": "commercefix",
  "scan_id": "scan_001",
  "order_id": "ord_001",
  "plan": "Repair Pro"
}
```

## Response

```json
{
  "business_id": "commercefix",
  "scan_id": "scan_001",
  "order_id": "ord_001",
  "delivery_status": "ready",
  "download_url": "https://example.com/downloads/pkg_001",
  "files": [
    "fixed_import_safe.csv",
    "seo_patch_only.csv",
    "error_report.xlsx",
    "before_after_preview.html"
  ]
}
```

## Security Boundary

The frontend may call checkout and display free scan results. It must not generate or download the full repair package.

The package generator may reuse `04_payment_delivery/server/serverRepairPackage.ts`, but that module must run in a server, worker, or trusted automation context. It must not be imported by `01_app/src/App.tsx`.

Shared scan logic lives in `02_repair_engine/src`. The frontend may use the free scan functions; paid package generation stays in `04_payment_delivery/server`.

## Failure States

- `payment_required`
- `scan_not_found`
- `csv_expired`
- `row_limit_exceeded`
- `repair_generation_failed`
- `qa_required`
