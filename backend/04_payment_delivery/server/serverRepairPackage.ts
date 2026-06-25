import Papa from "papaparse";
import JSZip from "jszip";
import { analyzeCsvText } from "../../02_repair_engine/src/repairEngine";
import type { InternalRepairData, Issue, RepairRow } from "../../02_repair_engine/src/types";

type CsvUnparser = {
  unparse(rows: RepairRow[]): string;
};

const csvParser = Papa as CsvUnparser;

export async function buildPaidRepairPackageFromCsv(csvText: string, fileName: string) {
  const { internal } = analyzeCsvText(csvText, fileName);
  return buildRepairZip(internal);
}

export async function buildPaidRepairPackageBytes(csvText: string, fileName: string) {
  const { internal } = analyzeCsvText(csvText, fileName);
  const zip = await buildRepairZipArchive(internal);
  return zip.generateAsync({ type: "uint8array" });
}

async function buildRepairZip(result: InternalRepairData): Promise<Blob> {
  const zip = await buildRepairZipArchive(result);
  return zip.generateAsync({ type: "blob" });
}

async function buildRepairZipArchive(result: InternalRepairData) {
  const zip = new JSZip();
  zip.file("fixed_import_safe.csv", csvParser.unparse(result.fixedRows));
  zip.file("seo_patch_only.csv", csvParser.unparse(result.seoPatchRows));
  zip.file("error_report.xlsx", await buildErrorReportBytes(result.allIssues));
  zip.file("before_after_preview.html", buildPreviewHtml(result));
  return zip;
}

async function buildErrorReport(issues: Issue[]) {
  const workbookBytes = await buildErrorReportBytes(issues);
  const workbookBuffer = workbookBytes.buffer.slice(
    workbookBytes.byteOffset,
    workbookBytes.byteOffset + workbookBytes.byteLength
  ) as ArrayBuffer;
  return new Blob([workbookBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

async function buildErrorReportBytes(issues: Issue[]) {
  const rows = [
    ["row", "field", "issue", "severity", "message", "suggested_fix"],
    ...issues.map((item) => [
      item.row,
      item.field,
      item.code,
      item.severity,
      item.message,
      item.suggestedFix
    ])
  ];

  return buildMinimalXlsx(rows);
}

async function buildMinimalXlsx(rows: Array<Array<string | number>>) {
  const workbook = new JSZip();
  workbook.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  workbook.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  workbook.folder("xl")?.file("workbook.xml", `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="error_report" sheetId="1" r:id="rId1"/></sheets>
</workbook>`);
  workbook.folder("xl")?.folder("_rels")?.file("workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  workbook.folder("xl")?.file("styles.xml", `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`);
  workbook.folder("xl")?.folder("worksheets")?.file("sheet1.xml", buildSheetXml(rows));
  return workbook.generateAsync({ type: "uint8array" });
}

function buildSheetXml(rows: Array<Array<string | number>>) {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, colIndex) => {
          const ref = `${columnName(colIndex + 1)}${rowIndex + 1}`;
          if (typeof cell === "number") {
            return `<c r="${ref}"><v>${cell}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function columnName(index: number) {
  let name = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

function buildPreviewHtml(result: InternalRepairData) {
  const rows = result.allPreviewRows
    .map(
      (row) => `<tr>
        <td>${row.row}</td>
        <td>${escapeHtml(row.handle)}</td>
        <td>${escapeHtml(row.titleBefore)}</td>
        <td>${escapeHtml(row.titleAfter)}</td>
        <td>${escapeHtml(row.descriptionBefore)}</td>
        <td>${escapeHtml(row.descriptionAfter)}</td>
        <td>${escapeHtml(row.altBefore)}</td>
        <td>${escapeHtml(row.altAfter)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>CommerceFix before/after preview</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 32px; color: #15201b; background: #f7f7f3; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { border: 1px solid #d7ddd4; padding: 10px; vertical-align: top; font-size: 13px; }
    th { text-align: left; background: #eef3ee; }
    code { background: #eef3ee; padding: 2px 5px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>CommerceFix before/after preview</h1>
  <p>Source: <code>${escapeHtml(result.fileName)}</code>. This preview is generated after payment.</p>
  <table>
    <thead>
      <tr>
        <th>Row</th><th>Handle</th><th>SEO title before</th><th>SEO title after</th>
        <th>Description before</th><th>Description after</th><th>Alt before</th><th>Alt after</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(input: string) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(input: string | number) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
