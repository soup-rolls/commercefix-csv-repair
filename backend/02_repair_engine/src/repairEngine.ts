import Papa from "papaparse";
import type { FreeScanResult, InternalRepairData, Issue, PreviewRow, RepairRow, ScanResult } from "./types";

type CsvParseError = {
  row?: number;
  message: string;
};

type CsvParseResult<T> = {
  data: T[];
  errors: CsvParseError[];
  meta: {
    fields?: string[];
  };
};

type CsvParser = {
  parse<T>(text: string, options: {
    header: boolean;
    skipEmptyLines: "greedy";
    transformHeader: (header: string) => string;
  }): CsvParseResult<T>;
  unparse(rows: RepairRow[]): string;
};

const csvParser = Papa as CsvParser;

const TITLE_TAG = "Metafield: title_tag [string]";
const DESCRIPTION_TAG = "Metafield: description_tag [string]";
const ALT_TEXT = "Image Alt Text";

const REQUIRED_HEADERS = ["Handle", "Title"];
const KNOWN_HEADERS = [
  "Handle",
  "Title",
  "Body (HTML)",
  "Vendor",
  "Product Category",
  "Type",
  "Tags",
  "Published",
  "Option1 Name",
  "Option1 Value",
  "Variant SKU",
  "Image Src",
  "Image Alt Text",
  TITLE_TAG,
  DESCRIPTION_TAG
];

const typoHints: Record<string, string> = {
  handel: "Handle",
  handl: "Handle",
  producthandle: "Handle",
  producttitle: "Title",
  titel: "Title",
  imageurl: "Image Src",
  imagesrc: "Image Src",
  alttext: "Image Alt Text",
  seotitle: TITLE_TAG,
  metatitle: TITLE_TAG,
  seodescription: DESCRIPTION_TAG,
  metadescription: DESCRIPTION_TAG
};

export const SHOPIFY_CSV_REPAIR_FIELDS = {
  titleTag: TITLE_TAG,
  descriptionTag: DESCRIPTION_TAG,
  altText: ALT_TEXT
} as const;

export async function parseCsv(file: File): Promise<ScanResult> {
  const text = await file.text();
  return scanCsvText(text, file.name);
}

export function scanCsvText(text: string, fileName = "sample.csv"): ScanResult {
  return analyzeCsvText(text, fileName).free;
}

