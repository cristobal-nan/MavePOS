# ADR 0004: Botón de Guardado Global, Unificación Visual y Bloqueo de Navegación en Configuración

## Estado
Aceptado

## Contexto
En la pestaña de Configuración (atajo F6), al modificar cualquier campo de texto o selector e inmediatamente cambiar de subpestaña o pestaña principal (F1-F6), se perdían los cambios ingresados sin confirmación ni indicación clara sobre si habían sido guardados.
Asimismo:
1. Las subpestañas tenían anchos dispares y desalineados respecto a la subpestaña de Apariencia (`max-w-4xl mx-auto flex flex-col gap-6`).
2. Cada tarjeta individual disponía de su propio botón "Guardar", lo que generaba duplicidad visual, desorden y confusión sobre el alcance del guardado.
3. Se requería un mecanismo riguroso y estricto que garantizara que ninguna modificación accidental quede sin guardar al desplazarse entre pantallas o subpestañas.

## Decisión
1. **Unificación Visual de Subpestañas:**
   - Todas las subpestañas de Configuración (`business`, `appearance`, `printers`, `cash`, `inventory`, `backups`, `shortcuts`, `danger`) se estandarizan con el contenedor centrado `max-w-4xl mx-auto flex flex-col gap-6`.
2. **Botón Global de Guardado:**
   - Se elimina todo botón individual de "Guardar" ubicado dentro de las tarjetas.
   - Se sitúa un único botón global en la barra superior de Configuración (visible para las subpestañas configurables: `business`, `printers`, `cash`, `inventory`).
   - **Estado Limpio (sin cambios):** Color lila tenue (`bg-lilac-600`), texto "Guardar Cambios".
   - **Estado Sucio (con cambios pendientes):** Cambia a color secundario naranja/ámbar de advertencia (`bg-amber-500 hover:bg-amber-600`), con badge pulsante del número de cambios pendientes y texto "Guardar Cambios Pendientes".
   - Al pulsar el botón: se ejecutan las persistencias en BD / IPC, el botón vuelve a su estado lila y se despliega una notificación flotante fija de éxito: *"Cambios realizados correctamente"*.
3. **Bloqueo Estricto de Navegación:**
   - Se crea `settingsStore` para rastrear en tiempo real el estado `isDirty`, los campos modificados detallados (`dirtyChanges`), y registrar los delegados `saveHandler` y `discardHandler` de la subpestaña activa.
   - Cualquier intento de cambiar de subpestaña interna o cambiar a otra pestaña principal (Ventas, Productos, Inventario, Corte, Reportes) mediante clic o teclado (F1 a F6) queda terminantemente bloqueado si `isDirty === true`.
   - Se despliega el modal interactivo `UnsavedChangesModal`:
     - Título: *"Los siguientes cambios no han sido guardados"*.
     - Lista clara y legible de cada campo modificado y su nuevo valor.
     - 3 opciones de decisión acordadas:
       1. **Guardar y continuar** (botón morado/lila): Persiste las modificaciones, muestra mensaje de éxito y navega a la sección solicitada.
       2. **Descartar y salir** (botón blanco con borde): Deshace todos los cambios pendientes y navega a la sección solicitada.
       3. **Cancelar** (botón neutro gris): Cierra el modal y mantiene al usuario exactamente donde estaba para que continúe editando.

## Consecuencias
- Cero pérdida accidental de datos en la configuración del punto de venta.
- Interfaz consistente, minimalista y clara, eliminando botones redundantes en cada tarjeta.
- Total certidumbre visual sobre qué valores cambiaron y si fueron guardados o descartados.
