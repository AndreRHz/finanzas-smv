# Dashboard financiero Alicorp (datos SMV)

## Objetivo
Construir de inicio a fin un dashboard financiero de **Alicorp S.A.A.** en Power BI a partir de los estados financieros anuales **consolidados** publicados por la SMV (reportes 2021–2025, cifras 2020–2025).

## Forma de trabajo
Por **etapas**. Al cerrar cada una: mostrar resultados de validación, **detenerse y esperar aprobación** del usuario antes de continuar. Planificar antes de escribir código. Actualizar este archivo al cerrar cada etapa. No hacer commits salvo que el usuario lo pida.

## Etapas
1. **ETL** – `etl_smv.py` carga `raw/*.xlsx` en `finanzas.duckdb` → `fact_eeff` (formato largo) + validaciones. ✅ **aprobada** (2026-11-11)
2. **Modelo analítico (DuckDB)** – `modelo_smv.py` + `mapeos/*.csv`: dimensiones de cuentas ER y Balance, empresa, año, versión vigente y vistas `pbi_*`. ✅ **aprobada**
3. **Modelo semántico Power BI** – `exportar_parquet.py` + PBIP en `powerbi/`: 7 tablas, 9 relaciones, 45 medidas DAX. ✅ implementada, **en revisión del usuario**
4. **Reporte** – páginas: (1) Resumen ejecutivo KPIs, (2) Estado de Resultados en cascada, (3) Márgenes y tendencias, (4) Balance y ratios. *Planificar el diseño antes de implementarlo.*

## Entorno
- Python 3.14 con entorno virtual **`.venv/` dentro del proyecto** (no usar el Python global).
  - `python -m venv .venv` → `.venv\Scripts\python.exe -m pip install -r requirements.txt`
- `requirements.txt`: `duckdb==1.5.6` (fijado igual que el **CLI de DuckDB v1.5.6** instalado, para compatibilidad del archivo `.duckdb`), `openpyxl==3.1.5`.
- Ejecutar ETL: `.venv\Scripts\python.exe etl_smv.py` (idempotente; recrea `fact_eeff`; exit code ≠ 0 si falla una validación).
- Ejecutar modelo: `.venv\Scripts\python.exe modelo_smv.py` (**siempre después del ETL**: `dim_anio` y el flag `mostrar` se calculan a partir de los datos).
- Exportar a Parquet: `.venv\Scripts\python.exe exportar_parquet.py` (después del modelo) → `parquet/pbi_*.parquet`. **Los `.parquet` se versionan en el repo** (decisión del usuario; no ignorarlos).
- Orden completo: `etl_smv.py` → `modelo_smv.py` → `exportar_parquet.py` → actualizar en Power BI Desktop.
- `finanzas.duckdb` y `.venv/` están en `.gitignore` (la BD es regenerable). También `**/.pbi/localSettings.json` y `**/.pbi/cache.abf`.
- DuckDB bloquea el archivo: cerrar DBeaver (u otro cliente) antes de correr los scripts.
- Power BI Desktop instalado (Microsoft Store, v2.159). CLI `powerbi-report-author` (npm global, v0.5.0) para scaffold/validación de reportes PBIR.
- Los commits los hace el usuario.

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
- **Decisión (usuario, cierre Etapa 1)**: para cada año se usa la **última versión publicada** (la del reporte más reciente que contiene ese año). 2020 solo existe en el reporte 2021.

## Modelo analítico (Etapa 2)
Mapeos editables en `mapeos/` (`dim_cuenta_er.csv`, `dim_cuenta_bal.csv`, `dim_empresa.csv`); el script valida que coincidan con `fact_eeff` por `orden` y nombre.