export function analyzeCsvText(text: string, fileName = "sample.csv"): { free: FreeScanResult; internal: InternalRepairData } {
  const issues: Issue[] = [];
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const parsed = csvParser.parse<RepairRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header: string) => header.trim()
  });

  const rows = parsed.data.map(normalizeRow);
  const headers = parsed.meta.fields ?? [];
  const fixedHeaders = ensureHeaders(headers);

  parsed.errors.forEach((error: CsvParseError) => {
    issues.push({
      row: error.row ? error.row + 2 : 1,
      field: "CSV",
      code: "csv_parse_risk",
      severity: "blocked",
      message: error.message,
      suggestedFix: "Review quotes, embedded newlines, and comma escaping before importing."
    });
  });

  REQUIRED_HEADERS.forEach((header) => {
    if (!headers.includes(header)) {
      issues.push({
        row: 1,
        field: header,
        code: "missing_required_header",
        severity: "blocked",
        message: `Missing required Shopify CSV header: ${header}.`,
        suggestedFix: `Add the ${header} column before import.`
      });
    }
  });

  headers.forEach((header: string) => {
    const normalized = compact(header);
    const suggestion = typoHints[normalized];
    if (suggestion && suggestion !== header) {
      issues.push({
        row: 1,
        field: header,
        code: "header_spelling_risk",
        severity: "fixable",
        message: `Header looks like ${suggestion} but is written as ${header}.`,
        suggestedFix: `Rename ${header} to ${suggestion}.`
      });
    }
  });

  const handleCounts = new Map<string, number>();
  const imageCounts = new Map<string, number>();
  const titleTagCounts = new Map<string, number>();
  const descriptionTagCounts = new Map<string, number>();

  rows.forEach((row: RepairRow) => {
    const handle = value(row.Handle);
    const image = value(row["Image Src"]);
    const titleTag = value(row[TITLE_TAG]);
    const descriptionTag = value(row[DESCRIPTION_TAG]);
    if (handle) handleCounts.set(handle, (handleCounts.get(handle) ?? 0) + 1);
    if (image) imageCounts.set(image, (imageCounts.get(image) ?? 0) + 1);
    if (titleTag) titleTagCounts.set(titleTag, (titleTagCounts.get(titleTag) ?? 0) + 1);
    if (descriptionTag) {
      descriptionTagCounts.set(descriptionTag, (descriptionTagCounts.get(descriptionTag) ?? 0) + 1);
    }
  });

  const fixedRows = rows.map((row: RepairRow, index: number) => {
    const csvRow = index + 2;
    const fixed = withHeaders(row, fixedHeaders);
    const handle = value(fixed.Handle);
    const title = value(fixed.Title);
    const image = value(fixed["Image Src"]);
    const optionName = value(fixed["Option1 Name"]);
    const optionValue = value(fixed["Option1 Value"]);

    if (!handle) {
      issues.push(issue(csvRow, "Handle", "missing_handle", "blocked", "Handle is empty.", "Add a stable product handle."));
      fixed.Handle = slugify(title || `product-${index + 1}`);
    } else if ((handleCounts.get(handle) ?? 0) > 1) {
      issues.push(issue(csvRow, "Handle", "duplicate_handle", "warn", `Handle ${handle} appears multiple times.`, "Confirm duplicate rows are intended variants."));
    }

    if (!title) {
      issues.push(issue(csvRow, "Title", "missing_title", "blocked", "Title is empty.", "Add a product title before importing."));
      fixed.Title = humanizeHandle(fixed.Handle || `Product ${index + 1}`);
    }

    if ((optionName && !optionValue) || (!optionName && optionValue)) {
      issues.push(issue(csvRow, "Option1", "option_pair_risk", "fixable", "Option1 Name and Option1 Value are incomplete.", "Fill both Option1 fields or leave both empty."));
      fixed["Option1 Name"] = optionName || "Title";
      fixed["Option1 Value"] = optionValue || "Default Title";
    }

    if (!value(fixed[TITLE_TAG])) {
      issues.push(issue(csvRow, TITLE_TAG, "missing_seo_title", "fixable", "SEO title metafield is empty.", "Generate an import-safe SEO title."));
      fixed[TITLE_TAG] = makeSeoTitle(fixed.Title);
    } else if (value(fixed[TITLE_TAG]).length > 70 || value(fixed[TITLE_TAG]).length < 20) {
      issues.push(issue(csvRow, TITLE_TAG, "seo_title_length_risk", "fixable", "SEO title length may truncate or underperform.", "Keep the SEO title around 40-65 characters."));
      fixed[TITLE_TAG] = makeSeoTitle(fixed.Title);
    }

    if (!value(fixed[DESCRIPTION_TAG])) {
      issues.push(issue(csvRow, DESCRIPTION_TAG, "missing_seo_description", "fixable", "SEO description metafield is empty.", "Generate a concise product meta description."));
      fixed[DESCRIPTION_TAG] = makeSeoDescription(fixed.Title, fixed.Vendor);
    } else if (value(fixed[DESCRIPTION_TAG]).length > 165 || value(fixed[DESCRIPTION_TAG]).length < 70) {
      issues.push(issue(csvRow, DESCRIPTION_TAG, "seo_description_length_risk", "fixable", "SEO description length may truncate or look thin.", "Keep the description around 120-155 characters."));
      fixed[DESCRIPTION_TAG] = makeSeoDescription(fixed.Title, fixed.Vendor);
    }

    if (value(fixed[TITLE_TAG]) && (titleTagCounts.get(value(fixed[TITLE_TAG])) ?? 0) > 1) {
      issues.push(issue(csvRow, TITLE_TAG, "duplicate_seo_title", "warn", "SEO title is duplicated.", "Use product-specific wording."));
    }

    if (value(fixed[DESCRIPTION_TAG]) && (descriptionTagCounts.get(value(fixed[DESCRIPTION_TAG])) ?? 0) > 1) {
      issues.push(issue(csvRow, DESCRIPTION_TAG, "duplicate_seo_description", "warn", "SEO description is duplicated.", "Use product-specific wording."));
    }

    if (!image) {
      issues.push(issue(csvRow, "Image Src", "missing_image_src", "warn", "Image Src is empty.", "Add a valid product image URL if available."));
    } else if (!/^https?:\/\//i.test(image)) {
      issues.push(issue(csvRow, "Image Src", "invalid_image_url", "fixable", "Image Src is not an http/https URL.", "Use a full http or https image URL."));
    } else if ((imageCounts.get(image) ?? 0) > 1) {
      issues.push(issue(csvRow, "Image Src", "duplicate_image_url", "warn", "Image URL appears multiple times.", "Confirm repeated image usage is intended."));
    }

    if (image && !value(fixed[ALT_TEXT])) {
      issues.push(issue(csvRow, ALT_TEXT, "missing_image_alt", "fixable", "Image alt text is empty.", "Generate descriptive image alt text."));
      fixed[ALT_TEXT] = makeAltText(fixed.Title);
    }

    return fixed;
  });

  const seoPatchRows = fixedRows.map((row: RepairRow) => ({
    Handle: row.Handle,
    Title: row.Title,
    [TITLE_TAG]: row[TITLE_TAG],
    [DESCRIPTION_TAG]: row[DESCRIPTION_TAG],
    [ALT_TEXT]: row[ALT_TEXT]
  }));

  const allPreviewRows = makePreviewRows(rows, fixedRows);
  const previewRows = allPreviewRows.slice(0, 5);
  const previewIssues = issues.slice(0, 5);
  const importRisks = issues.filter((item) => ["CSV", "Handle", "Title", "Option1"].includes(item.field) || item.code.includes("header")).length;
  const seoGaps = issues.filter((item) => item.field === TITLE_TAG || item.field === DESCRIPTION_TAG).length;
  const imageIssues = issues.filter((item) => item.field === "Image Src" || item.field === ALT_TEXT).length;
  const blockedRows = new Set(issues.filter((item) => item.severity === "blocked").map((item) => item.row)).size;
  const fixableRows = new Set(issues.filter((item) => item.severity === "fixable").map((item) => item.row)).size;
  const state = getScanState(rows.length, parsed.errors.length, issues.length, blockedRows, fixableRows);

  const free: FreeScanResult = {
    fileName,
    rowCount: rows.length,
    scannedRows: Math.min(rows.length, 50),
    headers,
    issues: previewIssues,
    previewRows,
    summary: {
      importRisks,
      seoGaps,
      imageIssues,
      fixableRows,
      blockedRows
    },
    state,
    message: getScanMessage(state, rows.length, issues.length)
  };

  const internal: InternalRepairData = {
    ...free,
    issues: previewIssues,
    previewRows,
    allIssues: issues,
    fixedRows,
    seoPatchRows,
    allPreviewRows
  };

  return { free, internal };
}

