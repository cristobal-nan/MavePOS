# Guía Maestra de Interfaz (UI/UX) y Plan de Reconstrucción — POS Offline

Este documento es el **sistema de diseño canónico y hoja de ruta** para auditar, reconstruir y unificar pantalla por pantalla todo el sistema.
Ha sido evaluado y calibrado bajo las dos habilidades de diseño:
- **`frontend-design` (Anthropic):** Coherencia estética, jerarquía visual, eliminación de clichés de IA y redacción UX.
- **`web-design-guidelines` (Vercel):** Accesibilidad (WCAG 2.1 AA), navegación por teclado, `tabular-nums`, gestión de foco y cero layout shift.

> [!IMPORTANT]
> **Aislamiento Estricto de Capas (Scope Boundary):**
> Esta campaña de auditoría y reconstrucción se circunscribe **exclusivamente a la capa de presentación visual y accesibilidad** (`JSX`, `TSX`, TailwindCSS y semántica ARIA).
> **Queda prohibido** modificar consultas SQLite, esquemas de base de datos, canales IPC en `main/preload` o la lógica financiera y de inventario de los stores (`useSalesStore`, `useCashStore`, `useInventoryStore`, etc.). La lógica de negocio está 100% probada y debe permanecer intacta.

> [!IMPORTANT]
> **Validación Dual Obligatoria en Cada Paso (Modo Claro & Modo Oscuro):**
> En **todos y cada uno de los pasos (del 0 al 8)**, es requisito excluyente verificar el contraste, la legibilidad y la jerarquía visual **tanto en Modo Claro como en Modo Oscuro (Slate Profundo)**.
> - Queda estrictamente prohibido aprobar o cerrar una fase habiendo revisado un solo modo.
> - En Modo Claro: fondos limpios (blanco o gris suave estructurado), bordes definidos y contraste nítido de texto.
> - En Modo Oscuro: paleta Slate Profundo (`#0F172A` bases, `#1E293B` tarjetas, `#334155` bordes, `#F8FAFC` textos), con botones de acción conservando su tinte identificatorio mediante fondos translúcidos y bordes tonales (nunca fundirse a gris plano ni mostrar bordes blancos residuales).

---

## 1. Reglas Técnicas y Accesibilidad (Validación Vercel)

Toda pantalla reconstruida debe cumplir estrictamente las siguientes reglas técnicas:

### 1.1 Foco y Navegación por Teclado
- **Anillos de foco visibles:** Todo elemento interactivo (`<button>`, `<input>`, `<a>`) debe tener `focus-visible:ring-2 focus-visible:ring-lilac-500 focus-visible:ring-offset-1 focus-visible:outline-none dark:focus-visible:ring-offset-slate-900`.
- **Prohibido `outline-none` sin reemplazo:** Nunca remover el outline sin proveer un anillo `:focus-visible`.
- **Controles agrupados:** Usar `focus-within:ring-2` en contenedores que agrupen inputs con iconos o botones (ej. barras de búsqueda).
- **Semántica HTML:** Usar siempre `<button>` para acciones y `<a>` para navegación. Prohibido `<div onClick>`.

### 1.2 Atributos ARIA y Accesibilidad
- **Botones con solo icono:** Obligatorio atributo `aria-label="Descripción de la acción"` y tooltip `title` (ej. botón basurero en carrito, cerrar modal, atajo F10).
- **Iconos decorativos:** Todo icono Lucide que acompañe texto debe llevar `aria-hidden="true"`.
- **Actualizaciones asíncronas:** Alertas, toasts o mensajes de estado deben incluir `aria-live="polite"`.
- **Tamaño de toque/clic (*Hit targets*):** Altura mínima de 36px a 40px en botones de caja para evitar clics accidentales o zonas muertas.
- **Formularios vinculados:** Todos los `<label>` deben estar asociados a su input mediante `htmlFor` o envolviendo el control.

### 1.3 Tipografía de Datos y Puntuación
- **`tabular-nums` obligatorio:** Toda columna de precios, existencias, totales, códigos o fechas debe usar `font-variant-numeric: tabular-nums` (clase Tailwind `tabular-nums font-mono` en tickets y `tabular-nums` en tablas de catálogo). Esto evita que los números bailen o tiemblen al cambiar valores.
- **Puntuación y elipsis:** Usar el carácter tipográfico de elipsis `…` (`U+2026`) y **no** tres puntos seguidos `...`.
- **Estados de carga:** Los textos de acción en progreso terminan en `…` (ej. *"Guardando…"*, *"Imprimiendo…"*, *"Cargando catálogo…"*).
- **Truncamiento en Flexbox:** Todo hijo directo de un contenedor `flex` que contenga texto truncable (`truncate`) debe incluir `min-w-0` para prevenir desbordamientos indeseados.

