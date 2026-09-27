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
3. **Cada fila de `products` es la unidad vendible**: código propio, stock propio, precio propio.
   Ventas, inventario y kardex siempre referencian `products.code`.
4. **Variantes** = productos agrupados opcionalmente vía `family_id` + `variant_label` ('Azul', 'Negro').
   La familia solo agrupa y prellena valores al crear variantes; cada producto conserva sus atributos.
   Ej: familia "Algodón" ← Algodón/Azul, Algodón/Negro, Algodón/Rojo con **códigos y stocks independientes**.
5. **Eliminar producto = soft delete** (`active=0`) para preservar historial y kardex.
6. **Ventas pendientes** (tickets en standby) se **persisten en BD** (`status='pending'`), sobreviven reinicios.
7. **Todo movimiento de inventario** se registra en `inventory_movements` (delta ±, tipo, motivo, ref venta).
8. **Precio de costo**: existe pero es **opcional**. **No existe** precio mayoreo ni inventario máximo.

## 4. Esquema de base de datos

```sql
categories(id PK, name, parent_id NULL→categories.id)   -- parent_id NULL = nivel 1; máximo 2 niveles

families(id PK, name, category_id→categories.id, created_at)

products(
  code PK, name, search_name,          -- search_name = nombre normalizado (ver §5)
  sale_price, cost_price?,              -- enteros CLP; cost_price opcional
  category_id→categories.id,            -- subcategoría o departamento
  family_id→families.id NULL,
  variant_label? ('Azul'),
  stock, min_stock, active, created_at, updated_at
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

settings(key PK, value)   -- carpeta respaldos, impresora elegida, ancho ticket, orden columnas, etc.
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

- Lista: código + nombre + atributos **precio y existencia**. En productos con familia muestra también
  el nombre de la familia y el `variant_label` ("Algodón / Negro").
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
| Producto de familia con mismo nombre base | se distinguen por `variant_label` y código |

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
| **Crear** | Código, nombre, precio venta, costo (opcional), categoría (depto→subcat), inventario actual, inventario mínimo. Flujo de **variantes**: crea familia y agrega N códigos con atributo (p. ej. Color: Azul/Negro/Rojo) prellenando valores. |
| **Modificar** | Cualquier atributo **menos inventario** (el inventario solo cambia por Ajuste/Importación/Venta). |
| **Eliminar** | Por código o búsqueda por nombre; soft delete. |
| **Categorías** | Lista de departamentos con sus subcategorías; crear y renombrar ambos niveles; validación al eliminar con contenido. |
| **Importar** | .xlsx (ver §7). |
| **Catálogo** | Tabla completa con filtros (texto, depto→subcat, bajos) y orden persistente; **selección múltiple** → mover categoría / agrupar como familia (ver §8). Vista opcional agrupada por familia. |

### 6.6 Inventario (subpestañas)

- **Ajustar existencia**: por código o búsqueda → lista nombre, cantidad actual, **+ / −** con input numérico,
  **nueva cantidad** (reemplaza directo) y **motivo** (texto). Genera movimiento.
- **Productos bajos en inventario**: lista los que están por debajo de su mínimo.
- **Reporte de movimientos**:Increased o disminuyó el inventario, manual o por venta, en un **día
  seleccionado** (por defecto hoy).
- **Kardex de producto**: por código o búsqueda → todos sus movimientos con fecha, cantidad modificada
  y motivo.

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
- **Agrupar como familia** (nombre nuevo o existente) → asigna `family_id` al lote.
- Quitar de familia.
- Flujo típico: filtrar `%ALGODON%` → seleccionar todo → agrupar como familia "Algodón" → asignar
  `variant_label` a cada uno.

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

## 12. Metodología de trabajo acordada

- **Pausa en cada fase**: se implementa la fase, se compila, se hace typecheck, se corren los tests y se
  avisa; el dueño prueba la app y da el visto bueno para seguir.
- **Tests automatizados** (vitest) de la lógica crítica:

  | Fase | Qué se testea |
  |---|---|
  | 2 | Esquema, upserts, soft delete |
  | 4 | Búsqueda: `algod`, `%algod`, `negro`, `%negro`, `%%negro`, `algod%`, `algod%negro`, `algod%natural`, tildes, mayúsculas, `_` literal, y que "Estuche de algodón" no salga con `algod` pero sí con `%algod`. CRUD productos/familias |
  | 5 | Importes, total, suma de pago mixto, vuelto, existencia = stock − carrito |
  | 6 | Ajustes generan movimientos correctos |
  | 7 | Devoluciones repone stock exacto y montos de corte |
  | 8 | Totales del corte cuadran con ventas/pagos/devoluciones/salidas |
  | 10 | Importador (mapeo, reemplazo de stock, categorías), retención de 7 respaldos |

## 13. Orden de implementación (12 fases)

1. **Base**: scaffold electron-vite, ventana fullscreen sin bordes + titlebar propia, tema blanco/lila,
   layout de pestañas
2. **Datos**: esquema SQLite completo + migraciones, IPC tipado, hook de cierre y `backupService`
3. **Arranque de caja**: pantalla de fondo de caja / entrada directa
4. **Productos**: CRUD, familias y variantes, categorías 2 niveles, `ProductSearch`, catálogo
5. **Ventas**: carrito, tickets simultáneos/pendientes, modal de cobro
6. **Inventario**: ajustes, bajos, movimientos por día, kardex
7. **Historial y dinero**: cancelaciones, devoluciones parciales, salidas de dinero
8. **Corte**: resumen y cierre de sesión
9. **Impresión**: ticket térmico, impresora normal, cajón, tests de conexión
10. **Importación Excel** + herramientas de organización masiva
11. **Reportes**: gráficos e intervalos
12. **Configuración y pulido**: datos negocio, impresoras, respaldos, atajos, focos de escáner
