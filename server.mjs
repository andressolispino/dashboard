import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const DIST = resolve(process.cwd(), "dist");
const SHEET_ID = process.env.GOOGLE_SHEET_ID || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_AVAILABLE = ADMIN_PASSWORD.length >= 12 && Boolean(SHEET_ID);
const SESSION_TTL = 2 * 60 * 60 * 1000;
const sessions = new Map();
const attempts = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

function securityHeaders(contentType) {
  return {
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' https://docs.google.com; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  };
}

function json(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    ...securityHeaders("application/json; charset=utf-8"),
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function cookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

function authenticated(request) {
  const token = cookies(request).unicom_admin;
  if (!token) return false;
  const expiresAt = sessions.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  return origin === `http://${request.headers.host}` || origin === `https://${request.headers.host}`;
}

function equalPassword(candidate) {
  const expected = createHash("sha256").update(ADMIN_PASSWORD).digest();
  const supplied = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expected, supplied);
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 4096) throw new Error("Solicitud demasiado grande.");
  }
  return body ? JSON.parse(body) : {};
}

function clientAttempts(request) {
  const key = request.socket.remoteAddress || "local";
  const current = attempts.get(key);
  if (!current || Date.now() - current.startedAt > 10 * 60 * 1000) {
    const fresh = { count: 0, startedAt: Date.now() };
    attempts.set(key, fresh);
    return fresh;
  }
  return current;
}

function gvizValue(cell) {
  if (!cell || cell.v === null || cell.v === undefined) return "";
  if (cell.f !== null && cell.f !== undefined) return String(cell.f);
  if (typeof cell.v === "object") return JSON.stringify(cell.v);
  return String(cell.v);
}

async function fetchAdminData() {
  const params = new URLSearchParams({
    sheet: "Consolidado",
    headers: "1",
    tq: "select A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S",
    tqx: "out:json",
  });
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`);
  if (!response.ok) throw new Error("Google Sheets no respondió correctamente.");
  const raw = await response.text();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Respuesta de Google Sheets no válida.");
  const result = JSON.parse(raw.slice(start, end + 1));
  if (result.status !== "ok" || !result.table) throw new Error("No fue posible interpretar la hoja.");
  return {
    headers: result.table.cols.map((column, index) => column.label || column.id || `Columna ${index + 1}`),
    rows: result.table.rows.map((row) => result.table.cols.map((_, index) => gvizValue(row.c?.[index]))),
    updatedAt: new Date().toISOString(),
  };
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/admin/status" && request.method === "GET") {
    json(response, 200, { available: ADMIN_AVAILABLE, authenticated: ADMIN_AVAILABLE && authenticated(request) });
    return true;
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    if (!sameOrigin(request)) {
      json(response, 403, { error: "Origen no autorizado." });
      return true;
    }
    if (!ADMIN_AVAILABLE) {
      json(response, 503, { error: "Configure ADMIN_PASSWORD y GOOGLE_SHEET_ID en .env.local." });
      return true;
    }
    const rate = clientAttempts(request);
    if (rate.count >= 5) {
      json(response, 429, { error: "Demasiados intentos. Espere diez minutos." });
      return true;
    }
    try {
      const body = await readBody(request);
      const candidate = typeof body.password === "string" ? body.password : "";
      if (!equalPassword(candidate)) {
        rate.count += 1;
        json(response, 401, { error: "Contraseña incorrecta." });
        return true;
      }
      rate.count = 0;
      const token = randomBytes(32).toString("base64url");
      sessions.set(token, Date.now() + SESSION_TTL);
      json(response, 200, { ok: true }, {
        "Set-Cookie": `unicom_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}`,
      });
    } catch {
      json(response, 400, { error: "Solicitud no válida." });
    }
    return true;
  }

  if (url.pathname === "/api/admin/logout" && request.method === "POST") {
    if (!sameOrigin(request)) {
      json(response, 403, { error: "Origen no autorizado." });
      return true;
    }
    const token = cookies(request).unicom_admin;
    if (token) sessions.delete(token);
    json(response, 200, { ok: true }, {
      "Set-Cookie": "unicom_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
    });
    return true;
  }

  if (url.pathname === "/api/admin/records" && request.method === "GET") {
    if (!ADMIN_AVAILABLE || !authenticated(request)) {
      json(response, 401, { error: "Sesión de administrador requerida." });
      return true;
    }
    try {
      json(response, 200, await fetchAdminData());
    } catch (error) {
      json(response, 502, { error: error instanceof Error ? error.message : "No fue posible consultar la hoja." });
    }
    return true;
  }

  if (url.pathname.startsWith("/api/")) {
    json(response, 404, { error: "Ruta no encontrada." });
    return true;
  }
  return false;
}

async function serveStatic(request, response, url) {
  const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const target = resolve(DIST, normalize(requested));
  if (target !== DIST && !target.startsWith(`${DIST}${sep}`)) {
    json(response, 403, { error: "Ruta no autorizada." });
    return;
  }
  let file = target;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    const content = await readFile(file);
    const extension = extname(file).toLowerCase();
    response.writeHead(200, {
      ...securityHeaders(mimeTypes[extension] || "application/octet-stream"),
      "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    if (request.method === "HEAD") response.end();
    else response.end(content);
  } catch {
    try {
      const content = await readFile(join(DIST, "index.html"));
      response.writeHead(200, { ...securityHeaders(mimeTypes[".html"]), "Cache-Control": "no-cache" });
      response.end(content);
    } catch {
      json(response, 503, { error: "Ejecute npm run build antes de iniciar el servidor." });
    }
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);
  if (await handleApi(request, response, url)) return;
  if (request.method !== "GET" && request.method !== "HEAD") {
    json(response, 405, { error: "Método no permitido." }, { Allow: "GET, HEAD" });
    return;
  }
  await serveStatic(request, response, url);
});

setInterval(() => {
  const now = Date.now();
  for (const [token, expiresAt] of sessions) if (expiresAt <= now) sessions.delete(token);
}, 15 * 60 * 1000).unref();

server.listen(PORT, HOST, () => {
  console.log(`Dashboard disponible en http://${HOST}:${PORT}`);
  console.log(ADMIN_AVAILABLE ? "Modo administrador habilitado." : "Modo administrador deshabilitado: configure ADMIN_PASSWORD y GOOGLE_SHEET_ID." );
});
