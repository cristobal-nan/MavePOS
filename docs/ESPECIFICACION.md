# Especificación del Proyecto — POS Offline

> Documento de referencia del proyecto. Define el alcance, el modelo de datos y todas las
> decisiones de producto tomadas. **Es la guía base para programar.**
> Actualizado: 2026-10-06 · Estado: Software 100% implementado y probado (194 tests pasando).

## Índice

1. [Descripción general](#1-descripción-general)
2. [Stack tecnológico](#2-stack-tecnológico-decidido)
3. [Modelo de dominio](#3-modelo-de-dominio-reglas-vinculantes)
4. [Esquema de base de datos](#4-esquema-de-base-de-datos)
5. [Componente reutilizable ProductSearch](#5-componente-reutilizable-productsearch)
6. [Pantallas](#6-pantallas)
7. [Importación Excel](#7-importación-excel-xlsx)
8. [Migración de los 10.000+ productos](#8-migración-de-los-10000-productos)
9. [Flujo de inicio](#9-flujo-de-inicio)
10. [Flujo de cierre y respaldos](#10-flujo-de-cierre-y-respaldos)
11. [Periféricos](#11-periféricos)
12. [Metodología de trabajo](#12-metodología-de-trabajo-acordada)
13. [Orden de implementación](#13-orden-de-implementación-12-fases)

---

## 1. Descripción general

Punto de venta de escritorio para **Windows**, **100% offline**, para un negocio de lanas/hilos/tejidos
(referencia: marcas como "Ukryl"). Opera con ~10.000+ productos importados desde el sistema actual.

Requisitos transversales:

- Preparado para **futuro online**: sincronizar inventario desde otro equipo y enviar boletas por
  correo electrónico. El diseño lo permite (BD local única + esquema con timestamps + todo movimiento
  auditado), pero **v1 es solo local**.
- Compatible con periféricos: teclado, mouse, pistola de códigos de barras, impresora normal,
  impresora térmica de tickets, cajón de dinero.
- Estética **blanco con lila**. Ventana **pantalla completa sin bordes** por defecto.

## 2. Stack tecnológico (decidido)

| Capa | Elección |
|---|---|
| Shell | Electron + electron-vite |
| UI | React + TypeScript + TailwindCSS |
| BD | better-sqlite3 (archivo `pos.db`, proceso main) |
| Estado | Zustand |
| Gráficos | Recharts |
| Excel | SheetJS (`xlsx`) |
| Impresión térmica | node-thermal-printer (ESC/POS) |
| Tests | vitest (lógica del proceso main) |

**Por qué SQLite en archivo único:** backup trivial (copiar el archivo), consultas <1 ms por código
(clave para POS con escáner), y ruta natural hacia un backend servidor en el futuro.

## 3. Modelo de dominio (reglas vinculantes)

1. **Moneda CLP**: montos como **enteros**, sin decimales, separador de miles con punto. Ej: `19.990`.
2. **Categorías y Proveedores (Relación N:M)**:
   - La **Categoría** define el objeto o clasificación principal del producto (ej: *Lanas*, *Hilos*, *Accesorios*).
   - Los **Proveedores** son una entidad independiente (`suppliers`) asociada a los productos mediante una relación de muchos a muchos (`product_suppliers`). Un producto puede comprarse a varios proveedores (ej: *Lana Natural* provista por *Revesderecho* y *Ukryl*).
   - **Sintaxis de visualización:** La columna en el catálogo y tablas se titula **"Categoría"**, y su contenido se formatea automáticamente como:
     `"Categoría - Proveedor1 / Proveedor2"` (ej: `"Lanas - Revesderecho / Ukryl"`). Si no tiene proveedor: `"Lanas"`. Si no tiene categoría pero sí proveedor: `"Proveedor1 / Proveedor2"` (ej: `"Revesderecho"` o `"Revesderecho / Ukryl"`, sin prefijo "Sin Categoría"). Si no tiene ni categoría ni proveedor: `"Sin Categoría"`.
   - **Filtros en Catálogo:** Existen dos selectores desplegables independientes en la barra superior: uno para filtrar por **Categoría** y otro para filtrar por **Proveedor**. Al filtrar por un proveedor, se muestran tanto los productos directamente asociados a él como las variaciones de un producto padre vinculado a ese proveedor.
3. **Unidad vendible y referencias**: Toda venta, kardex y movimiento de inventario referencia la unidad
   vendible (`products.code`), correspondiente a productos simples (`product_type = 'simple'`) o
   variaciones individuales (`product_type = 'variation'`).
4. **Productos Simples y Variables con Variaciones** (reemplaza el concepto previo de familias):
   - **Producto Simple (`simple`)**: Unidad vendible individual con código propio, stock propio, costo y precio propio.
   - **Producto Variable (`variable`)**: Producto padre contenedor (ej: "Algodón Rústico"). No se vende directamente en caja,
     no tiene stock físico directo ni se escanea; agrupa variaciones y define atributos compartidos.
   - **Variación (`variation`)**: Unidad vendible hija vinculada al producto padre mediante `parent_id`. Tiene código propio,
     precio propio, costo propio, stock y stock mínimo propios, y un valor de atributo (`attribute_name` ej: 'Color',
     `attribute_value` ej: 'Azul').
   - **Sin guion de separación**: En el catálogo, ventas y búsquedas, el nombre de una variación se compone limpiamente
     como `${parent.name} ${variation.name}` sin guiones `-` ni `—` artificiales.
5. **Listado y orden en Catálogo**:
   - En el Catálogo y vistas de venta se listan exclusivamente los productos **vendibles** (`simple` y `variation`),
     **excluyendo el producto padre contenedor** (`variable`).
   - El orden alfabético se agrupa por el nombre del **producto padre** (o simple si es simple):
     `COALESCE(parent.search_name, p.search_name) ASC, p.search_name ASC`. De esta forma, las variaciones quedan
     ordenadas naturalmente bajo la letra de su producto padre.
6. **Eliminar producto = soft delete** (`active=0`) para preservar historial y kardex. Si se elimina un producto padre
   variable, se desactivan automáticamente en cascada sus variaciones.
7. **Ventas pendientes** (tickets en standby) se **persisten en BD** (`status='pending'`), sobreviven reinicios.
8. **Todo movimiento de inventario** se registra en `inventory_movements` (delta ±, tipo, motivo, ref venta).
9. **Precio de costo**: existe pero es **opcional**. **No existe** precio mayoreo ni inventario máximo.

## 4. Esquema de base de datos

```sql
schema_migrations(version PK, applied_at)

categories(
  id PK AUTOINCREMENT,
  name TEXT NOT NULL,
  parent_id NULL→categories.id          -- nullable (categorías tratadas como nivel único en interfaz)
)

suppliers(
  id PK AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  search_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

product_suppliers(
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, supplier_id)
)

products(
  id PK AUTOINCREMENT,
  code UNIQUE NULL,                     -- código de barras o SKU (obligatorio para simples y variaciones)
  name, search_name,                    -- search_name = nombre normalizado en mayúsculas sin tildes (ver §5)
  product_type 'simple'|'variable'|'variation',
  parent_id NULL→products.id,           -- sólo en variaciones (apunta al producto variable contenedor)
  attribute_name NULL,                  -- ej: 'Color', 'Grosor', 'Talla'
  attribute_value NULL,                 -- ej: 'Azul', 'Rojo'
  sale_price, cost_price NULL,          -- enteros CLP; cost_price opcional
  category_id NULL→categories.id,       -- categoría principal del producto
  stock, min_stock, active,             -- active=1 activo, 0 soft delete
  created_at, updated_at
)

sales(
  id PK AUTOINCREMENT,
  folio INTEGER NULL UNIQUE,            -- folio correlativo global e irrepetible (se asigna al cobrar)
  ticket_number INTEGER NOT NULL,       -- orden visual del turno (inicia en 1 por sesión de caja, sin huecos)
  status 'pending'|'completed'|'cancelled',
  total, cash_session_id NULL→cash_sessions.id,
  created_at, completed_at NULL
)

sale_items(
  id PK AUTOINCREMENT,
  sale_id→sales.id, product_code→products.code, name,
  unit_price, quantity, returned_qty DEFAULT 0
)

sale_payments(
  id PK AUTOINCREMENT,
  sale_id→sales.id, method 'cash'|'card'|'transfer', amount
)

inventory_movements(
  id PK AUTOINCREMENT,
  product_code→products.code, delta ±,
  type 'venta'|'devolucion'|'ajuste'|'importacion'|'inicial',
  reason, ref_sale_id NULL→sales.id, created_at
)

cash_sessions(
  id PK AUTOINCREMENT,
  opening_fund, opened_at, closed_at NULL,
  closing_cash NULL, expected_cash NULL, difference NULL, notes NULL
)

cash_movements(
  id PK AUTOINCREMENT,
  cash_session_id→cash_sessions.id, type 'salida', amount, reason, created_at
)

settings(key PK, value)   -- carpeta respaldos, impresora elegida, ancho ticket, etc.
```

## 5. Componente reutilizable `ProductSearch`

Un **único** componente de búsqueda por nombre, reutilizado en: modificar producto, eliminar producto,
ajustar existencia, kardex (y donde haga falta).

### 5.1 Algoritmo de búsqueda

1. Recortar y normalizar el input: **mayúsculas, sin tildes** (NFD + strip diacritics).
2. El input es **un solo término**: los espacios van incluidos, no se separa en palabras.
3. Partir por `%` en **fragmentos**; descartar los fragmentos vacíos. Si no queda ninguno
   (`%`, `%%`, input vacío) → **listar todo**.
4. Todos los fragmentos se combinan con **AND**.
5. Según la posición del fragmento:
   - **Fragmento inicial** (sin `%` delante) → debe coincidir con el **inicio del nombre** → `LIKE frag%`
   - **Fragmentos con `%` delante** → deben aparecer en **cualquier parte** → `LIKE %frag%`

### 5.2 Tabla de comportamiento

Catálogo de ejemplo: `Algodón negro` · `Algodón azul` · `Algodón natural` · `Algodón premium negro` ·
`Algodón económico negro barato` · `Lana negro` · `Hilo negro` · `Estuche de algodón`

| Búsqueda | Regla aplicada | Resultados |
|---|---|---|
| `algod` | inicio del nombre | Algodón negro · Algodón azul · Algodón natural · Algodón premium negro · Algodón económico negro barato |
| `%algod` | cualquier parte | los anteriores **+ Estuche de algodón** |
| `negro` | inicio del nombre | ninguno en este catálogo (ningún nombre empieza con "Negro") |
| `%negro` | cualquier parte | Algodón negro · Lana negro · Hilo negro · Algodón premium negro · Algodón económico negro barato |
| `%%negro` | cualquier parte | idéntico a `%negro` (los fragmentos vacíos no repiten resultados) |
| `algod%` | inicio + fragmento vacío | idéntico a `algod` (el `%` final no hace nada) |
| `algod%negro` | "algod" al inicio **y** "negro" en cualquier parte | Algodón negro · Algodón premium negro · Algodón económico negro barato |
| `algod%natural` | "algod" al inicio **y** "natural" en cualquier parte | Algodón natural |

`algod` y `negro` se comportan **igual**: ambos anclan al inicio del nombre. La diferencia en los
resultados depende solo de qué palabras inicia cada nombre del catálogo.

### 5.3 SQL generado

```sql
-- fragmento inicial (sin % delante)
search_name LIKE :frag || '%'
-- fragmentos con % delante
search_name LIKE '%' || :frag || '%'
-- siempre: active = 1
```

- `ESCAPE` para que `_` sea **literal** (nunca comodín; solo `%` tiene ese significado).
- Índice en `search_name`. Con ~10k filas el escaneo completo es de milisegundos: no hace falta FTS5.
- La **búsqueda por código** es aparte y literal: input numérico matchea `products.code` exacto.

### 5.4 Otros detalles del componente

- Lista: código + nombre + atributos **precio y existencia**. En productos de tipo variación muestra el
  nombre compuesto `${parent.name} ${variation.name}` sin guiones artificiales y la etiqueta de su atributo ("Color: Azul").
- Orden persistente por **nombre / existencia / precio**.
- **Ancho redimensionable** (drag).
- Sin stemming ni manejo de género: un producto llamado `Lana negra` (con "a" final) **no** aparece
  con `%negro`; sí aparece con `%negra`.

### 5.5 Casos borde cerrados

| Caso | Resultado |
|---|---|
| `%` solo, `%%`, input vacío | lista todos los productos activos |
| `_` en el input | literal, no comodín |
| Espacios en el input | parte del mismo término, no separa palabras |
| Variaciones de un mismo producto padre | se distinguen por el valor del atributo y código único |

## 6. Pantallas

### 6.1 Pestañas (header en fila)

`Ventas · Productos · Inventario · Corte · Reportes · Configuración`

### 6.2 Ventas (pantalla principal)

- Arriba: **input de código** (autofocus permanente para escáner) + botones **Buscar**, **Agregar**,
  **Eliminar producto**.
- Tickets simultáneos: mini-pestañas de ventas abiertas (activa + pendientes en standby).
  - Cada pestaña incluye botón de cerrar/descartar con icono de basurero.
  - **Diferenciación entre Ticket y Folio**:
    - **Número de Ticket de Turno (`ticket_number`)**: Comienza en **Ticket #1** en cada nueva sesión de caja y se asigna sin huecos (menor número entero `>= 1` no vendido en el turno ni abierto en pestañas activas). Si se cierra o descarta un ticket, su número se reutiliza inmediatamente para el próximo ticket creado.
    - **Folio Único Global (`folio`)**: Índice único, incremental e irrepetible entre todas las ventas de la historia del sistema (`UNIQUE`, Folio 1, Folio 2...). Se genera al completar la venta y garantiza la trazabilidad global.
- Tabla de ítems: **precio, cantidad, importe (precio×cantidad), existencia (stock − cantidad en venta)**.
  Cantidad editable.
- Pie: **cantidad total de productos** de la venta.
- Botones: **Historial de ventas** · **Salida de dinero** · **Cobrar (F12)**.
- **Cobrar** → ventana **modal bloqueante** (no interactúa con lo de atrás):
  - Métodos: efectivo / tarjeta / transferencia / **mixto** (uno o varios con monto asignado cada uno;
    la suma debe cuadrar exactamente con el total).
  - Si es efectivo: campo "con cuánto paga" → calcula **vuelto**.
  - Tras cobrar: imprime ticket (opción) y abre venta nueva.

### 6.3 Historial de ventas (modal desde Ventas)

Lista todas las ventas con montos, cantidades y formas de pago. Filtro por **id/folio de venta** y por
**día**. Al seleccionar una venta:

- **Cancelar la venta completa** → repone todo el inventario, suma al monto "devoluciones" del corte.
- **Devolver un producto y cantidad específica** → repone solo esas unidades, suma el monto de la
  devolución al corte.
- **Iniciar Cambio de Producto** → abre modal de selección de ítems y cantidades a devolver, transfiriendo el crédito a un ticket reservado en Ventas marcado con color distintivo (`CAMBIO (Venta #FOLIO)`):
  - El cliente debe seleccionar nuevos productos por un monto **igual o superior** al crédito devuelto (sin entrega de dinero en efectivo por saldo a favor restante).
  - Si la venta original supera los **30 días** (1 mes), se muestra una advertencia visual informativa permitiendo proceder bajo criterio comercial.
  - Genera una nueva venta con Folio propio, reponiendo el stock de los productos devueltos y descontando el de los nuevos artículos entregados.

### 6.4 Salidas de dinero (modal desde Ventas)

Monto + campo de texto de **motivo**. Queda registrado y aparece **separado** en el corte.

### 6.5 Productos (subpestañas)

| Subpestaña | Contenido |
|---|---|
| **Crear** | Selector entre **Producto Simple** o **Producto Variable**. Para Simple: código, nombre, precio venta, costo (opcional), categoría (lista directa), proveedores (selección múltiple con creación rápida), stock inicial, stock mínimo. Para Variable: define producto contenedor con categoría y proveedores compartidos, y genera N variaciones vendibles (cada una con su código, atributo ej: Color: Azul/Negro, precio, costo, stock y stock mínimo). |
| **Modificar** | Cualquier atributo **menos inventario** (el inventario solo cambia por Ajuste/Importación/Venta). En variables permite agregar, editar o descontinuar variaciones. |
| **Eliminar** | Por código o búsqueda por nombre; soft delete (`active=0`). Eliminar un padre desactiva en cascada sus variaciones. |
| **Categorías** | Lista directa de categorías de nivel único (crear, renombrar en línea y eliminar con validación si tiene productos asociados). |
| **Importar** | .xlsx (ver §7). |
| **Catálogo** | Tabla completa con filtros independientes (texto con `%`, selector de categoría, selector de proveedor, stock bajo) y orden persistente de columnas. Sintaxis de columna Categoría: `"Categoría - Proveedor1 / Proveedor2"`. **Muestra exclusivamente productos vendibles** (`simple` y `variation`, sin el padre contenedor). **Orden alfabético**: ordenado por el nombre del producto padre (o simple): `COALESCE(parent.search_name, p.search_name) ASC, p.search_name ASC`. Selección múltiple para mover categoría y proveedores o agrupar bajo producto variable. |

### 6.6 Inventario (subpestañas)

- **Ajustar existencia**:
  - Búsqueda por escáner HID, tipeo de código o modal `ProductSearchModal`.
  - Dos modalidades: **Ajuste relativo (+ / −)** con botones rápidos (`-10, -5, -1, +1, +5, +10`) o **Reemplazar existencia** (conteo físico total).
  - Previsualización en tiempo real (`Stock Actual` ➔ `Delta` ➔ `Nuevo Stock`). Validación estricta: stock resultante no puede ser negativo y delta ≠ 0.
  - **Motivo obligatorio**: con chips rápidos (*"Conteo físico / Arqueo"*, *"Merma por daño o rotura"*, *"Devolución a proveedor"*, *"Ingreso de mercadería / Ajuste"*, etc.). Genera movimiento tipo `'ajuste'`.
- **Productos bajos en inventario**:
  - Lista interactiva donde `stock <= min_stock` sobre productos vendibles (`product_type IN ('simple', 'variation')`).
  - Muestra unidades en falta para reposición y botón directo **"Ajustar"** que precarga el producto en la subpestaña de ajuste.
- **Reporte de movimientos**:
  - Auditoría diaria por fecha seleccionada (por defecto hoy local). Filtro por tipo (`venta`, `devolucion`, `ajuste`, `importacion`, `inicial`).
  - Tarjetas de resumen: total de movimientos, unidades ingresadas (+) y unidades salidas (-).
  - Tabla detallada con hora, badge de color, delta y referencia/motivo (ej: `Venta #F-00104`).
- **Kardex de producto**:
  - Auditoría cronológica completa para un producto seleccionado por escáner o catálogo. Muestra fecha, hora, tipo de movimiento, cantidad modificada (delta±) y referencia/motivo.

### 6.7 Corte

- Resumen detallado de la sesión activa: fondo inicial de caja, ventas por método de pago (efectivo, tarjeta, transferencia), ventas totales netas, devoluciones totales (discriminando las efectuadas en efectivo) y salidas registradas.
- **Arqueo y cuadre de efectivo**: cálculo automático del efectivo esperado en caja (`fondo inicial + ventas efectivo - devoluciones efectivo - salidas de dinero`).
- **Modal de confirmación de corte**: campo para ingresar el efectivo contado físicamente, previsualización en tiempo real de la diferencia (cuadre perfecto, faltante o sobrante) y notas u observaciones de cierre.
- **Cierre formal**: actualiza `cash_sessions` con fecha de cierre y métricas de arqueo, y bloquea la aplicación para exigir una nueva apertura de fondo de caja al siguiente turno.

### 6.8 Reportes (propuesta, ajustable)

Rangos: hoy / 7 días / mes / personalizado. Gráficos Recharts + export CSV: ventas por día/semana/mes ·
por método de pago · por hora del día · top productos · por categoría · ticket promedio · comparativo contra
período anterior.

### 6.9 Configuración

- **Datos del negocio**: nombre, dirección, teléfono, RUT (base para ticket y futuro email).
- **Periféricos**: impresora térmica (conexión tcp/USB compartida/serie, ancho 58/80mm), impresora normal, cajón de dinero (apertura automática por pulso ESC/POS al imprimir ticket) y pruebas de test de impresión y apertura de cajón.
- **Respaldos**: carpeta de respaldos configurable, generación y restauración manual de copias `.bak` con `db.backup()`, acceso rápido al directorio y lista histórica de respaldos con fecha y tamaño.
- **Mantenimiento y desarrollo**: botón de vaciado controlado de base de datos (`resetDatabase`) protegido por modal de confirmación escrita ("VACIAR"), con opción para conservar o restablecer parámetros del negocio y periféricos.

## 7. Importación Excel (.xlsx)

Mapeo acordado, **upsert por código**:

| Columna del archivo | Destino |
|---|---|
| Código | `products.code` |
| Producto | `products.name` |
| P. Costo | `products.cost_price` |
| P. Venta | `products.sale_price` |
| Existencia | `products.stock` — **reemplaza** el actual y registra movimiento tipo 'importación' |
| Inv. Mínimo | `products.min_stock` |
| Departamento | categoría **nivel 1** (se crea si no existe) |

**Columnas ignoradas: `P. Mayoreo` e `Inv. Máximo`** (decisión del dueño: no se almacenan).
Al finalizar muestra reporte: creados / actualizados / errores por fila.

## 8. Migración de los 10.000+ productos

Los productos actuales **no tienen jerarquía ni variantes**. Estrategia acordada: **importar plano y
reorganizar después**.

En **Catálogo**, con filtros y selección múltiple (incluye "seleccionar todo el resultado"):

- **Mover a categoría y asignar proveedores** (selección de categoría y casillas de verificación de proveedores con creación rápida).
- **Agrupar bajo producto variable** (nombre nuevo o existente) → crea el padre contenedor, asigna categoría y proveedores compartidos al lote, y vincula las variaciones (`parent_id`).
- **Desagrupar de producto variable** → convierte las variaciones en productos simples autónomos.
- Flujo típico: filtrar `%ALGODON%` → seleccionar todo → agrupar bajo producto variable "Algodón" → asignar
  valores de atributo a cada variación.

## 9. Flujo de inicio

- **No existe sesión de caja abierta** → pantalla única de **fondo de caja** que desbloquea la app.
- **Sí existe sesión abierta** → entra directo a **Ventas** restaurando tickets pendientes.

## 10. Flujo de cierre y respaldos

```
[X] / Alt+F4
 ├─ Modal 1: "¿Cerrar caja?"
 │   ├─ NO  → sale ya; la sesión queda ABIERTA (al reabrir se restaura tal cual)
 │   └─ SÍ  → registra el cierre de sesión
 │            └─ Modal 2: Cuenta regresiva de 5 segundos
 │                 [Realizar ya] · [No respaldar] · al llegar a 0:
 │                 ├─ Estado en progreso: spinner giratorio y barra de progreso animada
 │                 ├─ Estado completado: confirmación visual (check verde) y ruta del archivo
 │                 └─ Pausa de 1.5s y cierre limpio automático de la aplicación
```

- Respaldo consistente con **`db.backup()`** de better-sqlite3 (compatible con WAL).
- Retención: **últimos 7** en `Documentos\Respaldos POS\` (configurable).
- Mismo mecanismo para el respaldo/restauración manual en Configuración.

## 11. Periféricos

| Periférico | Implementación |
|---|---|
| Escáner de códigos | Teclado HID (wedge): el input de código de Ventas debe permanecer enfocado y aceptar Enter como confirmación. |
| Impresora térmica | node-thermal-printer ESC/POS (tcp, USB compartida, serie; 58/80mm) |
| Cajón monetario | Pulso ESC/POS a través de la impresora térmica |
| Impresora normal | Spooler de Windows |

## 12. Metodología de trabajo y tests

- **Tests automatizados** (Vitest) de la lógica crítica (**194 pruebas automatizadas pasando al 100% en 17 suites**):

  | Fase | Estado | Qué se testea |
  |---|---|---|
  | 1 | Completada | Scaffold electron-vite, configuración de build y testing |
  | 2 | Completada | Esquema SQLite, WAL, migraciones, soft delete, persistencia y backups |
  | 3 | Completada | Apertura de caja con fondo inicial, cálculo de sesiones y bloqueo/desbloqueo |
  | 4 | Completada | Búsqueda por `%`, productos simples y variables/variaciones, orden por padre |
  | 5 | Completada | Carrito, tickets en standby en BD, suma de pagos mixtos, cálculo de vuelto |
  | 6 | Completada | Ajustes relativos y reemplazo, auditoría de movimientos, alertas stock bajo y kardex |
  | 7 | Completada | Cancelación total de ventas, devoluciones parciales y salidas de dinero |
  | 8 | Completada | Cuadre exacto del corte de caja con ventas, devoluciones y salidas |
  | 10 | Completada | Importador Excel (.xlsx), mapeo de columnas, reemplazo de stock, categorías, reorganización en lote y proveedores N:M |
  | 11 | Completada | Métricas clave (ventas netas, ticket promedio, unidades, márgenes), gráficos Recharts, filtros temporales y exportación Excel (.xlsx) |
  | 12 | Completada | Datos del negocio, gestión y restauración atómica de respaldos, atajos de teclado y mantenimiento |
  | 9 | Completada | Impresión térmica ESC/POS (node-thermal-printer, PC850), impresora normal Windows (spooler HTML), cajón monetario (pulso RJ11), auto-print, test de conexión |

## 13. Módulos y fases implementadas del sistema (100% completadas)

1. [x] **Base**: scaffold electron-vite, ventana fullscreen sin bordes + titlebar propia, tema blanco/lila, layout de pestañas.
2. [x] **Datos**: esquema SQLite completo + migraciones, IPC tipado, hook de cierre y `backupService`.
3. [x] **Arranque de caja**: pantalla de fondo de caja / entrada directa con sesión activa.
4. [x] **Productos**: CRUD simples y variables con variaciones, categorías y proveedores N:M, `ProductSearch` con `%`, catálogo ordenado por padre.
5. [x] **Ventas**: carrito reactivo, tickets simultáneos/pendientes en BD, modal de cobro (efectivo, tarjeta, transferencia, mixto).
6. [x] **Inventario**: ajustes de existencia (relativo/reemplazo) con motivo obligatorio, alertas de stock bajo, movimientos por día y kardex de producto.
7. [x] **Historial y dinero**: cancelaciones, devoluciones parciales con reposición de inventario, registro de salidas de dinero.
8. [x] **Corte**: resumen de caja por método de pago y cierre de sesión.
10. [x] **Importación Excel** + herramientas de organización masiva en catálogo (Reorganización en lote y Modelo de Proveedores N:M).
11. [x] **Reportes**: métricas clave, gráficos Recharts, intervalos temporales y exportación Excel (.xlsx).
12. [x] **Configuración y pulido**: datos negocio, respaldos, atajos de teclado y focos de escáner.
9. [x] **Impresión**: ticket térmico ESC/POS (node-thermal-printer), impresora normal Windows (spooler HTML), cajón monetario (pulso RJ11), auto-print al cobrar, test de conexión, UI en Configuración y botones en CheckoutModal e HistoryView.
