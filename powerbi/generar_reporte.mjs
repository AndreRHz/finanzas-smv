// Genera el reporte PBIR "Alicorp Finanzas" (Etapa 4) a partir de la especificación
// _brief/report-spec.md. Idempotente: reescribe el tema y las páginas con IDs estables.
//
// Uso:  node powerbi/generar_reporte.mjs
//       powerbi-report-author validate "powerbi/Alicorp Finanzas.Report"

import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const REPORTE = join(AQUI, "Alicorp Finanzas.Report");
const DEF = join(REPORTE, "definition");
const PAGINAS = join(DEF, "pages");

const SCHEMA_PAGE = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";
const SCHEMA_PAGES = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.1.0/schema.json";
const SCHEMA_VISUAL = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.13.0/schema.json";

// ---------------------------------------------------------------- paleta (Design Brief)
const C = {
  pagina: "#F1F5F9", panel: "#FFFFFF", borde: "#E2E8F0",
  texto: "#334155", titulo: "#0F172A", tenue: "#64748B",
  acento: "#0E7490", pizarra: "#475569", ambar: "#B45309", gris: "#94A3B8", negro: "#0F172A",
  mejora: "#15803D", deterioro: "#B91C1C",
};
const TEMA = "AlicorpSobrio-7c41e2a9.json";

// ---------------------------------------------------------------- utilidades
const hid = (s, n = 20) => createHash("sha1").update(s).digest("hex").slice(0, n);
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const str = (s) => lit(`'${String(s).replace(/'/g, "''")}'`);
const num = (n) => lit(`${n}D`);
const bool = (b) => lit(b ? "true" : "false");
const color = (hex) => ({ solid: { color: lit(`'${hex}'`) } });
const col = (t, c) => ({ Column: { Expression: { SourceRef: { Entity: t } }, Property: c } });
const med = (t, m) => ({ Measure: { Expression: { SourceRef: { Entity: t } }, Property: m } });
const qref = (t, p) => `${t}.${p}`;
const proj = (field, t, p) => ({ field, queryRef: qref(t, p), nativeQueryRef: p });
const M = (t, m) => proj(med(t, m), t, m);
const K = (t, c) => proj(col(t, c), t, c);

const ER = "Estado de Resultados", CMP = "Resultados Comparativo", BAL = "Balance";
const ANIO = ["Año", "Año"];

// ---------------------------------------------------------------- grilla 12x12 FHD
const LIENZO = { w: 1920, h: 1080, margen: 32, gutter: 24, snap: 8 };
const colW = (LIENZO.w - 2 * LIENZO.margen - 11 * LIENZO.gutter) / 12;
const rowH = (LIENZO.h - 2 * LIENZO.margen - 11 * LIENZO.gutter) / 12;
const snap = (v) => Math.round(v / LIENZO.snap) * LIENZO.snap;
function region([c1, r1, c2, r2], slot = 1, de = 1) {
  let x = LIENZO.margen + (c1 - 1) * (colW + LIENZO.gutter);
  let y = LIENZO.margen + (r1 - 1) * (rowH + LIENZO.gutter);
  let w = (c2 - c1) * colW + (c2 - c1 - 1) * LIENZO.gutter;
  let h = (r2 - r1) * rowH + (r2 - r1 - 1) * LIENZO.gutter;
  if (de > 1) { // divide a lo largo del eje mayor
    if (w >= h) { const sw = (w - (de - 1) * LIENZO.gutter) / de; x += (slot - 1) * (sw + LIENZO.gutter); w = sw; }
    else { const sh = (h - (de - 1) * LIENZO.gutter) / de; y += (slot - 1) * (sh + LIENZO.gutter); h = sh; }
  }
  return { x: snap(x), y: snap(y), width: snap(w), height: snap(h) };
}

// ---------------------------------------------------------------- objetos de contenedor (VCO)
const pad = (t, b = t, l = t, r = t) => [{ properties: { top: num(t), bottom: num(b), left: num(l), right: num(r) } }];
function vcoPanel({ titulo, subtitulo, alt, padding = 12 } = {}) {
  const v = {
    background: [{ properties: { show: bool(true), color: color(C.panel), transparency: num(0) } }],
    border: [{ properties: { show: bool(true), color: color(C.borde), radius: num(8), width: num(1) } }],
    padding: pad(padding),
    visualHeader: [{ properties: { show: bool(false) } }],
  };
  if (titulo) v.title = [{ properties: { show: bool(true), text: str(titulo), fontSize: num(13), bold: bool(true), fontColor: color(C.titulo), fontFamily: str("Segoe UI Semibold") } }];
  else v.title = [{ properties: { show: bool(false) } }];
  if (subtitulo) v.subTitle = [{ properties: { show: bool(true), text: str(subtitulo), fontSize: num(10), fontColor: color(C.tenue) } }];
  if (alt) v.general = [{ properties: { altText: str(alt) } }];
  return v;
}
const vcoTransparente = () => ({
  background: [{ properties: { show: bool(false) } }],
  border: [{ properties: { show: bool(false) } }],
  padding: pad(0),
  title: [{ properties: { show: bool(false) } }],
  visualHeader: [{ properties: { show: bool(false) } }],
});

// ---------------------------------------------------------------- filtros
const fNombre = (s) => "Filter" + hid("f:" + s, 24);
function filtroIn(clave, t, c, valores, { negar = false } = {}) {
  const cond = { In: { Expressions: [{ Column: { Expression: { SourceRef: { Source: "x" } }, Property: c } }], Values: valores.map((v) => [{ Literal: { Value: v } }]) } };
  return {
    name: fNombre(clave), field: col(t, c), type: "Categorical",
    filter: { Version: 2, From: [{ Name: "x", Entity: t, Type: 0 }], Where: [{ Condition: negar ? { Not: { Expression: cond } } : cond }] },
    howCreated: "User",
  };
}
function filtroDesde2021(clave) {
  return {
    name: fNombre(clave), field: col(...ANIO), type: "Advanced",
    filter: {
      Version: 2, From: [{ Name: "a", Entity: "Año", Type: 0 }],
      Where: [{ Condition: { Comparison: { ComparisonKind: 2, Left: { Column: { Expression: { SourceRef: { Source: "a" } }, Property: "Año" } }, Right: { Literal: { Value: "2021L" } } } } }],
    },
    howCreated: "User",
  };
}

