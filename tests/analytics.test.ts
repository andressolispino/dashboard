import { describe, expect, it } from "vitest";
import {
  calculateMetrics,
  classifyTheme,
  durationDays,
  hydrateRecord,
  normalizeCompany,
  normalizeSemester,
} from "../src/analytics";

describe("normalización de la fuente", () => {
  it("unifica semestres almacenados como texto o fecha de GViz", () => {
    expect(normalizeSemester("2020 - 1")).toBe("2020-1");
    expect(normalizeSemester("Date(2026,0,1)")).toBe("2026-1");
    expect(normalizeSemester("2025-02-01T00:00:00")).toBe("2025-2");
  });

  it("unifica la organización institucional", () => {
    expect(normalizeCompany("Corporación Universitaria Comfacauca-Unicomfacauca").key).toBe("UNICOMFACAUCA");
    expect(normalizeCompany("UNICOMFACAUCA").key).toBe("UNICOMFACAUCA");
    expect(normalizeCompany("Fundación Universitaria Marica Cano").key).toBe(
      "FUNDACION UNIVERSITARIA MARIA CANO",
    );
  });

  it("clasifica proyectos mediante reglas explicables", () => {
    expect(classifyTheme("Desarrollo de una plataforma web")).toBe("Software y transformación digital");
    expect(classifyTheme("Diseño CAD de una máquina")).toBe("Diseño y desarrollo de producto");
    expect(classifyTheme("Proyecto por definir")).toBe("Sin información / por definir");
  });
});

describe("indicadores", () => {
  it("calcula duración en días", () => {
    expect(durationDays("2026-01-01", "2026-04-01")).toBe(90);
  });

  it("excluye duraciones atípicas del promedio y las reporta", () => {
    const records = [90, 120, 900].map((days, index) =>
      hydrateRecord(
        {
          semester: "2026-1",
          company: `Empresa ${index}`,
          city: "Popayán",
          department: "Cauca",
          sector: "Tecnología, ingeniería y automatización",
          startDate: "2026-01-01",
          endDate: "2026-04-01",
          durationDays: days,
          theme: "Ingeniería y soporte técnico",
          visitsCompleted: index,
          reportedPlaced: index === 0 ? 3 : null,
          reportedUnplaced: index === 0 ? 0 : null,
        },
        index,
      ),
    );
    const metrics = calculateMetrics(records);
    expect(metrics.averageDuration).toBe(105);
    expect(metrics.quality.invalidDuration).toBe(1);
    expect(metrics.placements).toBe(3);
    expect(metrics.placementRate).toBe(100);
  });
});
