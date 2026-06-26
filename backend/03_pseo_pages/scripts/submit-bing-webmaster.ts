import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteUrl = normalizeSiteUrl(process.env.SITE_URL ?? "https://soup-rolls.github.io/commercefix-csv-repair");
const sitemapUrl = `${siteUrl}/sitemap.xml`;
const apiKey = process.env.BING_WEBMASTER_API_KEY;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const sitemapPath = path.join(projectRoot, "01_app", "dist", "sitemap.xml");

async function main() {
  if (!apiKey) {
    throw new Error("Missing BING_WEBMASTER_API_KEY. Generate it in Bing Webmaster Tools after verifying the site.");
  }

  const sitemap = await readFile(sitemapPath, "utf8");
  const urlList = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  if (!urlList.length) throw new Error("No URLs found in dist/sitemap.xml");

  const feedResult = await postBing("SubmitFeed", {
    siteUrl,
    feedUrl: sitemapUrl
  });

  const urlResult = await postBing("SubmitUrlbatch", {
    siteUrl,
    urlList
  });

  console.log(JSON.stringify({
    siteUrl,
    sitemapUrl,
    sitemapSubmitted: feedResult,
    urlBatchSubmitted: urlResult,
    submittedUrlCount: urlList.length
  }, null, 2));
}

async function postBing(method: string, payload: unknown) {
  const response = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/${method}?apikey=${encodeURIComponent(apiKey!)}`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${method} failed: HTTP ${response.status} ${body}`);
  }

  return {
    status: response.status,
    body
  };
}

function normalizeSiteUrl(value: string) {
  return value.replace(/\/+$/, "");
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
