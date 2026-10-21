# 02: Generador Visual Autónomo de Licencias (Herramienta del Desarrollador)

**What to build:** Una herramienta visual privada e independiente basada en navegador web (archivo HTML offline autónomo) que permite al desarrollador ingresar el código de máquina (`machine_id`) de un cliente, seleccionar la edición (`pos` o `erp`) y la topología (`single` o `multi`), y generar en un clic la clave de activación criptográficamente válida con botón para copiar al portapapeles.

**Blocked by:** None (can start immediately)

**Status:** completed

- [x] Genera un archivo visual HTML/CSS/JS standalone que funciona 100% offline en cualquier navegador moderno sin dependencias de Node.js ni empaquetadores.
- [x] Utiliza la API nativa `crypto.subtle` (Web Crypto API) para firmar con HMAC-SHA256 utilizando el mismo secreto y formato que el motor backend.
- [x] Incluye formulario limpio con campo para pegar el `machine_id`, selector de edición (POS Estándar vs POS + ERP) y selector de topología (Monocaja vs Multicaja).
- [x] Formatea la clave de activación resultante en bloques legibles y provee un botón interactivo para copiar la clave al portapapeles con confirmación visual.
- [x] Valida el formato del `machine_id` antes de firmar, impidiendo generar claves sobre identificadores vacíos o con estructura incorrecta.
