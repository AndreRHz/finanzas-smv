"""Etapa 2 – Modelo analítico en DuckDB.

Crea, sobre fact_eeff (cargada por etl_smv.py):
  - fact_eeff_vigente : última versión publicada de cada cifra (+ original y flag de reexpresión)
  - dim_empresa, dim_anio, dim_cuenta_er, dim_cuenta_bal  (dims de cuentas desde mapeos/*.csv)
  - vistas pbi_* para Power BI
y valida el mapeo y la aritmética de subtotales.

Uso:  .venv\\Scripts\\python.exe modelo_smv.py   (ejecutar después de etl_smv.py)
"""

from __future__ import annotations

import sys
from pathlib import Path

import duckdb

from etl_smv import DB_PATH, ER, ESF, imprimir

MAPEOS = Path(__file__).resolve().parent / "mapeos"


def csv(nombre: str) -> str:
    return (MAPEOS / nombre).as_posix()


SQL_MODELO = f"""
-- ---------------------------------------------------------------- versión vigente
CREATE OR REPLACE VIEW fact_eeff_vigente AS
SELECT empresa, tipo, anio_cifra AS anio, estado, orden, cuenta, nota, monto,
       anio_reporte AS anio_reporte_fuente,
       monto_original,
       anio_reporte_original,
       monto IS DISTINCT FROM monto_original AS es_reexpresado
FROM (
    SELECT *,
        row_number()  OVER (PARTITION BY empresa, tipo, estado, orden, anio_cifra ORDER BY anio_reporte DESC) AS rn,
        first_value(monto)        OVER w AS monto_original,
        first_value(anio_reporte) OVER w AS anio_reporte_original
    FROM fact_eeff
    WINDOW w AS (PARTITION BY empresa, tipo, estado, orden, anio_cifra ORDER BY anio_reporte)
)
WHERE rn = 1;

-- ---------------------------------------------------------------- dimensiones
CREATE OR REPLACE TABLE dim_empresa AS
SELECT * FROM read_csv('{csv("dim_empresa.csv")}', header = true, columns = {{
    'empresa_id': 'INTEGER', 'razon_social': 'VARCHAR', 'nombre_corto': 'VARCHAR',
    'tipo_eeff': 'VARCHAR', 'moneda': 'VARCHAR', 'unidad': 'VARCHAR'}});

CREATE OR REPLACE TABLE dim_anio AS
SELECT anio_cifra AS anio,
       max(anio_reporte) AS anio_reporte_fuente,
       bool_or(anio_reporte = anio_cifra) AS tiene_reporte_propio,
       anio_cifra = max(anio_cifra) OVER () AS es_ultimo_anio
FROM fact_eeff GROUP BY anio_cifra;

CREATE OR REPLACE TABLE dim_cuenta_er AS
SELECT c.cuenta_id, '{ER}' AS estado, c.orden, c.cuenta, c.cuenta_corta, c.grupo,
       c.tipo_fila, c.es_subtotal, c.signo, c.grupo_cascada, c.orden_cascada, c.unidad,
       c.tipo_fila <> 'titulo' AND EXISTS (
           SELECT 1 FROM fact_eeff_vigente v
           WHERE v.estado = '{ER}' AND v.orden = c.orden AND v.monto <> 0) AS mostrar
FROM read_csv('{csv("dim_cuenta_er.csv")}', header = true, columns = {{
    'cuenta_id': 'VARCHAR', 'orden': 'INTEGER', 'cuenta': 'VARCHAR', 'cuenta_corta': 'VARCHAR',
    'grupo': 'VARCHAR', 'tipo_fila': 'VARCHAR', 'es_subtotal': 'BOOLEAN', 'signo': 'INTEGER',
    'grupo_cascada': 'VARCHAR', 'orden_cascada': 'INTEGER', 'unidad': 'VARCHAR'}}) c;

CREATE OR REPLACE TABLE dim_cuenta_bal AS
SELECT c.cuenta_id, '{ESF}' AS estado, c.orden, c.cuenta, c.cuenta_corta, c.seccion, c.grupo,
       c.tipo_fila, c.es_subtotal, c.signo, c.clave_ratio,
       c.tipo_fila <> 'titulo' AND EXISTS (
           SELECT 1 FROM fact_eeff_vigente v
           WHERE v.estado = '{ESF}' AND v.orden = c.orden AND v.monto <> 0) AS mostrar
FROM read_csv('{csv("dim_cuenta_bal.csv")}', header = true, columns = {{
    'cuenta_id': 'VARCHAR', 'orden': 'INTEGER', 'cuenta': 'VARCHAR', 'cuenta_corta': 'VARCHAR',
    'seccion': 'VARCHAR', 'grupo': 'VARCHAR', 'tipo_fila': 'VARCHAR', 'es_subtotal': 'BOOLEAN',
    'signo': 'INTEGER', 'clave_ratio': 'VARCHAR'}}) c;

-- ---------------------------------------------------------------- vistas Power BI
CREATE OR REPLACE VIEW pbi_dim_empresa   AS SELECT * FROM dim_empresa;
CREATE OR REPLACE VIEW pbi_dim_anio      AS SELECT * FROM dim_anio;
CREATE OR REPLACE VIEW pbi_dim_cuenta_er AS SELECT * EXCLUDE (estado) FROM dim_cuenta_er;
CREATE OR REPLACE VIEW pbi_dim_cuenta_bal AS SELECT * EXCLUDE (estado) FROM dim_cuenta_bal;

CREATE OR REPLACE VIEW pbi_fact_er AS
SELECT e.empresa_id, v.anio, d.cuenta_id, v.monto, v.monto_original, v.es_reexpresado,
       v.anio_reporte_fuente
FROM fact_eeff_vigente v
JOIN dim_empresa   e ON e.razon_social = v.empresa AND e.tipo_eeff = v.tipo
JOIN dim_cuenta_er d ON d.estado = v.estado AND d.orden = v.orden;

CREATE OR REPLACE VIEW pbi_fact_bal AS
SELECT e.empresa_id, v.anio, d.cuenta_id, v.monto, v.monto_original, v.es_reexpresado,
       v.anio_reporte_fuente
FROM fact_eeff_vigente v
JOIN dim_empresa    e ON e.razon_social = v.empresa AND e.tipo_eeff = v.tipo
JOIN dim_cuenta_bal d ON d.estado = v.estado AND d.orden = v.orden;

-- Comparativo tal como lo presentó cada reporte (año actual vs. año anterior del MISMO
-- reporte): misma clasificación en ambos años -> base para variaciones YoY homogéneas.
CREATE OR REPLACE VIEW pbi_fact_er_comparativo AS
SELECT e.empresa_id, a.anio_reporte AS anio, d.cuenta_id,
       a.monto AS monto_actual, p.monto AS monto_anterior
FROM fact_eeff a
JOIN fact_eeff p ON p.empresa = a.empresa AND p.tipo = a.tipo AND p.estado = a.estado
                AND p.orden = a.orden AND p.anio_reporte = a.anio_reporte
                AND p.anio_cifra = a.anio_reporte - 1
JOIN dim_empresa   e ON e.razon_social = a.empresa AND e.tipo_eeff = a.tipo
JOIN dim_cuenta_er d ON d.estado = a.estado AND d.orden = a.orden
WHERE a.anio_cifra = a.anio_reporte;
"""


