# ADR 0002: Arqueo Doble, Cálculo de Retiro y Fondo de Caja del Siguiente Turno

## Estado
Aceptado

## Contexto
En los cortes de turno del POS, el arqueo físico de efectivo contrastaba únicamente una calculadora manual de billetes y monedas contra el total del sistema.
Sin embargo, en la operación diaria del negocio:
1. El turno abre con un desglose específico de billetes y monedas en gaveta (Fondo Inicial).
2. Durante el corte de turno, el cajero necesita contrastar visualmente el desglose con el que **abrió** el turno contra el desglose con el que **cierra** la caja para cuadrar.
3. Al momento de cerrar el turno, el dinero físico contado en la gaveta no se retira en su totalidad ni se deja completo: se retira una porción como ganancia / retiro del día (**Retiro**) y se deja una reserva de billetes chicos y monedas como **Fondo de Caja del Siguiente Turno**.
4. La regla acordada por el dueño del negocio:
   - Los billetes de $20.000 se retiran todos (quedan 0 en gaveta).
   - Los billetes de $10.000 se dejan a lo sumo 2 unidades ($20.000 en gaveta), retirando el excedente.
   - Los billetes menores ($5.000, $2.000, $1.000) y todas las monedas ($500, $100, $50, $10) se conservan íntegramente como base para el siguiente turno.
   - Estas cantidades máximas a dejar en gaveta deben ser configurables desde la pestaña de Configuración.
5. El monto retirado debe ser auditado de forma explícita en el historial de cortes de caja, junto con el desglose de ventas por método de pago y las diferencias.

## Decisiones

### 1. Doble Calculadora de Billetes y Monedas en Arqueo Físico
- En el módulo de Corte de Turno (`ActiveCashCutTab`), la sección de arqueo físico despliega dos cuadros lado a lado (grid de 2 columnas):
  - **Cuadro Izquierdo (Inicio de Turno)**: De solo lectura. Refleja las denominaciones y el total con el que se abrió la sesión actual (`opening_denominations`). Si la sesión abrió con un monto plano sin desglose, indica dicha condición y muestra el total.
  - **Cuadro Derecho (Cierre de Turno / Arqueo)**: Interactivo. El cajero ingresa el conteo físico de billetes y monedas al terminar el turno para cuadrar (`closing_denominations`).
- El cálculo de la diferencia (`Efectivo Contado - Efectivo Esperado`) se ejecuta en tiempo real sobre el total del cuadro derecho.

### 2. Flujo de Apertura de Caja con Desglose
- En la pantalla de **Apertura de Caja (`CashOpeningScreen`)**:
  - Si existe un desglose calculado en el corte del turno anterior (`next_opening_denominations`), la calculadora aparece prellenada con esas denominaciones exactas. El cajero verifica físicamente el cajón, puede ajustar cantidades si fuera necesario y confirma con un clic o presionando Enter para abrir la caja.
  - Si es la primera apertura o no hay desglose previo registrado en base de datos, la calculadora se presenta en blanco solicitando especificar el conteo de billetes y monedas inicial.

### 3. Cálculo Automático de Retiro y Fondo Siguiente Turno
- Al ingresar el arqueo de cierre (o al confirmar el corte), el sistema calcula automáticamente mediante una función pura de dominio (`calculateNextOpeningFundAndWithdrawal`):
  - **Fondo Siguiente Turno (`next_opening_fund`)**: Suma de las cantidades conservadas según las reglas configuradas.
  - **Monto de Retiro (`withdrawal_amount`)**: `Efectivo Físico Contado - Fondo Siguiente Turno`.
  - Desglose de billetes y monedas a retirar vs. a dejar en gaveta.
- La regla por defecto:
  - Billetes de $20.000: límite 0 unidades (se retiran todos).
  - Billetes de $10.000: límite 2 unidades (se retira el excedente).
  - Billetes de $5.000, $2.000, $1.000 y monedas: sin límite / ilimitadas (se conservan todas).
- La configuración se almacena en la tabla `settings` (clave `cash_cut_withdrawal_rules`) y se puede editar desde la pestaña de **Configuración**.

### 4. Estructura de Columnas en Historial de Cortes
- La tabla del Historial de Cortes (`CashCutHistoryTab`) se ajusta para desplegar con exactitud las siguientes 11 columnas:
  1. **Turno #**
  2. **Apertura**
  3. **Cierre**
  4. **Caja Inicial**
  5. **Caja Final** (Efectivo físico contado)
  6. **Ventas Efectivo**
  7. **Ventas Tarjeta**
  8. **Ventas Transferencia**
  9. **Diferencia Efectivo**
  10. **Diferencia Tarjeta**
  11. **Retiro** (Monto retirado al cierre)
- El modal de detalle del corte muestra además el desglose de lo retirado y lo que quedó como fondo.

### 5. Persistencia en Base de Datos
- Se añaden columnas a `cash_sessions`:
  - `opening_denominations TEXT NULL` (JSON con el desglose inicial).
  - `closing_denominations TEXT NULL` (JSON con el desglose contado al cierre).
  - `next_opening_denominations TEXT NULL` (JSON con el desglose proyectado para el siguiente turno).
  - `withdrawal_amount INTEGER NULL` (Monto total retirado en el corte).
  - `sales_cash INTEGER NULL`
  - `sales_card INTEGER NULL`
  - `sales_transfer INTEGER NULL`
  - `card_difference INTEGER NULL DEFAULT 0`

## Consecuencias
- **Positivas:**
  - Trazabilidad continua de billetes y monedas de un turno al siguiente sin pérdidas ni descuidos.
  - El cajero y el dueño tienen certeza inmediata de cuánto dinero sacar de la caja y cuánto dejar para el vuelto del día siguiente.
  - El historial de cortes provee una auditoría financiera completa con ventas por método y retiro visible a simple vista.
