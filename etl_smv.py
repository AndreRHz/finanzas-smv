"""ETL de estados financieros SMV (Alicorp) -> DuckDB.

Lee los reportes Excel de raw/ (formato "ReporteDetalleInformacionFinanciero"
de la SMV), los convierte a formato largo y los carga en finanzas.duckdb,
tabla fact_eeff. Al final ejecuta validaciones e imprime sus resultados.

Uso:  .venv\\Scripts\\python.exe etl_smv.py
"""

from __future__ import annotations

import re
import sys
from decimal import Decimal
from pathlib import Path

import duckdb
import openpyxl

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "raw"
DB_PATH = BASE_DIR / "finanzas.duckdb"

# Estados que se cargan. El resto de bloques (Cambios en el Patrimonio,
# Firmantes y sus subtítulos) se ignoran.
ESTADOS_INCLUIDOS = {
    "ESTADO DE SITUACION FINANCIERA",
    "ESTADO DE RESULTADOS",
    "ESTADO DE FLUJO DE EFECTIVO",
    "ESTADO DE RESULTADOS INTEGRALES",
}
FILA_INICIO_DATOS = 7  # filas 1-6 son metadatos

ESF = "ESTADO DE SITUACION FINANCIERA"
ER = "ESTADO DE RESULTADOS"


# --------------------------------------------------------------------------
# Parseo
# --------------------------------------------------------------------------
def normalizar(texto: str) -> str:
    """strip + colapsar espacios múltiples."""
    return re.sub(r"\s+", " ", str(texto)).strip()


