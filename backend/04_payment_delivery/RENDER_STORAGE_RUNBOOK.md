# CommerceFix Render Storage Runbook

Last updated: 2026-07-01

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

## Current Verified Status

As of 2026-07-01, production runtime check reports:

```json
{
  "storage": {
    "orders": "render_tmp",
    "uploads": "render_tmp",
    "packages": "render_tmp"
  },
  "storage_warning": "temporary_storage_redeploy_can_clear_pending_orders"
}
```

Analytics summary also reports:

```json
{
  "storage": {
    "kind": "render_tmp",
    "persistent": false
  }
}
```

This means analytics events, pending orders, uploaded CSVs, and generated packages may reset after Render restarts or redeploys.

## Before Real Paid Traffic

Do not rely on `render_tmp` for real customers.

Minimum production-safe path:

1. Add a Render Disk to the `commercefix-backend` service.
2. Mount it at `/var/data`.
3. Keep these env vars:
   - `ORDER_STORAGE_DIR=/var/data/orders`
   - `CSV_STORAGE_DIR=/var/data/uploads`
   - `PACKAGE_STORAGE_DIR=/var/data/packages`
   - `IMAP_CHECKPOINT_PATH=/var/data/imap-checkpoint.json`
4. Redeploy.
5. Verify:

```text
GET /api/commercefix/runtime-check
```

Expected:

```json
{
  "storage": {
    "orders": "render_disk",
    "uploads": "render_disk",
    "packages": "render_disk"
  }
}
```

And:

```text
GET /api/commercefix/analytics-summary
```

Expected:

```json
{
  "storage": {
    "kind": "render_disk",
    "persistent": true
  }
}
```

## Decision Rule

Stay on temporary storage only while all are true:

- No real paid customer has uploaded a CSV.
- PayPal flow is still being smoke-tested.
- Analytics is used as a directional signal only.
- Manual retry is acceptable if Render restarts.

Upgrade to persistent storage before any of these happen:

- First real paid order.
- First public launch post.
- Directory listing starts sending traffic.
- You cannot afford to lose uploaded CSV files or order states.

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
