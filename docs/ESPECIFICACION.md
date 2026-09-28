# Especificación del Proyecto — POS Offline

> Documento de referencia del proyecto. Define el alcance, el modelo de datos y todas las
> decisiones de producto tomadas. **Es la guía base para programar.**
> Actualizado: 2026-09-27 · Estado: plan aprobado, implementación pendiente.

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
2. **Categorías: exactamente 2 niveles** — Departamento → Subcategoría. Ej: `Ukryl` → `Lanas`, `Hilos`.
   Sin árbol recursivo.
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
categories(id PK, name, parent_id NULL→categories.id)   -- parent_id NULL = nivel 1 (depto); nivel 2 = subcat

products(
  id PK AUTOINCREMENT,
  code UNIQUE NULL,                     -- código de barras o SKU (obligatorio para simples y variaciones)
  name, search_name,                    -- search_name = nombre normalizado en mayúsculas sin tildes (ver §5)
  product_type 'simple'|'variable'|'variation',
  parent_id NULL→products.id,           -- sólo en variaciones (apunta al producto variable contenedor)
  attribute_name NULL,                  -- ej: 'Color', 'Grosor', 'Talla'
  attribute_value NULL,                 -- ej: 'Azul', 'Rojo'
  sale_price, cost_price NULL,          -- enteros CLP; cost_price opcional
  category_id NULL→categories.id,       -- subcategoría o departamento
  stock, min_stock, active,             -- active=1 activo, 0 soft delete
  created_at, updated_at
)

sales(id PK, folio, status 'pending'|'completed'|'cancelled',
      total, cash_session_id→cash_sessions.id, created_at, completed_at)

sale_items(id PK, sale_id→sales.id, product_code→products.code, name,
           unit_price, quantity, returned_qty)

sale_payments(id PK, sale_id→sales.id, method 'cash'|'card'|'transfer', amount)

inventory_movements(id PK, product_code→products.code, delta ±,
                    type 'venta'|'devolucion'|'ajuste'|'importacion'|'inicial',
                    reason, ref_sale_id NULL, created_at)

cash_sessions(id PK, opening_fund, opened_at, closed_at)

cash_movements(id PK, cash_session_id, type 'salida', amount, reason, created_at)

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
- Tabla de ítems: **precio, cantidad, importe (precio×cantidad), existencia (stock − cantidad en venta)**.
  Cantidad editable.
- Pie: **cantidad total de productos** de la venta.
- Botones: **Venta pendiente** (dejar en standby y seguir con otra) · **Eliminar ticket** (habilitado solo
  si hay **más de dos ventas simultáneas**, según especificación original) · **Historial de ventas** ·
  **Salida de dinero** · **Cobrar**.
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

### 6.4 Salidas de dinero (modal desde Ventas)

Monto + campo de texto de **motivo**. Queda registrado y aparece **separado** en el corte.

### 6.5 Productos (subpestañas)

| Subpestaña | Contenido |
|---|---|
| **Crear** | Selector entre **Producto Simple** o **Producto Variable**. Para Simple: código, nombre, precio venta, costo (opcional), categoría (depto→subcat), stock inicial, stock mínimo. Para Variable: define producto contenedor y genera N variaciones vendibles (cada una con su código, atributo ej: Color: Azul/Negro, precio, costo, stock y stock mínimo). |
| **Modificar** | Cualquier atributo **menos inventario** (el inventario solo cambia por Ajuste/Importación/Venta). En variables permite agregar, editar o descontinuar variaciones. |
| **Eliminar** | Por código o búsqueda por nombre; soft delete (`active=0`). Eliminar un padre desactiva en cascada sus variaciones. |
| **Categorías** | Lista de departamentos con sus subcategorías (exactamente 2 niveles); crear y renombrar ambos niveles; validación de eliminación si contiene productos asociados. |
| **Importar** | .xlsx (ver §7). |
| **Catálogo** | Tabla completa con filtros (texto con `%`, depto→subcat, stock bajo) y orden persistente de columnas. **Muestra exclusivamente productos vendibles** (`simple` y `variation`, sin el padre contenedor). **Orden alfabético**: ordenado por el nombre del producto padre (o simple): `COALESCE(parent.search_name, p.search_name) ASC, p.search_name ASC`. Selección múltiple para mover categoría o agrupar bajo producto variable. |

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

