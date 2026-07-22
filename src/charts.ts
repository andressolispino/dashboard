import * as echarts from "echarts/core";
import { BarChart } from "echarts/charts";
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { DashboardMetrics } from "./types";

echarts.use([
  BarChart,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const COLORS = ["#004991", "#F08300", "#BCCF00", "#009FE3", "#662483", "#399D3F", "#FCBF00"];
const TEXT = "#29364d";
const MUTED = "#718096";
const GRID = "#e8edf4";

const SECTOR_LABELS: Record<string, string> = {
  "Educación, ciencia e innovación": "Educación",
  "Industria y manufactura": "Industria y manufactura",
  "Tecnología, ingeniería y automatización": "Tecnología",
  "Agroindustria y alimentos": "Agroindustria y alimentos",
  "Energía, ambiente y servicios públicos": "Energía y ambiente",
  "Construcción e infraestructura": "Infraestructura",
  "Salud y tecnología biomédica": "Salud y biomedicina",
  "Sector público y desarrollo social": "Sector público",
  "Consultoría y servicios profesionales": "Consultoría profesional",
};

type ChartName = "trend" | "companies" | "themes" | "continuity" | "sectors";
const charts = new Map<ChartName, echarts.ECharts>();

function chart(name: ChartName): echarts.ECharts {
  const existing = charts.get(name);
  if (existing) return existing;
  const element = document.querySelector<HTMLElement>(`[data-chart="${name}"]`);
  if (!element) throw new Error(`No se encontró el contenedor ${name}.`);
  const instance = echarts.init(element, undefined, { renderer: "canvas" });
  charts.set(name, instance);
  return instance;
}

function tooltip() {
  return {
    backgroundColor: "rgba(20, 34, 55, .96)",
    borderWidth: 0,
    padding: 12,
    textStyle: { color: "#fff", fontFamily: "Montserrat", fontSize: 12 },
    extraCssText: "border-radius:10px;box-shadow:0 12px 30px rgba(10,25,45,.18)",
  };
}

function axis() {
  return {
    axisLine: { lineStyle: { color: GRID } },
    axisTick: { show: false },
    axisLabel: { color: MUTED, fontFamily: "Montserrat", fontSize: 11 },
    splitLine: { lineStyle: { color: GRID, type: "dashed" as const } },
  };
}

export function renderCharts(
  metrics: DashboardMetrics,
  handlers: {
    semester: (value: string) => void;
    company: (value: string) => void;
    theme: (value: string) => void;
    sector: (value: string) => void;
  },
) {
  const trend = chart("trend");
  trend.setOption(
    {
      animationDuration: 550,
      color: COLORS,
      tooltip: { ...tooltip(), trigger: "axis" },
      grid: { left: 38, right: 18, top: 28, bottom: 34 },
      xAxis: {
        ...axis(),
        type: "category",
        data: metrics.semesterTrend.map((item) => item.semester),
        axisLabel: { ...axis().axisLabel, rotate: metrics.semesterTrend.length > 8 ? 38 : 0 },
      },
      yAxis: { ...axis(), type: "value", minInterval: 1 },
      series: [
        {
          name: "Practicantes",
          type: "bar",
          data: metrics.semesterTrend.map((item) => item.count),
          barMaxWidth: 28,
          itemStyle: { color: "#004991", borderRadius: [7, 7, 2, 2] },
        },
      ],
    },
    true,
  );
  trend.off("click");
  trend.on("click", (params) => {
    if (typeof params.name === "string") handlers.semester(params.name);
  });

  const companies = chart("companies");
  const companyData = [...metrics.topCompanies].reverse();
  companies.setOption(
    {
      animationDuration: 550,
      tooltip: {
        ...tooltip(),
        trigger: "item",
        formatter: (params: { name: string; value: number; dataIndex: number }) => {
          const item = companyData[params.dataIndex];
          return `<strong>${params.name}</strong><br>${params.value} practicantes · ${item.semesters} semestres`;
        },
      },
      grid: { left: 176, right: 28, top: 12, bottom: 10, containLabel: false },
      xAxis: { ...axis(), type: "value", minInterval: 1 },
      yAxis: {
        ...axis(),
        type: "category",
        data: companyData.map((item) => item.name),
        axisLabel: { ...axis().axisLabel, width: 160, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          data: companyData.map((item) => ({ value: item.count, itemStyle: { color: "#009FE3" } })),
          barMaxWidth: 18,
          itemStyle: { borderRadius: [0, 7, 7, 0] },
        },
      ],
    },
    true,
  );
  companies.off("click");
  companies.on("click", (params) => {
    const item = companyData[params.dataIndex];
    if (item) handlers.company(item.key);
  });

  const themes = chart("themes");
  themes.setOption(
    {
      color: COLORS,
      tooltip: { ...tooltip(), trigger: "axis", valueFormatter: (value: unknown) => `${value} proyectos` },
      grid: { left: 194, right: 34, top: 12, bottom: 10, containLabel: false },
      xAxis: { ...axis(), type: "value", minInterval: 1 },
      yAxis: {
        ...axis(),
        type: "category",
        data: [...metrics.themeCounts].reverse().map((item) => item.name),
        axisLabel: { ...axis().axisLabel, width: 178, overflow: "truncate" },
      },
      series: [
        {
          type: "bar",
          data: [...metrics.themeCounts].reverse().map((item, index) => ({ value: item.value, itemStyle: { color: COLORS[index % COLORS.length] } })),
          barMaxWidth: 22,
          itemStyle: { borderRadius: [0, 7, 7, 0] },
          label: { show: true, position: "right", color: TEXT, fontWeight: 600 },
        },
      ],
    },
    true,
  );
  themes.off("click");
  themes.on("click", (params) => {
    if (typeof params.name === "string") handlers.theme(params.name);
  });

  const sectors = chart("sectors");
  const sectorData = metrics.sectorCounts.slice(0, 8).reverse();
  sectors.setOption(
    {
      animationDuration: 550,
      tooltip: { ...tooltip(), trigger: "axis", valueFormatter: (value: unknown) => `${value} prácticas` },
      grid: { left: 180, right: 34, top: 10, bottom: 10, containLabel: false },
      xAxis: { ...axis(), type: "value", minInterval: 1 },
      yAxis: {
        ...axis(),
        type: "category",
        data: sectorData.map((item) => item.name),
        axisLabel: {
          ...axis().axisLabel,
          width: 165,
          overflow: "truncate",
          formatter: (value: string) => SECTOR_LABELS[value] ?? value,
        },
      },
      series: [
        {
          type: "bar",
          data: sectorData.map((item, index) => ({ value: item.value, itemStyle: { color: COLORS[(index + 2) % COLORS.length] } })),
          barMaxWidth: 20,
          itemStyle: { borderRadius: [0, 7, 7, 0] },
          label: { show: true, position: "right", color: TEXT, fontWeight: 600 },
        },
      ],
    },
    true,
  );
  sectors.off("click");
  sectors.on("click", (params) => {
    if (typeof params.name === "string") handlers.sector(params.name);
  });

  const continuity = chart("continuity");
  continuity.setOption(
    {
      color: ["#004991", "#BCCF00"],
      tooltip: { ...tooltip(), trigger: "axis" },
      legend: { top: 0, right: 8, textStyle: { color: MUTED, fontFamily: "Montserrat", fontSize: 10 }, icon: "roundRect" },
      grid: { left: 38, right: 18, top: 44, bottom: 36 },
      xAxis: { ...axis(), type: "category", data: metrics.organizationContinuity.map((item) => item.semester), axisLabel: { ...axis().axisLabel, rotate: 35 } },
      yAxis: { ...axis(), type: "value", minInterval: 1 },
      series: [
        { name: "Nuevas", type: "bar", stack: "organizaciones", data: metrics.organizationContinuity.map((item) => item.newOrganizations), itemStyle: { borderRadius: [0, 0, 2, 2] } },
        { name: "Recurrentes", type: "bar", stack: "organizaciones", data: metrics.organizationContinuity.map((item) => item.recurringOrganizations), itemStyle: { borderRadius: [7, 7, 0, 0] } },
      ],
    },
    true,
  );
  continuity.off("click");
  continuity.on("click", (params) => {
    if (typeof params.name === "string") handlers.semester(params.name);
  });

}

const resizeObserver = new ResizeObserver(() => charts.forEach((instance) => instance.resize()));

export function observeCharts() {
  document.querySelectorAll<HTMLElement>("[data-chart]").forEach((element) => resizeObserver.observe(element));
}
