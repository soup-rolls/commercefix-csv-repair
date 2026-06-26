# CommerceFix PayPal Go-Live Checklist

Last updated: 2026-06-26

## Current State

PayPal live checkout is connected:

- Free scan works in the browser.
- The frontend points to `https://commercefix-backend.onrender.com`.
- The backend can create PayPal live checkout orders.
- Paid files remain locked until a verified `PAYMENT.CAPTURE.COMPLETED` webhook.
- IMAP intake remains optional and must not mark orders as paid.

## Server-Only Live Inputs

Do not paste secrets into chat, Markdown, screenshots, or frontend files.

Required server-only values:

- `PAYPAL_ENV=live`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID=9T2439849D580342D`
- `PUBLIC_BASE_URL`
- `DOWNLOAD_BASE_URL`
- `SMTP_USER`
- `SMTP_APP_PASSWORD`
- `DELIVERY_FROM`
- `DELIVERY_REPLY_TO`
- `ORDER_STORAGE_DIR`
- `CSV_STORAGE_DIR`
- `PACKAGE_STORAGE_DIR`

## 30-Minute Activation Path

1. Add the live PayPal credentials to the server environment only. Done when runtime check reports configured.
2. Set the PayPal webhook URL to:
   `https://<backend-host>/api/commercefix/paypal/webhook`
3. Run:
   `npm.cmd run fulfillment:check`
4. Run:
   `npm.cmd run fulfillment:dry-run`
5. Start the server and verify:
   `GET /health`
6. Create one test order through the app.
7. Complete one small PayPal payment.
8. Confirm only `PAYMENT.CAPTURE.COMPLETED` unlocks generation.
9. Confirm the status page and delivery email expose the zip package with:
   - `fixed_import_safe.csv`
   - `seo_patch_only.csv`
   - `error_report.xlsx`
   - `before_after_preview.html`
10. Keep homepage CTA in hosted checkout mode.

## Do Not Automate

- Refunds
- Disputes
- Customer file deletion
- Shopify import
- Shopify login/API access
- SEO ranking claims

## Fallback If PayPal Blocks A Customer Payment

Keep hosted checkout live, but use one of these manual payment paths only after the customer reports a failed checkout:

- PayPal invoice
- Wise payment request
- Stripe Payment Link, if available
- Lemon Squeezy checkout, if available

Manual payments must be recorded as `manual_payment_confirmed` before any paid file delivery.

## 2026-06-26 Live App / Webhook Setup

- PayPal Live REST API app created: `CommerceFix`
- Live webhook URL:
  `https://commercefix-backend.onrender.com/api/commercefix/paypal/webhook`
- Live webhook ID:
  `9T2439849D580342D`
- Events tracked in PayPal dashboard:
  `All Events`

Reason for `All Events`: PayPal's event picker was unreliable for selecting only `Payment capture completed` during setup. The CommerceFix backend still only fulfills on `PAYMENT.CAPTURE.COMPLETED`; other events are ignored.
