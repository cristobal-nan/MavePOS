# ADR 0006: Modo Oscuro, Arquitectura de Superficies y Acentos Independientes

## Estado
Aceptado

## Contexto
El personal de caja y administración opera el punto de venta durante jornadas extensas y en condiciones lumínicas diversas (luz natural diurna, iluminación fluorescente o turnos vespertinos/nocturnos).
La interfaz original contaba con una base fija de superficies claras (`bg-white`, `bg-slate-50`) con soporte para 4 temas de acento (`lila`, `esmeralda`, `oceano`, `grafito`).
Se requería dotar a la aplicación de un **Modo Oscuro** que cumpliera con las siguientes restricciones operativas:
1. No duplicar temas de forma rígida (ej. "Lila Claro", "Lila Oscuro", etc.), permitiendo que cualquier acento funcione sobre cualquier superficie.
2. Mantener la legibilidad y contraste en paneles VA o monitores económicos de caja.
3. No invertir visualmente los comprobantes de ticket térmico que emulan el papel físico blanco de la impresora térmica.
4. Evitar costo de procesamiento gráfico innecesario en equipos antiguos de punto de venta.

## Decisión
1. **Separación Ortogonal de Ejes (Superficie vs Acento):**
   - Se diseñó un modelo de dos ejes totalmente independientes:
     - **Modo de Superficie (`surface_mode`):** `'light' | 'dark' | 'system'`.
     - **Acento Temático (`theme_accent`):** `'lila' | 'esmeralda' | 'oceano' | 'grafito'`.
   - El modo de superficie controla la presencia de la clase `.dark` en el elemento raíz `<html>` (`darkMode: 'class'` en Tailwind) y los atributos `data-surface` y `data-surface-mode`.
   - El acento temático continúa inyectando dinámicamente las variables CSS `--color-theme-*` consumidas por la escala temática `lilac-*`.

2. **Paleta Slate Profundo:**
   - En lugar de negro puro (`#000000`), se adoptó una paleta basada en Slate Profundo:
     - Fondo general de la aplicación: `#0F172A` (Slate-900).
     - Tarjetas, modales, paneles e inputs: `#1E293B` (Slate-800).
     - Bordes, divisores y cuadrículas: `#334155` (Slate-700) y `rgba(255,255,255,0.12)`.
     - Tipografía principal: `#F8FAFC` (Slate-50) y secundaria: `#94A3B8` (Slate-400).
     - Placeholders: `#94A3B8` con opacidad del 80%.

3. **Selector y Detección Automática de Windows:**
   - La subpestaña *Configuración > Apariencia* ofrece 3 opciones en una tarjeta dedicada:
     - `[☀️ Modo Claro]`: Forzado permanente a fondo claro.
     - `[🌙 Modo Oscuro]`: Forzado permanente a Slate Profundo.
     - `[💻 Sistema (Automático)]`: Detección inicial y escucha reactiva en vivo vía `window.matchMedia('(prefers-color-scheme: dark)')`.
   - La selección se persiste en SQLite en la tabla `settings` bajo la clave `app_surface_mode`.

4. **Inmutabilidad de Tickets Térmicos Físicos:**
   - Los comprobantes de venta, de cambios y los reportes de arqueo/cierre de caja emulan físicamente el rollo de papel térmico (58mm/80mm).
   - Se definió la regla vinculante de que estos recibos **nunca deben invertirse a fondo oscuro**.
   - Mediante la clase protegida `thermal-ticket-paper`, el contenedor del ticket permanece siempre con fondo blanco puro (`#FFFFFF`) y texto negro nítido (`#0F172A`), presentándose con elegancia sobre el backdrop oscuro del modal.

5. **Gráficos Recharts Adaptativos:**
   - En *Reportes*, las cuadrículas (`CartesianGrid`), ejes (`XAxis`, `YAxis`) y tooltips se adaptan reactivamente a las variables del modo oscuro (`#334155` y `#94A3B8`), preservando la paleta de acentos del tema en las curvas y barras.

6. **Alcance de Transiciones CSS:**
   - Se estableció que las animaciones de transición de color (`transition-colors duration-200`) se programen **exclusivamente en la subpestaña de Apariencia** donde el usuario interactúa con los controles.
   - En el resto del software el cambio es instantáneo (0ms), garantizando cero consumo de CPU/GPU en terminales de caja.

## Consecuencias
- Descanso visual óptimo para el operador durante turnos extendidos.
- Experiencia de usuario consistente, reactiva y personalizable.
- Mantenimiento sencillo: añadir paletas futuras en `themes.ts` automáticamente otorga soporte para modo claro y modo oscuro.
- Regla vinculante agregada en `AGENTS.md` para evitar regresiones en nuevos componentes o vistas.
