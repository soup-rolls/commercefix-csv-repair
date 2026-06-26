import { once } from "node:events";
import type { AddressInfo } from "node:net";
import path from "node:path";

const sampleCsv = `Handle,Title,Vendor,Option1 Name,Option1 Value,Image Src,Image Alt Text,Metafield: title_tag [string],Metafield: description_tag [string]
linen-shirt,Linen Shirt,Northline,Size,,https://cdn.example.com/linen-shirt.jpg,,,
`;

async function main() {
  process.env.ORDER_STORAGE_DIR = path.resolve("D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/api-dry-run", "orders");
  process.env.CSV_STORAGE_DIR = path.resolve("D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/api-dry-run", "uploads");
  process.env.PACKAGE_STORAGE_DIR = path.resolve("D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/api-dry-run", "packages");
  process.env.PUBLIC_BASE_URL = "http://127.0.0.1:0";

  const { server } = await import("./httpServer");

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const health = await fetch(`${baseUrl}/health`);
    if (!health.ok) throw new Error(`health failed: ${health.status}`);

    const upload = await fetch(`${baseUrl}/api/commercefix/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csv_text: sampleCsv,
        original_file_name: "api-dry-run-shopify-products.csv",
        plan: "Repair Pro",
        payer_email: "customer@example.com"
      })
    });
    if (!upload.ok) throw new Error(`upload failed: ${upload.status} ${await upload.text()}`);
    const uploadPayload = await upload.json();

    console.log(JSON.stringify({
      ok: true,
      health: await health.json(),
      upload: uploadPayload
    }, null, 2));
  } finally {
    server.close();
    await once(server, "close");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
