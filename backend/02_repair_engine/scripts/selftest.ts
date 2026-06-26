import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyzeCsvText } from "../src/repairEngine";

const root = resolve(import.meta.dirname, "../..");
const sampleDir = join(root, "05_samples_test_files");
const reportDir = join(root, "06_docs", "qa_reports");
const sampleFiles = readdirSync(sampleDir).filter((name) => name.endsWith(".csv"));

mkdirSync(reportDir, { recursive: true });

const rows = sampleFiles.map((name) => {
  const csv = readFileSync(join(sampleDir, name), "utf8");
  const { free, internal } = analyzeCsvText(csv, name);
  const leakedPaidFields = ["fixedRows", "seoPatchRows", "allIssues", "allPreviewRows"].filter((key) => key in free);
  const violations: string[] = [];

  if (free.issues.length > 5) violations.push("free issues exceed 5");
  if (free.previewRows.length > 5) violations.push("free preview rows exceed 5");
  if (leakedPaidFields.length > 0) violations.push(`free leaked paid fields: ${leakedPaidFields.join(", ")}`);
  if (internal.fixedRows.length !== free.rowCount) violations.push("internal fixed rows mismatch row count");

  return {
    file: name,
    state: free.state,
    rows: free.rowCount,
    freeIssues: free.issues.length,
    freePreviewRows: free.previewRows.length,
    internalIssues: internal.allIssues.length,
    importRisks: free.summary.importRisks,
    seoGaps: free.summary.seoGaps,
    imageIssues: free.summary.imageIssues,
    violations
  };
});

const failed = rows.filter((row) => row.violations.length > 0);
const markdown = [
  "# CommerceFix Sample QA Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "| File | State | Rows | Free issues | Free preview | Internal issues | Import | SEO | Image | Violations |",
  "|---|---|---:|---:|---:|---:|---:|---:|---:|---|",
  ...rows.map((row) => `| ${row.file} | ${row.state} | ${row.rows} | ${row.freeIssues} | ${row.freePreviewRows} | ${row.internalIssues} | ${row.importRisks} | ${row.seoGaps} | ${row.imageIssues} | ${row.violations.join("; ") || "none"} |`)
].join("\n");

writeFileSync(join(reportDir, "sample-qa-report.md"), markdown, "utf8");
console.table(rows.map(({ file, state, rows, freeIssues, freePreviewRows, internalIssues, violations }) => ({
  file,
  state,
  rows,
  freeIssues,
  freePreviewRows,
  internalIssues,
  violations: violations.join("; ") || "none"
})));

if (failed.length > 0) {
  throw new Error(`${failed.length} sample QA checks failed`);
}