# --------------------------------------------------------------------------
def chequear(con, titulo: str, sql: str) -> bool:
    """Imprime el resultado; la validación pasa si la consulta no devuelve filas."""
    filas = imprimir(con, titulo, sql)
    print("  [OK]" if not filas else "  [FALLA]")
    return not filas


def validar(con) -> bool:
    ok = True
    print("\n" + "=" * 78 + "\nVALIDACIONES DEL MODELO\n" + "=" * 78)

    # 1. Cobertura del mapeo y coincidencia de nombres
    for dim, estado in (("dim_cuenta_er", ER), ("dim_cuenta_bal", ESF)):
        ok &= chequear(con, f"Mapeo {dim}: cuentas sin mapear o con nombre distinto", f"""
            SELECT coalesce(f.orden, d.orden) AS orden, f.cuenta AS cuenta_fact, d.cuenta AS cuenta_mapeo
            FROM (SELECT DISTINCT orden, cuenta FROM fact_eeff WHERE estado = '{estado}') f
            FULL JOIN {dim} d ON d.orden = f.orden
            WHERE f.cuenta IS DISTINCT FROM d.cuenta ORDER BY 1
        """)
        ok &= chequear(con, f"Unicidad en {dim} (cuenta_id, orden, cuenta_corta)", f"""
            SELECT 'cuenta_id' AS col, cuenta_id AS valor FROM {dim} GROUP BY ALL HAVING count(*) > 1
            UNION ALL SELECT 'orden', orden::VARCHAR FROM {dim} GROUP BY ALL HAVING count(*) > 1
            UNION ALL SELECT 'cuenta_corta', cuenta_corta FROM {dim} GROUP BY ALL HAVING count(*) > 1
        """)

    # 2. Filas de las vistas de hechos = filas vigentes (sin pérdidas en joins)
    ok &= chequear(con, "Filas de pbi_fact_* vs. fact_eeff_vigente", f"""
        SELECT * FROM (
            SELECT 'pbi_fact_er' AS vista, (SELECT count(*) FROM pbi_fact_er) AS filas,
                   (SELECT count(*) FROM fact_eeff_vigente WHERE estado = '{ER}') AS esperado
            UNION ALL
            SELECT 'pbi_fact_bal', (SELECT count(*) FROM pbi_fact_bal),
                   (SELECT count(*) FROM fact_eeff_vigente WHERE estado = '{ESF}')
        ) WHERE filas <> esperado OR filas = 0
    """)

    # 3. ER: cada subtotal = suma acumulada de las líneas de detalle anteriores
    ok &= chequear(con, "ER: subtotal vs. suma de detalle (diferencias)", """
        WITH f AS (SELECT f.anio, d.orden, d.cuenta_corta, d.tipo_fila, f.monto
                   FROM pbi_fact_er f JOIN dim_cuenta_er d USING (cuenta_id)
                   WHERE d.grupo_cascada IS NOT NULL),
        acum AS (SELECT *, sum(CASE WHEN tipo_fila = 'detalle' THEN monto ELSE 0 END)
                       OVER (PARTITION BY anio ORDER BY orden) AS suma_detalle FROM f)
        SELECT anio, cuenta_corta, monto, suma_detalle, monto - suma_detalle AS diferencia
        FROM acum WHERE tipo_fila = 'subtotal' AND monto <> suma_detalle ORDER BY anio, orden
    """)

    # 4. Cascada: la suma de los bloques de detalle termina en la utilidad neta
    ok &= chequear(con, "ER: cascada termina en utilidad neta (diferencias)", """
        SELECT f.anio,
               sum(f.monto) FILTER (d.tipo_fila = 'detalle') AS suma_cascada,
               sum(f.monto) FILTER (d.cuenta_id = 'ER25')    AS utilidad_neta
        FROM pbi_fact_er f JOIN dim_cuenta_er d USING (cuenta_id)
        WHERE d.grupo_cascada IS NOT NULL
        GROUP BY f.anio HAVING suma_cascada <> utilidad_neta ORDER BY 1
    """)

    # 5. Balance: detalle por grupo = total del grupo; totales cuadran
    ok &= chequear(con, "Balance: detalle por grupo vs. total del grupo (diferencias)", """
        WITH totales AS (
            SELECT * FROM (VALUES ('Activo corriente', 'ACT_CORR'), ('Activo no corriente', 'ACT_NO_CORR'),
                                  ('Pasivo corriente', 'PAS_CORR'), ('Pasivo no corriente', 'PAS_NO_CORR'),
                                  ('Patrimonio', 'PAT_TOTAL')) t(grupo, clave)),
        f AS (SELECT f.anio, d.grupo, d.tipo_fila, d.clave_ratio, f.monto
              FROM pbi_fact_bal f JOIN dim_cuenta_bal d USING (cuenta_id))
        SELECT t.grupo, f.anio,
               sum(f.monto) FILTER (f.tipo_fila = 'detalle') AS suma_detalle,
               sum(f.monto) FILTER (f.clave_ratio = t.clave)  AS total_grupo
        FROM totales t JOIN f USING (grupo)
        GROUP BY ALL HAVING suma_detalle <> total_grupo ORDER BY 1, 2
    """)
    ok &= chequear(con, "Balance: cuadre de totales con claves de ratio (diferencias)", """
        SELECT * FROM (
            PIVOT (SELECT f.anio, d.clave_ratio, f.monto FROM pbi_fact_bal f
                   JOIN dim_cuenta_bal d USING (cuenta_id) WHERE d.clave_ratio IS NOT NULL)
            ON clave_ratio USING sum(monto) GROUP BY anio)
        WHERE ACT_CORR + ACT_NO_CORR <> ACT_TOTAL
           OR PAS_CORR + PAS_NO_CORR <> PAS_TOTAL
           OR PAS_TOTAL + PAT_TOTAL <> PAS_PAT_TOTAL
           OR ACT_TOTAL <> PAS_PAT_TOTAL
    """)

    # Informativos
    imprimir(con, "Resumen de dimensiones", """
        SELECT 'dim_cuenta_er' AS tabla, count(*) AS filas, count(*) FILTER (mostrar) AS mostrar,
               count(*) FILTER (es_subtotal) AS subtotales FROM dim_cuenta_er
        UNION ALL SELECT 'dim_cuenta_bal', count(*), count(*) FILTER (mostrar),
               count(*) FILTER (es_subtotal) FROM dim_cuenta_bal
        UNION ALL SELECT 'dim_empresa', count(*), NULL, NULL FROM dim_empresa
        UNION ALL SELECT 'dim_anio', count(*), NULL, NULL FROM dim_anio
    """)
    imprimir(con, "dim_anio", "SELECT * FROM dim_anio ORDER BY anio")
    imprimir(con, "Cascada (versión vigente, miles de S/)", """
        PIVOT (SELECT d.orden_cascada, d.grupo_cascada, f.anio, f.monto
               FROM pbi_fact_er f JOIN dim_cuenta_er d USING (cuenta_id)
               WHERE d.grupo_cascada IS NOT NULL)
        ON anio USING sum(monto)::BIGINT GROUP BY orden_cascada, grupo_cascada ORDER BY orden_cascada
    """)
    imprimir(con, "Ventas YoY: vigente vs. vigente (mezcla versiones) vs. comparativo del mismo reporte", """
        WITH vig AS (SELECT anio, monto FROM pbi_fact_er WHERE cuenta_id = 'ER01'),
        cmp AS (SELECT anio, monto_actual, monto_anterior FROM pbi_fact_er_comparativo WHERE cuenta_id = 'ER01')
        SELECT v.anio, v.monto AS ventas_vigente, p.monto AS ventas_ant_vigente,
               round(100 * (v.monto / p.monto - 1), 1) AS yoy_vigente_pct,
               c.monto_actual AS ventas_reporte, c.monto_anterior AS ventas_ant_reporte,
               round(100 * (c.monto_actual / c.monto_anterior - 1), 1) AS yoy_comparativo_pct
        FROM vig v LEFT JOIN vig p ON p.anio = v.anio - 1 LEFT JOIN cmp c ON c.anio = v.anio
        ORDER BY v.anio
    """)
    return ok


def main() -> int:
    with duckdb.connect(str(DB_PATH)) as con:
        con.execute(SQL_MODELO)
        objetos = con.execute("""
            SELECT table_name, table_type FROM information_schema.tables
            WHERE table_schema = 'main' ORDER BY table_type, table_name
        """).fetchall()
        print("OBJETOS EN finanzas.duckdb")
        for nombre, tipo in objetos:
            print(f"  {tipo:<10} {nombre}")
        ok = validar(con)
    print("\n" + "=" * 78)
    print("RESULTADO:", "TODAS LAS VALIDACIONES OK" if ok else "HAY VALIDACIONES CON FALLA")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
