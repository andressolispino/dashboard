import type {
  DashboardMetrics,
  FilterState,
  PlacementRecord,
  Theme,
} from "./types";
import { THEMES } from "./types";

export const ALL_FILTER = "__all__";

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, " Y ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeCompany(value: string): { key: string; label: string } {
  let label = value.replace(/\s+/g, " ").trim() || "Organización no informada";
  let key = normalizeSearch(label)
    .replace(/\b(S A S|SAS|S A|SA|LTDA)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    key.includes("CORPORACION UNIVERSITARIA COMFACAUCA") ||
    key === "UNICOMFACAUCA"
  ) {
    key = "UNICOMFACAUCA";
    label = "Unicomfacauca";
  } else if (
    key.includes("FUNDACION") &&
    (key.includes("MARIA CANO") || key.includes("MARICA CANO") || key.includes("UNIEVRSITARIA MARIA CANO"))
  ) {
    key = "FUNDACION UNIVERSITARIA MARIA CANO";
    label = "Fundación Universitaria María Cano";
  } else if (key.includes("UNIVERSIDAD DE GUDALAJARA") || key.includes("UNIVERSIDAD DE GUADALAJARA")) {
    key = "UNIVERSIDAD DE GUADALAJARA";
    label = "Universidad de Guadalajara";
  } else if (key.includes("ECOINGENEIRIA SOSTENIBLE") || key.includes("ECOINGENIERIA SOSTENIBLE")) {
    key = "ECOINGENIERIA SOSTENIBLE";
    label = "Ecoingeniería Sostenible";
  } else if (
    key === "TENCNOPARQUE TECNOACADEMIA" ||
    key.includes("TECNOPARQUE TECNOACADEMIA SENNOVA REGIONAL CAUCA")
  ) {
    key = "TECNOPARQUE TECNOACADEMIA SENNOVA CAUCA";
    label = "Tecnoparque / Tecnoacademia Sennova Cauca";
  }

  return { key: key || "NO INFORMADA", label };
}

export function normalizeSemester(value: unknown, formatted?: unknown): string {
  const candidates = [formatted, value]
    .filter((candidate) => candidate !== null && candidate !== undefined)
    .map(String);

  for (const candidate of candidates) {
    const direct = candidate.match(/(20\d{2})\s*[-/]\s*0?([12])(?:\D|$)/);
    if (direct) return `${direct[1]}-${direct[2]}`;

    const gvizDate = candidate.match(/Date\((20\d{2}),\s*(\d{1,2}),/);
    if (gvizDate) {
      const month = Number(gvizDate[2]) + 1;
      if (month === 1 || month === 2) return `${gvizDate[1]}-${month}`;
    }

    const isoDate = candidate.match(/(20\d{2})-(0[12])-\d{2}/);
    if (isoDate) return `${isoDate[1]}-${Number(isoDate[2])}`;
  }

  return "Sin semestre";
}

export function semesterOrder(semester: string): number {
  const match = semester.match(/^(20\d{2})-([12])$/);
  return match ? Number(match[1]) * 2 + Number(match[2]) : 0;
}

export function classifyTheme(project: string): Theme {
  const text = normalizeSearch(project);
  if (!text || text.includes("POR DEFINIR") || text.includes("SIN DEFINIR")) {
    return "Sin información / por definir";
  }

  const rules: Array<[Theme, string[]]> = [
    [
      "Salud y tecnología biomédica",
      ["BIOMED", "ORTOPED", "FISIO", "BIPED", "ELECTROMIOGRAF", "PRESION PLANTAR", "NEONATAL", "INCUBADORA", "RESPIRATOR", "HOSPITAL SIMULADO", "ANALISIS DE MARCHA", "EQUILIBRIO FLAMENCO", "SIMULACION EN SALUD"],
    ],
    [
      "Educación e innovación",
      ["STEAM", "GUIA DE APRENDIZAJE", "PROCESO FORMATIVO", "PROCESO EDUCATIVO", "ACTIVIDADES DE CIENCIA", "INVESTIGACION E INNOVACION", "APOYO EN LAS CLASES", "FORTALECIMIENTO TECNOLOGICO Y APRENDIZAJE"],
    ],
    [
      "Software y transformación digital",
      [
        "SOFTWARE",
        "APLICACION",
        "APLICATIVO",
        "APP ",
        "PAGINA WEB",
        "PORTAL WEB",
        "SISTEMA DE INFORMACION",
        "BASE DE DATOS",
        "CHATBOT",
        "CHAT BOT",
        "INTELIGENCIA ARTIFICIAL",
        "PLATAFORMA",
        "FACTURACION ELECTRONICA",
        "TRANSFORMACION DIGITAL",
        "PILOTO DE UN SERVICIO",
        "MIKROTIK",
        "ANILLO REDUNDANTE",
      ],
    ],
    [
      "Automatización y control",
      ["AUTOMAT", "ELECTRON", "ELECTRIC", "IOT", "SENSOR", "ROBOT", "PLC", "MECATRON", "CONTROL", "TARJETA", "ARDUPILOT", "NAVEGACION AUTONOMA", "MONITOREO DE VARIABLES"],
    ],
    [
      "Energía y sostenibilidad",
      ["AMBIENT", "RESIDU", "ENERGIA", "ENERGETIC", "SOLAR", "SOSTENIB", "RECICL", "AGUA", "SUBPRODUCT", "RUIDO", "BESS", "BATERIA", "FIBRA DE FIQUE", "MATERIAL AISLANTE"],
    ],
    [
      "Mantenimiento y confiabilidad",
      ["MANTENIMIENTO", "REPARACION", "DIAGNOSTICO", "CALIBRACION", "HOJAS DE VIDA", "PREVENCION DE FALLAS", "CONFIABILIDAD"],
    ],
    [
      "Operaciones y logística",
      ["LOGISTIC", "INVENTARIO", "PRODUCCION", "LINEA DE PROCESO", "PLANTA DE PRODUCCION", "DISTRIBUCION", "OPERACION DEL EQUIPAMIENTO", "ALMACENAMIENTO"],
    ],
    [
      "Gestión, calidad y seguridad",
      ["GESTION", "CALIDAD", "ISO 9001", "AUDITOR", "DOCUMENT", "ADMINISTR", "SEGURIDAD", "INTERVENTORIA", "DIRECCION OPERATIVA"],
    ],
    [
      "Diseño y desarrollo de producto",
      ["DISENO", "CAD", "CAM", "CAE", "PROTOTIP", "FABRIC", "MANUFACTUR", "MODELADO", "MAQUINA", "DISPOSITIVO", "PRODUCTO", "3D", "GRUA", "ELEMENTO DIDACTICO", "EQUIPO DE PREACONDICIONAMIENTO"],
    ],
  ];

  return rules.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)))?.[0]
    ?? "Ingeniería y soporte técnico";
}

