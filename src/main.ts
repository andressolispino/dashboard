import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/montserrat/latin-700.css";
import "./style.css";

import { ALL_FILTER, calculateMetrics, filterOptions, filterRecords } from "./analytics";
import { initializeAdmin } from "./admin";
import { observeCharts, renderCharts } from "./charts";
import { loadDataset } from "./data-source";
import type { DataQuality, FilterState, LoadedDataset } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("No se encontró el contenedor principal.");

app.innerHTML = `
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <img src="./assets/unicomfacauca-logo-color.png" alt="Corporación Universitaria Comfacauca" />
        <div class="brand-copy">
          <span>Analítica institucional</span>
          <strong>Prácticas empresariales</strong>
        </div>
      </div>

      <section class="filters" aria-labelledby="filter-title">
        <div class="section-label" id="filter-title">Explorar información</div>
        <label>
          <span>Semestre</span>
          <select id="semester-filter" aria-label="Filtrar por semestre"></select>
        </label>
        <label>
          <span>Departamento</span>
          <select id="department-filter" aria-label="Filtrar por departamento"></select>
        </label>
        <label>
          <span>Ciudad</span>
          <select id="city-filter" aria-label="Filtrar por ciudad"></select>
        </label>
        <label>
          <span>Organización</span>
          <select id="company-filter" aria-label="Filtrar por organización"></select>
        </label>
        <label>
          <span>Temática del proyecto</span>
          <select id="theme-filter" aria-label="Filtrar por temática"></select>
        </label>
        <button class="reset-button" id="reset-filters" type="button">
          <span aria-hidden="true">↺</span> Restablecer filtros
        </button>
        <button class="admin-button" id="admin-button" type="button">
          <span aria-hidden="true">▣</span> Modo administrador
        </button>
      </section>

      <div class="sidebar-note">
        <div class="status-row">
          <span class="status-dot loading" id="status-dot"></span>
          <span id="source-status">Conectando con Google Sheets…</span>
        </div>
        <small id="sync-time">Preparando información</small>
        <p>Vista analítica sin nombres, teléfonos, correos ni tutores empresariales.</p>
      </div>
    </aside>

    <main class="main-content">
      <header class="hero">
        <div class="hero-identity">
          <img class="hero-logo" src="./assets/unicomfacauca-logo-color.png" alt="Corporación Universitaria Comfacauca - Unicomfacauca" />
          <div>
            <div class="eyebrow">Analítica institucional</div>
            <h1>Dashboard de<br /><em>Prácticas Empresariales</em></h1>
          </div>
        </div>
        <div class="hero-meta">
          <span class="live-pill" id="hero-source-pill"><i></i><span id="hero-source-status">Conectando datos</span></span>
          <strong id="period-range">2020-1 — 2026-1</strong>
        </div>
      </header>

      <div class="active-filter" id="active-filter" hidden></div>

      <section class="kpi-grid" aria-label="Indicadores principales">
        <article class="kpi-card blue">
          <div class="kpi-icon" aria-hidden="true">↗</div>
          <span>Practicantes ubicados</span>
          <strong id="kpi-placements">—</strong>
          <small id="kpi-placement-rate">Calculando tasa de ubicación</small>
        </article>
        <article class="kpi-card orange">
          <div class="kpi-icon" aria-hidden="true">◇</div>
          <span>Organizaciones aliadas</span>
          <strong id="kpi-companies">—</strong>
          <small>Entidades únicas en la selección</small>
        </article>
        <article class="kpi-card green">
          <div class="kpi-icon" aria-hidden="true">◷</div>
          <span>Duración mediana</span>
          <strong id="kpi-duration">—</strong>
          <small>Excluye fechas atípicas o incompletas</small>
        </article>
        <article class="kpi-card cyan">
          <div class="kpi-icon" aria-hidden="true">✓</div>
          <span>Tasa de ubicación</span>
          <strong id="kpi-placement">—</strong>
          <small>Ubicados sobre el total reportado</small>
        </article>
      </section>

      <section class="insight-strip" aria-label="Hallazgos automáticos">
        <div class="insight-heading">
          <span>✦</span>
          <div><small>Resumen ejecutivo</small><strong>Resultados destacados</strong></div>
        </div>
        <div class="insight-list" id="insights"></div>
      </section>

      <section class="dashboard-grid">
        <article class="panel panel-wide">
          <div class="panel-heading">
            <div><span>Evolución histórica</span><h2>Practicantes por semestre</h2></div>
            <small>Haga clic en una barra para filtrar</small>
          </div>
          <div class="chart chart-tall" data-chart="trend" role="img" aria-label="Evolución de practicantes por semestre"></div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div><span>Red empresarial</span><h2>Organizaciones con mayor vinculación</h2></div>
          </div>
          <div class="chart chart-tall" data-chart="companies" role="img" aria-label="Organizaciones con más practicantes"></div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div><span>Portafolio de proyectos</span><h2>Áreas de trabajo identificadas</h2></div>
          </div>
          <div class="chart chart-tall" data-chart="themes" role="img" aria-label="Distribución de temáticas de proyecto"></div>
          <details class="methodology"><summary>¿Cómo se clasifican?</summary><p>La categoría se asigna automáticamente con palabras clave del título o descripción del proyecto. Es una aproximación analítica y puede corregirse agregando una categoría oficial en la hoja.</p></details>
        </article>

        <article class="panel panel-wide">
          <div class="panel-heading">
            <div><span>Continuidad empresarial</span><h2>Organizaciones nuevas y recurrentes</h2></div>
            <small>Recurrente = participó en un semestre anterior</small>
          </div>
          <div class="chart chart-medium" data-chart="continuity" role="img" aria-label="Organizaciones nuevas y recurrentes por semestre"></div>
        </article>

        <article class="panel">
          <div class="panel-heading">
            <div><span>Alcance territorial</span><h2>Prácticas por ciudad</h2></div>
          </div>
          <div class="chart chart-medium" data-chart="geography" role="img" aria-label="Prácticas por ciudad y departamento"></div>
        </article>

        <article class="panel quality-panel">
          <div class="panel-heading">
            <div><span>Gobierno del dato</span><h2>Calidad de la base</h2></div>
            <strong class="quality-score" id="quality-score">—</strong>
          </div>
          <div class="quality-progress"><i id="quality-progress"></i></div>
          <div class="quality-list">
            <div><span>Fechas de inicio faltantes</span><strong id="quality-start">—</strong></div>
            <div><span>Fechas de fin faltantes</span><strong id="quality-end">—</strong></div>
            <div><span>Duraciones atípicas</span><strong id="quality-duration">—</strong></div>
            <div><span>Semestres con total inconsistente</span><strong id="quality-mismatch">—</strong></div>
          </div>
          <p class="quality-help">Estas alertas no se eliminan: se aíslan de los cálculos sensibles y quedan visibles para su corrección en Sheets.</p>
        </article>
      </section>

      <footer>
        <span>Dashboard de Prácticas Empresariales · Unicomfacauca</span>
        <span>Datos agregados · Sin información personal en pantalla</span>
      </footer>
    </main>
  </div>
  <div class="loading-overlay" id="loading-overlay">
    <div class="loader-mark"><span></span></div>
    <strong>Preparando la historia de las prácticas</strong>
    <small>Normalizando semestres, fechas y organizaciones…</small>
  </div>
  <dialog class="admin-dialog" id="admin-dialog" aria-labelledby="admin-title">
    <div class="admin-shell">
      <header class="admin-header">
        <div>
          <span>Acceso institucional protegido</span>
          <h2 id="admin-title">Modo administrador</h2>
        </div>
        <button class="dialog-close" id="admin-close" type="button" aria-label="Cerrar">×</button>
      </header>

      <section class="admin-message" id="admin-loading">
        <strong>Verificando acceso…</strong>
        <p>La información personal solo se solicita después de validar la sesión.</p>
      </section>

      <section class="admin-message" id="admin-unavailable" hidden>
        <strong>El servidor seguro no está activo</strong>
        <p>Inicie el proyecto con <code>pnpm run serve:secure</code> y configure una contraseña en <code>.env.local</code>. Esta función no se habilita en una publicación estática de GitHub Pages.</p>
      </section>

      <form class="admin-login" id="admin-login" hidden>
        <label for="admin-password">Contraseña de administrador</label>
        <div class="admin-login-row">
          <input id="admin-password" name="password" type="password" minlength="12" maxlength="256" autocomplete="current-password" required />
          <button type="submit">Ingresar</button>
        </div>
        <p id="admin-error" role="alert"></p>
        <small>La contraseña se valida en el servidor; nunca queda incluida en el código del dashboard.</small>
      </form>

      <section class="admin-data" id="admin-data" hidden>
        <div class="admin-toolbar">
          <label>
            <span>Buscar estudiante, proyecto u organización</span>
            <input id="admin-search" type="search" placeholder="Escriba para filtrar…" />
          </label>
          <label>
            <span>Semestre</span>
            <select id="admin-semester"></select>
          </label>
          <button class="admin-logout" id="admin-logout" type="button">Cerrar sesión</button>
        </div>
        <div class="admin-result-line"><strong id="admin-count">0 registros</strong><span>Información de consulta; las correcciones se realizan en Google Sheets.</span></div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead id="admin-table-head"></thead>
            <tbody id="admin-table-body"></tbody>
          </table>
        </div>
      </section>
    </div>
  </dialog>
`;

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`No se encontró ${selector}.`);
  return element;
};

