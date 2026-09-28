# AGENTS.md — POS Offline

Punto de venta de escritorio para Windows, 100% offline.
Las decisiones de abajo fueron acordadas con el dueño del proyecto y son vinculantes.

> Fuente de verdad completa: **`docs/ESPECIFICACION.md`** (esquema de BD, pantallas, flujos, fases).
> Este archivo solo resume lo que un agente no puede deducir solo. Si divergen, gana la especificación.

## Estado y stack decidido

- Stack: **Electron + electron-vite**, React + TypeScript, TailwindCSS, better-sqlite3 en modo WAL (proceso main),
  Zustand, Recharts, SheetJS (`xlsx`), node-thermal-printer.
- Ventana fullscreen sin bordes (`frame: false`) con titlebar propia (minimizar/cerrar).
- Tema: blanco + lila (acentos `#8B5CF6`, superficies `#EDE9FE`).
- Comandos: `npm run dev` (desarrollo), `npm run typecheck` (validación de tipos TS), `npm run build` (compilación producción), `npm run test` (pruebas unitarias con vitest).
- **Progreso actual:** Fases 1 a 7 completadas y probadas (70 tests unitarios pasando). Fase 8 (Corte de Caja) siguiente.

## Reglas de dominio (no negociables)

- Moneda **CLP**: montos como enteros, sin decimales, separador de miles con punto (`formatCLP`).
- Categorías: **exactamente 2 niveles** (Departamento → Subcategoría). No usar árbol recursivo.
- **Productos Simples y Variables con Variaciones** (reemplaza el concepto previo de familias):
  - Columna `product_type`: `'simple' | 'variable' | 'variation'`.
  - **Producto Simple (`simple`)**: Unidad vendible directa con código propio, stock propio y precio propio.
  - **Producto Variable (`variable`)**: Producto padre contenedor (ej: "Algodón Rústico"). No se vende directamente en caja, no tiene stock físico directo ni se escanea; agrupa variaciones y define atributos compartidos.
  - **Variación (`variation`)**: Unidad vendible vinculada a su padre vía `parent_id`. Tiene código propio, precio propio, costo propio, stock y stock mínimo propios, y un valor de atributo (`attribute_name` ej: 'Color', `attribute_value` ej: 'Azul').
  - **Sin guion de separación:** Al buscar, listar o vender una variación, no se añade guion `-` ni `—` artificial entre el padre y la variación (se muestra `${parent.name} ${variation.name}`).
- **Listado y orden en Catálogo**:
  - Catálogo lista todos los productos **vendibles** (`simple` y `variation`), **excluyendo el producto padre** (`variable`).
  - El orden alfabético se rige por el nombre del **producto padre** (o simple si es simple): `COALESCE(parent.search_name, p.search_name) ASC, p.search_name ASC`. De esta forma, una variación con 'Z' permanece agrupada bajo su padre si este empieza con 'A'.
- Unidad vendible: Cada fila vendible (`simple` o `variation`) es la unidad referenciada en ventas, inventario y kardex (`products.code`).
- Eliminar producto = **soft delete** (`active=0`) para preservar historial/kardex. Si se elimina un padre variable, se desactivan en cascada sus variaciones.
- Ventas pendientes (tickets en standby) se **persisten en BD** (status `pending`), sobreviven reinicios.
- Todo movimiento de inventario se registra en `inventory_movements` (delta±, tipo, motivo, ref venta).

## Búsqueda de productos (componente reutilizable `ProductSearch`)

- Normalización sobre columna `search_name` (mayúsculas, sin tildes) escrita al guardar el producto.
- Input = **un solo término** (los espacios van incluidos, no se separa en palabras).
- Se parte por `%` en fragmentos (los vacíos se descartan; si no queda ninguno, se lista todo):
  - **fragmento inicial** (sin `%` delante) → coincide con el **inicio del nombre** (`LIKE frag%`)
  - **fragmentos con `%` delante** → coinciden **en cualquier parte** (`LIKE %frag%`)
  - todos los fragmentos se combinan con **AND**
- Evalúa tanto `p.search_name` como el `search_name` del producto padre.
- Ej: `algod` = solo "Algodón..." · `%algod` = también "Estuche de algodón" ·
  `algod%` = idéntico a `algod` · `algod%negro` = empieza con "algod" y contiene "negro".
- Insensible a mayúsculas y tildes. `_` es literal, nunca comodín. Búsqueda por código aparte, literal.
- Columnas: código, nombre, precio, existencia; orden persistente (nombre/existencia/precio) y
  ancho redimensionable.
- Reutilizar este componente en modificar/eliminar producto, ajustar existencia y kardex.

## Control de Inventario (Fase 6)

- Subpestañas:
  - **Ajustar existencia:** Input de código / escáner o modal de búsqueda. Ajuste relativo (+ / −) o reemplazo directo a nueva cantidad. Requiere motivo obligatorio (auditoría en `inventory_movements`). Validación estricta: stock no negativo y delta ≠ 0.
  - **Stock bajo:** Muestra productos vendibles donde `stock <= min_stock`, ordenados por menor stock, con botón de acceso directo a ajustar.
  - **Movimientos:** Auditoría diaria filtrada por fecha (hoy por defecto) y tipo de movimiento (`venta`, `devolucion`, `ajuste`, `importacion`, `inicial`).
  - **Kardex:** Historial cronológico completo de entradas y salidas para un producto específico seleccionado.

## Importación Excel (.xlsx)

Mapeo exacto acordado (upsert por código): Código→code, Producto→name, P. Costo→cost_price,
P. Venta→sale_price, Existencia→stock (**reemplaza**, registra movimiento 'importación'),
Inv. Mínimo→min_stock, Departamento→categoría nivel 1 (se crea si no existe).
**Ignorar columnas**: P. Mayoreo e Inv. Máximo (el dueño decidió no almacenarlas).
Los 10k+ productos iniciales importan plano; la reorganización (subcategorías/variantes) se hace después
con selección múltiple en Catálogo → mover categoría / agrupar como producto variable con variaciones.

## Flujo de caja

- Inicio: si NO existe sesión abierta → pantalla única de fondo de caja que desbloquea la app.
  Si SÍ existe sesión abierta → entrar directo a Ventas restaurando tickets pendientes.
- Corte (pestaña): fondo de caja, ventas por método (efectivo/tarjeta/transferencia), total,
  devoluciones, salidas de dinero → cierra la sesión.
- Devoluciones: desde Historial de ventas (cancelar venta completa o devolver producto+cantidad);
  reponen inventario y suman al monto "devoluciones" del corte. Salidas de dinero: botón propio
  (monto + motivo), aparecen separadas en el corte.

## Flujo de cierre y respaldos

Al cerrar (X / Alt+F4):
1. Modal "¿Cerrar caja?" → **No**: salir ya, sesión queda abierta. **Sí**: registrar cierre de sesión.
2. Tras cerrar caja: modal con cuenta atrás de 5s ("respaldo automático") con botones
   [Realizar ya] / [No respaldar]; al llegar a 0 respalda solo y cierra.
- Respaldo con `db.backup()` de better-sqlite3 (consistente con WAL). Retención: últimos **7**
  en `Documentos\Respaldos POS\` (configurable). Mismo mecanismo para respaldo manual en Configuración.

## Periféricos

- Escáner de códigos = teclado HID (wedge): mantener input de código enfocado en Ventas.
- Impresora térmica: ESC/POS vía node-thermal-printer (tcp/USB compartida/serie, 58/80mm).
- Cajón monetario: pulso ESC/POS a través de la impresora térmica.
- Impresora normal: spooler de Windows.