function getScanState(rowCount: number, parseErrorCount: number, issueCount: number, blockedRows: number, fixableRows: number) {
  if (rowCount === 0) return "empty";
  if (parseErrorCount > 0) return "parse_failed";
  if (blockedRows > 0) return "qa_required";
  if (fixableRows > 0 || issueCount > 0) return "fixable";
  return "no_issues";
}

function getScanMessage(state: ReturnType<typeof getScanState>, rowCount: number, issueCount: number) {
  if (state === "empty") return "No product rows were found. Upload a Shopify product CSV with headers and rows.";
  if (state === "parse_failed") return "CSV parsing found structural risks. Review quoting, delimiters, and embedded line breaks.";
  if (state === "qa_required") return `${issueCount} issues found. Some rows need review before import-safe repair.`;
  if (state === "fixable") return `${issueCount} repairable issues found across ${rowCount} rows.`;
  return `No preview issues found in ${rowCount} rows. You can still export a QA report after checkout.`;
}

function makePreviewRows(originalRows: RepairRow[], fixedRows: RepairRow[]): PreviewRow[] {
  return fixedRows
    .map((fixed, index) => {
      const original = originalRows[index] ?? {};
      return {
        row: index + 2,
        handle: fixed.Handle,
        titleBefore: value(original[TITLE_TAG]),
        titleAfter: value(fixed[TITLE_TAG]),
        descriptionBefore: value(original[DESCRIPTION_TAG]),
        descriptionAfter: value(fixed[DESCRIPTION_TAG]),
        altBefore: value(original[ALT_TEXT]),
        altAfter: value(fixed[ALT_TEXT])
      };
    })
    .filter((row) => row.titleBefore !== row.titleAfter || row.descriptionBefore !== row.descriptionAfter || row.altBefore !== row.altAfter);
}

function ensureHeaders(headers: string[]) {
  return Array.from(new Set([...headers, ...REQUIRED_HEADERS, "Image Src", ALT_TEXT, TITLE_TAG, DESCRIPTION_TAG]));
}

function normalizeRow(row: RepairRow) {
  return Object.fromEntries(Object.entries(row).map(([key, val]) => [key.trim(), value(val)]));
}

function withHeaders(row: RepairRow, headers: string[]) {
  return Object.fromEntries(headers.map((header) => [header, value(row[header])]));
}

function issue(row: number, field: string, code: string, severity: Issue["severity"], message: string, suggestedFix: string): Issue {
  return { row, field, code, severity, message, suggestedFix };
}

function makeSeoTitle(title: string) {
  const clean = value(title) || "Shopify product";
  return trimToLength(`${clean} | Shop online`, 65);
}

function makeSeoDescription(title: string, vendor?: string) {
  const cleanTitle = value(title) || "this Shopify product";
  const brand = value(vendor);
  const copy = brand
    ? `Shop ${cleanTitle} from ${brand}. Review product details, images, and options before checkout.`
    : `Shop ${cleanTitle}. Review product details, images, and available options before checkout.`;
  return trimToLength(copy, 155);
}

function makeAltText(title: string) {
  return trimToLength(value(title) ? `${title} product image` : "Shopify product image", 120);
}

function value(input: unknown) {
  return String(input ?? "").trim();
}

function compact(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function slugify(input: string) {
  return value(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function humanizeHandle(input: string) {
  const clean = value(input).replace(/[-_]+/g, " ");
  return clean ? clean.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Untitled Product";
}

function trimToLength(input: string, limit: number) {
  const clean = value(input).replace(/\s+/g, " ");
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1).trim()}.`;
}
