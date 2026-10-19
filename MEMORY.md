# Memory.md - Diario de Estudio

Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no aporte.

## Estado actual
- Versión 1.0.9 activa en desarrollo (instalador 1.0.8 generado en `dist/`, 326 tests pasando al 100% en 32 suites, 0 errores de TypeScript).
- Auditoría UI completada al 100% (Fase 0 a Fase 8 de `AUDITORIA_UI.md`) en todas las pantallas (`F1` a `F6`).
- Arquitectura canónica consolidada: `ViewHeader`, `SubTabs`, `EmptyState` en todas las vistas principales y secundarias.
- Paleta dual estricta: Modo Claro y Slate Profundo (`#0F172A`, `#1E293B`, `#334155`), tickets térmicos blancos inmutables.
- Motor de catálogo vendible en memoria RAM (`memoryCatalogStore`) con respuesta a 0 ms y write-through en SQLite tanto para Ventas (F1), Catálogo (F2) y Modal (F10).
- Desacople total de input en `ProductSearch`: estado local síncrono para el texto y `startTransition` + tabla memoizada para renderizar sin tildar el cuadro en PCs de bajos recursos.
- Flujo de arqueo y corte de caja ultra ágil: navegación secuencial de arriba a abajo con la tecla `Enter` y auto-selección de texto (`.select()`).
- Respaldo dual al salir: SQLite `.db` e inventario Excel `.xlsx` (`${prefix}_${DD-MM-YYYY}_${HH-mm}.xlsx`) en `Documentos\Inventarios POS` (personalizable en Respaldos). Fecha estándar chilena `DD-MM-YYYY` en exportaciones Excel.

## Decisiones (y por qué)
- **Componentes canónicos (`ViewHeader`, `SubTabs`, `EmptyState`):** Unificación dimensional, accesibilidad ARIA completa (`tablist`, `tab`, `dialog`), soporte de teclado (flechas, Home, End, Escape) y cero layout shift.
- **Catálogo en RAM + Write-Through:** Búsqueda y escáner HID instantáneos sin consultar SQLite en cada tecla; SQLite y el store se sincronizan atómicamente.
- **Input desacoplado y tabla memoizada:** El cuadro de texto se actualiza a 0 ms sin esperar el re-renderizado de 150 filas; `startTransition` prioriza las pulsaciones de teclado e interrumpe el dibujo de la tabla si el usuario sigue escribiendo.
- **Stock bloqueado en edición de producto:** Prohibido editar stock en formulario de producto; solo muta por ajuste, venta, devolución o importación para asegurar auditoría en Kardex.
- **Folio global vs Ticket de turno:** Folio histórico incremental único; ticket de turno reinicia en 1 por sesión para flujo amigable de caja.
- **Cero Layout Shift estricto:** Modales, tarjetas de KPI y tablas con geometrías fijas y espacio reservado para cálculos reactivos y skeletons de carga.
- **Formato numérico universal:** Todo monto en pesos chilenos, cantidad, porcentaje, existencia o folio utiliza clases `tabular-nums font-mono`.
- **Búsqueda RAM sin ordenar por tecla:** `memoryCatalogStore.products` se mantiene siempre en orden canónico (`compareCanonical` = ORDER BY de SQLite); `searchLocal` recorre y corta al límite con soporte de filtros (categoría, proveedor, tipo). Con RAM lista, tanto modal como catálogo NO consultan SQLite (`fetchProducts` retorna sin activar `isLoading`), eliminando cualquier parpadeo de carga.

## Aprendizajes y errores a evitar
- **Rendimiento en PCs lentos:** Nunca vincular el valor de un `<input>` de búsqueda masiva directamente al ciclo de re-renderizado de una tabla grande; el input debe poseer estado local síncrono para no tildarse. No usar debounces artificiales innecesarios cuando `startTransition` permite concurrencia real sin demoras. Nunca `localeCompare`/sort del catálogo completo por tecla, ni IPC redundante en paralelo a la búsqueda en RAM.
- **Tests unitarios `.ts` sin JSX:** En archivos `.ts`, usar exclusivamente `React.createElement` (sin JSX) para evitar fallos de esbuild en node al correr Vitest.
- **Validaciones en inputs:** Avisos en la misma línea del label o borde teñido, jamás añadir líneas abajo que expandan tarjetas o modales.
- **Tokens temáticos:** Usar exclusivamente `lilac-*` de `themes.ts`; prohibido quemar clases fijas (`purple-*`, HEX) para no romper temas ni modo oscuro.
- **No compilar `.exe` autónomamente:** `npm run build:win` se ejecuta estrictamente bajo demanda del usuario, avanzando la versión al siguiente parche tras empaquetar.
- **Formato Git:** Commits directos en español, sin prefijos (`feat:`, etc.) y sin mezclar capas; mantener en working tree hasta indicación expresa.

## Próximos pasos
- Consolidar commits atómicos en git cuando el usuario lo solicite.
- Pruebas finales en hardware físico con escáner HID en modo continuo y térmicas ESC/POS.