// ---------------------------------------------------------------- constructores de visuales
let z = 0;
function contenedor(nombre, pos, visual, extra = {}) {
  z += 1000;
  return { $schema: SCHEMA_VISUAL, name: nombre, position: { ...pos, z, tabOrder: z }, visual, ...extra };
}

function textoTitulo(id, pos, texto, tam = 24) {
  return contenedor(id, pos, {
    visualType: "textbox",
    objects: { general: [{ properties: { paragraphs: [{ textRuns: [{ value: texto, textStyle: { fontFamily: "Segoe UI Semibold", fontSize: `${tam}px`, color: C.titulo } }], horizontalTextAlignment: "left" }] } }] },
    visualContainerObjects: vcoTransparente(),
  });
}

// Nota compacta: cada párrafo es [[texto, negrita?], ...] en 12px.
function textoNota(id, pos, parrafos) {
  return contenedor(id, pos, {
    visualType: "textbox",
    objects: {
      general: [{
        properties: {
          paragraphs: parrafos.map((runs) => ({
            textRuns: runs.map(([t, negrita]) => ({ value: t, textStyle: { fontFamily: "Segoe UI", fontSize: "12px", color: negrita ? C.titulo : C.pizarra, ...(negrita ? { fontWeight: "bold" } : {}) } })),
            horizontalTextAlignment: "left",
          })),
        },
      }],
    },
    visualContainerObjects: { ...vcoPanel({ padding: 8 }) },
  });
}

// Conclusión destacada (una frase) en un panel.
function textoDestacado(id, pos, texto) {
  return contenedor(id, pos, {
    visualType: "textbox",
    objects: {
      general: [{ properties: { paragraphs: [{ textRuns: [{ value: texto, textStyle: { fontFamily: "Segoe UI Semibold", fontSize: "15px", color: C.titulo } }], horizontalTextAlignment: "left" }] } }],
    },
    visualContainerObjects: {
      ...vcoPanel({ padding: 12 }),
      general: [{ properties: { altText: str(texto) } }],
    },
  });
}

function navegador(id, pos) {
  return contenedor(id, pos, {
    visualType: "pageNavigator",
    objects: {
      text: [
        { properties: { fontSize: num(11), fontColor: color(C.texto), fontFamily: str("Segoe UI") }, selector: { id: "default" } },
        { properties: { fontColor: color("#FFFFFF"), bold: bool(true) }, selector: { id: "selected" } },
      ],
      fill: [
        { properties: { show: bool(true), fillColor: color(C.panel) }, selector: { id: "default" } },
        { properties: { fillColor: color(C.acento) }, selector: { id: "selected" } },
      ],
    },
    visualContainerObjects: { ...vcoTransparente(), general: [{ properties: { altText: str("Navegación entre las páginas del reporte") } }] },
  });
}

function slicerAnio(id, pos) {
  return contenedor(id, pos, {
    visualType: "slicer",
    syncGroup: { groupName: "AnioSync", fieldChanges: true, filterChanges: true },
    query: { queryState: { Values: { projections: [K(...ANIO)] } } },
    objects: {
      data: [{ properties: { mode: str("Dropdown") } }],
      selection: [{ properties: { singleSelect: bool(true), strictSingleSelect: bool(true) } }],
      header: [{ properties: { show: bool(true), text: str("Año"), fontColor: color(C.texto) } }],
      general: [{
        properties: {
          filter: {
            filter: {
              Version: 2, From: [{ Name: "a", Entity: "Año", Type: 0 }],
              Where: [{ Condition: { In: { Expressions: [{ Column: { Expression: { SourceRef: { Source: "a" } }, Property: "Año" } }], Values: [[{ Literal: { Value: "2025L" } }]] } } }],
            },
          },
        },
      }],
    },
    visualContainerObjects: {
      background: [{ properties: { show: bool(true), color: color(C.panel), transparency: num(0) } }],
      border: [{ properties: { show: bool(true), color: color(C.borde), radius: num(8), width: num(1) } }],
      padding: pad(0, 0, 8, 8),
      visualHeader: [{ properties: { show: bool(false) } }],
      general: [{ properties: { altText: str("Selector de año (afecta tarjetas, subtítulo y cascada)") } }],
    },
  });
}

// Tarjeta KPI. `ref` = [tabla, medida] para la etiqueta de referencia (variación).
function tarjeta(id, pos, [t, m], etiqueta, { ref, refTitulo, acento = C.acento, unidades = true } = {}) {
  const objects = {
    value: [{ properties: { fontSize: num(26), fontColor: color(C.titulo), bold: bool(true), ...(unidades ? { labelDisplayUnits: num(1) } : {}) }, selector: { id: "default" } }],
    label: [{ properties: { show: bool(true), text: str(etiqueta), fontSize: num(11), fontColor: color(C.tenue), position: str("aboveValue") }, selector: { id: "default" } }],
    padding: [{ properties: { paddingUniform: num(8) }, selector: { id: "default" } }],
    layout: [{ properties: { paddingUniform: num(0) }, selector: { id: "default" } }],
    outline: [{ properties: { show: bool(false) }, selector: { id: "default" } }],
    accentBar: [{ properties: { show: bool(true), position: str("Left"), width: num(4), color: color(acento) }, selector: { id: "default" } }],
  };
  const query = { queryState: { Data: { projections: [M(t, m)] } } };
  if (ref) {
    // El título de la etiqueta de referencia es por instancia: usa el mismo selector que la etiqueta
    // (con selector { id: "default" } Desktop ignoraba el texto personalizado y mostraba el nombre de la medida).
    const selRef = { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: qref(t, m), id: hid(id + "ref", 8) };
    objects.referenceLabel = [{ properties: { value: { expr: med(ref[0], ref[1]) } }, selector: selRef }];
    objects.referenceLabelLayout = [{ properties: { position: str("below") } }];
    const tituloRef = { show: bool(true), titleContentType: str("custom"), titleText: str(refTitulo ?? "vs año anterior"), titleFontSize: num(10), titleFontColor: color(C.tenue) };
    objects.referenceLabelTitle = [{ properties: tituloRef, selector: { id: "default" } }, { properties: tituloRef, selector: selRef }];
  }
  return contenedor(id, pos, { visualType: "cardVisual", query, objects, visualContainerObjects: { ...vcoPanel({ padding: 8 }), general: [{ properties: { altText: str(`${etiqueta} del año seleccionado`) } }] } });
}