| Objeto | Tipo | Contenido |
|---|---|---|
| `fact_eeff_vigente` | vista | Última versión publicada de cada cifra + `anio_reporte_fuente`, `monto_original`, `es_reexpresado` |
| `dim_empresa` | tabla | `empresa_id`, razón social, nombre corto, tipo EEFF, moneda, unidad |
| `dim_anio` | tabla | 2020–2025, `anio_reporte_fuente`, `tiene_reporte_propio` (2020 = falso), `es_ultimo_anio` |
| `dim_cuenta_er` | tabla | 43 cuentas: `cuenta_id` ER01–ER43, `cuenta_corta`, `grupo`, `tipo_fila` (detalle/subtotal/titulo/memo), `es_subtotal`, `signo`, `grupo_cascada` + `orden_cascada` (13 pasos), `unidad`, `mostrar` |
| `dim_cuenta_bal` | tabla | 78 cuentas: `cuenta_id` BG01–BG78, `seccion`, `grupo`, `tipo_fila`, `es_subtotal`, `signo`, `clave_ratio`, `mostrar` |
| `pbi_dim_*` | vistas | Dimensiones para Power BI |
| `pbi_fact_er`, `pbi_fact_bal` | vistas | `empresa_id, anio, cuenta_id, monto` (vigente) + `monto_original, es_reexpresado, anio_reporte_fuente` |
| `pbi_fact_er_comparativo` | vista | Por año: `monto_actual` y `monto_anterior` **del mismo reporte** (misma clasificación) |

- Montos con signo contable (gastos negativos): sumar el **detalle** da los subtotales; nunca sumar filas con `es_subtotal` junto con su detalle. `signo` = naturaleza de la cuenta (+1 ingreso/ganancia, −1 gasto), útil para mostrar gastos en positivo.
- `mostrar` = falso para títulos y cuentas en 0 todos los años.
- `clave_ratio` (balance): `EFECTIVO, INVENTARIOS, ACT_CORR, ACT_NO_CORR, ACT_TOTAL, DEUDA_FIN_CORR, DEUDA_FIN_NO_CORR, PAS_CORR, PAS_NO_CORR, PAS_TOTAL, PAT_CONTROLADORA, PAT_TOTAL, PAS_PAT_TOTAL`.
- Cascada: Ventas → Costo de ventas → **U. bruta** → Gastos de ventas → Gastos de administración → Otros operativos neto → **U. operativa** → Resultado financiero neto (incluye asociadas y cuentas IFRS en 0) → **UAI** → Impuesto → **U. continuadas** → Discontinuadas → **U. neta**.
- Validaciones del modelo (todas OK): cobertura del mapeo y nombres, unicidad de `cuenta_id`/`orden`/`cuenta_corta` (requisito de "ordenar por columna" en Power BI), subtotales = detalle acumulado, la cascada termina en la U. neta, detalle del balance = total de cada grupo, cuadre de totales.

### ⚠️ Comparabilidad YoY (para la Etapa 3)
Con la versión vigente, el año Y viene del reporte Y+1 y el año Y−1 del reporte Y: **pueden tener clasificaciones distintas**. Caso crítico: Ventas 2023 vigente (11,039,113, reexpresado en 2024 por operaciones discontinuadas) vs. 2022 vigente (15,392,402) → −28.3 %, cuando en clasificación homogénea (reporte 2023) es −11.3 %. Para variaciones YoY usar `pbi_fact_er_comparativo`. 2021 vs. 2020 tiene el mismo problema en menor grado. El balance no tiene reexpresiones (sin impacto).

## Modelo semántico Power BI (Etapa 3)
Proyecto PBIP: `powerbi/Alicorp Finanzas.pbip` → `Alicorp Finanzas.SemanticModel/` (TMDL) + `Alicorp Finanzas.Report/` (en blanco, 1 página "Resumen"; se diseña en la Etapa 4). Construido con el MCP `powerbi-modeling-mcp`; edición posterior: abrir el PBIP en Desktop, conectar el MCP a la instancia local y guardar desde Desktop (o exportar TMDL).

