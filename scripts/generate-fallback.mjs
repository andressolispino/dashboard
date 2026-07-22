import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SHEET_ID = process.env.GOOGLE_SHEET_ID || process.env.VITE_GOOGLE_SHEET_ID || "";
const FALLBACK_OUTPUT = resolve(process.cwd(), "src/data/fallback.json");
const DIRECTORY_OUTPUT = resolve(process.cwd(), "src/data/directory.json");
const SECTOR_SOURCE = resolve(process.cwd(), "scripts/company_sectors.json");
const LOCATION_SOURCE = resolve(process.cwd(), "scripts/company_locations.json");

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
  if (!text || text.includes("POR DEFINIR") || text.includes("SIN DEFINIR")) {
    return "Sin información / por definir";
  }
  const rules = [
    ["Salud y tecnología biomédica", ["BIOMED", "ORTOPED", "FISIO", "BIPED", "ELECTROMIOGRAF", "PRESION PLANTAR", "NEONATAL", "INCUBADORA", "RESPIRATOR", "HOSPITAL SIMULADO", "ANALISIS DE MARCHA", "EQUILIBRIO FLAMENCO", "SIMULACION EN SALUD"]],
    ["Educación e innovación", ["STEAM", "GUIA DE APRENDIZAJE", "PROCESO FORMATIVO", "PROCESO EDUCATIVO", "ACTIVIDADES DE CIENCIA", "INVESTIGACION E INNOVACION", "APOYO EN LAS CLASES", "FORTALECIMIENTO TECNOLOGICO Y APRENDIZAJE"]],
    ["Software y transformación digital", ["SOFTWARE", "APLICACION", "APLICATIVO", "APP ", "PAGINA WEB", "PORTAL WEB", "SISTEMA DE INFORMACION", "BASE DE DATOS", "CHATBOT", "INTELIGENCIA ARTIFICIAL", "PLATAFORMA", "FACTURACION ELECTRONICA", "TRANSFORMACION DIGITAL", "PILOTO DE UN SERVICIO", "MIKROTIK", "ANILLO REDUNDANTE"]],
    ["Automatización y control", ["AUTOMAT", "ELECTRON", "ELECTRIC", "IOT", "SENSOR", "ROBOT", "PLC", "MECATRON", "CONTROL", "TARJETA", "ARDUPILOT", "NAVEGACION AUTONOMA", "MONITOREO DE VARIABLES"]],
    ["Energía y sostenibilidad", ["AMBIENT", "RESIDU", "ENERGIA", "ENERGETIC", "SOLAR", "SOSTENIB", "RECICL", "AGUA", "SUBPRODUCT", "RUIDO", "BESS", "BATERIA", "FIBRA DE FIQUE", "MATERIAL AISLANTE"]],
    ["Mantenimiento y confiabilidad", ["MANTENIMIENTO", "REPARACION", "DIAGNOSTICO", "CALIBRACION", "HOJAS DE VIDA", "PREVENCION DE FALLAS", "CONFIABILIDAD"]],
    ["Operaciones y logística", ["LOGISTIC", "INVENTARIO", "PRODUCCION", "LINEA DE PROCESO", "PLANTA DE PRODUCCION", "DISTRIBUCION", "OPERACION DEL EQUIPAMIENTO", "ALMACENAMIENTO"]],
    ["Gestión, calidad y seguridad", ["GESTION", "CALIDAD", "ISO 9001", "AUDITOR", "DOCUMENT", "ADMINISTR", "SEGURIDAD", "INTERVENTORIA", "DIRECCION OPERATIVA"]],
    ["Diseño y desarrollo de producto", ["DISENO", "CAD", "CAM", "CAE", "PROTOTIP", "FABRIC", "MANUFACTUR", "MODELADO", "MAQUINA", "DISPOSITIVO", "PRODUCTO", "3D", "GRUA", "ELEMENTO DIDACTICO", "EQUIPO DE PREACONDICIONAMIENTO"]],
  ];
  return rules.find(([, words]) => words.some((word) => text.includes(word)))?.[0] || "Ingeniería y soporte técnico";
}

function value(cell) {
  if (!cell || cell.v === null || cell.v === undefined) return "";
  return cell.f ?? cell.v;
}

function publicText(cell) {
  return String(value(cell))
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "")
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const sectorGroups = JSON.parse(await readFile(SECTOR_SOURCE, "utf8"));
const sectorMatches = sectorGroups
  .flatMap((group) => group.matches.map((match) => ({ match: normalize(match), sector: group.sector })))
  .sort((a, b) => b.match.length - a.match.length);
const companyLocations = JSON.parse(await readFile(LOCATION_SOURCE, "utf8"))
  .flatMap((item) => item.matches.map((match) => ({ ...item, match: normalize(match) })))
  .sort((a, b) => b.match.length - a.match.length);

function sectorFor(company, supplied) {
  const explicit = publicText(supplied);
  if (explicit) return explicit;
  const key = normalize(company);
  return sectorMatches.find((item) => key.includes(item.match) || item.match.includes(key))?.sector || "Sin clasificar";
}

function locationFor(company) {
  const key = normalize(company);
  return companyLocations.find((item) => key.includes(item.match) || item.match.includes(key));
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
  tq: "select A,B,C,D,E,F,G,H,I,J,M,N,O,P,Q,R",
  tqx: "out:json",
});
const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`);
if (!response.ok) throw new Error(`Google Sheets respondió ${response.status}.`);
const raw = await response.text();
const payload = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
if (payload.status !== "ok" || !payload.table) throw new Error("La respuesta de Google Sheets no contiene una tabla válida.");

const publicRows = payload.table.rows.flatMap((row, index) => {
  const cells = row.c || [];
  const startDate = isoDate(cells[5]);
  const endDate = isoDate(cells[6]);
  const company = publicText(cells[4]);
  const recordSemester = semester(cells[3]);
  if (!company || recordSemester === "Sin semestre") return [];
  const durationDays = startDate && endDate
    ? Math.round((new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86_400_000)
    : null;
  const projectTitle = publicText(cells[7]);
  const knownLocation = locationFor(company);
  const city = publicText(cells[13]) || knownLocation?.city || "";
  const department = publicText(cells[14]) || knownLocation?.department || "";
  const sector = sectorFor(company, cells[15]);
  const theme = themeFor(projectTitle);
  return [{
    aggregate: {
      semester: recordSemester,
      company,
      city,
      department,
      sector,
      startDate,
      endDate,
      durationDays,
      theme,
      visitsCompleted: [cells[10], cells[11], cells[12]].filter((cell) => String(value(cell)).trim()).length,
      reportedPlaced: number(cells[1]),
      reportedUnplaced: number(cells[0]),
    },
    directory: {
      id: `${recordSemester}-${index}`,
      studentName: publicText(cells[2]),
      semester: recordSemester,
      company,
      projectTitle,
      tutorName: publicText(cells[9]),
      city,
      department,
      sector,
      theme,
    },
  }];
});

const generatedAt = new Date().toISOString();
const records = publicRows.map((row) => row.aggregate);
const directoryRecords = publicRows.map((row) => row.directory);

await Promise.all([
  writeFile(FALLBACK_OUTPUT, `${JSON.stringify({ generatedAt, records }, null, 2)}\n`, "utf8"),
  writeFile(DIRECTORY_OUTPUT, `${JSON.stringify({ generatedAt, records: directoryRecords }, null, 2)}\n`, "utf8"),
]);
console.log(`Generated ${records.length} aggregate rows and ${directoryRecords.length} contact-free directory rows from Google Sheets.`);