// Subtítulo dinámico: tarjeta con una medida de texto, sin etiqueta.
function subtitulo(id, pos, [t, m], alt) {
  return contenedor(id, pos, {
    visualType: "cardVisual",
    query: { queryState: { Data: { projections: [M(t, m)] } } },
    objects: {
      value: [{ properties: { fontSize: num(15), fontColor: color(C.texto), bold: bool(false), horizontalAlignment: str("left") }, selector: { id: "default" } }],
      label: [{ properties: { show: bool(false) }, selector: { id: "default" } }],
      padding: [{ properties: { paddingUniform: num(4) }, selector: { id: "default" } }],
      layout: [{ properties: { paddingUniform: num(0) }, selector: { id: "default" } }],
      outline: [{ properties: { show: bool(false) }, selector: { id: "default" } }],
    },
    visualContainerObjects: { ...vcoTransparente(), general: [{ properties: { altText: str(alt) } }] },
  });
}

const leyendaArriba = [{ properties: { show: bool(true), position: str("Top"), fontSize: num(10), labelColor: color(C.texto) } }];
const ejeCategorico = [{ properties: { axisType: str("Categorical"), fontSize: num(10), labelColor: color(C.tenue), showAxisTitle: bool(false), gridlineShow: bool(false) } }];
const colorSerie = (t, m, hex) => ({ properties: { fill: color(hex) }, selector: { metadata: qref(t, m) } });

function grafico(id, pos, tipo, { categoria = ANIO, y = [], y2 = [], titulo, subtitulo: sub, alt, colores = {}, miles = false, leyenda = true, filtros = [], extraObjects = {}, etiquetasSolo, etiquetaBlanca = [], posEtiquetas = {}, propsEtiquetas = {} }) {
  const tablaDe = (m) => [...y, ...y2].find(([, mm]) => mm === m)[0];
  const queryState = { Category: { projections: [K(...categoria)] } };
  if (y.length) queryState.Y = { projections: y.map(([t, m]) => M(t, m)) };
  if (y2.length) queryState.Y2 = { projections: y2.map(([t, m]) => M(t, m)) };
  const objects = {
    categoryAxis: ejeCategorico,
    legend: leyenda ? leyendaArriba : [{ properties: { show: bool(false) } }],
    labels: [
      { properties: { show: bool(true), fontSize: num(9), color: color(C.texto), ...(miles ? { labelDisplayUnits: num(1) } : {}), ...propsEtiquetas } },
      // etiquetas solo en algunas series (evita superposición)
      ...(etiquetasSolo ? [...y, ...y2].filter(([, m]) => !etiquetasSolo.includes(m)).map(([t, m]) => ({ properties: { showSeries: bool(false) }, selector: { metadata: qref(t, m) } })) : []),
      ...etiquetaBlanca.map(([t, m]) => ({ properties: { color: color("#FFFFFF") }, selector: { metadata: qref(t, m) } })),
      // posición por serie (p. ej. una línea arriba y otra abajo para que no se encimen)
      ...Object.entries(posEtiquetas).map(([m, p]) => ({ properties: { labelPosition: str(p) }, selector: { metadata: qref(tablaDe(m), m) } })),
    ],
    dataPoint: [...y, ...y2].map(([t, m]) => colorSerie(t, m, colores[m] ?? C.acento)),
    ...(tipo === "lineChart" || tipo.endsWith("ComboChart") ? { lineStyles: [{ properties: { lineChartType: str("linear"), areaShow: bool(false), strokeWidth: num(3) } }] } : {}),
    ...extraObjects,
  };
  const visual = {
    visualType: tipo,
    query: { queryState, sortDefinition: { sort: [{ field: col(...categoria), direction: "Ascending" }], isDefaultSort: false } },
    objects,
    visualContainerObjects: vcoPanel({ titulo, subtitulo: sub, alt }),
  };
  return contenedor(id, pos, visual, filtros.length ? { filterConfig: { filters: filtros } } : {});
}

