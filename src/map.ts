import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PlacementRecord } from "./types";

type Coordinate = [number, number];

const CITY_COORDINATES: Record<string, Coordinate> = {
  bogota: [4.711, -74.0721],
  cajibio: [2.6233, -76.5707],
  "el bordo patia": [2.1156, -76.9825],
  guachene: [3.1337, -76.3925],
  guadalajara: [20.6597, -103.3496],
  "la vega": [2.0014, -76.7801],
  "paispamba sotara": [2.253, -76.61],
  piendamo: [2.6396, -76.534],
  popayan: [2.4448, -76.6147],
  "puerto tejada": [3.2311, -76.419],
  silvia: [2.611, -76.382],
  timbio: [2.3525, -76.683],
  "villa rica": [3.1787, -76.4613],
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const escapeHtml = (value: string) =>
  value.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character] ?? character);

let map: L.Map | null = null;
let markers: L.LayerGroup | null = null;

function ensureMap() {
  if (map && markers) return { map, markers };
  map = L.map("geo-map", {
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true,
  }).setView([2.45, -76.61], 7);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  markers = L.layerGroup().addTo(map);
  return { map, markers };
}

export function renderGeographicMap(
  records: PlacementRecord[],
  onCity: (city: string) => void,
) {
  const current = ensureMap();
  current.markers.clearLayers();

  const grouped = new Map<string, { city: string; department: string; count: number; coordinate: Coordinate }>();
  let missingLocation = 0;
  for (const record of records) {
    if (!record.city) {
      missingLocation += 1;
      continue;
    }
    const coordinate = CITY_COORDINATES[normalize(record.city)];
    if (!coordinate) {
      missingLocation += 1;
      continue;
    }
    const key = normalize(record.city);
    const item = grouped.get(key) ?? {
      city: record.city,
      department: record.department,
      count: 0,
      coordinate,
    };
    item.count += 1;
    grouped.set(key, item);
  }

  const points = [...grouped.values()].sort((a, b) => b.count - a.count);
  points.forEach((point) => {
    const marker = L.circleMarker(point.coordinate, {
      radius: Math.min(20, 7 + Math.sqrt(point.count) * 1.7),
      color: "#ffffff",
      weight: 2,
      fillColor: "#004991",
      fillOpacity: 0.84,
    });
    marker.bindTooltip(
      `<strong>${escapeHtml(point.city)}</strong><br>${escapeHtml(point.department || "Departamento no informado")}<br>${point.count} prácticas`,
      { direction: "top", offset: [0, -7] },
    );
    marker.on("click", () => onCity(point.city));
    marker.addTo(current.markers);
  });

  if (points.length === 1) {
    current.map.setView(points[0].coordinate, 10);
  } else if (points.length > 1) {
    const colombiaPoints = points.filter((point) => point.coordinate[1] > -90);
    const focus = colombiaPoints.length ? colombiaPoints : points;
    current.map.fitBounds(L.latLngBounds(focus.map((point) => point.coordinate)), {
      padding: [28, 28],
      maxZoom: 8,
    });
  } else {
    current.map.setView([2.45, -76.61], 7);
  }

  const summary = document.getElementById("geo-map-summary");
  if (summary) {
    summary.replaceChildren();
    points.slice(0, 5).forEach((point) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "geo-chip";
      button.textContent = `${point.city} ${point.count}`;
      button.addEventListener("click", () => onCity(point.city));
      summary.appendChild(button);
    });
    if (missingLocation) {
      const note = document.createElement("span");
      note.textContent = `${missingLocation} sin ubicación validada`;
      summary.appendChild(note);
    }
  }

  window.setTimeout(() => current.map.invalidateSize(), 0);
}
