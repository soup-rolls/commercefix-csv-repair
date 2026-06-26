# CommerceFix Render Storage Runbook

Last updated: 2026-06-26

## Current Free-Plan Mode

CommerceFix can run on Render Free with temporary storage:

- orders: `/tmp/commercefix/orders`
- uploads: `/tmp/commercefix/uploads`
- packages: `/tmp/commercefix/packages`

This is enough for smoke tests and low-risk checkout validation, but it is not durable. A service restart, redeploy, or instance replacement can clear pending orders, uploaded CSV files, and generated zip packages.

## Production Requirement

Before paid traffic, use one durable storage path:

1. Render Disk mounted at `/var/data`, then set:
   - `ORDER_STORAGE_DIR=/var/data/orders`
   - `CSV_STORAGE_DIR=/var/data/uploads`
   - `PACKAGE_STORAGE_DIR=/var/data/packages`
   - `IMAP_CHECKPOINT_PATH=/var/data/imap-checkpoint.json`
2. Or move orders to a database and files to object storage.

The current server automatically falls back from unwritable `/var/data` to `/tmp/commercefix` so free deploys do not crash.

## Retention

`PACKAGE_RETENTION_HOURS` controls download availability. Default: `72`.

Expired downloads return:

```json
{
  "error": "download_expired"
}
```

## Status Checks

Use:

```text
GET /api/commercefix/runtime-check
GET /api/commercefix/order/<order_id>
GET /api/commercefix/failures
```

Do not expose storage paths, package paths, customer CSV content, PayPal secrets, or SMTP secrets in public responses.