// Matriz plana: `filas` = [tabla, columna]; sin subtotales ni total general.
// `resaltar`: [tabla, medida] que vale 1 en las filas a resaltar (formato condicional: fondo gris claro y texto oscuro).
function matriz(id, pos, { filas, columnas, valores, titulo, subtitulo: sub, alt, filtros = [], fuente = 10, resaltar }) {
  const queryState = { Rows: { projections: [K(...filas)] }, Values: { projections: valores.map(([t, m, nombre]) => ({ ...M(t, m), ...(nombre ? { displayName: nombre } : {}) })) } };
  if (columnas) queryState.Columns = { projections: [K(...columnas)] };
  const visual = {
    visualType: "pivotTable",
    query: { queryState },
    objects: {
      // encabezados alineados a la derecha, igual que las cifras
      columnHeaders: [{ properties: { autoSizeColumnWidth: bool(true), columnAdjustment: str("growToFit"), fontSize: num(fuente), bold: bool(true), fontColor: color(C.titulo), backColor: color("#F8FAFC"), alignment: str("Right") } }],
      rowHeaders: [{ properties: { fontSize: num(fuente), fontColor: color(C.texto), wordWrap: bool(false) } }],
      values: [{ properties: { fontSize: num(fuente), fontColorPrimary: color(C.texto), fontColorSecondary: color(C.texto), backColorPrimary: color(C.panel), backColorSecondary: color("#F8FAFC") } }],
      subTotals: [{ properties: { rowSubtotals: bool(false), columnSubtotals: bool(false) } }],
    },
    visualContainerObjects: { ...vcoPanel({ titulo, subtitulo: sub, alt }), stylePreset: [{ properties: { name: str("None") } }] },
  };
  if (resaltar) {
    // regla: si [resaltar] = 1 → color; por defecto el color normal de la fila
    const regla = (si, no) => ({ solid: { color: { expr: { Conditional: {
      Cases: [{ Condition: { Comparison: { ComparisonKind: 0, Left: med(...resaltar), Right: { Literal: { Value: "1D" } } } }, Value: { Literal: { Value: `'${si}'` } } }],
      DefaultValue: { Literal: { Value: `'${no}'` } },
    } } } } });
    const cf = { backColor: regla("#E2E8F0", C.panel), fontColor: regla(C.titulo, C.texto) };
    // celdas de valores (selector obligatorio en matrices: dataViewWildcard + metadata del valor)
    for (const [t, m] of valores) visual.objects.values.push({ properties: cf, selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: qref(t, m) } });
    // encabezado de fila (nombre de la cuenta), mismo criterio
    visual.objects.rowHeaders.push({ properties: cf, selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: qref(...filas) } });
  }
  return contenedor(id, pos, visual, filtros.length ? { filterConfig: { filters: filtros } } : {});
}

// ---------------------------------------------------------------- páginas
const notaMetodologica = [
  [["Nota metodológica. ", true], ["Fuente: SMV, estados financieros anuales consolidados de Alicorp S.A.A., reportes 2021-2025 (cifras 2020-2025). Montos en miles de S/. Análisis independiente, sin afiliación con la empresa.", false]],
  [["Cada año usa la última versión publicada. Las variaciones YoY comparan ambos años dentro del mismo reporte (misma clasificación de operaciones continuadas); \"n.s.\" = no significativo (año anterior negativo). ROE y ROA sobre saldos promedio (2020 sin dato).", false]],
];

function paginaResumen() {
  const p = "resumen";
  // la nota ocupa una sola fila de la grilla; los gráficos ganan la fila liberada
  const R = { header: [1, 1, 7, 2], nav: [7, 1, 11, 2], filters: [11, 1, 13, 2], context: [1, 2, 13, 3], kpis: [1, 3, 13, 5], trend: [1, 5, 8, 12], split: [8, 5, 13, 12], notes: [1, 12, 13, 13] };
  const v = {};
  v.titulo = textoTitulo(hid(p + "titulo"), region(R.header), "Alicorp gana más por cada sol vendido, pero su ROE de 25.7% se apoya en mayor deuda", 20);
  v.nav = navegador(hid(p + "nav"), region(R.nav));
  v.anio = slicerAnio(hid(p + "anio"), region(R.filters));
  v.sub = subtitulo(hid(p + "sub"), region(R.context), [ER, "Subtítulo resumen"], "Descomposición del ROE del año seleccionado y del anterior: margen neto, rotación de activos y apalancamiento");
  v.k1 = tarjeta(hid(p + "k1"), region(R.kpis, 1, 5), [ER, "Ventas"], "Ventas (miles de S/)", { ref: [CMP, "Ventas YoY %"] });
  v.k2 = tarjeta(hid(p + "k2"), region(R.kpis, 2, 5), [ER, "Utilidad operativa"], "Utilidad operativa (miles de S/)", { ref: [CMP, "Utilidad operativa YoY %"], acento: C.pizarra });
  v.k3 = tarjeta(hid(p + "k3"), region(R.kpis, 3, 5), [ER, "Margen operativo %"], "Margen operativo", { ref: [ER, "Margen bruto %"], refTitulo: "Margen bruto", acento: C.pizarra, unidades: false });
  v.k4 = tarjeta(hid(p + "k4"), region(R.kpis, 4, 5), [ER, "Utilidad neta"], "Utilidad neta (miles de S/)", { ref: [CMP, "Utilidad neta YoY %"], acento: C.negro });
  v.k5 = tarjeta(hid(p + "k5"), region(R.kpis, 5, 5), [BAL, "ROE %"], "ROE", { ref: [BAL, "ROA %"], refTitulo: "ROA", unidades: false });
  v.trend = grafico(hid(p + "trend"), region(R.trend), "lineClusteredColumnComboChart", {
    y: [[ER, "Ventas"]], y2: [[ER, "Margen operativo %"]], miles: true,
    titulo: "Ventas y margen operativo, 2020-2025", subtitulo: "Columnas: ventas (miles de S/) · Línea: margen operativo",
    alt: "Ventas por año en columnas y margen operativo en línea, 2020-2025. Las ventas tocan su máximo en 2022 y el margen operativo es el más alto en 2024 (10.2%).",
    colores: { "Ventas": C.acento, "Margen operativo %": C.pizarra },
    posEtiquetas: { "Margen operativo %": "Above" },
    // Rangos fijos para separar capas: columnas en la mitad inferior (máx. 15.4 MM < 26 MM) y la línea del
    // margen (7%-10%) en la franja superior (eje secundario de -12% a 12.5%), así sus etiquetas no se enciman.
    extraObjects: { valueAxis: [{ properties: { show: bool(false), start: num(0), end: num(26000000), secShow: bool(false), secStart: num(-0.12), secEnd: num(0.125), gridlineShow: bool(false) } }] },
  });
  v.split = grafico(hid(p + "split"), region(R.split), "lineStackedColumnComboChart", {
    y: [[ER, "Utilidad operaciones continuadas"], [ER, "Resultado operaciones discontinuadas"]], y2: [[ER, "Utilidad neta"]], miles: true,
    titulo: "Utilidad neta: continuadas vs. discontinuadas", subtitulo: "Miles de S/ · Línea: utilidad neta",
    alt: "Utilidad de operaciones continuadas y resultado de discontinuadas por año, con la utilidad neta como línea. En 2021 las discontinuadas llevaron la utilidad neta a pérdida.",
    colores: { "Utilidad operaciones continuadas": C.acento, "Resultado operaciones discontinuadas": C.ambar, "Utilidad neta": C.negro },
    etiquetasSolo: ["Utilidad neta"],
    extraObjects: { valueAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.tenue), labelDisplayUnits: num(1), sharedAxis: bool(true), secShow: bool(false), gridlineShow: bool(true), gridlineColor: color(C.borde) } }] },
  });
  v.nota = textoNota(hid(p + "nota"), region(R.notes), notaMetodologica);
  const interacciones = ["trend", "split"].map((k) => ({ source: v.anio.name, target: v[k].name, type: "NoFilter" }));
  return { nombre: hid("pagina-resumen"), titulo: "Resumen ejecutivo", visuales: Object.values(v), interacciones };
}

