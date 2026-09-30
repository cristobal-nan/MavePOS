# GLOSSARY.md — Vocabulario de Dominio POS Mave

Este documento define el vocabulario canónico del sistema de Punto de Venta (POS Offline). Todo concepto de negocio en el código, interfaces, base de datos y documentación debe apegarse estrictamente a estos términos.

---

### Términos Centrales de Ventas y Comprobantes

- **Folio (`sales.folio`)**: Identificador numérico secuencial global, único e irrepetible para toda venta o cambio en la historia del sistema (`UNIQUE`, incremental: 1, 2, 3...). Nunca se reinicia entre turnos ni turnos de caja.
- **Número de Ticket (`sales.ticket_number`)**: Identificador de atención visual dentro del turno o sesión de caja activa. Se reinicia en 1 al abrir una nueva sesión de caja y se reutiliza si un ticket temporal es cancelado o descartado.
- **Ticket en Espera (Standby / Pending)**: Carrito de venta pausado y persistido en base de datos con estado `pending`, que sobrevive a reinicios del sistema.
- **Cambio de Producto (`exchange`)**: Transacción mediante la cual un cliente devuelve uno o varios ítems adquiridos en una venta previa (identificada por su Folio) para llevar nuevos productos de valor igual o superior.
  - Genera una **nueva venta con Folio propio**.
  - Reingresa automáticamente los productos devueltos al inventario físico con tipo de movimiento `devolucion`.
  - No efectúa devolución de dinero en efectivo ni saldos negativos: el cliente debe seleccionar nuevos productos cuyo total cubra o supere el crédito devuelto.
- **Crédito por Cambio (`exchange_credit`)**: Valor monetario a favor del cliente equivalente a la suma de los productos devueltos (`cantidad * precio_unitario_original`).
- **Diferencia a Pagar por Cambio**: Monto excedente que el cliente debe abonar cuando el valor de los nuevos productos seleccionados supera el crédito por cambio (`total_nuevos - credito_cambio`). Si el valor es exactamente igual, la diferencia a pagar es `$ 0`.
- **Plazo de Cambio (Ventana de 30 días)**: Plazo comercial estándar (1 mes) para cambios. Si la venta original fue realizada hace más de 30 días, el sistema emite una **advertencia informativa** visible en pantalla, permitiendo al vendedor autorizar el cambio según su criterio comercial sin bloquear la operación.

---

### Caja y Arqueo

- **Sesión de Caja (`cash_sessions`)**: Período operativo de un cajero entre la apertura con fondo inicial y el cierre con arqueo físico.
- **Fondo Inicial (`opening_fund`)**: Dinero en efectivo total con el que se inicia la sesión de caja.
- **Desglose de Denominaciones (`denomination_counts`)**: Cantidades físicas de cada billete chileno ($20.000, $10.000, $5.000, $2.000, $1.000) y moneda ($500, $100, $50, $10).
- **Arqueo Físico Inicial (`opening_denominations`)**: Desglose de billetes y monedas registrado en la apertura de caja. Se muestra de solo lectura en el cuadro izquierdo de la calculadora de arqueo en el corte de turno.
- **Arqueo Físico de Cierre (`closing_denominations`)**: Desglose de billetes y monedas contado físicamente en la gaveta al finalizar el turno. Se ingresa en el cuadro derecho de la calculadora de arqueo para cuadrar la caja.
- **Retiro de Cierre (`withdrawal_amount` / `retiro`)**: Monto total en efectivo retirado de la gaveta al finalizar el turno tras aplicar las reglas de retención de fondo. Se registra en la sesión y se visualiza en el historial de cortes.
- **Fondo del Siguiente Turno (`next_opening_fund` / `next_opening_denominations`)**: Efectivo y desglose de billetes/monedas que permanece físicamente en la gaveta para iniciar el próximo turno.
- **Reglas de Retiro por Denominación (`withdrawal_rules`)**: Configuración que determina cuántas unidades de cada denominación se conservan como fondo para el siguiente turno (por defecto: 0 billetes de $20.000, 2 billetes de $10.000 y el 100% de los billetes menores y monedas).
- **Corte de Turno / Arqueo Físico**: Proceso de conteo de billetes y monedas chilenas al cerrar el turno para contrastar el efectivo contado con el efectivo esperado del sistema.
- **Efectivo Esperado (`expected_cash`)**: `Fondo Inicial + Ventas en Efectivo - Devoluciones en Efectivo - Salidas de Dinero`.
- **Diferencia de Arqueo (`difference`)**: `Efectivo Contado - Efectivo Esperado`. Puede ser cuadrada (`balanced`), sobrante (`surplus`) o faltante (`shortage`).
- **Salida de Dinero (`cash_movements` tipo `salida`)**: Retiro de efectivo de la gaveta durante el turno con motivo justificado (gastos operativos, compras menores).

---

### Catálogo e Inventario

- **Producto Simple (`simple`)**: Producto vendible directo con código propio, stock propio y precio propio.
- **Producto Variable (`variable`)**: Contenedor padre de una familia de productos. No es vendible directamente en caja ni posee stock físico directo.
- **Variación (`variation`)**: Unidad vendible hija asociada a un producto variable padre mediante `parent_id`. Posee código, precio, costo y atributos propios (`attribute_value`, ej. Color 'Azul').
- **Kardex**: Historial cronológico de todos los movimientos de entrada y salida de inventario para un producto específico.
