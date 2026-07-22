"""Generate a privacy-aware dashboard fallback from the local workbook."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Seguimiento a estudiantes Práctica Empresarial.xlsx"
OUTPUT = ROOT / "src" / "data" / "fallback.json"
LOCATIONS = ROOT / "scripts" / "company_locations.json"


def normalized(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9]+", " ", text.upper())).strip()


def theme_for(project: object) -> str:
    text = normalized(project)
    rules = [
        ("Automatización y electrónica", ["AUTOMAT", "ELECTRON", "IOT", "SENSOR", "ROBOT", "PLC", "MECATRON", "CONTROL"]),
        ("Software y datos", ["SOFTWARE", "APLICACION", "PAGINA WEB", "SISTEMA DE INFORMACION", "BASE DE DATOS", "CHATBOT", "CHAT BOT", "INTELIGENCIA ARTIFICIAL", "PLATAFORMA"]),
        ("Diseño y manufactura", ["DISENO", "CAD", "CAM", "PROTOTIP", "FABRIC", "MANUFACTUR", "MODELADO", "MAQUINA", "3D"]),
        ("Mantenimiento y operaciones", ["MANTENIMIENTO", "OPERACION", "LOGISTIC", "INVENTARIO", "PRODUCCION", "EQUIPOS"]),
        ("Gestión y calidad", ["GESTION", "CALIDAD", "PROCESO", "AUDITOR", "DOCUMENT", "ADMINISTR", "SEGURIDAD"]),
        ("Sostenibilidad", ["AMBIENT", "RESIDU", "ENERGIA", "SOSTENIB", "RECICL", "AGUA"]),
    ]
    return next((name for name, keywords in rules if any(word in text for word in keywords)), "Otros")


def semester_for(value: object) -> str:
    if isinstance(value, (pd.Timestamp, datetime)):
        return f"{value.year}-{value.month}"
    match = re.search(r"(20\d{2})\s*-\s*0?([12])", str(value))
    return f"{match.group(1)}-{match.group(2)}" if match else "Sin semestre"


def iso_date(value: object) -> str | None:
    date = pd.to_datetime(value, errors="coerce")
    return None if pd.isna(date) else date.strftime("%Y-%m-%d")


def number(value: object) -> float | None:
    return None if pd.isna(value) else float(value)


def location_for(company: object, rules: list[dict[str, object]]) -> tuple[str, str]:
    key = normalized(company)
    for rule in rules:
        if any(match in key for match in rule["matches"]):
            return str(rule["city"]), str(rule["department"])
    return "", ""


def main() -> None:
    frame = pd.read_excel(SOURCE, sheet_name="Consolidado")
    rules = json.loads(LOCATIONS.read_text(encoding="utf-8"))
    records = []
    for _, row in frame.iterrows():
        start = iso_date(row.iloc[5])
        end = iso_date(row.iloc[6])
        duration = None
        if start and end:
            duration = (pd.Timestamp(end) - pd.Timestamp(start)).days
        city, department = location_for(row.iloc[4], rules)
        records.append(
            {
                "semester": semester_for(row.iloc[3]),
                "company": str(row.iloc[4]).strip(),
                "city": city,
                "department": department,
                "startDate": start,
                "endDate": end,
                "durationDays": duration,
                "theme": theme_for(row.iloc[7]),
                "visitsCompleted": sum(not pd.isna(row.iloc[index]) for index in (12, 13, 14)),
                "reportedPlaced": number(row.iloc[1]),
                "reportedUnplaced": number(row.iloc[0]),
            }
        )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "records": records,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated {OUTPUT.relative_to(ROOT)} with {len(records)} privacy-safe rows.")


if __name__ == "__main__":
    main()