function paginaCascada() {
  const p = "cascada";
  const R = { header: [1, 1, 6, 2], nav: [6, 1, 10, 2], filters: [10, 1, 13, 2], context: [1, 2, 13, 3], hero: [1, 3, 7, 13], detail: [7, 3, 13, 13] };
  const v = {};
  v.titulo = textoTitulo(hid(p + "titulo"), region(R.header), "De las ventas a la utilidad neta: dónde se queda cada sol");
  v.nav = navegador(hid(p + "nav"), region(R.nav));
  v.anio = slicerAnio(hid(p + "anio"), region(R.filters));
  v.sub = subtitulo(hid(p + "sub"), region(R.context), [ER, "Subtítulo cascada"], "De las ventas del año seleccionado cuánto queda como utilidad neta");
  // Cascada como columnas apiladas: el gráfico de cascada nativo no permite renombrar su barra "Total"
  // ni mostrar subtotales intermedios. Serie invisible (base) + tramos que suman/restan + barras de subtotal;
  // los tramos "bajo cero" cubren un paso que cruza el eje (2021: de utilidad de continuadas a pérdida neta).
  // Las etiquetas de los tramos muestran la variación del paso (cadena de formato dinámica de la medida).
  const serieCascada = [
    ["Cascada base", null], ["Cascada total", C.acento], ["Cascada aumento", C.mejora], ["Cascada disminución", C.deterioro],
    ["Cascada aumento bajo cero", C.mejora], ["Cascada disminución bajo cero", C.deterioro],
  ];
  const conEtiqueta = ["Cascada total", "Cascada aumento", "Cascada disminución"];
  v.cascada = contenedor(hid(p + "cascada"), region(R.hero), {
    visualType: "columnChart",
    query: {
      // Tooltips: solo el paso (categoría) y su monto; las series auxiliares no aparecen (showTooltipFieldsOnly)
      queryState: {
        Category: { projections: [K("Cuenta Resultados", "Paso cascada")] },
        Y: { projections: serieCascada.map(([m]) => M(ER, m)) },
        Tooltips: { projections: [{ ...M(ER, "Monto"), displayName: "Monto (miles de S/)" }] },
      },
      sortDefinition: { sort: [{ field: col("Cuenta Resultados", "Paso cascada"), direction: "Ascending" }], isDefaultSort: false },
    },
    objects: {
      dataPoint: serieCascada.map(([m, hex]) => ({ properties: hex ? { fill: color(hex) } : { fill: color(C.panel), fillTransparency: num(100) }, selector: { metadata: qref(ER, m) } })),
      labels: [
        // columnas apiladas no admiten OutsideEnd: etiqueta en el extremo interior, con fondo blanco para leerse sobre cualquier color
        // (sin `color` de texto: el validador lo confunde con el color del fondo; el texto por defecto es oscuro)
        { properties: { show: bool(true), fontSize: num(8), labelPosition: str("InsideEnd"), labelOverflow: bool(true), labelDisplayUnits: num(1), enableBackground: bool(true), backgroundColor: color(C.panel), backgroundTransparency: num(10) } },
        ...serieCascada.filter(([m]) => !conEtiqueta.includes(m)).map(([m]) => ({ properties: { showSeries: bool(false) }, selector: { metadata: qref(ER, m) } })),
        // texto oscuro por serie (Desktop usaba blanco automático sobre el fondo blanco de la etiqueta)
        ...conEtiqueta.map((m) => ({ properties: { color: color(C.titulo) }, selector: { metadata: qref(ER, m) } })),
      ],
      // columnas más anchas (menos espacio entre categorías) para que quepan cifras de 8 dígitos
      categoryAxis: [{ properties: { axisType: str("Categorical"), fontSize: num(10), labelColor: color(C.tenue), showAxisTitle: bool(false), gridlineShow: bool(false), innerPadding: num(12) } }],
      valueAxis: [{ properties: { show: bool(false), gridlineShow: bool(false) } }],
      legend: [{ properties: { show: bool(false) } }],
    },
    visualContainerObjects: {
      ...vcoPanel({
        titulo: "Cascada del año seleccionado (miles de S/)", subtitulo: "Verde suma · rojo resta · azul: ventas y subtotales, hasta la utilidad neta",
        alt: "Cascada desde ventas hasta utilidad neta del año seleccionado, con subtotales de utilidad bruta, operativa, antes de impuestos y de operaciones continuadas.",
      }),
      visualTooltip: [{ properties: { show: bool(true), type: str("Default"), showTooltipFieldsOnly: bool(true) } }],
    },
  }, { filterConfig: { filters: [filtroIn(p + "paso", "Cuenta Resultados", "Paso cascada", ["null"], { negar: true })] } });
  v.matriz = matriz(hid(p + "matriz"), region(R.detail), {
    // lista plana en orden contable (Cuenta se ordena por Orden), sin total general; subtotales resaltados por Es subtotal
    filas: ["Cuenta Resultados", "Cuenta"], columnas: ANIO, valores: [[ER, "Monto"]],
    resaltar: [ER, "Fila subtotal"],
    titulo: "Estado de Resultados 2020-2025 (miles de S/)", subtitulo: "Última versión publicada de cada año · en orden contable; filas resaltadas: subtotales (utilidad bruta, operativa, antes de impuestos, continuadas y neta)",
    alt: "Matriz del Estado de Resultados por cuenta y año, 2020-2025, en miles de soles, en orden contable desde ventas hasta la utilidad neta y su atribución; los subtotales están resaltados.",
    filtros: [
      filtroIn(p + "mostrar", "Cuenta Resultados", "Mostrar", ["true"]),
      filtroIn(p + "upa", "Cuenta Resultados", "Grupo", ["'UPA'"], { negar: true }),
    ],
  });
  const interacciones = [{ source: v.anio.name, target: v.matriz.name, type: "NoFilter" }];
  return { nombre: hid("pagina-cascada"), titulo: "Estado de Resultados en cascada", visuales: Object.values(v), interacciones };
}

