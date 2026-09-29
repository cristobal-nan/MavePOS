# ADR 0001: Sistema de Cambios de Producto

## Estado
Aceptado

## Contexto
Los clientes de la tienda física frecuentemente solicitan cambiar productos comprados previamente (ej. cambio de color de lana, grosor o tipo de accesorio).
Se requiere un flujo guiado y sin fricciones para:
1. Localizar la venta original en el Historial.
2. Seleccionar los artículos específicos y cantidades a devolver.
3. Reservar un ticket en la pantalla de Ventas con interfaz visual diferenciada para seleccionar los nuevos productos que el cliente llevará.
4. Validar el saldo a favor vs. la diferencia a pagar.
5. Gestionar la ventana de tiempo estándar de 1 mes (30 días) como advertencia informativa.

## Decisiones

### 1. Flujo de Inicio desde Historial de Ventas
- En el modal de detalle de venta del Historial (`SaleDetailModal`), se incorpora una acción destacada: **"Iniciar Cambio de Producto"**.
- Se despliega un modal de selección (`ProductExchangeModal`) que muestra los ítems de la venta elegible (excluyendo o limitando los que ya fueron previamente devueltos).
- El usuario selecciona qué ítems y qué cantidad se devolverán.
- Al confirmar, el sistema redirige automáticamente a la vista de **Ventas**, creando una pestaña de ticket con tipo especial `exchange`.

### 2. Pestaña de Ticket de Cambio en Ventas
- La pestaña en la barra superior se resalta con color distintivo (ámbar/dorado `#D97706` / fondo `#FEF3C7`), con ícono de intercambio (`ArrowLeftRight`) y etiqueta visible: `CAMBIO (Venta #FOLIO)`.
- El encabezado del ticket muestra:
  - Folio y fecha de la venta original.
  - Alerta amarilla si la venta original supera los 30 días de antigüedad: *"Venta realizada hace más de 30 días. Proceda según criterio comercial"*.
  - Detalle de los ítems devueltos y el **Crédito por Cambio** acumulado (`$ X`).
  - Estado en tiempo real del saldo:
    - Si `total_nuevos < credito_cambio`: Alerta ámbar *"Falta agregar $ Y para completar el cambio (debe ser igual o mayor)"*. El botón de cobro permanece deshabilitado o avisa del faltante.
    - Si `total_nuevos == credito_cambio`: Indicador verde *"Cambio exacto ($ 0 por pagar)"*. Cobro directo sin pagos adicionales.
    - Si `total_nuevos > credito_cambio`: Indicador *"Diferencia a pagar: $ Z"*. Abre modal de cobro para abonar únicamente la diferencia ($ Z).

### 3. Regla Financiera de Saldo a Favor
- **No se devuelve dinero en efectivo**: La política acordada exige que el cliente adquiera productos por un valor igual o superior al crédito generado por los ítems devueltos.
- Si el cliente añade productos de mayor valor, la diferencia neta se cancela mediante cualquier método habilitado (`efectivo`, `tarjeta`, `transferencia`, `mixto`).

### 4. Transaccionalidad, Inventario y Folio
- Cada cambio se ejecuta atómicamente en una transacción SQLite:
  1. Se actualiza la venta original registrando `returned_qty` sobre los ítems devueltos.
  2. Se reingresa el stock físico de los productos devueltos a la tabla `products` y se asienta el movimiento en `inventory_movements` (tipo `'devolucion'`, motivo `'Cambio por venta #FOLIO'`).
  3. Se genera un **nuevo registro de venta** con su propio **Folio global único**:
     - Contiene los nuevos productos vendidos.
     - Descuenta el stock correspondiente en `products` y `inventory_movements`.
     - Registra el crédito como descuento o partida especial vinculada a la venta original (`original_sale_id`).
     - Registra los pagos de la diferencia si correspondiera.

### 5. Comprobante de Cambio (ESC/POS y Normal)
- El comprobante térmico y el comprobante normal imprimen:
  - Título: `*** COMPROBANTE DE CAMBIO ***`.
  - Referencia: `Cambio asociado a Venta original Folio #X`.
  - Sección: `PRODUCTOS DEVUELTOS` (con su valor unitario y crédito total).
  - Sección: `NUEVOS PRODUCTOS ENTREGADOS`.
  - Desglose: `Crédito aplicado` y `Diferencia pagada`.

## Consecuencias
- **Positivas:**
  - Control de inventario estricto y sin discrepancias.
  - Auditoría transparente entre la venta original y la nueva venta de cambio.
  - Experiencia de usuario guiada que evita errores de cobro o devoluciones accidentales en efectivo.
  - Respeto de la flexibilidad comercial mediante advertencia de 30 días sin bloqueo rígido.
