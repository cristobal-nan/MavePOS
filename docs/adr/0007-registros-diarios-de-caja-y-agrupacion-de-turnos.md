# ADR 0007: Registros Diarios de Caja y Agrupación de Turnos

## Estado
Aceptado

## Contexto
En el POS Mave, la sub-pestaña "Historial de Cortes" dentro del módulo de Corte de Caja listaba individualmente cada sesión de caja cerrada (`cash_sessions`).
En la práctica comercial del negocio:
1. Una tienda puede operar con un solo turno diario (apertura en la mañana y cierre en la tarde/noche), o con dos o más turnos en una misma jornada (ej: turno mañana y turno tarde con cambio de cajero o cuadratura intermedia).
2. Para el análisis contable y visual de la jornada, el administrador requiere ver las filas consolidadas por **Día** en lugar de ver turnos aislados dispersos.
3. Se requiere que la tabla principal sume las ventas (efectivo, tarjeta, transferencia y totales), los retiros y las diferencias netas de los turnos del día, mostrando la Caja Inicial del primer turno y la Caja Final del último turno.
4. Se debe sumar una columna explícita con la **Cantidad de Turnos** que operaron en el día (`1 turno`, `2 turnos`, etc.).
5. Al hacer clic en un registro diario:
   - Si hubo un solo turno, se despliega de inmediato el detalle completo de dicho turno (tal como existía previamente).
   - Si hubieron dos o más turnos, el modal permite alternar fluidamente mediante sub-pestañas entre el "Consolidado del Día" y el detalle completo de cada turno individual ("Turno #1", "Turno #2", etc.), con sus respectivas ventas, inicio de caja, arqueo de billetes/monedas y retiro.

## Decisiones

### 1. Renombramiento y Semántica de la Sub-pestaña
- En la vista principal de Corte de Caja (`CashCutView`), la sub-pestaña pasa de llamarse *"Historial de Cortes"* a **"Registros Diarios"**.
- El contador numérico en la pestaña refleja el número de días registrados.
- El encabezado de la sección se actualiza a *"Registros Diarios de Caja"* con texto descriptivo claro.

### 2. Agrupación por Fecha Local (`DailyCashRecord`)
- Las sesiones de caja cerradas (`pastSessions`) se agrupan por fecha local de apertura (`YYYY-MM-DD`).
- Cada grupo genera una entidad pura `DailyCashRecord` con:
  - `dateKey`: Identificador de fecha en formato `YYYY-MM-DD`.
  - `displayDate`: Fecha formateada en estándar chileno (`DD/MM/AAAA`).
  - `turnCount`: Total de turnos cerrados en la jornada.
  - `firstOpenedAt`: Hora de apertura del primer turno del día.
  - `lastClosedAt`: Hora de cierre del último turno del día.
  - `initialOpeningFund`: Fondo inicial con el que arrancó el primer turno.
  - `finalClosingCash`: Efectivo final contado al cierre del último turno.
  - `totalSalesCash`, `totalSalesCard`, `totalSalesTransfer`, `totalSales`: Sumatoria de ventas de todos los turnos.
  - `totalDifferenceCash`, `totalDifferenceCard`: Sumatoria neta de diferencias de arqueo.
  - `totalWithdrawal`: Sumatoria de retiros en efectivo de la jornada.

### 3. Estructura de la Tabla Principal
- La tabla preserva el estilo denso y estable del sistema (sin layout shifts, borde Slate / negro fino, tipografía legible):
  1. **Fecha**: `DD/MM/AAAA`.
  2. **Turnos**: Badge visual (`1 turno` o `N turnos`).
  3. **Apertura**: Hora de apertura del primer turno.
  4. **Cierre**: Hora de cierre del último turno.
  5. **Caja Inicial**: Fondo inicial del primer turno.
  6. **Caja Final**: Caja final del último turno.
  7. **Ventas Efectivo**: Suma del día (`text-emerald-700 dark:text-emerald-400`).
  8. **Ventas Tarjeta**: Suma del día (`text-blue-700 dark:text-blue-400`).
  9. **Ventas Transferencia**: Suma del día (`text-indigo-700 dark:text-indigo-400`).
  10. **Ventas Totales**: Suma del día (`font-black text-slate-900 dark:text-white`).
  11. **Diferencia Efectivo**: Suma neta del día (`$0`, `+$X`, `-$X`).
  12. **Diferencia Tarjeta**: Suma neta del día (`$0`, `+$X`, `-$X`).
  13. **Retiro**: Suma de retiros del día (`text-amber-700 dark:text-amber-400`).

### 4. Modal de Detalle Adaptativo (`DailyRecordDetailModal`)
- Si `turnCount === 1`: Se despliega directamente el detalle del turno único con todos sus campos (horarios, ventas por método, arqueo de billetes y monedas, retiro y fondo siguiente).
- Si `turnCount > 1`: La cabecera del modal incluye sub-pestañas:
  - **"Consolidado del Día"**: Cuadro resumen con totales de ventas por método, suma de retiros, diferencias acumuladas y tabla comparativa de turnos.
  - **"Turno #1 (Apertura - Cierre)"**: Vista detallada completa e idéntica del primer turno.
  - **"Turno #2 (Apertura - Cierre)"**: Vista detallada completa e idéntica del segundo turno.
  - Pestañas adicionales según los turnos registrados.

### 5. Compatibilidad e Integridad
- No se requieren migraciones de base de datos; la agrupación opera sobre los registros existentes de `cash_sessions`.
- Si una jornada tuvo un único turno, el comportamiento y los números coinciden exactamente con la visualización previa.
