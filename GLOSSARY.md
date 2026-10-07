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

### Productos e Inventario (anteriormente Catálogo)

- **Pestaña Productos (F2)**: Vista principal de administración del catálogo de productos, categorías, proveedores e importación/exportación masiva en formato Excel.
- **Exportación a Excel**: Proceso que genera una planilla `.xlsx` con la totalidad de productos del sistema, preservando estructura de variaciones (`Tipo`, `Producto Padre`, `Atributo`, `Valor Atributo`) y proveedores.
- **Producto Simple (`simple`)**: Producto vendible directo con código propio, stock propio y precio propio.
- **Producto Variable (`variable`)**: Contenedor padre de una familia de productos. No es vendible directamente en caja ni posee stock físico directo.
- **Variación (`variation`)**: Unidad vendible hija asociada a un producto variable padre mediante `parent_id`. Posee código, precio, costo y atributos propios (`attribute_value`, ej. Color 'Azul').
- **Kardex**: Historial cronológico de todos los movimientos de entrada y salida de inventario para un producto específico.
- **Atajos de Motivos de Ajuste**: Teclas alfanuméricas o combinaciones asignables a motivos principales y complementos en Configuración (ej: 1, M, Ctrl+1) para selección instantánea sin usar el ratón.
- **Modo de Escucha de Ajuste**: Estado sin foco activo activado al presionar Enter en los campos de cantidad (`+ / -` o `Nueva Cantidad`), permitiendo aplicar motivos por teclado o presionar Enter para confirmar o avanzar.

---

### Configuración del Sistema (F6)

- **Guardado Global de Configuración**: Mecanismo centralizado en la cabecera superior de Configuración que persiste todas las modificaciones de la subpestaña activa, reemplazando botones individuales por tarjeta.
- **Estado Sucio (`isDirty`)**: Indicador reactivo que detecta cambios pendientes no persistidos en formularios de configuración. Transforma el botón de guardado en color naranja de advertencia e impide el cambio accidental de pestaña o subpestaña.
- **Bloqueo Estricto de Navegación**: Política de protección que intercepta clics y atajos de teclado (F1-F6) si existen cambios sin guardar, desplegando el modal `UnsavedChangesModal` con el listado detallado de modificaciones y opciones para guardar, descartar o cancelar.

---

### Apariencia y Tematización

- **Modo de Superficie (`surface_mode`)**: Dimensión que controla la luminosidad de las superficies de la interfaz (`light`, `dark` o `system`). En modo `dark`, los fondos se presentan en Slate-900 (`#0F172A`), paneles en Slate-800 (`#1E293B`) y textos en alto contraste legible (`#F8FAFC`).
- **Color de Acento (`theme_accent`)**: Tonalidad cromática del sistema (`lila`, `esmeralda`, `oceano`, `grafito`) que tiñe botones principales, badges de estado activo y focos, combinable ortogonalmente con cualquier Modo de Superficie.
- **Preferencia del Sistema (`system`)**: Modo que sincroniza automáticamente el Modo de Superficie con la configuración del sistema operativo Windows vía `prefers-color-scheme`.


