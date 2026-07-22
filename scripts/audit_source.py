"""Read-only quality audit for the practices source workbook."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


SOURCE = Path(__file__).resolve().parents[1] / "Seguimiento a estudiantes Práctica Empresarial.xlsx"


def find_column(columns: list[str], prefix: str) -> str:
    return next(column for column in columns if column.upper().startswith(prefix))


def main() -> None:
    frame = pd.read_excel(SOURCE, sheet_name="Consolidado")
    frame.columns = [str(column).strip().replace("\n", " ") for column in frame.columns]
    columns = frame.columns.tolist()

    semester = find_column(columns, "SEMESTRE")
    student = find_column(columns, "NOMBRE ESTUDIANTES")
    company = find_column(columns, "NOMBRE DE LA EMPRESA")
    start = find_column(columns, "FECHA DE INICIO")
    end = find_column(columns, "FECHA DE FINALIZACI")
    practice_type = find_column(columns, "TIPO DE PR")
    unplaced = find_column(columns, "NO. ESTUDIANTES QUE NO")
    placed = find_column(columns, "NO. ESTUDIANTES UBICADOS")

    for column in (semester, student, company, practice_type):
        frame[column] = frame[column].astype("string").str.strip()
    for column in (start, end):
        frame[column] = pd.to_datetime(frame[column], errors="coerce")

    duration = (frame[end] - frame[start]).dt.days
    visit_columns = [
        column for column in columns if column.upper().startswith("VISITA /")
    ]

    result = {
        "rows": len(frame),
        "semester_counts": (
            frame[semester].fillna("(vacío)").value_counts().sort_index().to_dict()
        ),
        "semester_distinct": sorted(frame[semester].dropna().unique().tolist()),
        "placed_declared": pd.to_numeric(frame[placed], errors="coerce")
        .dropna()
        .tolist(),
        "unplaced_declared": pd.to_numeric(frame[unplaced], errors="coerce")
        .dropna()
        .tolist(),
        "missing": {
            column: int(frame[column].isna().sum())
            for column in (student, semester, company, start, end, practice_type)
        },
        "duplicate_name_rows": int(
            frame[student].str.upper().duplicated(keep=False).sum()
        ),
        "companies_distinct": int(frame[company].nunique(dropna=True)),
        "practice_types": (
            frame[practice_type].fillna("(vacío)").value_counts().to_dict()
        ),
        "duration_days": {
            "count": int(duration.notna().sum()),
            "median": float(duration.median()),
            "min": float(duration.min()),
            "max": float(duration.max()),
            "negative": int((duration < 0).sum()),
        },
        "visits_nonempty": {
            column: int(frame[column].notna().sum()) for column in visit_columns
        },
        "columns": columns,
    }
    print(json.dumps(result, ensure_ascii=True, indent=2, default=str))


if __name__ == "__main__":
    main()