function paginaMargenes() {
  const p = "margenes";
  const R = { header: [1, 1, 9, 2], nav: [9, 1, 13, 2], tl: [1, 2, 7, 7], tr: [7, 2, 13, 7], bl: [1, 7, 7, 13], br: [7, 7, 13, 13] };
  const v = {};
  v.titulo = textoTitulo(hid(p + "titulo"), region(R.header), "El margen bruto se recuperó del bache de 2022 (18.0%) y hoy supera su nivel de 2020: 26.4% vs. 23.7%");
  v.nav = navegador(hid(p + "nav"), region(R.nav));
  v.margenes = grafico(hid(p + "margenes"), region(R.tl), "lineChart", {
    y: [[ER, "Margen bruto %"], [ER, "Margen operativo %"], [ER, "Margen continuadas %"], [ER, "Margen neto %"]],
    titulo: "Márgenes sobre ventas", subtitulo: "Margen continuadas = utilidad de operaciones continuadas / ventas",
    alt: "Cuatro márgenes por año. El margen bruto cae a 18.0% en 2022 y sube a 27.0% en 2024 y 26.4% en 2025; el operativo alcanza 10.2% en 2024.",
    colores: { "Margen bruto %": C.acento, "Margen operativo %": C.pizarra, "Margen continuadas %": C.ambar, "Margen neto %": C.gris },
    etiquetasSolo: ["Margen bruto %", "Margen operativo %"],
    extraObjects: { valueAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.tenue), gridlineShow: bool(true), gridlineColor: color(C.borde) } }] },
  });
  v.crecimiento = grafico(hid(p + "crecimiento"), region(R.tr), "clusteredColumnChart", {
    y: [[CMP, "Ventas YoY %"], [CMP, "Utilidad operativa YoY %"]],
    titulo: "Crecimiento vs. año anterior (comparable)", subtitulo: "Ambos años del mismo reporte: misma clasificación de operaciones continuadas",
    alt: "Variación anual de ventas y utilidad operativa 2021-2025 con base comparable. Ventas: +30.8%, +26.1%, -11.3%, -4.0%, +11.0%.",
    colores: { "Ventas YoY %": C.acento, "Utilidad operativa YoY %": C.pizarra },
    // Power BI ocultaba la etiqueta de Utilidad operativa 2022 (+29.8%) porque chocaba con la de Ventas: sin optimización
    // de etiquetas y con columnas más anchas (menos espacio entre años) cada etiqueta cabe sobre su barra
    propsEtiquetas: { optimizeLabelDisplay: bool(false) },
    filtros: [filtroDesde2021(p + "desde2021")],
    extraObjects: {
      valueAxis: [{ properties: { show: bool(false), gridlineShow: bool(false) } }],
      categoryAxis: [{ properties: { ...ejeCategorico[0].properties, innerPadding: num(10) } }],
    },
  });
  v.costos = grafico(hid(p + "costos"), region(R.bl), "columnChart", {
    y: [[ER, "Costo de ventas % ventas"], [ER, "Gastos de ventas % ventas"], [ER, "Gastos de administración % ventas"]],
    titulo: "Costo y gastos como % de las ventas", subtitulo: "El costo de ventas baja de 82.0% (2022) a 73.6% (2025)",
    alt: "Costo de ventas, gastos de ventas y gastos de administración como porcentaje de las ventas, apilados por año.",
    colores: { "Costo de ventas % ventas": C.pizarra, "Gastos de ventas % ventas": C.ambar, "Gastos de administración % ventas": C.gris },
    etiquetaBlanca: [[ER, "Costo de ventas % ventas"], [ER, "Gastos de ventas % ventas"]],
  });
  v.reexpresion = grafico(hid(p + "reexpresion"), region(R.br), "clusteredColumnChart", {
    y: [[ER, "Ventas originales"], [ER, "Ventas"]], miles: true,
    titulo: "Ventas: publicadas originalmente vs. última versión (miles de S/)", subtitulo: "2023 se reexpresó de 13,655,764 a 11,039,113 al reclasificar negocios como discontinuados",
    alt: "Ventas de cada año según su primera publicación y según la última versión publicada. La mayor diferencia es 2023 (-2,616,651 miles de soles).",
    colores: { "Ventas originales": C.gris, "Ventas": C.acento },
    extraObjects: { valueAxis: [{ properties: { show: bool(false), gridlineShow: bool(false) } }] },
  });
  return { nombre: hid("pagina-margenes"), titulo: "Márgenes y tendencias", visuales: Object.values(v), interacciones: [] };
}

