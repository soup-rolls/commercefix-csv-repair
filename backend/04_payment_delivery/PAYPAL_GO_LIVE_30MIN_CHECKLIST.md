# CommerceFix PayPal Go-Live Checklist

Last updated: 2026-06-26

## Current State

PayPal is still under review. CommerceFix should run in reservation mode:

- Free scan works in the browser.
- Paid files remain locked.
- Users can reserve a repair by emailing a CSV request with subject `CommerceFix CSV Request`.
- IMAP intake may create pending orders, but it must not mark orders as paid.

## Inputs Needed After PayPal Approval

Do not paste secrets into chat, Markdown, screenshots, or frontend files.

Required server-only values:

- `PAYPAL_ENV=live`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
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

1. Add the live PayPal credentials to the server environment only.
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
9. Confirm the delivery email contains the zip package with:
   - `fixed_import_safe.csv`
   - `seo_patch_only.csv`
   - `error_report.xlsx`
   - `before_after_preview.html`
10. Update homepage CTA from reservation mode to hosted checkout mode.

## Do Not Automate

- Refunds
- Disputes
- Customer file deletion
- Shopify import
- Shopify login/API access
- SEO ranking claims

## Fallback If PayPal Still Blocks

Keep reservation mode live and use one of these manual payment paths:

- PayPal invoice
- Wise payment request
- Stripe Payment Link, if available
- Lemon Squeezy checkout, if available

Manual payments must be recorded as `manual_payment_confirmed` before any paid file delivery.
