import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const appNodeModules = path.resolve(import.meta.dirname, "..", "..", "01_app", "node_modules");
process.env.NODE_PATH = [process.env.NODE_PATH, appNodeModules].filter(Boolean).join(path.delimiter);
require("node:module").Module._initPaths();

const sampleCsv = `Handle,Title,Vendor,Option1 Name,Option1 Value,Image Src,Image Alt Text,Metafield: title_tag [string],Metafield: description_tag [string]
linen-shirt,Linen Shirt,Northline,Size,,https://cdn.example.com/linen-shirt.jpg,,,
travel-tote,Travel Tote,Bright Co,,,https://cdn.example.com/tote.jpg,,,
`;

async function main() {
  const [{ loadAutomationConfig }, { createPendingOrder }, { buildPaidRepairPackageBytes }] = await Promise.all([
    import("./automationConfig"),
    import("./orderIntake"),
    import("./serverRepairPackage")
  ]);

  const tmpRoot = path.resolve("D:/AI_Cashflow_Data/CommerceFix_CSV_Repair/dry-run");
  await rm(tmpRoot, { recursive: true, force: true });
  await mkdir(tmpRoot, { recursive: true });

  const config = loadAutomationConfig({
    ...process.env,
    ORDER_STORAGE_DIR: path.join(tmpRoot, "orders"),
    CSV_STORAGE_DIR: path.join(tmpRoot, "uploads"),
    PACKAGE_STORAGE_DIR: path.join(tmpRoot, "packages"),
    PAYPAL_LITE_PRICE: "19.00",
    PAYPAL_PRO_PRICE: "39.00"
  });

  const order = await createPendingOrder({
    config,
    csvText: sampleCsv,
    originalFileName: "dry-run-shopify-products.csv",
    plan: "Repair Pro",
    payerEmail: "customer@example.com"
  });

  const packageBytes = await buildPaidRepairPackageBytes(sampleCsv, order.original_file_name);
  if (packageBytes.byteLength < 1000) {
    throw new Error(`Repair package too small: ${packageBytes.byteLength} bytes`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        order_id: order.order_id,
        scan_id: order.scan_id,
        plan: order.plan,
        csv_storage_path: order.csv_storage_path,
        package_bytes: packageBytes.byteLength
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
