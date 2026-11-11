# Dashboard financiero Alicorp (datos SMV)

## Objetivo
Construir de inicio a fin un dashboard financiero de **Alicorp S.A.A.** en Power BI a partir de los estados financieros anuales **consolidados** publicados por la SMV (reportes 2021–2025, cifras 2020–2025).

## Forma de trabajo
Por **etapas**. Al cerrar cada una: mostrar resultados de validación, **detenerse y esperar aprobación** del usuario antes de continuar. Planificar antes de escribir código. Actualizar este archivo al cerrar cada etapa. No hacer commits salvo que el usuario lo pida.

## Etapas
1. **ETL** – `etl_smv.py` carga `raw/*.xlsx` en `finanzas.duckdb` → `fact_eeff` (formato largo) + validaciones. ✅ implementada, **en revisión del usuario**
2. **Modelo analítico (DuckDB)** – dimensión de cuentas del Estado de Resultados (grupo, orden, signo, es_subtotal), dimensión empresa, vistas para Power BI. *Mostrar el mapeo de cuentas antes de crearlo.*
3. **Modelo semántico Power BI** – medidas DAX: Ventas, Utilidad bruta/operativa/neta, márgenes %, variación YoY, utilidad operaciones continuadas vs. discontinuadas, liquidez, endeudamiento, ROE.
4. **Reporte** – páginas: (1) Resumen ejecutivo KPIs, (2) Estado de Resultados en cascada, (3) Márgenes y tendencias, (4) Balance y ratios. *Planificar el diseño antes de implementarlo.*

## Entorno
- Python 3.14 con entorno virtual **`.venv/` dentro del proyecto** (no usar el Python global).
  - `python -m venv .venv` → `.venv\Scripts\python.exe -m pip install -r requirements.txt`
- `requirements.txt`: `duckdb==1.5.6` (fijado igual que el **CLI de DuckDB v1.5.6** instalado, para compatibilidad del archivo `.duckdb`), `openpyxl==3.1.5`.
- Ejecutar ETL: `.venv\Scripts\python.exe etl_smv.py` (idempotente; recrea `fact_eeff`; exit code ≠ 0 si falla una validación).
- `finanzas.duckdb` y `.venv/` están en `.gitignore` (la BD es regenerable).

## Fuente: estructura del Excel SMV (`raw/ReporteDetalleInformacionFinanciero - AAAA.xlsx`)
- Una hoja; filas 1–6 metadatos (`Año: 2021`, `Periodo: Anual`, `Empresa: ALICORP S.A.A.`, `Tipo: Consolidada`).
- Bloques apilados: título en MAYÚSCULAS → `Cuenta | NOTA | año actual | año anterior` → cuentas → fila vacía.
- Estados cargados: `ESTADO DE SITUACION FINANCIERA` (78 cuentas), `ESTADO DE RESULTADOS` (43), `ESTADO DE FLUJO DE EFECTIVO` (70), `ESTADO DE RESULTADOS INTEGRALES` (45; el título trae espacio final). Ignorados: `ESTADO DE CAMBIOS EN EL PATRIMONIO NETO`, `FIRMANTES` (y sus subtítulos).
- **Plantilla idéntica en los 5 años** → `(estado, orden)` identifica la cuenta de forma estable entre reportes. Hay nombres de cuenta repetidos dentro de un estado (p.ej. "Otros Activos Financieros" corriente y no corriente): **nunca identificar cuentas solo por nombre**.
- Montos en **miles de S/**, excepto filas de ganancia por acción (S/ por acción, con decimales). Negativos como texto `"(9,831,454)"`.
- Títulos de sección (p.ej. "Activos Corrientes") vienen con montos 0 y se conservan.
- NOTA: `0` = sin nota (→ NULL). Algunas notas numéricas perdieron comas en el origen (`2729` ≈ "27,29") → se guardan como texto tal cual.

## Tabla `fact_eeff` (DuckDB)
`empresa, tipo, anio_reporte, anio_cifra, estado, orden, cuenta, nota, monto DECIMAL(18,3)` — PK `(empresa, tipo, anio_reporte, anio_cifra, estado, orden)`. 2,360 filas (5 reportes × 236 cuentas × 2 años). Cada año de cifra aparece en hasta 2 reportes (el suyo y el siguiente, como comparativo).

## Decisiones tomadas
- Parseo posicional con openpyxl (sin pandas). `orden` = posición 1..n dentro del estado.
- `estado`/`cuenta` normalizados (strip + espacios múltiples colapsados).
- Validación (c) es pass/fail contra el **reporte original 2021**; el reporte 2022 trae 2021 reexpresado y se muestra como INFO.

## Hallazgos de la Etapa 1 (relevantes para etapas siguientes)
- **Balance**: cuadra en todos los reportes/años y **no tiene reexpresiones**.
- **Reexpresiones** (90 filas cuenta-año), solo en ER, EFE y ORI:
  - ER 2021, 2022, 2023: reclasificaciones entre **operaciones continuadas y discontinuadas** (la Ganancia Neta del Ejercicio no cambia). 2023 es la mayor: Ingresos 13,655,764 → 11,039,113 en el reporte 2024.
  - ER 2024 (en el reporte 2025): reclasificaciones menores entre gastos de ventas y otros ingresos/gastos operativos.
  - EFE: reclasificaciones entre líneas (p.ej. arrendamientos, intereses pagados).
  - ORI 2023: diferencias de redondeo (±1).
- **Pendiente de decidir en Etapa 2**: qué versión usar por año (última reexpresada = comparable, vs. original publicada).

## Estado actual
Etapa 1 implementada y validada (todas las validaciones OK). **Esperando aprobación del usuario para iniciar la Etapa 2.**
