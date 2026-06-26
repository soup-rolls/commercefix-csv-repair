# CommerceFix Automated Fulfillment Runbook

Generated: 2026-06-25

## Goal

Build the full automated loop:

```text
CSV intake -> pending order -> PayPal checkout -> verified PayPal capture webhook
-> paid repair package generation -> email delivery -> event log
```

CommerceFix remains a Shopify CSV Repair File Generator. It does not log into Shopify, call Shopify APIs, automatically import products, or promise SEO rankings.

## Current Implementation

Server-side modules:

- `server/automationConfig.ts`: loads server-only environment variables.
- `server/automationTypes.ts`: shared order, payment, delivery event types.
- `server/orderIntake.ts`: stores uploaded CSV and creates a pending order.
- `server/paypalWebhook.ts`: verifies PayPal webhook signature and maps completed captures to `payment_paid`.
- `server/paypalFulfillmentHandler.ts`: reusable webhook handler.
- `server/fulfillmentService.ts`: reads the order and CSV, generates the zip, sends email, writes event logs.
- `server/emailDelivery.ts`: sends the repair package through SMTP.
- `server/serverRepairPackage.ts`: generates the paid four-file zip in a trusted server context.
- `server/httpServer.ts`: Node HTTP API for upload, checkout creation, PayPal webhook, download, and failures.
- `server/imapClient.ts`: minimal secure IMAP client for Gmail App Password checks and constrained message fetches.
- `server/mailIntake.ts`: optional email intake that creates pending orders from CSV attachments. It never unlocks paid files.

## HTTP API

Local run:

```bash
npm run server:dev
```

Endpoints:

```text
GET  /health
POST /api/commercefix/upload
POST /api/commercefix/checkout
POST /api/commercefix/paypal/webhook
GET  /api/commercefix/download/:order_id
GET  /api/commercefix/failures
```

The frontend or future workbench should call `/upload` with CSV text, original file name, plan, and optional payer email. The response returns a pending `order_id` and `scan_id`. Then call `/checkout` with `order_id`; the server creates the PayPal hosted checkout order and returns `checkout_url`.

## Required Secrets

Use environment variables only. Do not put secrets in source files, Markdown files, frontend `.env`, screenshots, or chat logs.

```text
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_APP_PASSWORD=
GMAIL_PROXY_URL=auto
DELIVERY_FROM=
DELIVERY_REPLY_TO=
ORDER_STORAGE_DIR=D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/orders
CSV_STORAGE_DIR=D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/uploads
PACKAGE_STORAGE_DIR=D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/packages
DOWNLOAD_BASE_URL=
PUBLIC_BASE_URL=
COMMERCEFIX_SERVER_PORT=

# Optional IMAP intake. Payment authority remains PayPal only.
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=
IMAP_APP_PASSWORD=
IMAP_MAILBOX=INBOX
IMAP_SEARCH_QUERY=SUBJECT "CommerceFix CSV Request"
IMAP_MAX_MESSAGES=10
IMAP_DEFAULT_PLAN=Repair Pro
IMAP_CHECKPOINT_PATH=D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/imap-checkpoint.json
```

For Gmail, use a Gmail App Password or OAuth. Do not use the mailbox account password.

## PayPal Event Rule

Only this event can unlock paid generation:

```text
PAYMENT.CAPTURE.COMPLETED
```

The webhook must pass PayPal signature verification through:

```text
POST /v1/notifications/verify-webhook-signature
```

Ignored events:

- `CHECKOUT.ORDER.APPROVED`
- pending, denied, refunded, disputed, or unsigned events
- any event missing order id, capture id, payer email, amount, currency, or CommerceFix `custom_id`

## Delivery Output

Every successful delivery sends one zip package containing:

- `fixed_import_safe.csv`
- `seo_patch_only.csv`
- `error_report.xlsx`
- `before_after_preview.html`

The order JSON is updated with:

- `payment_status`
- `provider_capture_id`
- `paid_at`
- `delivered_at`
- `package_path`
- `download_url` when configured

Event logs are written under:

```text
<ORDER_STORAGE_DIR>/events
```

If SMTP is unavailable after payment, the server still keeps the generated package path on the order and emits:

```text
delivery_failed / email_delivery_failed
```

This is a recoverable delivery failure, not a repair generation failure. The operator can use `/api/commercefix/download/:order_id` or re-run email delivery after fixing the mail provider.

## Optional IMAP Intake Rule

IMAP is only a customer intake channel. It can read constrained mailbox matches, extract CSV attachments, create pending orders, and record `mail_intake_created`.

IMAP must not:

- mark an order as paid
- generate the four paid files
- send a repair package
- scan the whole personal inbox without a strict mailbox/search query

Commands:

```bash
npm run imap:check
npm run imap:dry-run
npm run imap:intake
```

Use `imap:dry-run` before `imap:intake` when changing the Gmail label, mailbox, or search query.

## Failure Path

Automated failures should emit `delivery_failed` and stop. Human review is still required for:

- refunds
- deleting customer files
- payment disputes
- failed package QA
- customer complaints

## Validation Commands

```bash
npm run build
npm run selftest
npm run fulfillment:check
npm run fulfillment:dry-run
npm run server:dry-run
npm audit --audit-level=moderate
```

`GMAIL_PROXY_URL=auto` reads the current Windows system proxy at runtime. This matters on networks where Node does not automatically use the Windows proxy and direct Gmail SMTP/IMAP ports are blocked.

`smtp:check`, `smtp:verify`, and `imap:check` require local Gmail App Password configuration and must not print the password value.

## Remaining Integration Work

- Deploy `server/httpServer.ts` to a Node-capable host or adapt the handlers to the future workbench backend.
- Configure PayPal webhook URL in the PayPal dashboard.
- Add PayPal live/sandbox client credentials after PayPal approval.
- Add retention cleanup for CSV and package directories.
- Run one sandbox payment from PayPal to confirm end-to-end delivery.