function paginaBalance() {
  const p = "balance";
  const R = { header: [1, 1, 6, 2], nav: [6, 1, 10, 2], filters: [10, 1, 13, 2], kpis: [1, 2, 13, 4], tl: [1, 4, 5, 8], tm: [5, 4, 9, 8], tr: [9, 4, 13, 8], bl: [1, 8, 6, 13], br: [6, 8, 13, 12], conclusion: [6, 12, 13, 13] };
  const v = {};
  v.titulo = textoTitulo(hid(p + "titulo"), region(R.header), "Menos liquidez y más apalancamiento: el patrimonio cayó 62% desde 2020", 20);
  v.nav = navegador(hid(p + "nav"), region(R.nav));
  v.anio = slicerAnio(hid(p + "anio"), region(R.filters));
  const kpis = [
    [[BAL, "Liquidez corriente"], "Liquidez corriente", C.acento, false],
    [[BAL, "Prueba ácida"], "Prueba ácida", C.pizarra, false],
    [[BAL, "Pasivo / Patrimonio"], "Pasivo / Patrimonio", C.ambar, false],
    [[BAL, "Deuda financiera neta"], "Deuda financiera neta (miles de S/)", C.negro, true],
    [[BAL, "ROE %"], "ROE", C.acento, false],
    [[BAL, "ROA %"], "ROA", C.gris, false],
  ];
  kpis.forEach(([m, etq, ac, uni], i) => { v["k" + i] = tarjeta(hid(p + "k" + i), region(R.kpis, i + 1, 6), m, etq, { acento: ac, unidades: uni }); });
  v.financiamiento = grafico(hid(p + "financiamiento"), region(R.tl), "columnChart", {
    y: [[BAL, "Pasivo corriente"], [BAL, "Pasivo no corriente"], [BAL, "Patrimonio total"]], miles: true,
    titulo: "¿Cómo se financia el activo?", subtitulo: "Miles de S/ al cierre de cada año",
    alt: "Pasivo corriente, pasivo no corriente y patrimonio total apilados por año; el patrimonio baja de 3,680,824 (2020) a 1,388,866 (2025).",
    colores: { "Pasivo corriente": C.ambar, "Pasivo no corriente": C.pizarra, "Patrimonio total": C.acento },
    extraObjects: { labels: [{ properties: { show: bool(false) } }], valueAxis: [{ properties: { show: bool(true), fontSize: num(9), labelColor: color(C.tenue), labelDisplayUnits: num(1), gridlineShow: bool(true), gridlineColor: color(C.borde) } }] },
  });
  v.liquidez = grafico(hid(p + "liquidez"), region(R.tm), "lineChart", {
    y: [[BAL, "Liquidez corriente"], [BAL, "Prueba ácida"], [BAL, "Razón de efectivo"]],
    titulo: "Liquidez (veces)", subtitulo: "La liquidez corriente cae por debajo de 1.0x desde 2024",
    alt: "Liquidez corriente, prueba ácida y razón de efectivo por año. La liquidez corriente baja de 1.40x (2021) a 0.81x (2025).",
    colores: { "Liquidez corriente": C.acento, "Prueba ácida": C.pizarra, "Razón de efectivo": C.gris },
    extraObjects: { y1AxisReferenceLine: [{ properties: { show: bool(true), value: num(1), lineColor: color(C.deterioro), style: str("dashed"), transparency: num(30) }, selector: { id: "1" } }] },
  });
  v.endeudamiento = grafico(hid(p + "endeudamiento"), region(R.tr), "lineChart", {
    y: [[BAL, "Pasivo / Patrimonio"], [BAL, "Deuda financiera / Patrimonio"]],
    titulo: "Endeudamiento (veces el patrimonio)", subtitulo: "Pasivo total y deuda financiera sobre patrimonio total",
    alt: "Pasivo sobre patrimonio y deuda financiera sobre patrimonio por año; el pasivo sube de 2.17x (2020) a 6.68x (2025).",
    colores: { "Pasivo / Patrimonio": C.ambar, "Deuda financiera / Patrimonio": C.pizarra },
    posEtiquetas: { "Pasivo / Patrimonio": "Above", "Deuda financiera / Patrimonio": "Under" },
    // eje de 0 a 8x: espacio bajo el punto de 2020 (1.11x) y sobre el de 2025 (6.68x) para sus etiquetas
    extraObjects: { valueAxis: [{ properties: { show: bool(true), start: num(0), end: num(8), fontSize: num(9), labelColor: color(C.tenue), gridlineShow: bool(true), gridlineColor: color(C.borde) } }] },
  });
  v.retornos = grafico(hid(p + "retornos"), region(R.bl), "clusteredColumnChart", {
    y: [[BAL, "ROE %"], [BAL, "ROA %"]],
    titulo: "Rentabilidad: ROE y ROA", subtitulo: "Sobre saldos promedio; utilidad y patrimonio de la controladora en el ROE",
    alt: "ROE y ROA por año 2021-2025. El ROE pasa de -1.0% (2021) a 25.7% (2025); el ROA de -0.2% a 4.0%.",
    colores: { "ROE %": C.acento, "ROA %": C.gris },
    filtros: [filtroDesde2021(p + "retornos2021")],
  });
  v.dupont = matriz(hid(p + "dupont"), region(R.br), {
    filas: ANIO,
    valores: [[BAL, "Margen neto controladora % (DuPont)", "Margen neto (controladora)"], [BAL, "Rotación de activos (DuPont)", "× Rotación de activos"], [BAL, "Apalancamiento (DuPont)", "× Apalancamiento"], [BAL, "ROE %", "= ROE"]],
    fuente: 14,
    titulo: "Análisis DuPont: ¿de dónde viene el ROE?",
    subtitulo: "Margen neto × Rotación × Apalancamiento = ROE. Apalancamiento = activo total / patrimonio de la controladora (saldos promedio), distinto de Pasivo / Patrimonio",
    alt: "Descomposición DuPont del ROE 2021-2025. En 2025 el ROE de 25.7% se explica por un apalancamiento de 6.59x, con margen neto de 3.8% y rotación de 1.03x.",
    filtros: [filtroDesde2021(p + "dupont2021")],
  });
  v.conclusion = textoDestacado(hid(p + "conclusion"), region(R.conclusion),
    "Entre 2022 y 2025 el margen y la rotación casi no cambiaron; el ROE subió por el apalancamiento (4.45x → 6.59x)");
  const interacciones = ["financiamiento", "liquidez", "endeudamiento", "retornos", "dupont"].map((k) => ({ source: v.anio.name, target: v[k].name, type: "NoFilter" }));
  return { nombre: hid("pagina-balance"), titulo: "Balance y ratios", visuales: Object.values(v), interacciones };
}