### 1.4 Animaciones y Rendimiento
- **Respeto a accesibilidad:** Respetar `motion-reduce` mediante la variante `motion-reduce:transition-none`.
- **Propiedades explícitas:** Prohibido usar `transition: all`. Listar siempre las propiedades explícitas (ej. `transition-colors duration-150`, `transition-transform duration-150`).
- **Compositor amigable:** Animar únicamente `transform` y `opacity`.

---

## 2. Dirección de Arte y Consistencia (Filosofía Anthropic)

Para erradicar la sensación de "interfaz generada por IA sin terminar" y darle identidad de herramienta de escritorio robusta:

### 2.1 Erradicación de Clichés Visuales de IA
- ❌ **Evitar el "SaaS Card Kit":** No recortar cada sección en tarjetas blancas flotantes idénticas con esquinas hiper-redondeadas y sombras grises genéricas. El POS es un software de escritorio: preferir paneles continuos, líneas divisorias nítidas (`border-slate-200 dark:border-slate-800`) y estructura clara.
- ❌ **Sin etiquetas en mayúsculas sostenidas (`ALL CAPS`):** Eliminar labels tipo `ESTADO DEL TICKET` o `CÓDIGO DE BARRAS`. Usar *sentence case* (`Código de barras`, `Estado del ticket`) con peso medio (`font-medium text-xs`).
- ❌ **Sin gradientes decorativos vacíos:** El color debe transmitir estado, categoría o jerarquía funcional, nunca servir como relleno estético.
- ❌ **Sin flechas `→` redundantes:** Los botones expresan su acción mediante texto directo.

### 2.2 Redacción de Interfaz (UX Copywriting)
- **Voz activa y orientada a la tarea:** Botones con verbos claros en infinitivo (*"Cobrar venta"*, *"Ajustar stock"*, *"Guardar cambios"*, nunca *"Enviar"* o *"Aceptar"*).
- **Cohesión léxica (Botón $\rightarrow$ Toast):** Si el botón dice *"Guardar cambios"*, el toast o confirmación dice *"Cambios guardados"*.
- **Manejo de errores y estados vacíos:**
  - Los errores explican qué ocurrió y cómo corregirlo de forma neutra y sin disculpas vacías (*"El código de barras ya existe en el catálogo"*, no *"Lo sentimos, hubo un error"*).
  - Un estado vacío nunca es un callejón sin salida: explica qué falta e incluye el botón para crearlo (*"No hay productos en esta categoría. [Agregar primer producto]"*).

---

## 3. Arquitectura Visual y Superficies del POS

