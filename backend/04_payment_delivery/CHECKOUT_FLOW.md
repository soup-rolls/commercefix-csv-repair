# CommerceFix Checkout Flow

Goal: prevent free scan users from receiving paid repair files before payment.

## States

```text
free_scan_created
checkout_started
payment_pending
payment_paid
repair_generation_started
repair_generation_ready
delivery_sent
delivery_failed
```

## Flow

1. User uploads Shopify product CSV.
2. Server intake stores the original CSV in temporary storage and creates a pending CommerceFix order.
3. Free scan returns only:
   - total issue counts
   - issue categories
   - first 5 issue examples
   - first 5 before/after preview rows
   - paid file package list
4. User clicks checkout.
5. Frontend redirects to PayPal hosted checkout URL.
6. PayPal sends webhook after capture.
7. CommerceFix verifies PayPal webhook signature.
8. Only `PAYMENT.CAPTURE.COMPLETED` maps to `payment_paid`.
9. CommerceFix calls the controlled repair generation flow.
10. CommerceFix creates the repair package.
11. CommerceFix sends the package by email and records `delivery_sent`.

## Frontend Checkout URLs

The app expects the CommerceFix backend API URL from environment variables:

```text
VITE_COMMERCEFIX_API_BASE_URL
```

The browser sends CSV text to `/api/commercefix/upload`, receives an `order_id`, then asks `/api/commercefix/checkout` for a PayPal hosted checkout URL.

If the API URL is missing or unavailable, the UI must not pretend payment started. It should show checkout unavailable and keep paid files locked.

## PayPal Hosted Checkout Mode

PayPal approval is complete enough for live hosted checkout.

1. User clicks `Checkout $19 Lite` or `Checkout $39 Pro`.
2. The browser creates a pending order through the CommerceFix backend.
3. The backend creates a PayPal order and returns `checkout_url`.
4. The browser redirects to PayPal hosted checkout.
5. Paid file generation remains locked until PayPal sends a verified capture webhook.

## Boundary

The browser UI may show the names of these paid files before payment:

- `fixed_import_safe.csv`
- `seo_patch_only.csv`
- `error_report.xlsx`
- `before_after_preview.html`

The browser UI must not generate, download, or expose their full contents before `payment_paid`.

## Production Requirement

The frontend paywall is only an interface. Production protection requires server-side or trusted-worker generation after payment confirmation.

## PayPal Automation Boundary

PayPal is the payment provider. The automated flow must wait for a verified capture event, not a client-side redirect or approval screen.

Required server-only environment variables:

```text
PAYPAL_ENV
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_APP_PASSWORD
ORDER_STORAGE_DIR
CSV_STORAGE_DIR
PACKAGE_STORAGE_DIR
```

Do not store email account passwords in source code, docs, or frontend `.env` values. Gmail delivery should use a Gmail App Password or OAuth token.
