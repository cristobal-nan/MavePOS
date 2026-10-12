# POS Offline

Punto de venta de escritorio para Windows, 100% offline. Electron + React + TypeScript + SQLite (better-sqlite3 en modo WAL).

## Documentación

- **[docs/ESPECIFICACION.md](docs/ESPECIFICACION.md)** — especificación completa: modelo de datos, esquema de BD, pantallas, importación Excel, flujos de caja/cierre, periféricos y orden de implementación. **Es la guía base del proyecto.**
- **[AGENTS.md](AGENTS.md)** — resumen de reglas de dominio y lógica de negocio para agentes de desarrollo.

## Estado del Proyecto

- **Fases 1 a 12 completadas y verificadas al 100% (272 tests automatizados pasando):**
  1. Base (scaffold electron-vite, ventana fullscreen sin bordes, titlebar propia, temas dinámicos y soporte de modo oscuro).
  2. Datos (esquema SQLite en WAL, migraciones, IPC tipado, respaldos automáticos con retención de 7 archivos).
  3. Arranque de caja (pantalla única de apertura con fondo de caja, sesiones de caja).
  4. Catálogo y Productos (CRUD, productos simples y variables con variaciones, categorías y proveedores N:M, ordenamiento alfabético por padre, buscador con `%`).
  5. Ventas (carrito, tickets en standby persistentes en BD, modal de cobro con efectivo, tarjeta, transferencia y pago mixto).
  6. Control de Inventario (ajustes relativos y por reemplazo con motivo obligatorio, alertas de stock bajo, movimientos del día y kardex cronológico).
  7. Historial y Dinero (historial de ventas con filtros de fecha y folio, anulación total de ventas con restitución de inventario, devoluciones parciales por producto y salidas de dinero de caja con motivos auditados).
  8. Corte de Caja (resumen en vivo de ventas por método, devoluciones y salidas, cálculo de efectivo esperado en gaveta, arqueo físico con calculadora de billetes/monedas, cuadre con sobrante/faltante, cierre de sesión y comprobante).
  9. Impresión y Tickets Térmicos (motor híbrido ESC/POS y GDI nativo en C# vía Windows Spooler RAW, soporte de fuentes de sistema, modo gráfico y texto, cajón de dinero con pulso universal y previsualizador en papel físico térmico).
  10. Importación Excel y herramientas en lote (importador `.xlsx` con mapeo flexible, asignación masiva de categorías/proveedores y agrupación de variaciones).
  11. Reportes y Analíticas (gráficos Recharts, métricas de margen/ticket promedio, filtros de períodos y exportación a Excel).
  12. Configuración y Mantenimiento (datos de empresa, respaldos manuales y automáticos, gestión de periféricos y atajos de teclado globales).

## Comandos

- `npm run dev`: Inicia el entorno de desarrollo en caliente (Electron + Vite HMR).
- `npm run typecheck`: Validación estricta de tipos de TypeScript (Node y Web).
- `npm test`: Ejecución de pruebas unitarias automatizadas con Vitest.
- `npm run build`: Compilación para producción.