const formatter = new Intl.NumberFormat("es-CO");
const state: FilterState = {
  semester: ALL_FILTER,
  companyKey: ALL_FILTER,
  theme: ALL_FILTER,
  city: ALL_FILTER,
  department: ALL_FILTER,
};
let dataset: LoadedDataset;
let globalQuality: DataQuality;

function setOptions(select: HTMLSelectElement, options: Array<{ value: string; label: string }>) {
  select.innerHTML = [
    `<option value="${ALL_FILTER}">Todos</option>`,
    ...options.map((option) => `<option value="${option.value}">${option.label}</option>`),
  ].join("");
}

function element<T extends HTMLElement>(selector: string): T {
  return $<T>(selector);
}

function render() {
  const filtered = filterRecords(dataset.records, state);
  const metrics = calculateMetrics(filtered);

  element<HTMLElement>("#kpi-placements").textContent = formatter.format(metrics.placements);
  element<HTMLElement>("#kpi-companies").textContent = formatter.format(metrics.companies);
  element<HTMLElement>("#kpi-duration").textContent = metrics.medianDuration ? `${metrics.medianDuration} días` : "Sin dato";
  const placementScope = filterRecords(dataset.records, { ...state, companyKey: ALL_FILTER, theme: ALL_FILTER, city: ALL_FILTER, department: ALL_FILTER });
  const placementRate = calculateMetrics(placementScope, dataset.records).placementRate;
  element<HTMLElement>("#kpi-placement").textContent = placementRate !== null ? `${placementRate}%` : "Sin dato";
  element<HTMLElement>("#kpi-placement-rate").textContent = placementRate !== null
    ? `${placementRate}% de ubicación reportada`
    : "Sin totales de ubicación para esta selección";

  element<HTMLElement>("#insights").innerHTML = metrics.insights
    .map((insight, index) => `<p><span>0${index + 1}</span>${insight}</p>`)
    .join("");

  element<HTMLElement>("#quality-score").textContent = `${globalQuality.completeness}%`;
  element<HTMLElement>("#quality-progress").style.width = `${globalQuality.completeness}%`;
  element<HTMLElement>("#quality-start").textContent = String(globalQuality.missingStart);
  element<HTMLElement>("#quality-end").textContent = String(globalQuality.missingEnd);
  element<HTMLElement>("#quality-duration").textContent = String(globalQuality.invalidDuration);
  element<HTMLElement>("#quality-mismatch").textContent = String(globalQuality.reportedMismatch);

  const period = metrics.semesterTrend;
  element<HTMLElement>("#period-range").textContent = period.length
    ? `${period[0].semester} — ${period.at(-1)?.semester}`
    : "Sin registros";

  const active = element<HTMLElement>("#active-filter");
  const labels = [
    state.semester !== ALL_FILTER ? state.semester : "",
    state.companyKey !== ALL_FILTER
      ? dataset.records.find((record) => record.companyKey === state.companyKey)?.company ?? ""
      : "",
    state.theme !== ALL_FILTER ? state.theme : "",
    state.department !== ALL_FILTER ? state.department : "",
    state.city !== ALL_FILTER ? state.city : "",
  ].filter(Boolean);
  active.hidden = labels.length === 0;
  active.innerHTML = labels.length
    ? `<span>Vista filtrada</span>${labels.map((label) => `<strong>${label}</strong>`).join("")}`
    : "";

  renderCharts(metrics, {
    semester: (value) => updateFilter("semester", value),
    company: (value) => updateFilter("companyKey", value),
    theme: (value) => updateFilter("theme", value),
    city: (value) => updateFilter("city", value),
  });
}