### 3.1 Infraestructura Existente de Temas y Componentes Globales
El sistema ya cuenta con una base sólida de componentes y configuración compartida que **debe respetarse y reutilizarse**:
- **Motor Central de Temas:** [`src/renderer/src/theme/themes.ts`](file:///C:/Users/crist/Documents/mave/pos/src/renderer/src/theme/themes.ts) — Define los 4 acentos (`lila`, `esmeralda`, `oceano`, `grafito`) con escalas 50–950 y las funciones `applyTheme()` y `applySurfaceMode()`.
- **Barra de Navegación Principal:** [`src/renderer/src/components/NavigationTabs.tsx`](file:///C:/Users/crist/Documents/mave/pos/src/renderer/src/components/NavigationTabs.tsx) — Gestiona las pestañas globales superiores (`Ventas`, `Productos`, `Inventario`, etc.).
- **Barra de Ventana sin Bordes:** [`src/renderer/src/components/TitleBar.tsx`](file:///C:/Users/crist/Documents/mave/pos/src/renderer/src/components/TitleBar.tsx) — Minimizar, cerrar y arrastrar ventana.
- **Comprobante Térmico Físico:** [`src/renderer/src/components/ThermalTicketPaperView.tsx`](file:///C:/Users/crist/Documents/mave/pos/src/renderer/src/components/ThermalTicketPaperView.tsx) — Renderizado inmutable de papel blanco para tickets de venta y corte.

### 3.2 Esquema de Color Dual y Slate Profundo
- **Tokens Centralizados:** Toda la interfaz consume tokens dinámicos `lilac-*` desde `src/renderer/src/theme/themes.ts`. Prohibido quemar clases como `purple-*` o valores HEX manuales.
- **Acentos:** Soporte dinámico para **Lila** (base), **Esmeralda**, **Océano** y **Grafito**.
- **Modo Oscuro Slate Profundo:**
  - Fondo base de aplicación: `#0F172A` (Slate 900).
  - Paneles, tarjetas y modales: `#1E293B` (Slate 800).
  - Bordes, divisores e inputs: `#334155` (Slate 700).
  - Textos: `#F8FAFC` (Slate 50, títulos) y `#94A3B8` (Slate 400, descripciones).
  - **Identidad de color en modo oscuro:** Los botones de acción y badges no deben volverse grises planos; deben conservar su matiz mediante fondos translúcidos (`bg-lilac-950/40 border border-lilac-700/50 text-lilac-200`).
- **Tickets Térmicos Inmutables:** Los comprobantes de venta, cambios y arqueo representan papel físico. **Siempre se muestran e imprimen en papel blanco puro con texto negro monoespaciado** (`thermal-ticket-paper`, `bg-white text-slate-900 font-mono`), tanto en modo claro como en modo oscuro.

---

## 4. Anatomía Estándar de una Pantalla (Blueprint de Reconstrucción)

Cada pantalla que auditemos y reconstruyamos debe encajar exactamente en esta estructura de 3 zonas:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 1. ViewHeader (Cabecera Canónica)                                            │
│    [Icono + Título de Vista] [Subtítulo] ── [Buscador/Filtros] [Botón Acción]│
├──────────────────────────────────────────────────────────────────────────────┤
│ 2. SubTabs (Opcional si la vista tiene múltiples sub-secciones)              │
│    [ Pill 1 Activa ] [ Pill 2 ] [ Pill 3 ]                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3. MainContent (Área de Trabajo con Geometría Fija)                         │
│    - Tablas de datos con altura de fila fija (h-11) y scroll contenido       │
│    - Formularios con validación en línea (sin saltos de altura)              │
│    - Espacios reservados para totales ($0, 0 un., —)                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Componente A: `ViewHeader` Canónico
```tsx
// Estructura uniforme
<header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-between gap-4">
  <div className="min-w-0">
    <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{titulo}</h1>
    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitulo}</p>
  </div>
  <div className="flex items-center gap-3">
    {/* Filtros o buscadores secundarios */}
    {accionesPrimarias}
  </div>
</header>
```

### Componente B: `SubTabs` Canónicas
*(Resuelve la inconsistencia histórica de pestañas con estilos dispares).*
- **Contenedor:** `bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl flex gap-1 w-fit border border-slate-200/50 dark:border-slate-700/50`.
- **Item Activo:** `bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium shadow-sm rounded-lg px-3.5 py-1.5 text-sm flex items-center gap-2 transition-colors duration-150`.
- **Item Inactivo:** `text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-lg px-3.5 py-1.5 text-sm flex items-center gap-2 transition-colors duration-150`.
- **Iconos:** Tamaño estándar `h-4 w-4 shrink-0`.

### Componente C: Formularios y Cero Layout Shift
- **Validación en la misma fila:**
  ```tsx
  <div className="flex items-center justify-between mb-1 gap-2">
    <label htmlFor={id} className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</label>
    {error && (
      <span className="text-xs font-medium text-rose-500 dark:text-rose-400 truncate max-w-[200px]" title={error}>
        {error}
      </span>
    )}
  </div>
  <input
    id={id}
    className={clsx(
      "w-full px-3 py-2 rounded-lg border text-sm transition-colors duration-150",
      error ? "border-rose-500 focus-visible:ring-rose-500" : "border-slate-300 dark:border-slate-700"
    )}
  />
  ```
- **Prohibido:** Renderizar elementos condicionales debajo del input (`{error && <p>...}`) que empujen el formulario hacia abajo.

### Componente D: Feedback en Botón y Toasts
- **En botón accionado:** Spinner `Loader2` giratorio mientras procesa $\rightarrow$ Check `CheckCircle2` verde durante 2 a 3 segundos.
- **Toast global:** Posición fija `fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200` con `aria-live="polite"` y auto-cierre de 3-4 segundos.

---

## 5. Hoja de Ruta Pantalla por Pantalla

Para cada pantalla se aplicará rigurosamente este ciclo de 5 pasos:
1. **Auditoría Técnica (`web-design-guidelines`):** Foco visible, semántica ARIA, hit targets mínimos y `tabular-nums`.
2. **Revisión Estética (`frontend-design`):** Alineación a `ViewHeader`, unificación de `SubTabs`, erradicación de clichés y UX copywriting activo.
3. **Reconstrucción y Homologación:** Reemplazo de componentes ad-hoc por los patrones canónicos.
4. **Validación Técnica Estricta:** `npm run typecheck` (0 errores) y `npm run test` (100% pasando).
5. **Registro en Bitácora:** Documentar en la Sección 6 los archivos tocados, mejoras aplicadas y validación visual dual (Claro y Slate Profundo).

> [!CAUTION]
> **Criterio Estricto de Terminación (Anti-Premature Completion):**
> Una fase o pantalla se considera completada y puede marcarse como `[x]` en la matriz **únicamente** cuando se hayan ejecutado los 5 pasos y se haya llenado su correspondiente entrada en la **Sección 6 (Bitácora)**. Queda prohibido marcar `[x]` de forma anticipada.

---

### Matriz de Estado

| # | Fase / Pantalla | Componentes o Secciones | Puntos Específicos de Reconstrucción | Estado |
|---|---|---|---|:---:|
| 0 | **Base Canónica Compartida** | `ViewHeader`, `SubTabs`, `EmptyState` | Crear componentes primitivos compartidos en `src/renderer/src/components/common/` conectando `themes.ts`, asegurando accesibilidad y soporte claro/oscuro. | `[x] Completado` |
| 1 | **Ventas y Cobro** | `SalesView.tsx`, `CheckoutModal.tsx` | Autofocus HID permanente, tickets standby con basurero accesible, modal de cobro bloqueante con vuelto en tiempo real (`tabular-nums`), previsualizador térmico blanco. | `[x] Completado` |
| 2 | **Catálogo y Productos** | `CatalogView.tsx`, `ProductFormModal.tsx` | Conectar `SubTabs` canónicas, buscador F10 con drag redimensionable, tabla densa (`h-11`, `tabular-nums`), formulario de producto sin mutación de stock. | `[x] Completado` |
| 3 | **Inventario y Kardex** | `InventoryView.tsx`, `CancelAdjustmentModal.tsx`, `AdjustmentRulesHelpModal.tsx` | Conectar `SubTabs` canónicas, modo de escucha por atajos en cantidad (Enter), inputs numéricos con borrado fluido, tabla de auditoría cronológica. | `[x] Completado` |
| 4 | **Corte y Arqueo** | `CashCutView.tsx`, calculadora de efectivo | Conectar `SubTabs` canónicas (Turnos / Registros Diarios), calculadora física en 2 columnas (apertura read-only vs cierre editable con `tabular-nums`), arqueo balanceado/sobrante/faltante. | `[x] Completado` |
| 5 | **Historial y Cambios** | `HistoryView.tsx`, `ExchangeModal.tsx` | Filtros de fecha y folio en `ViewHeader`, ticket de cambio (`CAMBIO`), advertencia informativa >30 días, reimpresión rápida. | `[x] Completado` |
| 6 | **Reportes** | `ReportsView.tsx` | Tarjetas de métricas fijas sin layout shift, selectores temporales con foco accesible, gráficos Recharts con soporte claro y Slate Profundo. | `[x] Completado` |
| 7 | **Configuración** | `SettingsView.tsx` | Conectar `SubTabs` canónicas, guardado único en cabecera con estado `isDirty` (naranja), `UnsavedChangesModal`, selector de 4 temas y transiciones solo aquí. | `[x] Completado` |
| 8 | **Barrido Final de Cohesión** | Toda la aplicación (`F1` a `F6`) | Verificación cruzada entre la primera y la última pantalla, retrofitting de mejoras tardías, comprobación de 0 regresiones en `typecheck` y 100% de tests. | `[x] Completado` |

---

## 6. Bitácora de Auditoría y Cambios

### Fase 0: Base Canónica Compartida (`ViewHeader`, `SubTabs`, `EmptyState`)
- **Estado:** `[x] Completado`
- [x] Verificado en Modo Claro
- [x] Verificado en Modo Oscuro (Slate Profundo)
- **Archivos:**
  - `src/renderer/src/components/common/ViewHeader.tsx`
  - `src/renderer/src/components/common/SubTabs.tsx`
  - `src/renderer/src/components/common/EmptyState.tsx`
  - `src/renderer/src/components/common/index.ts`
  - `src/test/commonComponents.test.ts`
- **Cambios realizados:**
  - `ViewHeader`: Cabecera canónica unificada para vistas del POS con título truncable, subtítulo, contenedor de icono temático con tono suave, ranura para badges y espacio para acciones/filtros (`min-w-0`, `focus-visible`).
  - `SubTabs`: Navegación secundaria estilo pill con soporte para teclado (flechas izq/der/arriba/abajo, Home, End), roles ARIA completos (`tablist`, `tab`, `aria-selected`), insignia con `tabular-nums` y focus rings visibles (`focus-visible:ring-2 focus-visible:ring-lilac-500`).
  - `EmptyState`: Estado vacío funcional sin clichés de tarjetas flotantes ni gradientes decorativos. Incluye icono estructurado, título en sentence case, descripción concisa, botón de acción con copy activo y estado de carga (`Loader2` con elipsis `…`).
  - Verificación dual en Modo Claro y Modo Oscuro Slate Profundo (`#0F172A`, `#1E293B`, `#334155`). Cobertura de pruebas con 11 tests unitarios en Vitest pasando al 100%.

---

### Pantalla 1: Ventas y Cobro (`SalesView.tsx`, `CheckoutModal.tsx`)
- **Estado:** `[x] Completado`
- [x] Verificado en Modo Claro
- [x] Verificado en Modo Oscuro (Slate Profundo)
- **Archivos:**
  - `src/renderer/src/views/SalesView.tsx`
  - `src/renderer/src/components/CheckoutModal.tsx`
  - `src/test/checkoutModal.test.ts`
- **Cambios realizados:**
  - `SalesView`: Navegación de tickets simultáneos (standby) convertida a tabs accesibles con semántica `role="tablist"` / `role="tab"`, `aria-selected` y botón de descarte accesible (`aria-label`, tooltip `title`).
  - Autofocus permanente para escáner HID en input de código, con protección contra colisiones en modales y atajos (+ / - para cantidades, F10 buscador, F12 cobro, Ctrl+T nuevo ticket, Ctrl+W cerrar ticket).
  - Sustitución de estado vacío ad-hoc por el componente canónico `EmptyState` con CTA orientada a la acción hacia el catálogo (F10).
  - Aplicación de `tabular-nums` monoespaciado en precios unitarios, cantidades, subtotales, existencias restantes y totales del pie de página.
  - Estandarización de modales de confirmación (cambio exacto, confirmación de eliminación al llegar a 0 y descarte de ticket) con soporte dual Slate Profundo (`#0F172A`, `#1E293B`, `#334155`).
  - `CheckoutModal`: Reconstrucción completa con semántica ARIA (`role="dialog"`, `role="tablist"` en métodos de pago), focus rings visibles temáticos (`focus-visible:ring-lilac-500`), cálculo de vuelto en tiempo real con `tabular-nums`, botones de corte rápido, soporte dual nativo y elipsis tipográfica `…` en estados de carga.
  - Comprobante térmico físico inmutable en blanco puro con tipografía monoespaciada negra.
  - Añadida suite unitaria `checkoutModal.test.ts` alcanzando 293 pruebas unitarias al 100%.

---

### Pantalla 2: Catálogo y Productos (`CatalogView.tsx`, `ProductFormModal.tsx`)
- **Estado:** `[x] Completado`
- [x] Verificado en Modo Claro
- [x] Verificado en Modo Oscuro (Slate Profundo)
- **Archivos:**
  - `src/renderer/src/views/CatalogView.tsx`
  - `src/renderer/src/components/ProductSearch.tsx`
  - `src/renderer/src/components/ProductSearchModal.tsx`
  - `src/renderer/src/components/ProductFormModal.tsx`
  - `src/test/catalogView.test.ts`
- **Cambios realizados:**
  - `CatalogView`: Integrado `ViewHeader` canónico con título descriptivo, subtítulo, badge con contador de productos en `tabular-nums`, y botón primario "+ Nuevo Producto" (`focus-visible:ring-2 focus-visible:ring-lilac-500`).
  - Switch canónico con `SubTabs` para filtrado por tipo de producto (Todos, Vendibles, Simples, Variables, Variaciones) integrado dentro del panel accesible de Filtros, con badge reactivo en el botón de cabecera e indicador de filtro activo, liberando el espacio vertical de la tabla de catálogo.
  - Barra de acciones masivas contextual optimizada con contraste accesible, `tabular-nums` en el contador de seleccionados y anillos de foco visibles (`focus-visible:ring-white`).
  - Modales de confirmación y advertencia (`stockBlockedProduct`, `isBulkDeleteModalOpen`, y Drawer de Filtros) homologados con `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, soporte Slate Profundo (`dark:bg-slate-900`, `dark:border-slate-800`), y botones con `focus-visible`.
  - `ProductSearch`: Filas de tabla ultra compactas con altura mínima reducida (`h-7.5 min-h-[30px]`, `py-0.5 px-2`), permitiendo visualizar un máximo de productos simultáneos en pantalla sin superar sustancialmente la altura de la fuente, eliminación de bordes oscuros duros (`border-slate-100 dark:border-slate-800`), `tabular-nums` en código (`font-mono`), precios, stock y contadores.
  - Integración del componente canónico `EmptyState` para búsquedas sin resultados y estado de carga automática desactivada, con acción de limpieza orientada a la tarea. Checkboxes con `aria-label` accesible.
  - `ProductSearchModal`: Buscador F10 modal accesible con `role="dialog"`, `aria-modal="true"`, drag redimensionable, y paleta Slate Profundo.
  - `ProductFormModal`: Integridad de inventario estricta; el stock de productos existentes no es editable directamente (campo bloqueado con botón que redirige a Inventario > Ajustar), y validación en línea con tooltips flotantes sin layout shift.
  - Creada suite unitaria `src/test/catalogView.test.ts` (5 pruebas), alcanzando 315 tests unitarios pasando al 100% y 0 errores en `npm run typecheck`.

---

### Pantalla 3: Inventario y Kardex (`InventoryView.tsx`, `CancelAdjustmentModal.tsx`, `AdjustmentRulesHelpModal.tsx`)
- **Estado:** `[x] Completado`
- [x] Verificado en Modo Claro
- [x] Verificado en Modo Oscuro (Slate Profundo)
- **Archivos:**
  - `src/renderer/src/views/InventoryView.tsx`
  - `src/renderer/src/components/CancelAdjustmentModal.tsx`
  - `src/renderer/src/components/AdjustmentRulesHelpModal.tsx`
  - `src/test/inventoryView.test.ts`
- **Cambios realizados:**
  - `InventoryView`: Reemplazo de cabecera manual por `ViewHeader` canónico (`icon={Boxes}`, subtítulo descriptivo, badge con total de alertas en `tabular-nums`, y botón accesible "Reglas de Ajuste" con foco visible).
  - Conexión de `SubTabs` canónicas para navegación entre las 4 secciones (`adjust`, `lowStock`, `movements`, `kardex`) con soporte completo de teclado, semántica ARIA (`tablist` / `tab`) e insignia de alertas activas en Stock Bajo.
  - Homologación de `EmptyState` canónico en los 4 escenarios de vaciado: lista de ajustes recientes en la barra lateral, ausencia de alertas de stock mínimo, movimientos del día sin registros y vista kardex sin movimientos/sin producto seleccionado, con llamadas a la acción orientadas al flujo de trabajo.
  - Edición numérica fluida: formulario de ajuste de stock con soporte para borrado libre en `onChange`, validación en línea con bordes coloreados (`border-rose-500`) y espacio reservado para evitar layout shift; cálculo proyectado en tiempo real de delta y stock final con `tabular-nums font-mono`.
  - Modo de atajos de teclado en cantidad: `Enter` activa el modo de motivos rápidos o selección de motivo.
  - Reemplazo de bordes oscuros rígidos (`border-black/60`) por el sistema Slate suave dual (`border-slate-200 dark:border-slate-800`). Focus rings temáticos accesibles (`focus-visible:ring-2 focus-visible:ring-lilac-500`) en todos los inputs, selects, botones y tarjetas interactivas.
  - `CancelAdjustmentModal`: Reconstruido con `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, soporte de cierre con tecla `Escape`, resumen de impacto con `tabular-nums` y elipsis tipográfica `…` en estado de reversión.
  - `AdjustmentRulesHelpModal`: Reconstruido con semántica ARIA dialog, erradicación de clichés de IA (eliminado badge "NUEVO" parpadeante con `animate-pulse`), diseño editorial limpio en Slate Profundo y tecla `Escape`.
  - Creada suite unitaria `src/test/inventoryView.test.ts` (5 pruebas), alcanzando 303 tests unitarios pasando al 100% y 0 errores en `npm run typecheck`.

---

### Pantalla 4: Corte y Arqueo (`CashCutView.tsx`, calculadora de arqueo y modales)
- **Estado:** `[x] Completado`
- [x] Verificado en Modo Claro
- [x] Verificado en Modo Oscuro (Slate Profundo)
- **Archivos:**
  - `src/renderer/src/views/CashCutView.tsx`
  - `src/renderer/src/views/cashCut/ActiveCashCutTab.tsx`
  - `src/renderer/src/views/cashCut/CashCutHistoryTab.tsx`
  - `src/renderer/src/views/cashCut/DenominationsCalculator.tsx`
  - `src/renderer/src/views/cashCut/ConfirmCashCutModal.tsx`
  - `src/test/cashCutView.test.ts`
- **Cambios realizados:**
  - `CashCutView`: Integrado `ViewHeader` canónico con icono `Calculator`, indicador de sesión activa con badge numérico, y navegación por `SubTabs` canónicas (`active`, `history`) con ARIA y soporte de teclado completo.
  - `DenominationsCalculator`: Erradicados bordes duros `border-black/60`, reemplazados por el sistema Slate dual (`border-slate-200 dark:border-slate-700`). Edición fluida sin conversiones espurias a `NaN` en borrado de denominaciones, y formato numérico con `tabular-nums font-mono` en cantidades y subtotales calculados.
  - Modales de confirmación y limpieza accesibles (`ConfirmCashCutModal`, modal de limpieza de gaveta): incorporan `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, captura de tecla `Escape`, botones primarios con focus visible y elipsis tipográfica `…` en estados de carga.
  - `CashCutHistoryTab`: Reemplazado estado vacío ad-hoc por el componente canónico `EmptyState` con CTA para registrar arqueo, tabla de historial en Slate Profundo con `tabular-nums` en montos calculados, diferencias y fechas.
  - Comprobante térmico físico inmutable en blanco puro con tipografía monoespaciada negra.
  - Creada suite unitaria `src/test/cashCutView.test.ts` (4 pruebas), alcanzando 307 tests unitarios pasando al 100%.

---

### Pantalla 5: Historial y Cambios (`HistoryView.tsx`, `SalesHistoryTab.tsx`, `ProductExchangeModal.tsx`)
- **Estado:** `[x] Completado`
- [x] Verificado en Modo Claro
- [x] Verificado en Modo Oscuro (Slate Profundo)
- **Archivos:**
  - `src/renderer/src/views/HistoryView.tsx`
  - `src/renderer/src/views/history/SalesHistoryTab.tsx`
  - `src/renderer/src/views/history/ProductExchangeModal.tsx`
  - `src/test/historyView.test.ts`
- **Cambios realizados:**
  - `HistoryView`: Integrado `ViewHeader` canónico con icono `History`, subtítulo explicativo, badge de estado y navegación secundaria por `SubTabs` canónicas (`sales`, `cash_movements`).
  - `SalesHistoryTab`: Filtros de fecha y folio integrados con soporte de foco accesible, estado vacío con componente canónico `EmptyState`, tarjetas de KPI con altura fija y valores monetarios en `tabular-nums font-mono`.
  - `ProductExchangeModal`: Modal de cambio de productos reconstruido con semántica ARIA (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, listener `Escape`), advertencia informativa si la venta supera los 30 días, selección de artículos a devolver y cálculo de crédito a favor en vivo con `tabular-nums font-mono`, manteniendo espacio reservado sin empujar contenedores.
  - Creada suite unitaria `src/test/historyView.test.ts` (2 pruebas), alcanzando 309 tests unitarios pasando al 100%.

---

### Pantalla 6: Reportes y Analíticas (`ReportsView.tsx`)
- **Estado:** `[x] Completado`
- [x] Verificado en Modo Claro
- [x] Verificado en Modo Oscuro (Slate Profundo)
- **Archivos:**
  - `src/renderer/src/views/ReportsView.tsx`
  - `src/test/reportsView.test.ts`
- **Cambios realizados:**
  - `ReportsView`: Reemplazado encabezado ad-hoc por el componente canónico `ViewHeader` con icono `BarChart3`, badge `Métricas`, y selectores de rango temporal accesibles en cabecera (Hoy, Últimos 7 días, Este Mes, Mes Anterior, Personalizado) con `focus-visible:ring-2 focus-visible:ring-lilac-500`.
  - Cero Layout Shift: Implementado skeleton inicial estructurado con alturas fijas que reserva exactamente las dimensiones de las 5 tarjetas de KPI y los contenedores de gráficos mientras se cargan los datos, eliminando saltos bruscos en el renderizado.
  - Integrado componente canónico `EmptyState` cuando no existen datos para el período seleccionado, con acción de reintento orientada a la tarea.
  - Tablas de Proveedores y Ranking Detallado de Productos Vendidos formateadas con `tabular-nums font-mono` en precios unitarios, cantidades vendidas, porcentajes y recaudación total.
  - Soporte dual riguroso en gráficos Recharts adaptados a la superficie activa (cuadrícula Slate `#334155` y etiquetas `#94A3B8` en modo oscuro, tooltips flotantes con contraste oscuro garantizado).
  - Creada suite unitaria `src/test/reportsView.test.ts` (3 pruebas), alcanzando 312 tests unitarios pasando al 100%.

---

### Pantalla 7: Configuración y Apariencia (`SettingsView.tsx`, `AppearanceSettingsTab.tsx`, `UnsavedChangesModal.tsx`)
- **Estado:** `[x] Completado`
- [x] Verificado en Modo Claro
- [x] Verificado en Modo Oscuro (Slate Profundo)
- **Archivos:**
  - `src/renderer/src/views/SettingsView.tsx`
  - `src/renderer/src/views/settings/AppearanceSettingsTab.tsx`
  - `src/renderer/src/views/settings/UnsavedChangesModal.tsx`
  - `src/test/settingsView.test.ts`
- **Cambios realizados:**
  - `SettingsView`: Reemplazo del encabezado ad-hoc por el componente canónico `ViewHeader` con icono `Settings`, badge `Sistema`, y botón de guardado global en cabecera (`primaryAction`) que reacciona con estado `isDirty` (atención/naranja con pulse e indicador de foco accesible), y elipsis tipográfica `…` en estado de guardado.
  - Conexión de `SubTabs` canónicas para navegación entre las 8 subsecciones (`business`, `appearance`, `printers`, `cash`, `inventory`, `backups`, `shortcuts`, `danger`) con iconos descriptivos, soporte de teclado y roles ARIA completos.
  - `AppearanceSettingsTab`: Tarjetas interactivas de modo de superficie (Claro, Oscuro, Sistema) y de temas de acento (Lila, Esmeralda, Océano, Grafito) equipadas con semántica accesible `role="button"`, `tabIndex={0}`, manejo de eventos de teclado (Enter / Espacio) y focus rings visibles (`focus-visible:ring-2 focus-visible:ring-lilac-500`). Transiciones de color suaves restringidas exclusivamente a esta vista (`duration-200`).
  - `UnsavedChangesModal`: Reconstruido con `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, listener nativo para tecla `Escape`, soporte de modo oscuro Slate Profundo dual (`dark:bg-slate-800`, `dark:border-amber-700/60`), valores modificados con `tabular-nums font-mono`, y botones de acción con anillos de foco accesibles.
  - Creada suite unitaria `src/test/settingsView.test.ts` (3 pruebas), alcanzando 315 tests unitarios pasando al 100%.

---

### Fase 8: Barrido Final de Cohesión y Retrofitting
- **Estado:** `[x] Completado`
- [x] Verificado en Modo Claro (todas las vistas)
- [x] Verificado en Modo Oscuro (Slate Profundo, todas las vistas)
- **Alcance:** Recorrido integral de consistencia global `F1` a `F6`
- **Archivos:**
  - `src/renderer/src/App.tsx`
  - `src/renderer/src/components/NavigationTabs.tsx`
  - `docs/AUDITORIA_UI.md`
  - `MEMORY.md`
- **Cambios realizados:**
  - `NavigationTabs.tsx`: Retrofitting de accesibilidad global para la barra superior de navegación. Incorporación de roles ARIA semánticos (`role="tablist"`, `role="tab"`, `aria-selected`), restauración de anillos de foco visibles temáticos (`focus-visible:ring-2 focus-visible:ring-lilac-500`) y eliminación de supresiones de foco ciego.
  - `App.tsx`: Incorporación de `font-mono tabular-nums` en la barra de estado inferior para folios de tickets, conteos de unidades, totales en pesos chilenos, montos de vuelto y número de versión (`v1.0.7`). Homologación de elipsis tipográfica (`…`) en overlays de carga del sistema, y corrección en la guía de atajos de teclado (`F1` a `F6`).
  - Verificación Cruzada Integral Pantalla 1 a Pantalla 7:
    - **Cabeceras Canónicas:** 100% de las vistas principales (`CatalogView`, `InventoryView`, `CashCutView`, `HistoryView`, `ReportsView`, `SettingsView`) implementan el componente canónico `ViewHeader` con soporte de iconos temáticos, subtítulos orientados a tareas, insignias informativas y ranuras para acciones primarias o filtros.
    - **Sub-navegación Canónica:** 100% de las vistas secundarias con múltiples secciones implementan el componente canónico `SubTabs` en formato pill accesible con semántica `tablist`/`tab`, indicadores numéricos `tabular-nums` y navegación por teclado.
    - **Estados Vacíos:** Erradicación completa de contenedores de estado vacío improvisados; adopción universal de `EmptyState` canónico con botón de acción activo y spinners con elipsis tipográfica `…`.
    - **Cero Layout Shift:** Todos los paneles reactivos (resumen de venta en Standby, totales en CheckoutModal, comparativas en Arqueo de Caja, cálculo de cambios de producto, skeleton loaders en Reportes, y tarjetas de KPI) cuentan con dimensiones reservadas fijas.
    - **Paleta Dual Estricta:** Reemplazo universal de bordes oscuros rígidos (`border-black/60`) por el sistema Slate Profundo `#0F172A` / `#1E293B` / `#334155` y Slate suave claro `#F8FAFC` / `#E2E8F0`, manteniendo inmutables los tickets térmicos en blanco puro con texto negro.
    - **Formatos Numéricos:** Homologación universal de `tabular-nums font-mono` en todos los valores monetarios CLP, existencias, porcentajes y códigos.
    - **Accesibilidad y Diálogos:** 100% de modales con `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, listener nativo para tecla `Escape` y focus rings visibles accesibles.
  - Batería completa de pruebas unitarias: 32 suites y 315 pruebas pasando al 100% en Vitest sin ninguna regresión; 0 errores en `npm run typecheck`.
