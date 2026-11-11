# Report Spec — Alicorp Finanzas

## Report identity
- Report name: Alicorp Finanzas
- Semantic model: `powerbi/Alicorp Finanzas.SemanticModel` (Etapa 3, aprobado)
- Audience: público general / reclutadores / analistas (pieza de portafolio pública)
- Primary purpose: contar en 4 páginas cómo evolucionaron ventas, rentabilidad y solidez financiera de Alicorp 2020–2025, con rigor metodológico visible (reexpresiones, comparabilidad YoY)
- Delivery target: PBIP local en el repositorio (sin publicar en Fabric)

## Semantic model binding
- Entry mode:          Local Model
- Model name:          Alicorp Finanzas
- connectionString:    byPath `../Alicorp Finanzas.SemanticModel` (ya configurado en `definition.pbir`)

## User decisions and constraints
- Scope: 4 páginas definidas por el usuario (Resumen ejecutivo, Estado de Resultados en cascada, Márgenes y tendencias, Balance y ratios)
- Page count: 4
- Interactivity: navegador de páginas en la cabecera de cada página; segmentador **Año** (desplegable, selección única, por defecto 2025) en páginas 1, 2 y 4. El segmentador afecta solo a tarjetas / cascada; los gráficos de tendencia 2020–2025 ignoran el segmentador (interacción = None). Sin drillthrough ni marcadores.
- Design direction: Corporativo sobrio (Corporate Cool adaptado)
- Publishing: no
- Tooling: Power BI Desktop + `powerbi-report-author` CLI + MCP de modelado
- Model edit permissions: sí (medidas nuevas listadas abajo)
- Accessibility: contraste WCAG AA, texto alternativo en cada gráfico, verde/rojo nunca como única señal (siempre con signo ▲▼ o +/−)
- Data caveats: montos en **miles de S/**; versión vigente para niveles, `Resultados Comparativo` para YoY; 2020 sin YoY/ROE/ROA; Utilidad neta YoY 2022 = +1,978% (base negativa) — no se destaca; análisis independiente, sin logotipos ni marca de Alicorp.

## Narrative
- Core story: Alicorp salió de negocios (operaciones discontinuadas 2021–2024), vende menos que en 2022 pero con mejores márgenes; la rentabilidad sobre patrimonio sube en 2025 sobre todo porque el patrimonio se redujo, mientras la liquidez cae y el apalancamiento sube.
- Audience promise: en 1 minuto se entiende el desempeño; en 5, cómo se construye la utilidad y qué tan sólido es el balance.
- Key questions answered:
  1. ¿Cuánto vende, cuánto gana y cuánto rinde al accionista en el año elegido? (P1)
  2. ¿Dónde se va cada sol de ventas hasta llegar a la utilidad neta? (P2)
  3. ¿Mejoran los márgenes? ¿Qué cambió en la estructura de costos? ¿Cuánto movieron las reexpresiones las cifras? (P3)
  4. ¿Es sólido el balance: liquidez, endeudamiento y retorno? (P4)

## Design identity
- Tone: Corporativo sobrio (Corporate Cool): superficie gris frío, texto pizarra, un acento azul petróleo.
- Signature: el acento azul petróleo `#0E7490` marca solo la métrica principal de cada visual; mejora/deterioro en verde `#15803D` / rojo `#B91C1C` siempre acompañado de ▲▼.

## Page plan
1. **Resumen ejecutivo** — Executive Summary, variante A
   - Purpose: foto del año elegido + trayectoria 2020–2025.
   - Visuals: subtítulo dinámico; 5 tarjetas (Ventas, Utilidad operativa, Margen operativo %, Utilidad neta, ROE %) con variación YoY comparable como etiqueta de referencia; combo Ventas (columnas) + Margen operativo % (línea) por año; combo Utilidad continuadas + discontinuadas (columnas apiladas) + Utilidad neta (línea) por año; nota metodológica.
   - Slicers: Año.
2. **Estado de Resultados en cascada** — Analytical Canvas, variante A
   - Purpose: cómo se construye la utilidad neta del año elegido.
   - Visuals: subtítulo dinámico; cascada por `Paso cascada` (solo líneas de detalle; total = Utilidad neta); matriz del Estado de Resultados (cuentas visibles sin UPA × años 2020–2025).
   - Slicers: Año (solo cascada y subtítulo).
3. **Márgenes y tendencias** — Analytical Canvas 2×2, sin segmentador
   - Visuals: líneas de 4 márgenes; columnas Ventas YoY % y Utilidad operativa YoY % (comparables); columnas apiladas de costo y gastos como % de ventas; columnas Ventas publicadas originalmente vs. vigentes (efecto de reexpresiones).
4. **Balance y ratios** — Analytical Canvas, variante A
   - Visuals: 6 tarjetas (Liquidez corriente, Prueba ácida, Pasivo / Patrimonio, Deuda financiera neta, ROE %, ROA %); fila media de 3 tendencias (financiamiento apilado, liquidez, endeudamiento); fila inferior: columnas ROE % y ROA % + **tabla DuPont 2021-2025** (Margen neto controladora × Rotación de activos × Apalancamiento = ROE %).
   - Slicers: Año (solo tarjetas).

## Ajustes aprobados por el usuario (2026-11-11)
1. **DuPont por año (2021-2025)** en la página 4, con las mismas definiciones que `ROE %` (utilidad y patrimonio de la controladora, saldos promedio): Margen neto controladora = U. neta controladora / Ventas; Rotación de activos = Ventas / Activo total promedio; Apalancamiento = Activo total promedio / Patrimonio controladora promedio. Producto = ROE % (validar).
2. **"n.s." en variaciones YoY %** cuando el año anterior tiene signo contrario a la naturaleza de la cuenta (para ventas y utilidades: año anterior negativo). Implementado con cadena de formato dinámica (valor 0 mostrado como "n.s."). Formato de variaciones: "▲ 0.0%" / "▼ 0.0%".

## Design system summary
- Theme: base del skill adaptada; fondo de página `#F1F5F9`, paneles blancos `#FFFFFF` con borde 1px `#E2E8F0` y radio 8px, texto `#334155`, títulos `#0F172A`.
- Color semantics: Ventas / métrica principal `#0E7490`; secundarias `#475569` (pizarra), `#B45309` (ámbar), `#94A3B8` (gris); mejora `#15803D`, deterioro `#B91C1C`.
- Typography: Segoe UI Semibold (títulos 24pt página, 12pt visual), Segoe UI 11pt cuerpo; valores de tarjeta 28pt.
- Layout: lienzo 1920×1080, grilla 12×12, margen 32px, separación 24px, densidad media.
- Accessibility: AA en todos los pares texto/fondo; texto alternativo en todos los gráficos; ▲▼ en variaciones.

## Model requirements
- Existing measures: las 45 de la Etapa 3.
- New measures (tabla `Estado de Resultados`, carpeta indicada):
  - `Gastos de ventas` (ER04), `Gastos de administración` (ER05) — Resultados
  - `Costo de ventas % ventas`, `Gastos de ventas % ventas`, `Gastos de administración % ventas` — Márgenes (en positivo: −gasto / ventas)
  - `Ventas originales` = Ventas tal como se publicaron por primera vez — Resultados
  - `Subtítulo resumen` (texto) — Narrativa: «2025 · Ventas S/ 11,763,822 mil (▲ 11.0% vs 2024) · Utilidad neta S/ 459,239 mil · ROE 25.7%»
  - `Subtítulo cascada` (texto) — Narrativa: «2025 · De S/ 11,763,822 mil en ventas quedan S/ 459,239 mil de utilidad neta (3.9%)»
- New measures (tabla `Balance`, carpeta Saldos): `Activo no corriente`, `Pasivo no corriente`.
- New measures (tabla `Balance`, carpeta Rentabilidad\DuPont): `Margen neto controladora % (DuPont)`, `Rotación de activos (DuPont)`, `Apalancamiento (DuPont)`.
- Modified measures: `Variación YoY %` y los 5 `… YoY %` con regla "n.s." y formato ▲/▼ dinámico.
- New calculated columns: ninguna.
- Relationship/sort requirements: ninguno (ya existen `Paso cascada` → `Orden cascada`, `Cuenta` → `Orden`).

## Canonical design contract

```yaml
Design Brief:
  generated_by: powerbi-report-cli
  contract_version: 1
  mode: greenfield
  design_identity:
    tone: "Corporativo sobrio (Corporate Cool): superficie #F1F5F9, paneles blancos con borde #E2E8F0 radio 8, texto pizarra #334155, un acento azul petróleo #0E7490"
    signature: "Acento #0E7490 solo en la métrica principal de cada visual; variaciones en verde #15803D / rojo #B91C1C siempre con ▲▼"
  archetype: Executive Summary
  navigation_model: page_navigator
  color_map:
    - measure: "'Estado de Resultados'[Ventas]"
      color: "#0E7490"
      tint: "#CFFAFE"
    - measure: "'Estado de Resultados'[Ventas originales]"
      color: "#94A3B8"
      tint: "#E2E8F0"
    - measure: "'Estado de Resultados'[Margen bruto %]"
      color: "#0E7490"
      tint: "#CFFAFE"
    - measure: "'Estado de Resultados'[Margen operativo %]"
      color: "#475569"
      tint: "#E2E8F0"
    - measure: "'Estado de Resultados'[Margen continuadas %]"
      color: "#B45309"
      tint: "#FEF3C7"
    - measure: "'Estado de Resultados'[Margen neto %]"
      color: "#94A3B8"
      tint: "#F1F5F9"
    - measure: "'Estado de Resultados'[Utilidad operaciones continuadas]"
      color: "#0E7490"
      tint: "#CFFAFE"
    - measure: "'Estado de Resultados'[Resultado operaciones discontinuadas]"
      color: "#B45309"
      tint: "#FEF3C7"
    - measure: "'Estado de Resultados'[Utilidad neta]"
      color: "#0F172A"
      tint: "#E2E8F0"
    - measure: "'Estado de Resultados'[Costo de ventas % ventas]"
      color: "#475569"
      tint: "#E2E8F0"
    - measure: "'Estado de Resultados'[Gastos de ventas % ventas]"
      color: "#B45309"
      tint: "#FEF3C7"
    - measure: "'Estado de Resultados'[Gastos de administración % ventas]"
      color: "#94A3B8"
      tint: "#F1F5F9"
    - measure: "'Resultados Comparativo'[Ventas YoY %]"
      color: "#0E7490"
      tint: "#CFFAFE"
    - measure: "'Resultados Comparativo'[Utilidad operativa YoY %]"
      color: "#475569"
      tint: "#E2E8F0"
    - measure: "'Balance'[Pasivo corriente]"
      color: "#B45309"
      tint: "#FEF3C7"
    - measure: "'Balance'[Pasivo no corriente]"
      color: "#475569"
      tint: "#E2E8F0"
    - measure: "'Balance'[Patrimonio total]"
      color: "#0E7490"
      tint: "#CFFAFE"
    - measure: "'Balance'[Liquidez corriente]"
      color: "#0E7490"
      tint: "#CFFAFE"
    - measure: "'Balance'[Prueba ácida]"
      color: "#475569"
      tint: "#E2E8F0"
    - measure: "'Balance'[Razón de efectivo]"
      color: "#94A3B8"
      tint: "#F1F5F9"
    - measure: "'Balance'[Pasivo / Patrimonio]"
      color: "#B45309"
      tint: "#FEF3C7"
    - measure: "'Balance'[Deuda financiera / Patrimonio]"
      color: "#475569"
      tint: "#E2E8F0"
    - measure: "'Balance'[ROE %]"
      color: "#0E7490"
      tint: "#CFFAFE"
    - measure: "'Balance'[ROA %]"
      color: "#94A3B8"
      tint: "#F1F5F9"
  semantic_colors:
    improvement: "#15803D"
    deterioration: "#B91C1C"
    waterfall_increase: "#15803D"
    waterfall_decrease: "#B91C1C"
    waterfall_total: "#0E7490"
  pages:
    - name: "Resumen ejecutivo"
      role: landing
      archetype: Executive
      layout_variant: A
      variant_rationale: "Pocas métricas anuales con fuerte componente temporal: tira de KPIs con contexto YoY sobre dos tendencias equilibradas."
      navigation:
        - element: page_navigator
          action: PageNavigation
          label: "Navegación entre las 4 páginas"
      page_background: "#F1F5F9"
      layout_summary: "Cabecera con título, navegador y segmentador Año; subtítulo dinámico; 5 tarjetas; dos combos 2020-2025; nota metodológica al pie."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:  [1,  1,  7,  2]
            nav:     [7,  1, 10,  2]
            filters: [10, 1, 13,  2]
            context: [1,  2, 13,  3]
            kpis:    [1,  3, 13,  5]
            trend:   [1,  5,  8, 11]
            split:   [8,  5, 13, 11]
            notes:   [1, 11, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Alicorp: ventas, rentabilidad y retorno al accionista"
            purpose: "Anclar la página en el desempeño del año elegido."
          - id: page_nav
            region: nav
            kind: pageNavigator
            purpose: "Navegar entre las 4 páginas."
          - id: year_slicer
            region: filters
            kind: slicer
            field_bindings: "'Año'[Año]"
            slicer_type: dropdown
            selection: { single_select: true, default: 2025 }
          - id: subtitle
            region: context
            kind: textbox
            field_bindings: "'Estado de Resultados'[Subtítulo resumen]"
            insight_basis: "Frase dinámica con ventas, variación YoY comparable, utilidad neta y ROE del año elegido."
          - id: kpi_ventas
            region: kpis
            kind: cardVisual
            purpose: "¿Cuánto vendió en el año y cuánto creció?"
            field_bindings: { value: "'Estado de Resultados'[Ventas]", reference_label: "'Resultados Comparativo'[Ventas YoY %]" }
            color_strategy: measure_match
            slot: 1
            of: 5
          - id: kpi_uoperativa
            region: kpis
            kind: cardVisual
            purpose: "¿Cuánto ganó la operación y cómo cambió?"
            field_bindings: { value: "'Estado de Resultados'[Utilidad operativa]", reference_label: "'Resultados Comparativo'[Utilidad operativa YoY %]" }
            color_strategy: semantic
            slot: 2
            of: 5
          - id: kpi_margen_op
            region: kpis
            kind: cardVisual
            purpose: "¿Qué parte de cada sol vendido queda como utilidad operativa?"
            field_bindings: { value: "'Estado de Resultados'[Margen operativo %]", reference_label: "'Estado de Resultados'[Margen bruto %]" }
            color_strategy: measure_match
            slot: 3
            of: 5
          - id: kpi_uneta
            region: kpis
            kind: cardVisual
            purpose: "¿Cuál fue la utilidad neta y cómo cambió?"
            field_bindings: { value: "'Estado de Resultados'[Utilidad neta]", reference_label: "'Resultados Comparativo'[Utilidad neta YoY %]" }
            color_strategy: semantic
            slot: 4
            of: 5
          - id: kpi_roe
            region: kpis
            kind: cardVisual
            purpose: "¿Cuánto rinde el patrimonio del accionista?"
            field_bindings: { value: "'Balance'[ROE %]", reference_label: "'Balance'[ROA %]" }
            color_strategy: measure_match
            slot: 5
            of: 5
          - id: ventas_margen_trend
            region: trend
            kind: lineClusteredColumnComboChart
            purpose: "¿Cómo evolucionaron ventas y margen operativo 2020-2025?"
            field_bindings: { Category: "'Año'[Año]", ColumnY: "'Estado de Resultados'[Ventas]", LineY: "'Estado de Resultados'[Margen operativo %]" }
            sort_policy: category_asc
            color_strategy: measure_match
            interactions: { year_slicer: none }
          - id: utilidad_split
            region: split
            kind: lineStackedColumnComboChart
            purpose: "¿Cuánto de la utilidad neta viene de operaciones continuadas vs. discontinuadas?"
            field_bindings: { Category: "'Año'[Año]", ColumnY: ["'Estado de Resultados'[Utilidad operaciones continuadas]", "'Estado de Resultados'[Resultado operaciones discontinuadas]"], LineY: "'Estado de Resultados'[Utilidad neta]" }
            sort_policy: category_asc
            color_strategy: measure_match
            interactions: { year_slicer: none }
          - id: method_note
            region: notes
            kind: textbox
            text: "Fuente: Superintendencia del Mercado de Valores (SMV), estados financieros anuales consolidados de Alicorp S.A.A., reportes 2021-2025 (cifras 2020-2025). Montos en miles de S/. Cada año usa la última versión publicada; las variaciones YoY comparan ambos años dentro del mismo reporte para mantener la misma clasificación de operaciones continuadas. ROE y ROA usan saldos promedio (2020 sin dato). Análisis independiente, sin afiliación con la empresa."
            purpose: "Transparencia metodológica para lectores externos."
        space_audit:
          content_cell_count: 132
          placed_cell_count: 132
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: trend, pct_of_content: 32 }
          balance_rationale: "Subtítulo y KPIs dan la foto del año; las dos tendencias (7 y 5 columnas) dan la trayectoria; la nota de 2 filas sostiene la credibilidad pública. Ninguna región supera 45%."
    - name: "Estado de Resultados en cascada"
      role: detail
      archetype: Analytical
      layout_variant: A
      variant_rationale: "Una pregunta (cómo se construye la utilidad) con dos vistas complementarias: cascada del año y matriz histórica, en mitades iguales."
      navigation:
        - element: page_navigator
          action: PageNavigation
          label: "Navegación entre las 4 páginas"
      page_background: "#F1F5F9"
      layout_summary: "Cabecera con título, navegador y segmentador Año; subtítulo dinámico; cascada a la izquierda y matriz 2020-2025 a la derecha."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:  [1,  1,  7,  2]
            nav:     [7,  1, 10,  2]
            filters: [10, 1, 13,  2]
            context: [1,  2, 13,  3]
            hero:    [1,  3,  7, 13]
            detail:  [7,  3, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "De las ventas a la utilidad neta: dónde se queda cada sol"
            purpose: "Plantear la lectura de la cascada."
          - id: page_nav
            region: nav
            kind: pageNavigator
            purpose: "Navegar entre las 4 páginas."
          - id: year_slicer
            region: filters
            kind: slicer
            field_bindings: "'Año'[Año]"
            slicer_type: dropdown
            selection: { single_select: true, default: 2025 }
          - id: subtitle
            region: context
            kind: textbox
            field_bindings: "'Estado de Resultados'[Subtítulo cascada]"
            insight_basis: "Ventas → utilidad neta y margen neto del año elegido."
          - id: waterfall
            region: hero
            kind: waterfallChart
            purpose: "¿Qué suma y qué resta entre ventas y utilidad neta en el año elegido?"
            field_bindings: { Category: "'Cuenta Resultados'[Paso cascada]", Y: "'Estado de Resultados'[Monto]" }
            visual_filters: ["'Cuenta Resultados'[Tipo de fila] = detalle", "'Cuenta Resultados'[Paso cascada] no vacío"]
            sort_policy: natural_order
            color_strategy: semantic
            total_label: "Utilidad neta"
          - id: er_matrix
            region: detail
            kind: pivotTable
            purpose: "¿Cómo se ve el Estado de Resultados completo en cada año?"
            field_bindings: { Rows: "'Cuenta Resultados'[Cuenta]", Columns: "'Año'[Año]", Values: "'Estado de Resultados'[Monto]" }
            visual_filters: ["'Cuenta Resultados'[Mostrar] = true", "'Cuenta Resultados'[Grupo] <> UPA"]
            sort_policy: natural_order
            totals: { row_totals: false, column_totals: false }
            color_strategy: none
            interactions: { year_slicer: none }
        space_audit:
          content_cell_count: 132
          placed_cell_count: 132
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: hero, pct_of_content: 45 }
          balance_rationale: "Cascada y matriz comparten mitades iguales (60 celdas cada una): la cascada explica el año y la matriz da el detalle histórico; el subtítulo resume la conclusión."
    - name: "Márgenes y tendencias"
      role: detail
      archetype: Analytical
      layout_variant: B
      variant_rationale: "Cuatro preguntas de tendencia de igual peso sobre la misma serie 2020-2025: cuadrícula 2×2 sin segmentador."
      navigation:
        - element: page_navigator
          action: PageNavigation
          label: "Navegación entre las 4 páginas"
      page_background: "#F1F5F9"
      layout_summary: "Cabecera con título y navegador; 2×2: márgenes, crecimiento comparable, estructura de costos, efecto de reexpresiones."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header: [1,  1, 10,  2]
            nav:    [10, 1, 13,  2]
            tl:     [1,  2,  7,  7]
            tr:     [7,  2, 13,  7]
            bl:     [1,  7,  7, 13]
            br:     [7,  7, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Un negocio más chico pero más rentable: el margen bruto pasó de 18.0% (2022) a 26.4% (2025)"
            purpose: "Conclusión de la página (datos fijos 2020-2025, sin segmentador)."
          - id: page_nav
            region: nav
            kind: pageNavigator
            purpose: "Navegar entre las 4 páginas."
          - id: margins_line
            region: tl
            kind: lineChart
            purpose: "¿Cómo evolucionaron los márgenes bruto, operativo, de continuadas y neto?"
            field_bindings: { Category: "'Año'[Año]", Y: ["'Estado de Resultados'[Margen bruto %]", "'Estado de Resultados'[Margen operativo %]", "'Estado de Resultados'[Margen continuadas %]", "'Estado de Resultados'[Margen neto %]"] }
            sort_policy: category_asc
            color_strategy: measure_match
          - id: growth_columns
            region: tr
            kind: clusteredColumnChart
            purpose: "¿Cuánto crecieron ventas y utilidad operativa vs. el año anterior, con clasificación homogénea?"
            field_bindings: { Category: "'Año'[Año]", Y: ["'Resultados Comparativo'[Ventas YoY %]", "'Resultados Comparativo'[Utilidad operativa YoY %]"] }
            visual_filters: ["'Año'[Año] >= 2021"]
            sort_policy: category_asc
            color_strategy: measure_match
          - id: cost_structure
            region: bl
            kind: stackedColumnChart
            purpose: "¿Qué parte de las ventas consumen el costo de ventas y los gastos operativos?"
            field_bindings: { Category: "'Año'[Año]", Y: ["'Estado de Resultados'[Costo de ventas % ventas]", "'Estado de Resultados'[Gastos de ventas % ventas]", "'Estado de Resultados'[Gastos de administración % ventas]"] }
            sort_policy: category_asc
            color_strategy: measure_match
          - id: restatement_effect
            region: br
            kind: clusteredColumnChart
            purpose: "¿Cuánto cambiaron las ventas de cada año al reexpresarse por operaciones discontinuadas?"
            field_bindings: { Category: "'Año'[Año]", Y: ["'Estado de Resultados'[Ventas originales]", "'Estado de Resultados'[Ventas]"] }
            sort_policy: category_asc
            color_strategy: measure_match
            comparison_basis: "Ventas publicadas originalmente vs. última versión publicada (2023: 13,655,764 → 11,039,113)."
        space_audit:
          content_cell_count: 132
          placed_cell_count: 132
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: bl, pct_of_content: 27 }
          balance_rationale: "Cuatro cuadrantes casi iguales (30/30/36/36 celdas) porque las cuatro preguntas tienen el mismo peso; la fila inferior es algo más alta para leyendas de 3 series."
    - name: "Balance y ratios"
      role: detail
      archetype: Analytical
      layout_variant: A
      variant_rationale: "Seis ratios al cierre del año elegido en tira de KPIs y cuatro tendencias 2020-2025 que explican por qué se mueven."
      navigation:
        - element: page_navigator
          action: PageNavigation
          label: "Navegación entre las 4 páginas"
      page_background: "#F1F5F9"
      layout_summary: "Cabecera con título, navegador y segmentador Año; 6 tarjetas; 2×2 de financiamiento, liquidez, endeudamiento y rentabilidad."
      layout_contract:
        canvas: { width: 1920, height: 1080, margin: 32, gutter: 24, snap: 8 }
        grid:
          columns: 12
          rows: 12
          regions:
            header:  [1,  1,  7,  2]
            nav:     [7,  1, 10,  2]
            filters: [10, 1, 13,  2]
            kpis:    [1,  2, 13,  4]
            tl:      [1,  4,  5,  8]
            tm:      [5,  4,  9,  8]
            tr:      [9,  4, 13,  8]
            bl:      [1,  8,  6, 13]
            br:      [6,  8, 13, 13]
        placements:
          - id: page_title
            region: header
            kind: textbox
            text: "Menos liquidez y más apalancamiento: el patrimonio cayó 62% desde 2020"
            purpose: "Conclusión de la página sobre la solidez del balance."
          - id: page_nav
            region: nav
            kind: pageNavigator
            purpose: "Navegar entre las 4 páginas."
          - id: year_slicer
            region: filters
            kind: slicer
            field_bindings: "'Año'[Año]"
            slicer_type: dropdown
            selection: { single_select: true, default: 2025 }
          - id: kpi_liquidez
            region: kpis
            kind: cardVisual
            purpose: "¿Cubre el activo corriente al pasivo corriente?"
            field_bindings: "'Balance'[Liquidez corriente]"
            color_strategy: measure_match
            slot: 1
            of: 6
          - id: kpi_acida
            region: kpis
            kind: cardVisual
            purpose: "¿Y sin contar inventarios?"
            field_bindings: "'Balance'[Prueba ácida]"
            color_strategy: measure_match
            slot: 2
            of: 6
          - id: kpi_pas_pat
            region: kpis
            kind: cardVisual
            purpose: "¿Cuántos soles de deuda hay por cada sol de patrimonio?"
            field_bindings: "'Balance'[Pasivo / Patrimonio]"
            color_strategy: measure_match
            slot: 3
            of: 6
          - id: kpi_deuda_neta
            region: kpis
            kind: cardVisual
            purpose: "¿Cuánta deuda financiera queda después de descontar el efectivo?"
            field_bindings: "'Balance'[Deuda financiera neta]"
            color_strategy: none
            slot: 4
            of: 6
          - id: kpi_roe
            region: kpis
            kind: cardVisual
            purpose: "¿Cuánto rinde el patrimonio?"
            field_bindings: "'Balance'[ROE %]"
            color_strategy: measure_match
            slot: 5
            of: 6
          - id: kpi_roa
            region: kpis
            kind: cardVisual
            purpose: "¿Cuánto rinden los activos?"
            field_bindings: "'Balance'[ROA %]"
            color_strategy: measure_match
            slot: 6
            of: 6
          - id: financing_structure
            region: tl
            kind: stackedColumnChart
            purpose: "¿Cómo se financia el activo: pasivo corriente, no corriente y patrimonio?"
            field_bindings: { Category: "'Año'[Año]", Y: ["'Balance'[Pasivo corriente]", "'Balance'[Pasivo no corriente]", "'Balance'[Patrimonio total]"] }
            sort_policy: category_asc
            color_strategy: measure_match
            interactions: { year_slicer: none }
          - id: liquidity_lines
            region: tm
            kind: lineChart
            purpose: "¿Cómo evolucionó la liquidez?"
            field_bindings: { Category: "'Año'[Año]", Y: ["'Balance'[Liquidez corriente]", "'Balance'[Prueba ácida]", "'Balance'[Razón de efectivo]"] }
            sort_policy: category_asc
            color_strategy: measure_match
            reference_line: { value: 1.0, label: "1.0x" }
            interactions: { year_slicer: none }
          - id: leverage_lines
            region: tr
            kind: lineChart
            purpose: "¿Cómo evolucionó el endeudamiento?"
            field_bindings: { Category: "'Año'[Año]", Y: ["'Balance'[Pasivo / Patrimonio]", "'Balance'[Deuda financiera / Patrimonio]"] }
            sort_policy: category_asc
            color_strategy: measure_match
            interactions: { year_slicer: none }
          - id: returns_columns
            region: bl
            kind: clusteredColumnChart
            purpose: "¿Cómo evolucionaron ROE y ROA?"
            field_bindings: { Category: "'Año'[Año]", Y: ["'Balance'[ROE %]", "'Balance'[ROA %]"] }
            visual_filters: ["'Año'[Año] >= 2021"]
            sort_policy: category_asc
            color_strategy: measure_match
            interactions: { year_slicer: none }
          - id: dupont_table
            region: br
            kind: tableEx
            purpose: "¿El ROE de cada año viene de rentabilidad, eficiencia o apalancamiento?"
            field_bindings: ["'Año'[Año]", "'Balance'[Margen neto controladora % (DuPont)]", "'Balance'[Rotación de activos (DuPont)]", "'Balance'[Apalancamiento (DuPont)]", "'Balance'[ROE %]"]
            visual_filters: ["'Año'[Año] >= 2021"]
            sort_policy: category_asc
            color_strategy: none
            conditional_formatting: "Barras de datos en los tres factores para comparar su peso entre años"
            insight_basis: "Descomposición multiplicativa del ROE: Margen neto × Rotación × Apalancamiento = ROE (identidad exacta)."
            interactions: { year_slicer: none }
        space_audit:
          content_cell_count: 132
          placed_cell_count: 132
          empty_cell_pct: 0
          unplaced_regions: []
          largest_region: { name: br, pct_of_content: 27 }
          balance_rationale: "Tira de 6 ratios (24 celdas), tres tendencias iguales (16 celdas c/u) y una fila inferior donde la tabla DuPont (35) es algo más ancha que ROE/ROA (25) porque tiene 5 columnas numéricas; ninguna región domina."
  interaction_pattern:
    drill_targets: []
    cross_filter_rules: "Segmentador Año → tarjetas, subtítulos y cascada: Filter; → gráficos de tendencia y matriz histórica: None. Entre visuales: Highlight por defecto."
  accessibility:
    alt_text_strategy: "headline+trend: cada gráfico describe la serie y su conclusión (p. ej. 'Margen bruto sube de 21.5% en 2023 a 26.4% en 2025')."
    contrast_notes: "Texto #334155 y #0F172A sobre #FFFFFF/#F1F5F9 cumplen AA; #94A3B8 solo para series, nunca para texto; verde/rojo acompañados de ▲▼ o signo."
  theme:
    base: "references/design/assets/base.json adaptado a Corporativo sobrio (dataColors: #0E7490, #475569, #B45309, #94A3B8, #0F172A, #15803D, #B91C1C)"
    user_overrides: "Montos en miles de S/ (sin abreviar a millones); sin logotipos ni marca de Alicorp."
```

## Implementation notes
- Model changes: 10 medidas nuevas vía MCP en la instancia de Desktop; validar con DAX contra DuckDB; exportar TMDL al PBIP.
- PBIR/report authoring: tema personalizado registrado en `report.json`; 4 páginas FHD; interacciones del segmentador Año en None para tendencias/matriz; texto alternativo en cada gráfico.
- Validation: `powerbi-report-author validate` por lote; recarga en Desktop; captura de pantalla de las 4 páginas y revisión.
- Desktop screenshot verification: sí, las 4 páginas.
- Publishing boundary: solo local; los commits los hace el usuario.
- Risks: las etiquetas de referencia de `cardVisual` pueden necesitar ajuste de versión; la cascada no muestra subtotales intermedios (se ven en la matriz); el formato de subtotales en negrita de la matriz depende del soporte de formato condicional por fila.
