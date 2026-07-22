interface AdminPayload {
  headers: string[];
  rows: string[][];
  updatedAt: string;
}

interface AdminStatus {
  available: boolean;
  authenticated: boolean;
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`No se encontró #${id}.`);
  return element as T;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "No fue posible completar la solicitud.");
  return payload;
}

export function initializeAdmin() {
  const dialog = byId<HTMLDialogElement>("admin-dialog");
  const loading = byId<HTMLElement>("admin-loading");
  const unavailable = byId<HTMLElement>("admin-unavailable");
  const login = byId<HTMLFormElement>("admin-login");
  const dataView = byId<HTMLElement>("admin-data");
  const password = byId<HTMLInputElement>("admin-password");
  const error = byId<HTMLElement>("admin-error");
  const search = byId<HTMLInputElement>("admin-search");
  const semester = byId<HTMLSelectElement>("admin-semester");
  const head = byId<HTMLTableSectionElement>("admin-table-head");
  const body = byId<HTMLTableSectionElement>("admin-table-body");
  const count = byId<HTMLElement>("admin-count");
  let payload: AdminPayload | null = null;

  const showOnly = (target: HTMLElement) => {
    [loading, unavailable, login, dataView].forEach((section) => {
      section.hidden = section !== target;
    });
  };

  const renderRows = () => {
    if (!payload) return;
    const semesterIndex = payload.headers.findIndex((header) => normalize(header).includes("semestre"));
    const query = normalize(search.value);
    const selectedSemester = semester.value;
    const rows = payload.rows.filter((row) => {
      const matchesSemester = selectedSemester === "__all__" || row[semesterIndex] === selectedSemester;
      const matchesQuery = !query || normalize(row.join(" ")).includes(query);
      return matchesSemester && matchesQuery;
    });

    body.replaceChildren();
    const fragment = document.createDocumentFragment();
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      payload?.headers.forEach((_, index) => {
        const td = document.createElement("td");
        td.textContent = row[index] || "—";
        tr.appendChild(td);
      });
      fragment.appendChild(tr);
    });
    body.appendChild(fragment);
    count.textContent = `${new Intl.NumberFormat("es-CO").format(rows.length)} registros`;
  };

  const renderPayload = (nextPayload: AdminPayload) => {
    payload = nextPayload;
    const headerRow = document.createElement("tr");
    nextPayload.headers.forEach((header) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = header;
      headerRow.appendChild(th);
    });
    head.replaceChildren(headerRow);

    const semesterIndex = nextPayload.headers.findIndex((header) => normalize(header).includes("semestre"));
    const semesters = [...new Set(nextPayload.rows.map((row) => row[semesterIndex]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es"));
    semester.replaceChildren();
    const all = document.createElement("option");
    all.value = "__all__";
    all.textContent = "Todos";
    semester.appendChild(all);
    semesters.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      semester.appendChild(option);
    });
    renderRows();
    showOnly(dataView);
  };

  const loadRecords = async () => {
    showOnly(loading);
    try {
      renderPayload(await requestJson<AdminPayload>("/api/admin/records"));
    } catch (reason) {
      error.textContent = reason instanceof Error ? reason.message : "No fue posible cargar la información.";
      showOnly(login);
    }
  };

  const open = async () => {
    if (!dialog.open) dialog.showModal();
    showOnly(loading);
    try {
      const status = await requestJson<AdminStatus>("/api/admin/status");
      if (!status.available) showOnly(unavailable);
      else if (status.authenticated) await loadRecords();
      else {
        showOnly(login);
        window.setTimeout(() => password.focus(), 0);
      }
    } catch {
      showOnly(unavailable);
    }
  };

  byId<HTMLButtonElement>("admin-button").addEventListener("click", open);
  byId<HTMLButtonElement>("admin-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  login.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    try {
      await requestJson<{ ok: boolean }>("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: password.value }),
      });
      password.value = "";
      await loadRecords();
    } catch (reason) {
      error.textContent = reason instanceof Error ? reason.message : "Acceso rechazado.";
      password.select();
    }
  });
  byId<HTMLButtonElement>("admin-logout").addEventListener("click", async () => {
    await requestJson<{ ok: boolean }>("/api/admin/logout", { method: "POST", body: "{}" }).catch(() => undefined);
    payload = null;
    showOnly(login);
    password.focus();
  });
  search.addEventListener("input", renderRows);
  semester.addEventListener("change", renderRows);
}
