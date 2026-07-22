import fallback from "./data/fallback.json";
import {
  classifyTheme,
  durationDays,
  hydrateRecord,
  normalizeSemester,
  parseGvizDate,
} from "./analytics";
import type { FallbackPayload, LoadedDataset, PlacementRecord } from "./types";

const SHEET_ID = __PUBLIC_SHEET_ID__;
const QUERY = "select A,B,D,E,F,G,H,I,M,N,O,P,Q";

interface GvizCell {
  v?: unknown;
  f?: string;
}

interface GvizResponse {
  status: string;
  errors?: Array<{ message?: string; detailed_message?: string }>;
  table?: { rows: Array<{ c: Array<GvizCell | null> }> };
}

function numericCell(cell: GvizCell | null | undefined): number | null {
  if (cell?.v === null || cell?.v === undefined || cell.v === "") return null;
  const value = Number(cell.v);
  return Number.isFinite(value) ? value : null;
}

function textCell(cell: GvizCell | null | undefined): string {
  return String(cell?.v ?? cell?.f ?? "").trim();
}

function transformGviz(response: GvizResponse): PlacementRecord[] {
  if (response.status !== "ok" || !response.table) {
    const message = response.errors?.[0]?.detailed_message || response.errors?.[0]?.message;
    throw new Error(message || "Google Sheets no devolvió una tabla válida.");
  }

  return response.table.rows
    .map((row, index) => {
      const cells = row.c ?? [];
      const semester = normalizeSemester(cells[2]?.v, cells[2]?.f);
      const startDate = parseGvizDate(cells[4]?.v);
      const endDate = parseGvizDate(cells[5]?.v);
      const company = textCell(cells[3]);
      if (!company || semester === "Sin semestre") return null;

      return hydrateRecord(
        {
          semester,
          company,
          city: textCell(cells[11]),
          department: textCell(cells[12]),
          startDate,
          endDate,
          durationDays: durationDays(startDate, endDate),
          theme: classifyTheme(textCell(cells[6])),
          visitsCompleted: [cells[8], cells[9], cells[10]].filter(
            (cell) => textCell(cell).length > 0,
          ).length,
          reportedPlaced: numericCell(cells[1]),
          reportedUnplaced: numericCell(cells[0]),
        },
        index,
      );
    })
    .filter((record): record is PlacementRecord => record !== null);
}

function loadJsonp(timeoutMs = 12_000): Promise<PlacementRecord[]> {
  if (!SHEET_ID) return Promise.reject(new Error("La publicación usa el respaldo agregado de privacidad."));
  return new Promise((resolve, reject) => {
    const callbackName = `__unicomfacauca_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => finish(new Error("La consulta tardó demasiado.")), timeoutMs);

    const cleanup = () => {
      window.clearTimeout(timeout);
      script.remove();
      delete (window as unknown as Record<string, unknown>)[callbackName];
    };
    const finish = (error?: Error, records?: PlacementRecord[]) => {
      cleanup();
      if (error) reject(error);
      else resolve(records ?? []);
    };

    (window as unknown as Record<string, unknown>)[callbackName] = (response: GvizResponse) => {
      try {
        finish(undefined, transformGviz(response));
      } catch (error) {
        finish(error instanceof Error ? error : new Error("No fue posible interpretar la hoja."));
      }
    };

    const params = new URLSearchParams({
      sheet: "Consolidado",
      tq: QUERY,
      tqx: `out:json;responseHandler:${callbackName}`,
    });
    script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`;
    script.onerror = () => finish(new Error("No fue posible conectar con Google Sheets."));
    document.head.appendChild(script);
  });
}

function loadFallback(): PlacementRecord[] {
  const payload = fallback as FallbackPayload;
  return payload.records.map((record, index) => hydrateRecord(record, index));
}

export async function loadDataset(): Promise<LoadedDataset> {
  try {
    const records = await loadJsonp();
    if (!records.length) throw new Error("La hoja no contiene registros legibles.");
    return { records, source: "Google Sheets", loadedAt: new Date() };
  } catch (error) {
    return {
      records: loadFallback(),
      source: "respaldo local",
      loadedAt: new Date((fallback as FallbackPayload).generatedAt),
      warning: error instanceof Error ? error.message : "No fue posible actualizar los datos.",
    };
  }
}
