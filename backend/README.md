# CommerceFix Backend

This folder contains the Render-deployable Node backend for the CommerceFix CSV repair flow.

- `/health` for uptime checks
- `/api/commercefix/upload` to create pending orders from CSV text
- `/api/commercefix/checkout` to create PayPal hosted checkout orders
- `/api/commercefix/paypal/webhook` to receive verified capture webhooks
- `/api/commercefix/download/:order_id` to fetch the generated repair package
- `/api/commercefix/failures` to inspect recent failure events

Run locally from this folder:

```bash
npm install
npm run dry-run
npm run start
```