export function parseGvizDate(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value);
  const gviz = raw.match(/Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)/);
  if (gviz) {
    const date = new Date(Date.UTC(Number(gviz[1]), Number(gviz[2]), Number(gviz[3])));
    return date.toISOString().slice(0, 10);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function durationDays(startDate: string | null, endDate: string | null): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

export function hydrateRecord(
  record: Omit<PlacementRecord, "id" | "companyKey" | "semesterOrder">,
  index: number,
): PlacementRecord {
  const company = normalizeCompany(record.company);
  return {
    ...record,
    city: record.city ?? "",
    department: record.department ?? "",
    sector: record.sector || "Sin clasificar",
    id: `${record.semester}-${index}`,
    company: company.label,
    companyKey: company.key,
    semesterOrder: semesterOrder(record.semester),
  };
}

export function filterRecords(records: PlacementRecord[], filters: FilterState): PlacementRecord[] {
  return records.filter(
    (record) =>
      (filters.semester === ALL_FILTER || record.semester === filters.semester) &&
      (filters.companyKey === ALL_FILTER || record.companyKey === filters.companyKey) &&
      (filters.theme === ALL_FILTER || record.theme === filters.theme) &&
      (filters.sector === ALL_FILTER || record.sector === filters.sector) &&
      (filters.city === ALL_FILTER || record.city === filters.city) &&
      (filters.department === ALL_FILTER || record.department === filters.department),
  );
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

function uniqueReported(records: PlacementRecord[]): Array<[number, number]> {
  const bySemester = new Map<string, [number, number]>();
  for (const record of records) {
    const current = bySemester.get(record.semester) ?? [0, 0];
    if (record.reportedPlaced !== null) current[0] = record.reportedPlaced;
    if (record.reportedUnplaced !== null) current[1] = record.reportedUnplaced;
    bySemester.set(record.semester, current);
  }
  return [...bySemester.values()];
}

export function calculateMetrics(
  records: PlacementRecord[],
  baselineRecords: PlacementRecord[] = records,
): DashboardMetrics {
  const semesterMap = new Map<string, number>();
  const companyMap = new Map<
    string,
    { name: string; count: number; semesters: Set<string>; durations: number[] }
  >();
  const themeMap = new Map<Theme, number>(THEMES.map((theme) => [theme, 0]));

  for (const record of records) {
    semesterMap.set(record.semester, (semesterMap.get(record.semester) ?? 0) + 1);
    themeMap.set(record.theme, (themeMap.get(record.theme) ?? 0) + 1);
    const company = companyMap.get(record.companyKey) ?? {
      name: record.company,
      count: 0,
      semesters: new Set<string>(),
      durations: [],
    };
    company.count += 1;
    company.semesters.add(record.semester);
    if (record.durationDays !== null && record.durationDays >= 30 && record.durationDays <= 365) {
      company.durations.push(record.durationDays);
    }
    companyMap.set(record.companyKey, company);
  }

  const semesterTrend = [...semesterMap.entries()]
    .map(([semester, count]) => ({ semester, count }))
    .sort((a, b) => semesterOrder(a.semester) - semesterOrder(b.semester));

  const companyPortfolio = [...companyMap.entries()]
    .map(([key, item]) => ({
      key,
      name: item.name,
      students: item.count,
      semesters: item.semesters.size,
      medianDuration: median(item.durations),
    }))
    .sort((a, b) => b.students - a.students || b.semesters - a.semesters);

  const validDurations = records
    .map((record) => record.durationDays)
    .filter((days): days is number => days !== null && days >= 30 && days <= 365);
  const averageDuration = validDurations.length
    ? Math.round(validDurations.reduce((sum, days) => sum + days, 0) / validDurations.length)
    : null;
  const reported = uniqueReported(records);
  const placed = reported.reduce((sum, [value]) => sum + value, 0);
  const unplaced = reported.reduce((sum, [, value]) => sum + value, 0);

  const actualBySemester = new Map(semesterMap);
  const reportedBySemester = new Map<string, number>();
  for (const record of records) {
    if (record.reportedPlaced !== null) reportedBySemester.set(record.semester, record.reportedPlaced);
  }

  const quality = {
    missingStart: records.filter((record) => !record.startDate).length,
    missingEnd: records.filter((record) => !record.endDate).length,
    invalidDuration: records.filter(
      (record) =>
        record.durationDays !== null &&
        (record.durationDays < 30 || record.durationDays > 365),
    ).length,
    reportedMismatch: [...reportedBySemester].filter(
      ([semester, value]) => actualBySemester.get(semester) !== value,
    ).length,
    completeness: records.length
      ? Math.round(
          (records.reduce(
            (sum, record) => sum + Number(Boolean(record.startDate)) + Number(Boolean(record.endDate)),
            0,
          ) /
            (records.length * 2)) *
            100,
        )
      : 0,
  };

  const latest = semesterTrend.at(-1);
  const previous = semesterTrend.at(-2);
  const change = latest && previous ? latest.count - previous.count : 0;
  const topFive = companyPortfolio.slice(0, 5).reduce((sum, item) => sum + item.students, 0);
  const firstSeen = new Map<string, number>();
  for (const record of baselineRecords) {
    const current = firstSeen.get(record.companyKey);
    if (current === undefined || record.semesterOrder < current) {
      firstSeen.set(record.companyKey, record.semesterOrder);
    }
  }
  const organizationsBySemester = new Map<string, Set<string>>();
  for (const record of records) {
    const organizations = organizationsBySemester.get(record.semester) ?? new Set<string>();
    organizations.add(record.companyKey);
    organizationsBySemester.set(record.semester, organizations);
  }
  const organizationContinuity = [...organizationsBySemester.entries()]
    .sort(([a], [b]) => semesterOrder(a) - semesterOrder(b))
    .map(([semester, organizations]) => {
      const order = semesterOrder(semester);
      const newOrganizations = [...organizations].filter((key) => firstSeen.get(key) === order).length;
      return {
        semester,
        newOrganizations,
        recurringOrganizations: organizations.size - newOrganizations,
      };
    });

  const geography = new Map<string, { value: number; city: string }>();
  for (const record of records) {
    if (!record.city) continue;
    const label = record.department ? `${record.city} · ${record.department}` : record.city;
    const item = geography.get(label) ?? { value: 0, city: record.city };
    item.value += 1;
    geography.set(label, item);
  }
  const geographyCounts = [...geography.entries()]
    .map(([name, item]) => ({ name, value: item.value, city: item.city }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const sectorMap = new Map<string, number>();
  for (const record of records) {
    const sector = record.sector || "Sin clasificar";
    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + 1);
  }
  const sectorCounts = [...sectorMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const insights = records.length
    ? [
        latest && previous
          ? `${latest.semester} registra ${latest.count} practicantes: ${Math.abs(change)} ${change >= 0 ? "más" : "menos"} que ${previous.semester}.`
          : "Seleccione más de un semestre para comparar la evolución.",
        `${companyPortfolio[0]?.name ?? "La principal organización"} lidera con ${companyPortfolio[0]?.students ?? 0} vinculaciones; las cinco primeras concentran ${Math.round((topFive / records.length) * 100)}%.`,
        `${sectorCounts[0]?.name ?? "El sector principal"} concentra ${sectorCounts[0]?.value ?? 0} prácticas en la selección.`,
      ]
    : ["No hay registros para la combinación de filtros seleccionada."];

  return {
    placements: records.length,
    companies: companyMap.size,
    averageDuration,
    placementRate: placed + unplaced ? Math.round((placed / (placed + unplaced)) * 1000) / 10 : null,
    semesterTrend,
    topCompanies: companyPortfolio.slice(0, 8).map((item) => ({
      key: item.key,
      name: item.name,
      count: item.students,
      semesters: item.semesters,
    })),
    themeCounts: [...themeMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value),
    sectorCounts,
    organizationContinuity,
    geographyCounts,
    quality,
    insights,
  };
}

export function filterOptions(records: PlacementRecord[]) {
  const semesters = [...new Set(records.map((record) => record.semester))].sort(
    (a, b) => semesterOrder(a) - semesterOrder(b),
  );
  const companies = [...new Map(records.map((record) => [record.companyKey, record.company])).entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const departments = [...new Set(records.map((record) => record.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const cities = [...new Set(records.map((record) => record.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const sectors = [...new Set(records.map((record) => record.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  return { semesters, companies, themes: THEMES, departments, cities, sectors };
}
