# ADR 0005: Atajos de Teclado en Motivos de Ajuste de Stock y Modo de Escucha Fluida

## Estado
Aceptado

## Contexto
El proceso de ajuste de inventario (F3) requería múltiples interacciones manuales o uso del mouse para seleccionar motivos preconfigurados (principales o complementos).
Además, la transición con la tecla Enter pasaba obligatoriamente del campo `+ / -` al campo `Nueva Cantidad`, obligando al usuario a saltar campos antes de poder ingresar el motivo y confirmar el ajuste.
Se requería:
1. Poder asignar teclas directas (ej: `1`, `2`, `M`, etc.) o combinaciones con modificadores (`Ctrl+1`, `Alt+M`) a los motivos configurados en la pestaña Configuración > Inventario.
2. Un flujo de teclado optimizado donde:
   - Al escanear o ingresar código + Enter $\rightarrow$ pasa al campo `+ / -`.
   - Al ingresar número a sumar o restar en `+ / -` + Enter $\rightarrow$ se desenfoca cualquier input (`blur()`), entrando en un **modo de escucha de atajos**.
   - En dicho modo de escucha, al presionar la tecla de un motivo se aplica automáticamente (reemplazando o encadenando complementos).
   - Presionar Enter habiendo seleccionado un motivo por atajo confirma el ajuste inmediatamente.
   - Si no se presiona ningún atajo y se pulsa Enter nuevamente, el flujo avanza al siguiente campo (`Nueva Cantidad` o `Motivo del ajuste`).

## Decisión
1. **Extensión del Modelo de Datos:**
   - Se añadió el campo opcional `shortcut?: string` a la interfaz `QuickAdjustmentReason`.
   - Los motivos predeterminados inician sin atajos asignados, siendo completamente personalizables.
2. **Configuración de Atajos (`InventorySettingsTab.tsx`):**
   - Grabador interactivo de teclas/atajos en el formulario de creación de nuevos motivos.
   - En la lista de motivos configurados: badge visible con la tecla (`[1]`, `[Ctrl+1]`) y capacidad de asignar, modificar o remover la tecla asignada.
   - Desasignación automática de atajos duplicados para garantizar unicidad.
3. **Mecanismo de Escucha en Control de Inventario (`InventoryView.tsx`):**
   - Al presionar Enter en `+ / -` o en `Nueva Cantidad`, se ejecuta `blur()` y se activa `listeningMode`.
   - Mientras `listeningMode` está activo, un banner sutil y badges en los botones de motivos destacan las teclas disponibles y las opciones de Enter.
   - El listener global de ventana en la pestaña de inventario intercepta las teclas asignadas usando `isShortcutMatch(e, r.shortcut)` únicamente cuando ningún input tiene el foco del navegador.
   - Al pulsar un atajo de motivo, se aplica al texto y la pantalla permanece en modo de escucha para permitir añadir más complementos con una sola tecla.
   - Al presionar Enter con un motivo ya aplicado, se dispara `handleConfirmAdjust` de inmediato.
   - Si se presiona Enter sin aplicar atajos, avanza ordenadamente a `Nueva Cantidad` (desde `+ / -`) o a `Motivo` (desde `Nueva Cantidad`).
4. **Guía de Atajos del Sistema (`ShortcutsTab.tsx`):**
   - Se documentó el flujo de 3 pasos en la guía de atajos del sistema.

## Consecuencias
- Operación 100% libre de mouse para ajustes de inventario de alta velocidad.
- Máxima agilidad para conteos físicos, mermas y ajustes repetitivos.
- Mantiene compatibilidad total con el ingreso manual mediante teclado o ratón.
