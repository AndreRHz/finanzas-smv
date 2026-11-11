"""Etapa 3 – Exporta las vistas pbi_* de finanzas.duckdb a parquet/ para Power BI.

Uso:  .venv\\Scripts\\python.exe exportar_parquet.py   (después de etl_smv.py y modelo_smv.py)
"""

from __future__ import annotations

import sys
from pathlib import Path

import duckdb

from etl_smv import DB_PATH

SALIDA = Path(__file__).resolve().parent / "parquet"


def main() -> int:
    SALIDA.mkdir(exist_ok=True)
    with duckdb.connect(str(DB_PATH), read_only=True) as con:
        vistas = [r[0] for r in con.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'main' AND table_type = 'VIEW' AND table_name LIKE 'pbi\\_%' ESCAPE '\\'
            ORDER BY table_name
        """).fetchall()]
        if not vistas:
            print("No hay vistas pbi_*: ejecuta antes modelo_smv.py")
            return 1
        print(f"EXPORTACIÓN A {SALIDA}")
        for vista in vistas:
            destino = SALIDA / f"{vista}.parquet"
            con.execute(f"COPY (SELECT * FROM {vista}) TO '{destino.as_posix()}' (FORMAT parquet)")
            filas = con.execute(f"SELECT count(*) FROM '{destino.as_posix()}'").fetchone()[0]
            esperado = con.execute(f"SELECT count(*) FROM {vista}").fetchone()[0]
            estado = "OK" if filas == esperado else "FALLA"
            print(f"  {vista + '.parquet':<32} {filas:>5} filas  {estado}")
            if estado != "OK":
                return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
