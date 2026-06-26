# CommerceFix Repair Engine

Shared CSV scan and repair planning logic.

This directory is intentionally outside `01_app/src` so paid generation code does not live in frontend UI source.

## Used By

- `01_app/src/App.tsx` for free scan previews only
- `04_payment_delivery/server/serverRepairPackage.ts` for paid package generation after `payment_paid`

## Boundary

The free app may call:

- `parseCsv`
- `scanCsvText`

The controlled server or worker may call:

- `analyzeCsvText`

Only the controlled server or worker may generate:

- `fixed_import_safe.csv`
- `seo_patch_only.csv`
- `error_report.xlsx`
- `before_after_preview.html`
