import fs from "fs";
import path from "path";

export function getData(name) {
  const filePath = path.join(process.cwd(), "public", "data", `${name}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
    const altPath = path.join(process.cwd(), "aurumwatch", "web", "public", "data", `${name}.json`);
    if (fs.existsSync(altPath)) {
      return JSON.parse(fs.readFileSync(altPath, "utf-8"));
    }
  } catch (err) {
    console.error(`Failed to read data for ${name}:`, err);
  }
  return null;
}


