# ADR 0003: Exportación de Catálogo a Excel con Estructura Interna y Renombre a "Productos"

## Estado
Aceptado

## Contexto
El sistema contaba con una pestaña llamada "Catálogo" (atajo F2) que permitía gestionar productos e importar archivos Excel planos. Se acordó:
1. Renombrar la pestaña principal "Catálogo" a **"Productos"** para alinearse con la terminología natural del negocio.
2. Incorporar un botón **"Exportar Excel"** junto a "Importar Excel" que permita descargar la totalidad del inventario de productos.
3. El archivo exportado debe incluir columnas detalladas de estructura interna (`Tipo`, `Producto Padre`, `Atributo`, `Valor Atributo`, `Proveedores`) para que refleje fielmente tanto productos simples como productos variables con variaciones.
4. El importador de Excel debe ser bidireccional: admitir tanto plantillas planas históricas como archivos exportados con columnas de variaciones y proveedores.
5. El nombre del archivo sugerido en el diálogo de guardado de Windows debe tener un prefijo personalizable desde Configuración (por defecto `"Productos"`), con formato `${prefijo}_${YYYY-MM-DD}.xlsx`.

## Decisión
1. **Renombrar Pestaña:** Cambiar la etiqueta en `NavigationTabs.tsx`, `App.tsx` y referencias visuales a "Productos".
2. **Columnas de Exportación:**
   - `Código` (products.code)
   - `Producto` (products.name)
   - `Tipo` ('simple' | 'variacion')
   - `Producto Padre` (nombre del producto padre variable, si aplica)
   - `Atributo` (nombre del atributo, ej: 'Color', si aplica)
   - `Valor Atributo` (valor del atributo, ej: 'Azul', si aplica)
   - `P. Costo` (products.cost_price ?? 0)
   - `P. Venta` (products.sale_price)
   - `Existencia` (products.stock)
   - `Inv. Mínimo` (products.min_stock)
   - `Categoría` (nombre completo de categoría)
   - `Proveedores` (nombres de proveedores separados por ' / ')
3. **Guardado en Windows:**
   - Uso de `dialog.showSaveDialog` en proceso Electron main para seleccionar ubicación y nombre.
   - Apertura opcional de la carpeta en el Explorador de Windows con `shell.showItemInFolder`.
4. **Soporte Bidireccional en Importación:**
   - `ExcelService.importExcel` detecta columnas `Producto Padre`, `Atributo`, `Valor Atributo` y `Proveedores`.
   - Si una fila tiene `Producto Padre`, crea/busca el producto padre variable y asocia la variación.
   - Si incluye `Proveedores`, crea/busca los proveedores y asocia la relación en `product_suppliers`.
   - Si no incluye estas columnas, opera como importación plana habitual.
5. **Configuración de Prefijo:**
   - Almacenado en la tabla `settings` bajo la clave `excel_export_prefix` (por defecto: `"Productos"`).

## Consecuencias
- El usuario puede respaldar, auditar y editar masivamente su inventario en Excel sin perder la estructura de variaciones ni proveedores.
- Facilita la migración de datos y respaldo humano legible fuera del software.
