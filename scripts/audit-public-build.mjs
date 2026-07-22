import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();
const DIST = resolve(ROOT, "dist");
const FALLBACK = resolve(ROOT, "src", "data", "fallback.json");
const DIRECTORY = resolve(ROOT, "src", "data", "directory.json");
const allowedRecordKeys = new Set([
  "semester",
  "company",
  "city",
  "department",
  "sector",
  "startDate",
  "endDate",
  "durationDays",
  "theme",
  "visitsCompleted",
  "reportedPlaced",
  "reportedUnplaced",
]);
const forbiddenExtensions = new Set([".xlsx", ".xls", ".csv", ".tsv", ".map"]);
const allowedDirectoryKeys = new Set([
  "id",
  "studentName",
  "semester",
  "company",
  "projectTitle",
  "tutorName",
  "city",
  "department",
  "sector",
  "theme",
]);
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const phonePattern = /(?:\+?\d[\d\s().-]{6,}\d)/;

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

const directory = JSON.parse(await readFile(DIRECTORY, "utf8"));
if (!Array.isArray(directory.records) || directory.records.length !== fallback.records.length) {
  throw new Error("El directorio público no coincide con el respaldo analítico.");
}
for (const [index, record] of directory.records.entries()) {
  const unexpected = Object.keys(record).filter((key) => !allowedDirectoryKeys.has(key));
  if (unexpected.length) {
    throw new Error(`Directorio ${index + 1}: campos no autorizados: ${unexpected.join(", ")}`);
  }
  const publicValues = Object.entries(record).map(([key, value]) => ({ key, value: String(value) }));
  const hasEmail = publicValues.some(({ value }) => emailPattern.test(value));
  const hasPhone = publicValues.some(
    ({ key, value }) => !["id", "semester"].includes(key) && phonePattern.test(value),
  );
  if (hasEmail || hasPhone) {
    throw new Error(`Directorio ${index + 1}: se detectó un posible correo o teléfono.`);
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

console.log(`Auditoría pública aprobada: ${fallback.records.length} registros agregados, ${directory.records.length} filas de directorio sin contactos y ${distFiles.length} archivos publicables.`);
