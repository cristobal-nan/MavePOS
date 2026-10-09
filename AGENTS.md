# AGENTS.md — POS Offline (Reglamento Operativo del Proyecto)

Punto de venta de escritorio para Windows, 100% offline.
Documento vinculante de reglas de negocio, integridad técnica y comportamiento de interfaz para agentes de desarrollo.
> Fuente de especificación detallada y esquemas: `docs/ESPECIFICACION.md`.

---

## 1. Stack Tecnológico y Comandos

- **Arquitectura:** Electron + electron-vite (separación estricta entre proceso `main` y `renderer` vía IPC seguro en `preload`).
- **Frontend:** React + TypeScript, TailwindCSS, Zustand (gestión de estado), Recharts (gráficos), SheetJS (`xlsx`).
- **Base de Datos:** SQLite local con `better-sqlite3` en modo **WAL** (ejecutada exclusivamente en proceso `main`).
- **Impresión y Periféricos:** `node-thermal-printer` (ESC/POS, 58/80mm), spooler de Windows para impresoras convencionales.
- **Ventana:** Fullscreen sin bordes (`frame: false`) con TitleBar propia (minimizar/cerrar).
- **Tema:** Dinámico centralizado en `src/renderer/src/theme/themes.ts` (tema base Mave Lila, con soporte para Esmeralda, Océano y Grafito).
- **Comandos de desarrollo y validación:**
  - `npm run dev`: Inicia el entorno de desarrollo.
  - `npm run typecheck`: Validación estricta de tipos TypeScript (debe pasar con 0 errores).
  - `npm run test`: Batería completa de pruebas unitarias con Vitest (debe pasar al 100%).
  - `npm run build`: Compilación de producción (main, preload y renderer).
- **Flujo y Formato de Commits en Git:**
  - **Sin prefijos ni etiquetas:** Mensajes directos, descriptivos y en español. **Prohibido terminantemente** usar tags o prefijos al inicio como `feat:`, `fix:`, `refactor:`, `chore:`, etc.
  - **Cantidad natural y necesaria:** No forzar jamás un número fijo o arbitrario de commits (como 4). Crear únicamente la cantidad de commits necesaria según los cambios reales para que el historial sea claro y atómico:
    - Si se resolvió un solo problema o ajuste puntual: **1 solo commit**.
    - Si se abordaron varias tareas o módulos independientes: **un commit por cada unidad funcional clara**, sin sobre-fragmentar archivos de un mismo módulo en múltiples commits innecesarios.
  - Ejemplos:
    - `"permitir seleccionar y restaurar respaldos desde carpetas externas"`
    - `"unificar motivos rapidos de inventario y enlazar boton guardar del header"`
    - `"implementar spooler RAW de Windows y pulso universal para cajon de dinero"`

---

## 2. Reglas de Negocio y Dominio (No Negociables)

- **Moneda CLP:** Todos los valores monetarios son **enteros** sin decimales. Formato con punto separador de miles (`formatCLP`).
- **Categorías y Proveedores (Relación N:M):**
  - La **Categoría** define el tipo principal del producto (ej: *Lanas*, *Hilos*).
  - Los **Proveedores** (`suppliers`) son entidades independientes asociadas a productos mediante `product_suppliers` (un producto puede tener múltiples proveedores).
  - **Sintaxis de visualización unificada en tablas:** Columna *"Categoría"*, formateada como:
    - Con categoría y proveedores: `"Categoría - Proveedor1 / Proveedor2"`
    - Sin proveedores: `"Categoría"`
    - Sin categoría pero con proveedores: `"Proveedor1 / Proveedor2"` (sin prefijos artificiales)
    - Sin categoría ni proveedores: `"Sin Categoría"`
  - **Protección referencial:** No se permite eliminar una categoría si aún tiene productos asignados.
