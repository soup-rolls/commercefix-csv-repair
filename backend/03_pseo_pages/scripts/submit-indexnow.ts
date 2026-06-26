import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteUrl = normalizeSiteUrl(process.env.SITE_URL ?? "https://soup-rolls.github.io/commercefix-csv-repair");
const host = new URL(siteUrl).host;
const indexNowKey = process.env.INDEXNOW_KEY ?? "a72c9b5f0e134d76a8b4c2f1930dce61";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const sitemapPath = path.join(projectRoot, "01_app", "dist", "sitemap.xml");

async function main() {
  const sitemap = await readFile(sitemapPath, "utf8");
  const urlList = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);

  if (!urlList.length) {
    throw new Error("No URLs found in dist/sitemap.xml");
  }

  const keyLocation = `${siteUrl}/${indexNowKey}.txt`;
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host,
      key: indexNowKey,
      keyLocation,
      urlList
    })
  });

  const body = await response.text();
  console.log(JSON.stringify({
    status: response.status,
    ok: response.ok,
    submitted: urlList.length,
    host,
    keyLocation,
    body
  }, null, 2));

  if (!response.ok) process.exitCode = 1;
}

function normalizeSiteUrl(value: string) {
  return value.replace(/\/+$/, "");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
