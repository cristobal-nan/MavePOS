# AGENTS.md — POS Offline (Reglamento Operativo del Proyecto)

Punto de venta de escritorio para Windows, 100% offline.
Documento vinculante de reglas de negocio, integridad técnica y comportamiento de interfaz para agentes de desarrollo.
- **Especificación completa y esquemas:** Consulta `docs/ESPECIFICACION.md` para esquemas de tablas SQLite, flujos de importación masiva, fórmulas de arqueo y detalle de componentes UX.

---

## 1. Stack Tecnológico y Validación

- **Arquitectura:** Electron + electron-vite (separación estricta entre proceso `main` y `renderer` vía IPC seguro en `preload`).
- **Frontend:** React + TypeScript, TailwindCSS, Zustand (estado), Recharts (gráficos), SheetJS (`xlsx`).
- **Base de Datos:** SQLite local con `better-sqlite3` en modo **WAL** (ejecutada exclusivamente en proceso `main`).
- **Impresión y Periféricos:** `node-thermal-printer` (ESC/POS, 58/80mm), Windows Spooler RAW (C# GDI) para térmicas y convencionales.
- **Ventana:** Fullscreen sin bordes (`frame: false`) con TitleBar propia (minimizar/cerrar).
- **Tema:** Dinámico centralizado en `src/renderer/src/theme/themes.ts` (tema base Mave Lila, con soporte para Esmeralda, Océano y Grafito).
- **Invariantes de Validación:**
  - `npm run typecheck`: Obligatorio 0 errores de TypeScript antes de dar por buena cualquier tarea.
  - `npm run test`: Batería completa de pruebas con Vitest; debe pasar al 100% sin regresiones.
- **Flujo de Commits en Git:**
  - **Formato directo:** Mensajes descriptivos en español, sin prefijos ni etiquetas (`feat:`, `fix:`, `refactor:`, etc.).
  - **Momento:** Mantener cambios en el *working tree* durante el desarrollo. Commitear solo a petición expresa del usuario o al completar y validar la tarea (`typecheck` y `test`).
  - **Atómicos por responsabilidad:** Separar el trabajo por unidades de cambio claras (un commit para base de datos/servicio, uno para interfaz visual y uno para pruebas). Evitar commits "paraguas" que mezclen capas no relacionadas.
- **Política de Versiones y Generación de Instaladores:**
  - **Compilación bajo demanda:** `npm run build:win` se ejecuta estrictamente cuando el usuario lo solicite de manera explícita.
  - **Sincronización:** El valor de `version` en `package.json` y la etiqueta visible en el pie de página (`src/renderer/src/App.tsx`) deben coincidir en todo momento con la versión de desarrollo activa.
  - **Ciclo de versión:** Tras compilar el instalador solicitado, avanzar de inmediato el número de versión (en `package.json` y footer) al siguiente parche (ej. de 1.0.7 a 1.0.8) para continuar el desarrollo.

---

## 2. Reglas de Negocio y Dominio

- **Moneda CLP:** Todos los valores monetarios son **enteros** sin decimales. Formato con punto separador de miles (`formatCLP`).
- **Categorías y Proveedores (Relación N:M):**
  - **Categoría:** Define el tipo principal del producto (ej: *Lanas*, *Hilos*). No se permite eliminar una categoría si aún tiene productos asignados.
  - **Proveedores (`suppliers`):** Entidades independientes asociadas a productos vía `product_suppliers` (un producto puede tener múltiples proveedores).
  - **Visualización en tablas:** Columna *"Categoría"*, formateada como:
    - Con categoría y proveedores: `"Categoría - Proveedor1 / Proveedor2"`
    - Sin proveedores: `"Categoría"`
    - Sin categoría pero con proveedores: `"Proveedor1 / Proveedor2"`
    - Sin categoría ni proveedores: `"Sin Categoría"`
- **Jerarquía de Productos:**
  - `product_type`: `'simple' | 'variable' | 'variation'`.
  - **Simple (`simple`):** Unidad vendible autónoma con código, stock, costo y precio propios.
  - **Variable (`variable`):** Producto padre contenedor (ej: "Algodón Rústico"). Agrupa variaciones y define categoría/proveedores compartidos. No se vende en caja, no tiene stock físico directo ni se escanea.
  - **Variación (`variation`):** Unidad vendible vinculada a su padre vía `parent_id`. Tiene código propio, precio, costo, stock y valor de atributo (`attribute_name` / `attribute_value`).
  - **Nombre compuesto sin guiones:** Se visualiza como `${parent.name} ${variation.name}`.
- **Listado en Catálogo:**
  - Lista exclusivamente unidades vendibles (`simple` y `variation`), excluyendo el producto padre (`variable`).
  - Orden alfabético regido por el nombre del padre (o del producto si es simple): `COALESCE(parent.search_name, p.search_name) ASC, p.search_name ASC`.
- **Integridad de Inventario y Kardex:**
  - **Origen único de mutación de stock:** El inventario cambia exclusivamente mediante Ajuste de Inventario, Importación Excel, Venta o Devolución. En el formulario de crear/modificar productos solo se editan metadatos, precios, costos y atributos.
  - **Auditoría obligatoria:** Todo movimiento genera una fila en `inventory_movements` (delta±, tipo, motivo obligatorio y referencia).
  - **Eliminación lógica:** Desactivar un producto marca `active=0`. Al desactivar un padre variable, sus variaciones se desactivan en cascada.
- **Folio Global vs. Número de Ticket:**
  - **Folio (`sales.folio`):** Identificador único, incremental y global histórico (`UNIQUE`, Folio 1, 2, 3...). Nunca se reinicia ni se repite.
  - **Número de Ticket (`sales.ticket_number`):** Orden visual del turno actual (Ticket #1, Ticket #2...). Se reinicia en **1** al abrir una sesión de caja y se reasigna sin huecos al descartar tickets.

---

## 3. Ventas, Cobro y Escáner de Códigos

- **Autofocus Permanente para Escáner HID:**
  - El escáner opera como teclado HID (wedge). El input de código en Ventas debe permanecer enfocado permanentemente.
  - Al cerrar modales (Cobro, Historial, Búsqueda F10), descartar un ticket o cambiar de pestaña, el foco debe regresar de forma inmediata al input de código.
- **Tickets Simultáneos (Standby):**
  - Los tickets abiertos se persisten en base de datos (`status='pending'`) para resistir reinicios o cortes de energía.
- **Cobro (Checkout Modal):**
  - Modal bloqueante. Métodos: Efectivo, Tarjeta, Transferencia y Mixto.
  - En cobro **mixto**, la suma de los métodos debe cuadrar con el total exacto de la venta.
  - En **efectivo**, el monto entregado debe ser mayor o igual al total; el vuelto se calcula automáticamente.
  - Tras completar el cobro: opción de impresión, pulso al cajón de dinero si aplica, y apertura inmediata de una nueva venta limpia con foco en el escáner.
- **Cambios de Producto:**
  - Desde el Historial de Ventas se genera un ticket de cambio (`CAMBIO (Venta #X)`).
  - Los nuevos artículos deben sumar un valor igual o superior al crédito devuelto (no se entrega efectivo por saldo a favor restante).
  - Advertencia visual si la venta original supera los 30 días.

---

## 4. Control de Inventario y Kardex

- **Ajustar Existencia:**
  - Ajuste relativo (+ / −) o reemplazo directo a conteo físico.
  - Validación: delta ≠ 0, stock resultante ≥ 0 y motivo de ajuste obligatorio.
- **Alertas de Stock Bajo:**
  - Lista productos vendibles donde `stock <= min_stock`, con acceso directo para ajustar.
- **Búsqueda Normalizada (`ProductSearch`) y Catálogo en RAM:**
  - Búsqueda insensible a mayúsculas y tildes sobre `search_name`. El carácter `%` actúa como comodín intermedio; sin `%` al inicio, ancla al comienzo del nombre. El carácter `_` es siempre literal.
  - **Respuesta a 0 ms:** El catálogo vendible se precarga en memoria RAM al inicio (`memoryCatalogStore`).
  - **Sincronización Write-Through Obligatoria:** Toda operación que mute inventario o catálogo (ventas, devoluciones, ajustes, guardado de productos o importación) debe reflejar el cambio atómicamente tanto en SQLite como en el Store de memoria RAM.

---

## 5. Flujo de Caja y Cierre de la Aplicación

- **Apertura de Caja:** Si no hay sesión activa (`cash_sessions`), la navegación se bloquea exigiendo ingresar el fondo inicial.
- **Corte de Caja:** Calcula ventas netas por método, devoluciones y salidas de dinero. Compara el efectivo esperado con el conteo físico y registra el cierre formal.
- **Cierre de Aplicación (X / Alt+F4):**
  1. Pregunta si se desea cerrar el turno de caja. Si responde "No", la sesión queda abierta para el siguiente inicio.
  2. Al confirmar cerrar caja (o en salida post-corte), ejecuta el modal de respaldo automático con cuenta regresiva de 5 segundos.
  3. Respaldo consistente con `db.backup()` en `Documentos\Respaldos POS\`, reteniendo los últimos 7 archivos.

---

## 6. Reglas de Interfaz y UX (Cero Layout Shift & Edición Fluida)

- **Estabilidad Dimensional (Cero Layout Shift):**
  - Modales y tarjetas deben conservar dimensiones y alturas fijas mientras el usuario escribe, navega o interactúa.
  - **Espacio Reservado:** Todo cálculo reactivo en tiempo real (totales acumulados, conteos, resúmenes) debe estar maquetado con espacio reservado permanente (valor base `$0`, `0 un.` o `—`), evitando renderizados condicionales que empujen contenedores.
- **Validaciones en Línea:**
  - Errores de campo ubicados a la derecha del título (`label`), con texto conciso truncado y tooltip nativo `title` con el detalle completo.
  - Resaltar errores exclusivamente tiñendo el borde del input (`border-rose-500`). Evitar insertar líneas nuevas debajo de los campos que expandan la altura de la tarjeta o desalineen columnas.
  - En tablas o listas densas, usar bordes coloreados y tooltips manteniendo fija la altura de la fila.
- **Feedback sin Empujar Contenido:**
  - Confirmación dentro del propio botón accionado (spinner de carga mientras procesa; check verde temporal durante 2-3 segundos) o mediante toast flotante con posición fija (`fixed`). Evitar banners intercalados en el flujo que desplacen elementos hacia abajo.
- **Inputs Numéricos y Edición Fluida:**
  - Permitir escritura y borrado libre en `onChange`. Las restricciones (mínimos, enteros, redondeos) se evalúan exclusivamente en `onBlur` o al guardar.
- **Temas Centralizados:**
  - Consumir exclusivamente los tokens temáticos `lilac-*` vinculados a variables CSS dinámicas desde `src/renderer/src/theme/themes.ts`. Evitar clases de color fijas (`purple-*`, HEX) en componentes.
- **Modo Oscuro Slate Profundo:**
  - Soporte en dos ejes: Modo de Superficie (`surface_mode`) y Acento Temático (`theme_accent`).
  - Paleta Slate Profundo (`#0F172A` bases, `#1E293B` tarjetas, `#334155` bordes, `#F8FAFC` / `#94A3B8` texto).
  - **Transiciones:** Restringidas exclusivamente a la vista de *Configuración > Apariencia*. En el resto de la app, el cambio de tema o superficie es instantáneo (0 ms).
- **Inmutabilidad de Tickets Térmicos:**
  - Los tickets representan papel físico; se visualizan e imprimen siempre en fondo blanco con texto negro nítido (`thermal-ticket-paper`), incluso en modo oscuro.

---

## 7. Criterio de Finalización de Tarea

Una tarea se considera finalizada únicamente cuando:
1. **Validación técnica estricta:** `npm run typecheck` pasa con 0 errores y `npm run test` pasa al 100% de pruebas unitarias.
2. **Validación visual dual:** El componente o cambio fue verificado y mantiene contraste, legibilidad y estabilidad dimensional tanto en Modo Claro como en Modo Oscuro.
3. **Persistencia de contexto:** Si la tarea generó una nueva decisión arquitectónica, una lección aprendida o un cambio de estado, se actualizó [MEMORY.md](MEMORY.md).

---

## Memoria

- Al empezar, lee [MEMORY.md](MEMORY.md) para conocer el estado del proyecto y las decisiones tomadas.
- Al terminar una tarea, actualízalo: estado actual, decisiones importantes (con su porqué) y errores a evitar.
- Mantenlo breve (máximo ~50 líneas): resume o elimina lo que ya no aporte.
- Si algo se convierte en una regla permanente, propón moverlo a `AGENTS.md` en lugar de dejarlo en la memoria.
- No guardes nunca datos sensibles (claves, tokens, datos personales).

---

## Agent skills

### Issue tracker

GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context (`GLOSSARY.md` + `docs/adr/` at the repo root). See `docs/agents/domain.md`.