- **Jerarquía de Productos (Simples vs Variables con Variaciones):**
  - `product_type`: `'simple' | 'variable' | 'variation'`.
  - **Simple (`simple`):** Unidad vendible autónoma con código, stock, costo y precio propios.
  - **Variable (`variable`):** Producto padre contenedor (ej: "Algodón Rústico"). **No se vende en caja, no tiene stock físico directo ni se escanea**; agrupa variaciones y define categoría/proveedores compartidos.
  - **Variación (`variation`):** Unidad vendible vinculada a su padre vía `parent_id`. Tiene código propio, precio, costo, stock y valor de atributo (`attribute_name` / `attribute_value`).
  - **Nombre compuesto sin guiones:** Se visualiza como `${parent.name} ${variation.name}` (sin guiones `-` ni `—`).
- **Listado y Orden en Catálogo:**
  - El Catálogo lista exclusivamente **unidades vendibles** (`simple` y `variation`), **excluyendo el producto padre (`variable`)**.
  - Orden alfabético regido por el nombre del **padre** (o del producto si es simple):
    `COALESCE(parent.search_name, p.search_name) ASC, p.search_name ASC`.
- **Integridad de Inventario (¡REGLA CRÍTICA!):**
  - **Prohibido editar stock en el formulario de Modificar Producto:** En la pantalla de crear/modificar productos se editan nombres, precios, costos, categorías y atributos, **NUNCA el inventario**. El stock solo cambia mediante: Ajuste de Inventario, Importación Excel, Venta o Devolución.
  - **Kardex y Auditoría obligatorios:** Todo movimiento de stock genera una fila en `inventory_movements` (delta±, tipo, motivo obligatorio y referencia).
  - **Eliminación lógica (Soft Delete):** Eliminar un producto marca `active=0`. Si se elimina un padre variable, se desactivan en cascada sus variaciones.
