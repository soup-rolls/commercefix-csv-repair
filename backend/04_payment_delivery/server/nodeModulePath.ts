import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const appNodeModules = path.resolve(import.meta.dirname, "..", "..", "01_app", "node_modules");
process.env.NODE_PATH = [process.env.NODE_PATH, appNodeModules].filter(Boolean).join(path.delimiter);
require("node:module").Module._initPaths();
