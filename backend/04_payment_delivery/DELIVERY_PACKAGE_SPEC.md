# CommerceFix Delivery Package Spec

Every paid repair flow must produce exactly these files.

## `fixed_import_safe.csv`

Purpose: repaired Shopify product CSV that can be imported after user review.

Allowed repairs in V1:

- missing `Handle` fallback from title
- missing `Title` fallback from handle
- incomplete `Option1 Name` / `Option1 Value`
- missing or risky SEO title
- missing or risky SEO description
- missing image alt text

## `seo_patch_only.csv`

Purpose: lower-risk patch file for SEO metadata and image alt text.

Required columns:

- `Handle`
- `Title`
- `Metafield: title_tag [string]`
- `Metafield: description_tag [string]`
- `Image Alt Text`

## `error_report.xlsx`

Purpose: row-level report for inspection.

Required columns:

- `row`
- `field`
- `issue`
- `severity`
- `message`
- `suggested_fix`

## `before_after_preview.html`

Purpose: quick visual QA of repaired SEO fields and image alt text.

Must include:

- source file name
- row number
- handle
- before value
- after value

## Not Included

- Shopify login
- Shopify API token
- automatic Shopify import
- SEO ranking guarantee
- manual agency review

## Automated Email Delivery

After verified payment and package generation, CommerceFix sends one zip attachment:

```text
commercefix_<order_id>_repair_package.zip
```

The zip must contain exactly:

- `fixed_import_safe.csv`
- `seo_patch_only.csv`
- `error_report.xlsx`
- `before_after_preview.html`

Delivery email content must include:

- order id
- selected plan
- original file name
- package file list
- review-before-import reminder
- no Shopify login/API/import boundary
- no SEO ranking guarantee

Gmail delivery must use an app-specific password or OAuth token. Do not use or store the mailbox account password.