Botón **Hacer corte** → muestra: fondo de caja · ventas en efectivo · ventas con tarjeta · ventas por
transferencia · ventas totales · monto de devoluciones · monto de salidas de dinero → **cierra la sesión
de caja**.

### 6.8 Reportes (propuesta, ajustable)

Rangos: hoy / 7 días / mes / personalizado. Gráficos Recharts + export CSV: ventas por día/semana/mes ·
por método de pago · por hora del día · top productos · por categoría · ticket promedio · comparativo contra
período anterior.

### 6.9 Configuración

Datos del negocio (nombre, dirección, teléfono, RUT — base para ticket y futuro email) · impresora térmica
(conexión tcp/USB compartida/serie, ancho 58/80mm) · impresora normal · cajón (activado, se abre al
imprimir ticket) · **test de impresión y apertura de cajón** · carpeta de respaldos, respaldo/restaurar
manual, abrir carpeta, lista de respaldos con fecha y tamaño.

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

- **Mover a categoría/subcategoría** (selección cascada Depto→Subcat).
- **Agrupar bajo producto variable** (nombre nuevo o existente) → crea el padre contenedor y asigna `parent_id` al lote.
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
 │            └─ Modal 2: "Se realizará un respaldo automáticamente en 5… 4… 3…"
 │                 [Realizar ya] · [No respaldar] · al llegar a 0 → respalda y cierra
```

- Respaldo con **`db.backup()`** de better-sqlite3 (consistente con WAL).
- Retención: **últimos 7** en `Documentos\Respaldos POS\` (configurable).
- Mismo mecanismo para el respaldo/restauración manual de Configuración.

## 11. Periféricos

| Periférico | Implementación |
|---|---|
| Escáner de códigos | Teclado HID (wedge): el input de código de Ventas debe permanecer enfocado y aceptar Enter como confirmación. |
| Impresora térmica | node-thermal-printer ESC/POS (tcp, USB compartida, serie; 58/80mm) |
| Cajón monetario | Pulso ESC/POS a través de la impresora térmica |
| Impresora normal | Spooler de Windows |

## 12. Metodología de trabajo y tests

- **Pausa en cada fase**: se implementa la fase, se compila, se hace typecheck, se corren los tests y se
  avisa; el dueño prueba la app y da el visto bueno para seguir.
- **Tests automatizados** (vitest) de la lógica crítica (**76 pruebas automatizadas pasando al 100%**):

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
  | 10 | Pendiente | Importador Excel, mapeo de columnas, reemplazo de stock, categorías |

## 13. Orden de implementación (12 fases)

1. [x] **Base**: scaffold electron-vite, ventana fullscreen sin bordes + titlebar propia, tema blanco/lila, layout de pestañas.
2. [x] **Datos**: esquema SQLite completo + migraciones, IPC tipado, hook de cierre y `backupService`.
3. [x] **Arranque de caja**: pantalla de fondo de caja / entrada directa con sesión activa.
4. [x] **Productos**: CRUD simples y variables con variaciones, categorías 2 niveles, `ProductSearch` con `%`, catálogo ordenado por padre.
5. [x] **Ventas**: carrito reactivo, tickets simultáneos/pendientes en BD, modal de cobro (efectivo, tarjeta, transferencia, mixto).
6. [x] **Inventario**: ajustes de existencia (relativo/reemplazo) con motivo obligatorio, alertas de stock bajo, movimientos por día y kardex de producto.
7. [x] **Historial y dinero**: cancelaciones, devoluciones parciales con reposición de inventario, registro de salidas de dinero.
8. [x] **Corte**: resumen de caja por método de pago y cierre de sesión.
9. [ ] **Impresión**: ticket térmico ESC/POS, impresora normal, cajón, test de conexión.
10. [ ] **Importación Excel** + herramientas de organización masiva en catálogo.
11. [ ] **Reportes**: gráficos Recharts e intervalos temporales.
12. [ ] **Configuración y pulido**: datos negocio, impresoras, respaldos, atajos de teclado y focos de escáner.
