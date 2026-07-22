import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.VITE_GOOGLE_SHEET_ID || "";
const OUTPUT = resolve(process.cwd(), "src/data/fallback.json");

if (!SHEET_ID) {
  throw new Error("Defina GOOGLE_SHEET_ID o VITE_GOOGLE_SHEET_ID en .env.local.");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function themeFor(project) {
  const text = normalize(project);
  const rules = [
    ["Automatización y electrónica", ["AUTOMAT", "ELECTRON", "IOT", "SENSOR", "ROBOT", "PLC", "MECATRON", "CONTROL"]],
    ["Software y datos", ["SOFTWARE", "APLICACION", "PAGINA WEB", "SISTEMA DE INFORMACION", "BASE DE DATOS", "CHATBOT", "INTELIGENCIA ARTIFICIAL", "PLATAFORMA"]],
    ["Diseño y manufactura", ["DISENO", "CAD", "CAM", "PROTOTIP", "FABRIC", "MANUFACTUR", "MODELADO", "MAQUINA", "3D"]],
    ["Mantenimiento y operaciones", ["MANTENIMIENTO", "OPERACION", "LOGISTIC", "INVENTARIO", "PRODUCCION", "EQUIPOS"]],
    ["Gestión y calidad", ["GESTION", "CALIDAD", "PROCESO", "AUDITOR", "DOCUMENT", "ADMINISTR", "SEGURIDAD"]],
    ["Sostenibilidad", ["AMBIENT", "RESIDU", "ENERGIA", "SOSTENIB", "RECICL", "AGUA"]],
  ];
  return rules.find(([, words]) => words.some((word) => text.includes(word)))?.[0] || "Otros";
}

function value(cell) {
  if (!cell || cell.v === null || cell.v === undefined) return "";
  return cell.f ?? cell.v;
}

function number(cell) {
  const raw = value(cell);
  if (raw === "" || raw === null || raw === undefined) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function semester(cell) {
  const match = String(value(cell)).match(/(20\d{2})\s*[-/]\s*0?([12])/);
  return match ? `${match[1]}-${match[2]}` : "Sin semestre";
}

function isoDate(cell) {
  const raw = String(cell?.v ?? "");
  const gviz = raw.match(/Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/);
  if (gviz) return new Date(Date.UTC(Number(gviz[1]), Number(gviz[2]), Number(gviz[3]))).toISOString().slice(0, 10);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

const params = new URLSearchParams({
  sheet: "Consolidado",
  headers: "1",
  tq: "select A,B,D,E,F,G,H,I,M,N,O,P,Q",
  tqx: "out:json",
});
const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`);
if (!response.ok) throw new Error(`Google Sheets respondió ${response.status}.`);
const raw = await response.text();
const payload = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
if (payload.status !== "ok" || !payload.table) throw new Error("La respuesta de Google Sheets no contiene una tabla válida.");

const records = payload.table.rows.flatMap((row) => {
  const cells = row.c || [];
  const startDate = isoDate(cells[4]);
  const endDate = isoDate(cells[5]);
  const company = String(value(cells[3])).trim();
  const recordSemester = semester(cells[2]);
  if (!company || recordSemester === "Sin semestre") return [];
  const durationDays = startDate && endDate
    ? Math.round((new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86_400_000)
    : null;
  return [{
    semester: recordSemester,
    company,
    city: String(value(cells[11])).trim(),
    department: String(value(cells[12])).trim(),
    startDate,
    endDate,
    durationDays,
    theme: themeFor(value(cells[6])),
    visitsCompleted: [cells[8], cells[9], cells[10]].filter((cell) => String(value(cell)).trim()).length,
    reportedPlaced: number(cells[1]),
    reportedUnplaced: number(cells[0]),
  }];
});

await writeFile(OUTPUT, `${JSON.stringify({ generatedAt: new Date().toISOString(), records }, null, 2)}\n`, "utf8");
console.log(`Generated ${OUTPUT} with ${records.length} privacy-safe rows from Google Sheets.`);
