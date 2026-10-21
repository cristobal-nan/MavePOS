# Memory.md - Diario de Estudio

Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- Versión 1.0.10 activa en desarrollo (0 errores de TypeScript, suites de licencia e interfaz validadas al 100%).
- Motor de Licenciamiento Backend (Issue 01), Generador Visual (Issue 02) e Interfaz de Activación F6 (Issue 03) completados: subpestaña canónica "Licencia" en Configuración, copia rápida de `machine_id` para WhatsApp, validación en tiempo real con cero layout shift (`h-6`), activación reactiva en `useLicenseStore` y persistencia en SQLite.
- Transición arquitectónica POS+ERP aprobada (ADR-0008 a ADR-0012): matriz comercial ortogonal (POS/ERP x Monocaja/Multicaja), licenciamiento offline atado a hardware (`machine_id`), sincronización multi-tienda asíncrona vía Google Drive (carpeta compartida de 1 TB), aislamiento modular en `src/modules/erp/` y Bodega Centralizadora con Guías de Transferencia.
- Auditoría UI completada al 100% en todas las pantallas (`F1` a `F6`) con arquitectura canónica (`ViewHeader`, `SubTabs`, `EmptyState`) y cero layout shift.
- Motor de catálogo vendible en memoria RAM (`memoryCatalogStore`) con respuesta a 0 ms y write-through en SQLite tanto para Ventas (F1), Catálogo (F2) y Modal (F10).

## Decisiones (y por qué)
- **Licenciamiento offline atado a Hardware:** HMAC-SHA256 con payload Base64URL y firma Hex. Si la base de datos se clona a otra PC (`hardware_mismatch`), el sistema revoca automáticamente el modo ERP en SQLite y regresa a POS estándar.
- **UI de Licencia con Cero Layout Shift:** Espacio reservado permanente (`h-6`) para estados de validación en vivo; tiñe borde del input (`border-emerald-500` / `border-rose-500`) sin alterar alturas ni empujar el botón de activación.
- **Lectura ultra-rápida de Machine ID en Windows:** Consulta directa al registro (`reg query HKLM\SOFTWARE\Microsoft\Cryptography /v MachineGuid`, <15ms) con fallback a CIM y variable de entorno `MAVE_MACHINE_UUID` para testing determinista.
- **Componentes canónicos (`ViewHeader`, `SubTabs`, `EmptyState`):** Unificación dimensional, accesibilidad ARIA completa (`tablist`, `tab`, `dialog`), soporte de teclado y cero layout shift.
- **Catálogo en RAM + Write-Through:** Búsqueda y escáner HID instantáneos sin consultar SQLite en cada tecla; SQLite y el store se sincronizan atómicamente.
- **Stock bloqueado en edición de producto:** Prohibido editar stock en formulario de producto; solo muta por ajuste, venta, devolución o importación para asegurar auditoría en Kardex.
- **Folio global vs Ticket de turno:** Folio histórico incremental único; ticket de turno reinicia en 1 por sesión para flujo amigable de caja.

## Aprendizajes y errores a evitar
- **Node runtime en tests:** Ejecutar vitest vía `npm run test` (usa `ELECTRON_RUN_AS_NODE=1 electron`) para compatibilidad nativa con `better-sqlite3` compilado para Electron.
- **Tests unitarios `.ts` sin JSX:** En archivos `.ts`, usar exclusivamente `React.createElement` (sin JSX) para evitar fallos de esbuild en node al correr Vitest.
- **Tokens temáticos:** Usar exclusivamente `lilac-*` de `themes.ts`; prohibido quemar clases fijas (`purple-*`, HEX) para no romper temas ni modo oscuro.
- **No compilar `.exe` autónomamente:** `npm run build:win` se ejecuta estrictamente bajo demanda del usuario, avanzando la versión al siguiente parche tras empaquetar.
- **Formato Git:** Commits directos en español, sin prefijos (`feat:`, etc.) y sin mezclar capas; mantener en working tree hasta indicación expresa.

## Próximos pasos
- Etapa 1: Modelo/Servicio de Clientes y RUT chileno (Issue 04) y Directorio de Clientes UI (Issue 05).
- Etapa 2: Gestor de Bodega y Sincronización Multi-Tienda vía Google Drive.
- Etapa 3: Conector Multicaja en Red Local (Servidor LAN y Terminales cliente).
- Etapa 4: Compras a Proveedores y Cotizaciones / Preventas.
