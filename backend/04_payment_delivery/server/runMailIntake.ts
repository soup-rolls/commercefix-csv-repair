import { runMailIntake } from "./mailIntake";

const mode = process.argv.includes("--intake") ? "intake" : "dry-run";

runMailIntake(mode)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
