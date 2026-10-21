# 04: Modelo de Datos y Servicio de Clientes (Directorio y Cuentas Corrientes)

**What to build:** Esquema de base de datos relacional para la entidad clientes y el libro mayor de movimientos de crédito (migración de base de datos), junto con el servicio backend para crear, actualizar, buscar y auditar cuentas corrientes con cálculo transaccional atómico de saldos deudores y validación estricta del algoritmo Módulo 11 del RUT chileno.

**Blocked by:** 01: Infraestructura de Licenciamiento Backend y Verificación de Hardware

**Status:** completed

- [x] Incorpora migración de base de datos creando la tabla `customers` con campos para RUT único, nombre completo, contacto, dirección, límite de crédito en pesos chilenos y saldo deudor acumulado (`current_balance`).
- [x] Crea la tabla `customer_credit_movements` para registrar de forma inmutable cada cargo por venta, abono o ajuste, almacenando saldo anterior, nuevo saldo, folio de venta o sesión de caja asociada.
- [x] Actualiza la tabla de ventas para permitir asociar un cliente (`customer_id`) y habilitar el método de pago `credito`.
- [x] Implementa validador universal del algoritmo Módulo 11 para RUTs chilenos (formateo con guion y validación estricta de dígito verificador).
- [x] Provee servicio backend con operaciones atómicas en SQLite (transacción única) para asegurar que todo movimiento de crédito actualice sincronizadamente el saldo del cliente.
- [x] Implementa handlers IPC tipados para listar clientes, buscar por texto/RUT, guardar cliente y obtener el estado de cuenta histórico.
- [x] Incluye batería de pruebas unitarias que comprueban integridad de RUTs, persistencia, cálculo de saldos y protección contra saldos inconsistentes.