function updateFilter(key: keyof FilterState, value: string) {
  state[key] = value;
  const selector = key === "companyKey" ? "#company-filter" : `#${key}-filter`;
  element<HTMLSelectElement>(selector).value = value;
  render();
}

function bindControls() {
  element<HTMLSelectElement>("#semester-filter").addEventListener("change", (event) => {
    state.semester = (event.target as HTMLSelectElement).value;
    render();
  });
  element<HTMLSelectElement>("#company-filter").addEventListener("change", (event) => {
    state.companyKey = (event.target as HTMLSelectElement).value;
    render();
  });
  element<HTMLSelectElement>("#theme-filter").addEventListener("change", (event) => {
    state.theme = (event.target as HTMLSelectElement).value;
    render();
  });
  element<HTMLSelectElement>("#department-filter").addEventListener("change", (event) => {
    state.department = (event.target as HTMLSelectElement).value;
    render();
  });
  element<HTMLSelectElement>("#city-filter").addEventListener("change", (event) => {
    state.city = (event.target as HTMLSelectElement).value;
    render();
  });
  element<HTMLButtonElement>("#reset-filters").addEventListener("click", () => {
    state.semester = ALL_FILTER;
    state.companyKey = ALL_FILTER;
    state.theme = ALL_FILTER;
    state.department = ALL_FILTER;
    state.city = ALL_FILTER;
    element<HTMLSelectElement>("#semester-filter").value = ALL_FILTER;
    element<HTMLSelectElement>("#company-filter").value = ALL_FILTER;
    element<HTMLSelectElement>("#theme-filter").value = ALL_FILTER;
    element<HTMLSelectElement>("#department-filter").value = ALL_FILTER;
    element<HTMLSelectElement>("#city-filter").value = ALL_FILTER;
    render();
  });
}

