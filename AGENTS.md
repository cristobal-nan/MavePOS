# AGENTS.md — POS Offline

Punto de venta de escritorio para Windows, 100% offline. Repositorio recién iniciado:
**aún no existe código**; las decisiones de abajo fueron acordadas con el dueño del proyecto y son vinculantes.

> Fuente de verdad completa: **`docs/ESPECIFICACION.md`** (esquema de BD, pantallas, flujos, fases).
> Este archivo solo resume lo que un agente no puede deducir solo. Si divergen, gana la especificación.

## Estado y stack decidido

- Stack: **Electron + electron-vite**, React + TypeScript, TailwindCSS, better-sqlite3 (proceso main),
  Zustand, Recharts, SheetJS (`xlsx`), node-thermal-printer.
- Ventana fullscreen sin bordes (`frame: false`) con titlebar propia (minimizar/cerrar).
- Tema: blanco + lila (acentos `#8B5CF6`, superficies `#EDE9FE`).
- Comandos: `npm run dev` (desarrollo), `npm run typecheck` (validación de tipos TS), `npm run build` (compilación producción), `npm run test` (pruebas unitarias con vitest).

## Reglas de dominio (no negociables)

- Moneda **CLP**: montos como enteros, sin decimales, separador de miles con punto.
- Categorías: **exactamente 2 niveles** (Departamento → Subcategoría). No usar árbol recursivo.
- Cada fila de `products` es la unidad vendible: código propio, stock propio, precio propio.
  Ventas, inventario y kardex siempre referencian `products.code` (esto simplifica todo lo demás).
- Variantes = productos agrupados opcionalmente vía `family_id` + `variant_label` ('Azul', 'Negro').
  La familia solo agrupa y prellena valores al crear variantes; cada producto conserva sus atributos.
  Ej: familia "Algodón" ← Algodón/Azul, Algodón/Negro, Algodón/Rojo (códigos y stocks independientes).
- Eliminar producto = **soft delete** (`active=0`) para preservar historial/kardex.
- Ventas pendientes (tickets en standby) se **persisten en BD** (status `pending`), sobreviven reinicios.
- Todo movimiento de inventario se registra en `inventory_movements` (delta±, tipo, motivo, ref venta).

## Búsqueda de productos (componente reutilizable `ProductSearch`)

- Normalización sobre columna `search_name` (mayúsculas, sin tildes) escrita al guardar el producto.
- Input = **un solo término** (los espacios van incluidos, no se separa en palabras).
- Se parte por `%` en fragmentos (los vacíos se descartan; si no queda ninguno, se lista todo):
  - **fragmento inicial** (sin `%` delante) → coincide con el **inicio del nombre** (`LIKE frag%`)
  - **fragmentos con `%` delante** → coinciden **en cualquier parte** (`LIKE %frag%`)
  - todos los fragmentos se combinan con **AND**
- Ej: `algod` = solo "Algodón..." · `%algod` = también "Estuche de algodón" ·
  `algod%` = idéntico a `algod` · `algod%negro` = empieza con "algod" y contiene "negro".
- Insensible a mayúsculas y tildes. `_` es literal, nunca comodín. Búsqueda por código aparte, literal.
- Columnas: código, nombre, precio, existencia; orden persistente (nombre/existencia/precio) y
  ancho redimensionable.
- Reutilizar este componente en modificar/eliminar producto, ajustar existencia y kardex.

## Importación Excel (.xlsx)

Mapeo exacto acordado (upsert por código): Código→code, Producto→name, P. Costo→cost_price,
P. Venta→sale_price, Existencia→stock (**reemplaza**, registra movimiento 'importación'),
Inv. Mínimo→min_stock, Departamento→categoría nivel 1 (se crea si no existe).
**Ignorar columnas**: P. Mayoreo e Inv. Máximo (el dueño decidió no almacenarlas).
Los 10k+ productos iniciales importan plano; la reorganización (subcategorías/familias) se hace después
con selección múltiple en Catálogo → mover categoría / agrupar como familia.

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
