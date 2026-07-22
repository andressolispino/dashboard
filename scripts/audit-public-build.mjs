import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const DIST = resolve(ROOT, "dist");
const FALLBACK = resolve(ROOT, "src", "data", "fallback.json");
const allowedRecordKeys = new Set([
  "semester",
  "company",
  "city",
  "department",
  "startDate",
  "endDate",
  "durationDays",
  "theme",
  "visitsCompleted",
  "reportedPlaced",
  "reportedUnplaced",
]);
const forbiddenExtensions = new Set([".xlsx", ".xls", ".csv", ".tsv", ".map"]);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(path)));
    else files.push(path);
  }
  return files;
}

const fallback = JSON.parse(await readFile(FALLBACK, "utf8"));
if (!Array.isArray(fallback.records) || !fallback.records.length) {
  throw new Error("El respaldo público no contiene registros.");
}
for (const [index, record] of fallback.records.entries()) {
  const unexpected = Object.keys(record).filter((key) => !allowedRecordKeys.has(key));
  if (unexpected.length) {
    throw new Error(`Registro ${index + 1}: campos no autorizados: ${unexpected.join(", ")}`);
  }
}

const distFiles = await filesIn(DIST);
const forbiddenFiles = distFiles.filter((file) =>
  forbiddenExtensions.has(extname(file).toLowerCase()) || file.toLowerCase().includes(".env"),
);
if (forbiddenFiles.length) {
  throw new Error(`Archivos no publicables: ${forbiddenFiles.map((file) => relative(ROOT, file)).join(", ")}`);
}

const html = await readFile(join(DIST, "index.html"), "utf8");
if (!html.includes("./assets/") || html.includes('/src/main.ts')) {
  throw new Error("Las rutas del paquete no son compatibles con un subdirectorio de GitHub Pages.");
}

try {
  const localEnv = await readFile(resolve(ROOT, ".env.local"), "utf8");
  const masterId = localEnv.match(/^GOOGLE_SHEET_ID=(.+)$/m)?.[1]?.trim();
  if (masterId) {
    for (const file of distFiles.filter((path) => [".html", ".js", ".json"].includes(extname(path)))) {
      if ((await readFile(file, "utf8")).includes(masterId)) {
        throw new Error(`El paquete público contiene el ID de la hoja maestra en ${relative(ROOT, file)}.`);
      }
    }
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

console.log(`Auditoría pública aprobada: ${fallback.records.length} registros agregados y ${distFiles.length} archivos publicables.`);
