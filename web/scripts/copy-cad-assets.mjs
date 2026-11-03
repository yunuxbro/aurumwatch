import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const targetDirectory = path.resolve(scriptDirectory, "../public/cad");
const occtEntry = require.resolve("occt-import-js");
const rhinoEntry = require.resolve("rhino3dm");

await mkdir(targetDirectory, { recursive: true });
await Promise.all([
  copyFile(path.join(path.dirname(occtEntry), "occt-import-js.wasm"), path.join(targetDirectory, "occt-import-js.wasm")),
  copyFile(occtEntry, path.join(targetDirectory, "occt-import-js.js")),
  copyFile(path.join(path.dirname(rhinoEntry), "rhino3dm.wasm"), path.join(targetDirectory, "rhino3dm.wasm")),
  copyFile(rhinoEntry, path.join(targetDirectory, "rhino3dm.js")),
]);