- **Parámetro Power Query `CarpetaParquet`** (por defecto `E:\Proyectos\finanzas-smv\parquet\`, debe terminar en `\`). Todas las tablas: `Parquet.Document(File.Contents(CarpetaParquet & "<archivo>.parquet"))` + tipos explícitos.
- Modo Import, cultura `es-PE`, `discourageImplicitMeasures` = true.
- Tablas: `Empresa`, `Año`, `Cuenta Resultados`, `Cuenta Balance` (dimensiones); `Estado de Resultados` (vigente), `Resultados Comparativo` (YoY), `Balance` (hechos). Relaciones 1:* de una dirección desde las 3 dimensiones a cada hecho. Columnas de montos ocultas (`Importe…`); claves ocultas; `Cuenta` ordenada por `Orden`, `Paso cascada` por `Orden cascada`.
- Medidas (miles de S/, con descripción y carpeta):
  - *Estado de Resultados*: `Monto`, `Monto original`; Resultados (`Ventas`, `Costo de ventas`, `Utilidad bruta`, `Utilidad operativa`, `Utilidad antes de impuestos`, `Utilidad neta`, `Utilidad neta controladora`); Continuadas vs discontinuadas; Márgenes (`Margen bruto %`, `Margen operativo %`, `Margen continuadas %`, `Margen neto %`). KPIs por `CALCULATE([Monto], REMOVEFILTERS('Cuenta Resultados'), [ID cuenta] = "ERxx")`.
  - *Resultados Comparativo*: `Monto año actual/anterior (comparable)`, `Variación YoY`, `Variación YoY %` (÷ ABS del año anterior), `Ventas año anterior`, `Ventas / Utilidad bruta / Utilidad operativa / Utilidad continuadas / Utilidad neta YoY %`. 2020 en blanco.
  - *Balance*: `Saldo` (toma el último año del contexto; los saldos no se suman entre años), saldos por `Clave ratio`, `Deuda financiera (neta)`; Liquidez (`Liquidez corriente`, `Prueba ácida`, `Razón de efectivo`); Endeudamiento (`Pasivo / Patrimonio`, `Pasivo / Activo %`, `Deuda financiera / Patrimonio`, `Multiplicador de capital`); Rentabilidad (`ROE %` = U. neta controladora / patrimonio controladora promedio, `ROA %` = U. neta / activo total promedio; 2020 en blanco).
- **Validación (OK)**: refresh completo en Desktop; filas por tabla = Parquet; `INFO.MEASURES()` sin errores; 40 medidas × 6 años (240 valores) idénticos a un cálculo SQL independiente sobre `fact_eeff`.
- Nota: `Utilidad neta YoY %` 2022 = +1,978.5 % (2021 fue pérdida de −28,400): correcto matemáticamente, conviene no destacarlo en el reporte.
- Limitación para la Etapa 4: `Grupo`/`Sección` de las dimensiones de cuentas se ordenan alfabéticamente (no hay columna de orden de grupo); agregarla si una matriz los necesita en orden contable.

## Reporte (Etapa 4)
- Audiencia: **pieza de portafolio pública** (narrativa guiada, nota metodológica visible, sin logotipos/marca de Alicorp). Estilo: **corporativo sobrio** (fondo `#F1F5F9`, texto `#334155`, acento `#0E7490`, verde `#15803D`/rojo `#B91C1C` con ▲▼).
- Especificación de diseño: `_brief/report-spec.md` (contrato YAML `Design Brief` = fuente de verdad para construir).

- Ajustes aprobados al construir: **DuPont 2021-2025** en la página 4 (Margen neto controladora × Rotación de activos × Apalancamiento = ROE %, mismas definiciones que `ROE %`; identidad validada en DAX y SQL) y **"n.s."** en variaciones YoY % cuando el año anterior tiene signo contrario a la naturaleza de la cuenta (cadena de formato dinámica; valor 0; formato ▲/▼).
- Modelo: +13 medidas (58 en total; 65 tras los ajustes post-aprobación: 6 de cascada + `Fila subtotal`, oculta, para el formato condicional de la matriz): gastos de ventas/administración y sus % de ventas, `Ventas originales`, `Activo/Pasivo no corriente`, 2 subtítulos dinámicos, 3 factores DuPont.
- **Reporte generado por código**: `node powerbi/generar_reporte.mjs` reescribe el tema (`StaticResources/RegisteredResources/AlicorpSobrio-*.json`) y las 4 páginas (IDs estables). No editar páginas a mano en Desktop: cambiar el generador y regenerar. Validar con `powerbi-report-author validate "powerbi/Alicorp Finanzas.Report"` (3 avisos esperados de altura del segmentador; en Desktop el encabezado "Año" se ve bien).
- **Flujo con Desktop**: al abrir un PBIP generado Desktop marca "cambios sin guardar". `powerbi-report-author preview "powerbi/Alicorp Finanzas.Report" --host desktop --reload` recarga sin cerrar (reinicia el motor: cambia el puerto y relee el TMDL del disco, así que el disco debe estar al día; reconectar el MCP después). Si cambió el **modelo** vía MCP, primero copiar el cambio al TMDL en disco y luego cerrar Desktop **sin guardar** y reabrir (guardar sobrescribiría el PBIR generado con la versión cargada).
- **Ajustes post-aprobación (2026-11-11)**:
  - Títulos nuevos en páginas 1 y 3; subtítulo dinámico de la página 1 = descomposición DuPont del año y del anterior (no repite las tarjetas).
  - Página 4: conclusión bajo el DuPont y subtítulo que aclara Apalancamiento = activo total / patrimonio de la controladora (saldos promedio).
  - Tarjetas: el título de la etiqueta de referencia ("vs año anterior", "Margen bruto", "ROA") funciona con `referenceLabelTitle` en **dos** entradas: selector `{id: "default"}` + selector de la instancia.
  - **Cascada** = columnas apiladas (el gráfico nativo no permite renombrar "Total" ni subtotales intermedios): 6 medidas en `Estado de Resultados` › carpeta `Cascada` (base invisible, total, aumento, disminución y tramos "bajo cero" para pasos que cruzan el eje, p. ej. 2021). Las etiquetas muestran la variación del paso vía cadena de formato dinámica. Las barras muy delgadas (otros operativos, resultado financiero, impuesto, discontinuadas) no muestran etiqueta: Power BI la oculta por falta de alto (el valor está en la matriz y en la información sobre herramientas).
  - Tooltips de la cascada: solo el paso y `Monto` (proyección `Tooltips` + `visualTooltip.showTooltipFieldsOnly`, que exige el esquema `visualContainer/2.13.0`; la 2.14.0 que escribe Desktop no está publicada y el validador se saltaría los visuales).
  - **Matriz ER (página 2)** = lista plana de `Cuenta` × `Año` con `[Monto]`, en orden contable (`Cuenta` se ordena por `Orden`), filtros `Mostrar = verdadero` y `Grupo ≠ UPA` (20 filas, de Ventas a Utilidad neta – no controladoras), sin subtotales ni total general. Las filas de subtotal (`Es subtotal`) se resaltan con formato condicional (fondo `#E2E8F0`, texto oscuro) mediante la medida oculta `Fila subtotal` (1/0; la regla no acepta una columna booleana). El formato condicional aplica a las celdas de valores; Desktop lo ignora en los encabezados de fila (nombre de la cuenta).
    - Descartado: una jerarquía `Bloque` > `Cuenta` con subtotales de matriz. El "Total" de cada bloque no era la suma de sus cuentas sino el subtotal acumulado del estado, lo que confundía; se eliminaron las columnas `Bloque`/`Orden bloque` y la medida `Monto matriz`.
  - Encabezados de columnas de matrices alineados a la derecha; nota metodológica en una fila (12px); etiquetas sin superposición (rangos fijos de ejes en el combo de la página 1, posición por serie; Crecimiento de la página 3 sin optimización de etiquetas y con columnas más anchas; Endeudamiento con eje de 0 a 8x).
- Validación: 0 errores reales. Quedan 3 avisos de altura del segmentador y 1 error `PBIR_FORMATTING_PROP_NESTED` en `labels.backgroundColor` de la cascada que es **falso positivo** del validador (la propiedad es `fill` según el propio catálogo del CLI y Desktop la renderiza bien).
- Desktop quita el `$schema` de `Alicorp Finanzas.pbip` y `definition.pbir` al guardar; restaurarlo si reaparece el error `PBIR_JSON_FILE_NO_SCHEMA`.
- Cambios de modelo: hacerlos vía MCP contra Desktop y exportar TMDL al PBIP (`database.tmdl` debe conservar `database 'Alicorp Finanzas'`).

## Estado actual
Etapa 4 construida y validada (esquema OK; capturas de las 4 páginas revisadas). **Esperando aprobación final del usuario.**
