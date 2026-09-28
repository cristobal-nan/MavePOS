# POS Offline

Punto de venta de escritorio para Windows, 100% offline. Electron + React + TypeScript + SQLite (better-sqlite3 en modo WAL).

## Documentación

- **[docs/ESPECIFICACION.md](docs/ESPECIFICACION.md)** — especificación completa: modelo de datos, esquema de BD, pantallas, importación Excel, flujos de caja/cierre, periféricos y orden de implementación. **Es la guía base del proyecto.**
- **[AGENTS.md](AGENTS.md)** — resumen de reglas de dominio y lógica de negocio para agentes de desarrollo.

## Estado del Proyecto

- **Fases 1 a 7 completadas y verificadas:**
  1. Base (scaffold electron-vite, ventana fullscreen sin bordes, titlebar propia lila/blanca).
  2. Datos (esquema SQLite en WAL, migraciones, IPC tipado, respaldos automáticos con retención de 7 archivos).
  3. Arranque de caja (pantalla única de apertura con fondo de caja, sesiones de caja).
  4. Catálogo y Productos (CRUD, productos simples y variables con variaciones, categorías de 2 niveles, ordenamiento alfabético por padre, buscador con `%`).
  5. Ventas (carrito, tickets en standby persistentes en BD, modal de cobro con efectivo, tarjeta, transferencia y pago mixto).
  6. Control de Inventario (ajustes relativos y por reemplazo con motivo obligatorio, alertas de stock bajo, movimientos del día y kardex cronológico).
  7. Historial y Dinero (historial de ventas con filtros de fecha y folio, anulación total de ventas con restitución de inventario, devoluciones parciales por producto y salidas de dinero de caja con motivos auditados).
- **Próxima fase:** Fase 8 (Corte de caja / Arqueo y Cierre de Sesión).

## Comandos

- `npm run dev`: Inicia el entorno de desarrollo en caliente (Electron + Vite HMR).
- `npm run typecheck`: Validación estricta de tipos de TypeScript (Node y Web).
- `npm test`: Ejecución de pruebas unitarias automatizadas con Vitest.
- `npm run build`: Compilación para producción.