- **Folio Único Global vs Número de Ticket de Turno:**
  - **Folio (`sales.folio`):** Identificador **único, incremental y global** entre todas las ventas de la historia del sistema (`UNIQUE`, Folio 1, 2, 3...). Nunca se reinicia ni se repite.
  - **Número de Ticket (`sales.ticket_number`):** Orden visual de atención del turno actual (Ticket #1, Ticket #2...). Se reinicia en **1** al abrir una sesión de caja y se asigna sin huecos (reutilizándose de inmediato si un ticket se descarta).

---

## 3. Ventas, Cobro y Escáner de Códigos

- **Autofocus Permanente para Escáner HID:**
  - El escáner de códigos funciona como teclado HID (wedge). El input de código en Ventas debe permanecer **siempre enfocado**.
  - Al cerrar cualquier modal (Cobro, Historial, Búsqueda F10), descartar un ticket o cambiar de pestaña, el foco debe regresar **automáticamente e inmediatamente al input de código**.
- **Tickets Simultáneos (Standby):**
  - Los tickets abiertos se persisten en base de datos (`status='pending'`) para sobrevivir a reinicios o cortes de energía.
- **Cobro (Checkout Modal):**
  - Modal bloqueante que no permite interactuar con la vista de fondo.
  - Métodos: Efectivo, Tarjeta, Transferencia y Mixto.
  - En cobro **mixto**, la suma de los métodos debe cuadrar **exactamente** con el total de la venta.
  - En **efectivo**, el monto entregado debe ser mayor o igual al total; se calcula el vuelto automáticamente.
  - Tras completar el cobro: opción de impresión de ticket, apertura del cajón de dinero si corresponde, y apertura inmediata de una nueva venta limpia con foco en el escáner.
- **Cambios de Producto:**
  - Desde el Historial de Ventas se genera un ticket reservado de cambio (`CAMBIO (Venta #X)`).
  - El cliente debe llevar nuevos artículos por un valor **igual o superior** al crédito devuelto (no se entrega dinero en efectivo por saldo a favor restante).
  - Advertencia visual si la venta original supera los 30 días.

---

## 4. Control de Inventario y Kardex

- **Ajustar Existencia:**
  - Permite ajuste relativo (+ / −) o reemplazo directo a conteo físico.
  - Validación estricta: delta ≠ 0 y el stock resultante no puede ser negativo.
  - Motivo de ajuste **obligatorio** (para auditoría).
- **Alertas de Stock Bajo:**
  - Lista productos vendibles donde `stock <= min_stock`, con botón de acceso directo para ajustar.
- **Búsqueda Normalizada (`ProductSearch`):**
  - Búsqueda insensible a mayúsculas y tildes sobre `search_name`.
  - El carácter `%` actúa como comodín intermedio; si no lleva `%` al inicio, ancla al comienzo del nombre. El carácter `_` es siempre literal.

---

## 5. Flujo de Caja y Cierre de la Aplicación

- **Apertura de Caja:** Si no hay sesión abierta (`cash_sessions`), la app bloquea la navegación exigiendo ingresar el fondo de caja inicial.
- **Corte de Caja:** Calcula ventas netas por método, devoluciones y salidas de dinero. Realiza el arqueo comparando el efectivo esperado con el contado físicamente y registra el cierre formal.
- **Cierre de la Aplicación (X / Alt+F4):**
  1. Paso 1: Pregunta si desea cerrar el turno de caja. Si responde "No", la sesión queda abierta para el próximo inicio.
  2. Paso 2: Si confirma cerrar caja (o en salida post-corte), se ejecuta el modal de respaldo automático con cuenta regresiva de 5 segundos.
  3. Respaldo consistente con `db.backup()` en `Documentos\Respaldos POS\`, reteniendo los últimos 7 archivos.

---

## 6. Reglas de Interfaz y UX (Cero Layout Shift & Edición Fluida)

- **Estabilidad Dimensional y Modales de Geometría Fija (Cero Layout Shift Estricto):**
  - **Prohibido terminantemente que un modal o contenedor cambie de altura, brinque o se expanda al interactuar:** Toda ventana modal o tarjeta de trabajo debe conservar dimensiones y alturas estables e invariables mientras el usuario escribe, navega o interactúa.
  - **Contenido Reactivo con Espacio Reservado:** Todo texto, cálculo o subtotal reactivo en tiempo real (ej: totales acumulados, conteos, resúmenes) **DEBE estar maquetado de antemano de forma permanente y fija** (mostrando valor base `$0`, `0 un.` o placeholder `—`). **NUNCA** condicionar su renderizado (`{cond && <p>...}`) de modo que su aparición/desaparición empuje los bordes o alargue el modal.
- **Validaciones en Inputs y Formularios (Sin líneas verticales nuevas):**
  - **Avisos en la misma línea de la etiqueta (`label`):** Si un campo particular falla una validación (ej: código duplicado, formato incorrecto), el aviso se ubica **a la derecha en la misma fila del título del campo** (`flex items-center justify-between mb-1 gap-2`), con texto conciso truncado (`truncate`) y detalle completo en el atributo `title` (tooltip nativo).
  - **Prohibido terminantemente insertar líneas nuevas debajo del input:** No colocar spans o párrafos de error debajo de los campos que expandan la altura de la tarjeta o desalineen columnas vecinas. El input reforzará el error tiñendo su borde (`border-rose-500 focus:border-rose-600`).
  - **Tablas y Filas Densas:** En tablas de datos o listas de items (ej: variaciones), los errores se marcan exclusivamente mediante borde coloreado en el input, tooltip `title` y/o punto indicador flotante absoluto (`absolute`), preservando siempre fija la altura de la fila.
- **Prohibido terminantemente Banners Inline que causen Layout Shift:**
  - **NUNCA** colocar mensajes condicionales de éxito, error o guardado arriba o entre tarjetas que empujen el contenido hacia abajo al aparecer o desaparecer.
  - El feedback visual de acciones se maneja exclusivamente de dos formas:
    1. **En el propio botón accionado:** Spinner de carga (`Loader2` animado) mientras procesa, y confirmación temporal en verde (`bg-emerald-600`, icono `CheckCircle2` y texto tipo *"¡Guardado!"* o *"¡Respaldo Realizado!"* durante 2 a 3 segundos).
    2. **Toast flotante con posición fija:** Contenedor fuera del flujo del documento (`fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 select-none`), con auto-cierre temporizado (ej: 3 a 4 segundos).
- **Inputs Numéricos y Edición Fluida:**
  - Permitir escribir y borrar libremente mientras el input está enfocado (no forzar mínimos, clamps ni autocompletados restrictivos en `onChange`).
  - Las restricciones (mínimo, máximo, enteros o redondeos) se evalúan y aplican exclusivamente en `onBlur` o al presionar guardar.
- **Centralización de Colores y Temas Dinámicos:**
  - Archivo maestro único de paletas: `src/renderer/src/theme/themes.ts`.
  - **Prohibido quemar clases de color fijas como `purple-*`, `violet-*` o valores HEX directos en componentes.**
  - Toda la interfaz debe consumir exclusivamente los tokens temáticos `lilac-*` (`bg-lilac-50`, `bg-lilac-600`, `text-lilac-700`, `border-lilac-200`, etc.).
  - Estos tokens están conectados dinámicamente a variables CSS (`--color-theme-*`) en `tailwind.config.js`, permitiendo cambiar el tema completo al instante desde *Configuración > Apariencia*.
- **Soporte de Modo Oscuro y Arquitectura de Superficies (Slate Profundo):**
  - La apariencia opera en dos ejes ortogonales independientes: **Modo de Superficie** (`surface_mode: 'light' | 'dark' | 'system'`) y **Acento Temático** (`theme_accent: 'lila' | 'esmeralda' | 'oceano' | 'grafito'`).
  - **Prohibido asumir fondo blanco invariable:** Todos los componentes deben soportar el modo oscuro utilizando la paleta Slate Profundo (`#0F172A` para bases/fondos oscuros, `#1E293B` para tarjetas/paneles, `#334155` para bordes y divisores, `#F8FAFC` / `#94A3B8` para tipografía).
  - **Inmutabilidad de Tickets Térmicos Físicos:** Los tickets de venta, cambios y cortes de caja representan papel físico de impresora térmica (58/80mm). **Siempre deben visualizarse e imprimirse en papel blanco con texto negro nítido** (`bg-white text-slate-900 font-mono`, clase `thermal-ticket-paper`), incluso cuando la aplicación o el modal se encuentren en modo oscuro.
  - **Alcance de Transiciones CSS:** Las transiciones de color (`transition-colors duration-200`) están **estrictamente limitadas a la subpestaña de Configuración > Apariencia** donde el usuario visualiza el cambio en pantalla. En el resto de la aplicación, el cambio de tema o superficie es instantáneo (0ms) para garantizar rendimiento óptimo y consumo cero de GPU en computadores de caja.
- **Validación Dual Obligatoria (Modo Claro & Modo Oscuro):**
  - **TODO cambio visual o componente nuevo DEBE verificarse y garantizar contraste y legibilidad óptima en AMBOS modos (Claro y Oscuro).**
  - En **modo oscuro**, los elementos con fondo de color (botones de acción, badges, etiquetas, atajos) **deben preservar su tinte de color identificatorio** (fondos translúcidos con contraste y bordes de su propia familia tonal, nunca fundirse a un gris plano o transparente ni mostrar bordes blancos residuales).
  - En **modo claro**, las superficies, tablas y paneles deben mantener fondos limpios y definidos (blanco puro o gris intencional, evitando transparencias no deseadas que ensucien la visualización).

---

## Agent skills

### Issue tracker

GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` + `docs/adr/` at the repo root). See `docs/agents/domain.md`.