// ---------------------------------------------------------------- tema
function escribirTema() {
  const dir = join(REPORTE, "StaticResources", "RegisteredResources");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.startsWith("AlicorpSobrio-") && f !== TEMA) rmSync(join(dir, f));
  const fuente = "Segoe UI";
  const tema = {
    $schema: "https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.153.json",
    name: TEMA,
    dataColors: [C.acento, C.pizarra, C.ambar, C.gris, C.negro, C.mejora, C.deterioro, "#0891B2", "#CBD5E1"],
    good: C.mejora, neutral: C.gris, bad: C.deterioro,
    maximum: C.acento, center: "#CFFAFE", minimum: "#F1F5F9", null: C.gris,
    foreground: C.texto, background: C.panel, tableAccent: C.acento,
    textClasses: {
      callout: { fontSize: 26, fontFace: "Segoe UI Semibold", color: C.titulo },
      title: { fontSize: 13, fontFace: "Segoe UI Semibold", color: C.titulo },
      header: { fontSize: 12, fontFace: "Segoe UI Semibold", color: C.titulo },
      label: { fontSize: 10, fontFace: fuente, color: C.texto },
    },
    visualStyles: {
      "*": {
        "*": {
          background: [{ show: true, color: { solid: { color: C.panel } }, transparency: 0 }],
          border: [{ show: true, color: { solid: { color: C.borde } }, radius: 8, width: 1 }],
          dropShadow: [{ show: false }],
          padding: [{ top: 8, bottom: 8, left: 8, right: 8 }],
          visualHeader: [{ show: false }],
          categoryAxis: [{ gridlineShow: false }],
          valueAxis: [{ gridlineStyle: "dotted", gridlineColor: { solid: { color: C.borde } } }],
        },
      },
      page: { "*": { background: [{ color: { solid: { color: C.pagina } }, transparency: 0 }] } },
      textbox: { "*": { padding: [{ top: 0, bottom: 0, left: 0, right: 0 }], background: [{ show: false }], border: [{ show: false }] } },
      pivotTable: { "*": { columnHeaders: [{ autoSizeColumnWidth: true, columnAdjustment: "growToFit" }] } },
      tableEx: { "*": { columnHeaders: [{ autoSizeColumnWidth: true, columnAdjustment: "growToFit" }] } },
      slicer: {
        "*": {
          header: [{ fontFamily: "Segoe UI Semibold", textSize: 10, fontColor: { solid: { color: C.texto } }, outlineStyle: 0 }],
          items: [{ fontFamily: fuente, textSize: 10, fontColor: { solid: { color: C.texto } }, outlineStyle: 0, padding: 2 }],
        },
      },
    },
  };
  writeFileSync(join(dir, TEMA), JSON.stringify(tema, null, 2) + "\n");
}

function actualizarReportJson() {
  const ruta = join(DEF, "report.json");
  const rep = JSON.parse(readFileSync(ruta, "utf8"));
  const base = rep.themeCollection.baseTheme;
  rep.themeCollection.customTheme = { name: TEMA, reportVersionAtImport: base.reportVersionAtImport, type: "RegisteredResources" };
  rep.resourcePackages = rep.resourcePackages.filter((p) => p.type !== "RegisteredResources");
  rep.resourcePackages.push({ name: "RegisteredResources", type: "RegisteredResources", items: [{ name: TEMA, path: TEMA, type: "CustomTheme" }] });
  writeFileSync(ruta, JSON.stringify(rep, null, 2) + "\n");
}

// ---------------------------------------------------------------- escritura
function escribirPagina(pg) {
  const dir = join(PAGINAS, pg.nombre);
  mkdirSync(join(dir, "visuals"), { recursive: true });
  const page = {
    $schema: SCHEMA_PAGE, name: pg.nombre, displayName: pg.titulo, displayOption: "FitToPage",
    height: LIENZO.h, width: LIENZO.w,
    objects: { background: [{ properties: { color: color(C.pagina), transparency: num(0) } }] },
  };
  if (pg.interacciones.length) page.visualInteractions = pg.interacciones;
  writeFileSync(join(dir, "page.json"), JSON.stringify(page, null, 2) + "\n");
  for (const vis of pg.visuales) {
    const vdir = join(dir, "visuals", vis.name);
    mkdirSync(vdir, { recursive: true });
    writeFileSync(join(vdir, "visual.json"), JSON.stringify(vis, null, 2) + "\n");
  }
}

if (existsSync(PAGINAS)) rmSync(PAGINAS, { recursive: true, force: true });
mkdirSync(PAGINAS, { recursive: true });
escribirTema();
actualizarReportJson();
const paginas = [paginaResumen(), paginaCascada(), paginaMargenes(), paginaBalance()];
paginas.forEach(escribirPagina);
writeFileSync(join(PAGINAS, "pages.json"), JSON.stringify({ $schema: SCHEMA_PAGES, pageOrder: paginas.map((p) => p.nombre), activePageName: paginas[0].nombre }, null, 2) + "\n");
console.log(`Reporte generado: ${paginas.length} páginas, ${paginas.reduce((n, p) => n + p.visuales.length, 0)} visuales, tema ${TEMA}`);
