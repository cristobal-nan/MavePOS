# 03: Gestión y Activación de Licencias en Interfaz de Usuario

**What to build:** Subpestaña "Licencia del Sistema" en la vista de Configuración (F6) para que el comerciante visualice su código de máquina de instalación, pueda copiarlo fácilmente para enviarlo por WhatsApp al desarrollador, e ingrese y active la clave de licencia recibida, con retroalimentación visual inmediata y transición fluida de la edición activa sin recargar la aplicación.

**Blocked by:** 01: Infraestructura de Licenciamiento Backend y Verificación de Hardware

**Status:** closed

- [x] Añade la subpestaña "Licencia" en la navegación secundaria de Configuración (F6) utilizando los componentes canónicos de cabecera y pestañas.
- [x] Muestra el identificador de instalación del equipo (`machine_id`) con tipografía monospace destacada y un botón de "Copiar Código" con feedback de copiado.
- [x] Muestra el estado actual de la licencia (ej. "Edición POS Estándar" o "Edición POS + ERP", indicando la topología Monocaja o Multicaja).
- [x] Provee un campo de texto para pegar la clave de activación con botón de "Activar Licencia".
- [x] Valida la clave en tiempo real mostrando mensajes concisos de éxito o error (clave no corresponde al equipo, clave corrupta, formato inválido) respetando las reglas de cero layout shift.
- [x] Al activarse con éxito, actualiza el estado global de la aplicación (`app_edition`) reactivamente para habilitar el acceso a los módulos ERP de forma instantánea.