async function start() {
  initializeAdmin();
  dataset = await loadDataset();
  globalQuality = calculateMetrics(dataset.records).quality;
  const options = filterOptions(dataset.records);
  setOptions(
    element<HTMLSelectElement>("#semester-filter"),
    options.semesters.map((semester) => ({ value: semester, label: semester })),
  );
  setOptions(
    element<HTMLSelectElement>("#department-filter"),
    options.departments.map((department) => ({ value: department, label: department })),
  );
  setOptions(
    element<HTMLSelectElement>("#city-filter"),
    options.cities.map((city) => ({ value: city, label: city })),
  );
  setOptions(
    element<HTMLSelectElement>("#company-filter"),
    options.companies.map((company) => ({ value: company.key, label: company.label })),
  );
  setOptions(
    element<HTMLSelectElement>("#theme-filter"),
    options.themes.map((theme) => ({ value: theme, label: theme })),
  );

  const dot = element<HTMLElement>("#status-dot");
  dot.className = `status-dot ${dataset.source === "Google Sheets" ? "online" : "fallback"}`;
  element<HTMLElement>("#source-status").textContent = dataset.source === "Google Sheets"
    ? "Google Sheets conectado"
    : "Usando respaldo seguro";
  element<HTMLElement>("#hero-source-status").textContent = dataset.source === "Google Sheets"
    ? "Conectado a Google Sheets"
    : "Datos agregados protegidos";
  element<HTMLElement>("#hero-source-pill").classList.toggle("fallback", dataset.source !== "Google Sheets");
  element<HTMLElement>("#sync-time").textContent = dataset.source === "Google Sheets"
    ? `Actualizado ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(dataset.loadedAt)}`
    : `Respaldo del ${new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" }).format(dataset.loadedAt)}`;
  if (dataset.warning) element<HTMLElement>("#source-status").title = dataset.warning;

  bindControls();
  render();
  observeCharts();
  window.setTimeout(() => element<HTMLElement>("#loading-overlay").classList.add("is-hidden"), 300);
}

start().catch((error) => {
  element<HTMLElement>("#loading-overlay").innerHTML = `
    <strong>No fue posible iniciar el dashboard</strong>
    <small>${error instanceof Error ? error.message : "Error inesperado"}</small>
  `;
});