def parse_monto(v) -> Decimal | None:
    """Convierte montos SMV: enteros/decimales o texto '(9,831,454)' -> -9831454."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return Decimal(str(v))
    s = str(v).strip().replace(",", "")
    if s == "":
        return None
    negativo = s.startswith("(") and s.endswith(")")
    if negativo:
        s = s[1:-1]
    try:
        d = Decimal(s)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Monto no parseable: {v!r}") from exc
    return -d if negativo else d


def parse_nota(v) -> str | None:
    if v is None or v == 0 or str(v).strip() in ("", "0"):
        return None
    return str(v).strip()


def leer_metadatos(rows: list[tuple]) -> dict:
    meta = {}
    for r in rows[:FILA_INICIO_DATOS - 1]:
        if isinstance(r[0], str) and ":" in r[0]:
            clave, valor = r[0].split(":", 1)
            meta[normalizar(clave)] = normalizar(valor)
    return {
        "empresa": meta["Empresa"],
        "tipo": meta["Tipo"],
        "anio_reporte": int(meta["Año"]),
        "periodo": meta.get("Periodo"),
    }


def es_titulo(r: tuple) -> bool:
    a = r[0]
    return (
        isinstance(a, str)
        and a.strip() != ""
        and a.strip().isupper()
        and all(c is None for c in r[1:])
    )


def parsear_estados(rows: list[tuple], meta: dict) -> list[tuple]:
    registros = []
    estado = None       # estado activo (None = bloque ignorado o fuera de bloque)
    anios = None        # (anio_actual, anio_anterior)
    orden = 0
    for r in rows[FILA_INICIO_DATOS - 1:]:
        r = tuple(r) + (None,) * (4 - len(r))
        if all(c is None for c in r):  # fila vacía = fin de bloque
            estado, anios = None, None
            continue
        if es_titulo(r):
            titulo = normalizar(r[0])
            estado = titulo if titulo in ESTADOS_INCLUIDOS else None
            anios, orden = None, 0
            continue
        if estado is None:
            continue
        if r[0] == "Cuenta":
            anios = (int(r[2]), int(r[3]))
            if anios[0] != meta["anio_reporte"] or anios[1] != meta["anio_reporte"] - 1:
                raise ValueError(
                    f"Cabecera de años {anios} no coincide con reporte {meta['anio_reporte']} ({estado})"
                )
            continue
        if anios is None:
            raise ValueError(f"Fila de datos sin cabecera en {estado}: {r[:4]}")
        orden += 1
        cuenta = normalizar(r[0])
        nota = parse_nota(r[1])
        for anio, valor in zip(anios, (r[2], r[3])):
            registros.append((
                meta["empresa"], meta["tipo"], meta["anio_reporte"], anio,
                estado, orden, cuenta, nota, parse_monto(valor),
            ))
    return registros


def leer_archivo(path: Path) -> tuple[dict, list[tuple]]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        rows = list(wb.worksheets[0].iter_rows(values_only=True))
    finally:
        wb.close()
    meta = leer_metadatos(rows)
    anio_archivo = re.search(r"(\d{4})", path.stem)
    if anio_archivo and int(anio_archivo.group(1)) != meta["anio_reporte"]:
        raise ValueError(f"{path.name}: año del nombre != metadato Año ({meta['anio_reporte']})")
    return meta, parsear_estados(rows, meta)


# --------------------------------------------------------------------------
# Carga
# --------------------------------------------------------------------------
DDL = """
CREATE OR REPLACE TABLE fact_eeff (
    empresa       VARCHAR NOT NULL,
    tipo          VARCHAR NOT NULL,
    anio_reporte  INTEGER NOT NULL,
    anio_cifra    INTEGER NOT NULL,
    estado        VARCHAR NOT NULL,
    orden         INTEGER NOT NULL,
    cuenta        VARCHAR NOT NULL,
    nota          VARCHAR,
    monto         DECIMAL(18,3),
    PRIMARY KEY (empresa, tipo, anio_reporte, anio_cifra, estado, orden)
)
"""


def cargar(con, registros: list[tuple]) -> None:
    con.execute(DDL)
    con.executemany("INSERT INTO fact_eeff VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", registros)
    con.execute(
        "COMMENT ON TABLE fact_eeff IS 'EEFF anuales SMV en formato largo. "
        "Montos en miles de S/, excepto ganancias por acción (S/ por acción).'"
    )


# --------------------------------------------------------------------------
# Validaciones
# --------------------------------------------------------------------------
def imprimir(con, titulo: str, sql: str, params=None) -> list[tuple]:
    rel = con.execute(sql, params or [])
    cols = [d[0] for d in rel.description]
    filas = rel.fetchall()
    print(f"\n--- {titulo} ({len(filas)} filas)")
    if filas:
        anchos = [max(len(str(c)), *(len(fmt(f[i])) for f in filas)) for i, c in enumerate(cols)]
        print("  " + " | ".join(str(c).ljust(w) for c, w in zip(cols, anchos)))
        print("  " + "-+-".join("-" * w for w in anchos))
        for f in filas:
            print("  " + " | ".join(fmt(v).rjust(w) if isinstance(v, (int, float, Decimal)) else fmt(v).ljust(w)
                                    for v, w in zip(f, anchos)))
    return filas


def fmt(v) -> str:
    if v is None:
        return ""
    if isinstance(v, Decimal):
        return f"{v:,.3f}".rstrip("0").rstrip(".") if v != v.to_integral() else f"{int(v):,}"
    if isinstance(v, int) and not isinstance(v, bool) and abs(v) >= 10000:
        return f"{v:,}"
    return str(v)


def validar(con) -> bool:
    ok = True
    print("\n" + "=" * 78 + "\nVALIDACIONES\n" + "=" * 78)

    # Integridad: filas por reporte/estado idénticas entre reportes
    filas = imprimir(con, "Integridad: filas por estado y reporte", """
        PIVOT (SELECT anio_reporte, estado FROM fact_eeff)
        ON anio_reporte USING count(*) GROUP BY estado ORDER BY estado
    """)
    for f in filas:
        if len(set(f[1:])) != 1:
            print(f"  [FALLA] conteos distintos entre reportes para {f[0]}")
            ok = False
    nulos = con.execute("SELECT count(*) FROM fact_eeff WHERE monto IS NULL").fetchone()[0]
    print(f"  Montos nulos/no parseables: {nulos}")

    # (a) Reexpresiones
    print("\n" + "-" * 78 + "\n(a) REEXPRESIONES: misma cuenta y año con monto distinto entre reportes")
    con.execute("""
        CREATE OR REPLACE TEMP VIEW v_reexpresiones AS
        SELECT a.estado, a.orden, a.cuenta, a.anio_cifra,
               a.anio_reporte AS reporte_original, a.monto AS monto_original,
               b.anio_reporte AS reporte_nuevo,    b.monto AS monto_nuevo,
               b.monto - a.monto AS diferencia
        FROM fact_eeff a
        JOIN fact_eeff b
          ON a.empresa = b.empresa AND a.tipo = b.tipo AND a.estado = b.estado
         AND a.orden = b.orden AND a.anio_cifra = b.anio_cifra
         AND a.anio_reporte < b.anio_reporte
        WHERE a.monto IS DISTINCT FROM b.monto
    """)
    imprimir(con, "Resumen de reexpresiones por año y estado", """
        SELECT anio_cifra, reporte_original, reporte_nuevo, estado, count(*) AS cuentas
        FROM v_reexpresiones GROUP BY ALL ORDER BY anio_cifra, estado
    """)
    imprimir(con, "Detalle de reexpresiones", """
        SELECT anio_cifra, estado, orden, cuenta, monto_original, monto_nuevo, diferencia
        FROM v_reexpresiones ORDER BY anio_cifra, estado, orden
    """)

    # (b) Cuadre del balance
    print("\n" + "-" * 78 + "\n(b) CUADRE: TOTAL ACTIVOS = TOTAL PASIVOS Y PATRIMONIO")
    filas = imprimir(con, "Cuadre del balance por reporte y año", f"""
        SELECT anio_reporte, anio_cifra,
               sum(monto) FILTER (cuenta = 'TOTAL ACTIVOS')              AS total_activos,
               sum(monto) FILTER (cuenta = 'TOTAL PASIVOS Y PATRIMONIO') AS total_pas_pat,
               sum(monto) FILTER (cuenta = 'Total Pasivos')              AS total_pasivos,
               sum(monto) FILTER (cuenta = 'Total Patrimonio')           AS total_patrimonio,
               total_activos - total_pas_pat                             AS dif_activo_vs_pp,
               total_pasivos + total_patrimonio - total_pas_pat          AS dif_pas_mas_pat
        FROM fact_eeff WHERE estado = '{ESF}'
        GROUP BY ALL ORDER BY anio_reporte, anio_cifra DESC
    """)
    for f in filas:
        if f[6] != 0 or f[7] != 0:
            print(f"  [FALLA] reporte {f[0]} año {f[1]} no cuadra")
            ok = False
    if all(f[6] == 0 and f[7] == 0 for f in filas):
        print("  [OK] los balances cuadran en todos los reportes y años")

    # (c) Control 2021
    print("\n" + "-" * 78 + "\n(c) CONTROL 2021 (Estado de Resultados)")
    esperados = {
        "Ingresos de Actividades Ordinarias": Decimal(12227663),
        "Ganancia (Pérdida) Bruta": Decimal(2396209),
        "Ganancia (Pérdida) Operativa": Decimal(916566),
    }
    filas = con.execute(f"""
        SELECT anio_reporte, cuenta, monto FROM fact_eeff
        WHERE estado = '{ER}' AND anio_cifra = 2021 AND cuenta IN ({",".join("?" * len(esperados))})
        ORDER BY anio_reporte, orden
    """, list(esperados)).fetchall()
    # Las cifras esperadas son las publicadas originalmente (reporte 2021): ese es
    # el control de parseo. El reporte 2022 trae 2021 reexpresado -> informativo.
    print(f"  {'reporte':<8} {'cuenta':<38} {'esperado':>12} {'obtenido':>12}  resultado")
    for reporte, cuenta, monto in filas:
        if reporte == 2021:
            res = "OK" if monto == esperados[cuenta] else "FALLA"
            ok &= res == "OK"
        else:
            res = f"INFO: reexpresado ({fmt(monto - esperados[cuenta])})" if monto != esperados[cuenta] else "OK"
        print(f"  {reporte:<8} {cuenta:<38} {fmt(esperados[cuenta]):>12} {fmt(monto):>12}  {res}")
    if sum(1 for f in filas if f[0] == 2021) != len(esperados):
        print("  [FALLA] faltan cuentas de control en el reporte 2021")
        ok = False
    return ok


# --------------------------------------------------------------------------
def main() -> int:
    archivos = sorted(RAW_DIR.glob("*.xlsx"))
    if not archivos:
        print(f"No hay archivos .xlsx en {RAW_DIR}")
        return 1

    registros = []
    print("CARGA")
    for path in archivos:
        meta, regs = leer_archivo(path)
        print(f"  {path.name}: {meta['empresa']} | {meta['tipo']} | {meta['periodo']} "
              f"| año {meta['anio_reporte']} -> {len(regs)} filas")
        registros.extend(regs)

    with duckdb.connect(str(DB_PATH)) as con:
        cargar(con, registros)
        total = con.execute("SELECT count(*) FROM fact_eeff").fetchone()[0]
        print(f"  fact_eeff: {total} filas cargadas en {DB_PATH.name}")
        ok = validar(con)

    print("\n" + "=" * 78)
    print("RESULTADO:", "TODAS LAS VALIDACIONES OK" if ok else "HAY VALIDACIONES CON FALLA")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
