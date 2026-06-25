export type Severity = "pass" | "warn" | "fixable" | "blocked";

export type Issue = {
  row: number;
  field: string;
  code: string;
  severity: Exclude<Severity, "pass">;
  message: string;
  suggestedFix: string;
};

export type RepairRow = Record<string, string>;

export type PreviewRow = {
  row: number;
  handle: string;
  titleBefore: string;
  titleAfter: string;
  descriptionBefore: string;
  descriptionAfter: string;
  altBefore: string;
  altAfter: string;
};

export type ScanSummary = {
  importRisks: number;
  seoGaps: number;
  imageIssues: number;
  fixableRows: number;
  blockedRows: number;
};

export type ScanState = "ready" | "fixable" | "qa_required" | "empty" | "parse_failed" | "no_issues";

export type FreeScanResult = {
  fileName: string;
  rowCount: number;
  scannedRows: number;
  headers: string[];
  issues: Issue[];
  previewRows: PreviewRow[];
  summary: ScanSummary;
  state: ScanState;
  message: string;
};

export type InternalRepairData = FreeScanResult & {
  allIssues: Issue[];
  fixedRows: RepairRow[];
  seoPatchRows: RepairRow[];
  allPreviewRows: PreviewRow[];
};

export type ScanResult = FreeScanResult;
