import directorySource from "./data/directory.json";
import type { DirectoryPayload, DirectoryRecord } from "./types";

const payload = directorySource as DirectoryPayload;
const formatter = new Intl.NumberFormat("es-CO");

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`No se encontró #${id}.`);
  return element as T;
};

function addOptions(select: HTMLSelectElement, values: string[]) {
  const all = document.createElement("option");
  all.value = "__all__";
  all.textContent = "Todos";
  select.appendChild(all);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function cell(value: string, fallback = "No registrado") {
  const td = document.createElement("td");
  td.textContent = value || fallback;
  return td;
}

export function initializeDirectory() {
  const dialog = byId<HTMLDialogElement>("directory-dialog");
  const search = byId<HTMLInputElement>("directory-search");
  const semester = byId<HTMLSelectElement>("directory-semester");
  const city = byId<HTMLSelectElement>("directory-city");
  const body = byId<HTMLTableSectionElement>("directory-table-body");
  const count = byId<HTMLElement>("directory-count");
  const updated = byId<HTMLElement>("directory-updated");

  addOptions(
    semester,
    [...new Set(payload.records.map((record) => record.semester))].sort((a, b) =>
      a.localeCompare(b, "es", { numeric: true }),
    ),
  );
  addOptions(
    city,
    [...new Set(payload.records.map((record) => record.city).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "es"),
    ),
  );

  updated.textContent = `Actualizado ${new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
  }).format(new Date(payload.generatedAt))}`;

  const renderRows = () => {
    const query = normalize(search.value);
    const records = payload.records.filter((record) => {
      const matchesSemester = semester.value === "__all__" || record.semester === semester.value;
      const matchesCity = city.value === "__all__" || record.city === city.value;
      const haystack = normalize([
        record.studentName,
        record.company,
        record.projectTitle,
        record.tutorName,
        record.city,
        record.department,
        record.theme,
      ].join(" "));
      return matchesSemester && matchesCity && (!query || haystack.includes(query));
    });

    const fragment = document.createDocumentFragment();
    records.forEach((record: DirectoryRecord) => {
      const row = document.createElement("tr");
      row.append(
        cell(record.studentName),
        cell(record.semester),
        cell(record.company),
        cell(record.projectTitle),
        cell(record.tutorName),
        cell([record.city, record.department].filter(Boolean).join(" · ")),
      );
      fragment.appendChild(row);
    });
    body.replaceChildren(fragment);
    count.textContent = `${formatter.format(records.length)} ${records.length === 1 ? "registro" : "registros"}`;
  };

  byId<HTMLButtonElement>("directory-button").addEventListener("click", () => {
    if (!dialog.open) dialog.showModal();
    renderRows();
    window.setTimeout(() => search.focus(), 0);
  });
  byId<HTMLButtonElement>("directory-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  search.addEventListener("input", renderRows);
  semester.addEventListener("change", renderRows);
  city.addEventListener("change", renderRows);
  renderRows();
}
