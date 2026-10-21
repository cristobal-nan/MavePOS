# 01: Infraestructura de Licenciamiento Backend y Verificación de Hardware

**What to build:** Generación e inspección del identificador de máquina (`machine_id`) atado al hardware físico del computador (placa madre y procesador en Windows), motor de validación criptográfica offline para verificar y descifrar la clave de activación (`license_key`), persistencia del estado de licencia en la configuración local del sistema, y contratos de servicio e IPC para consultar y activar licencias de forma segura.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] Genera un identificador de hardware único, consistente y formateado (`machine_id`, formato `MAVE-XXXX-XXXX-XXXX`) obtenido del UUID del sistema operativo Windows.
- [x] Implementa algoritmo de verificación criptográfica offline (HMAC-SHA256 con secreto maestro embebido) que valida la integridad de la clave y extrae la edición (`pos` o `erp`) y la topología (`single` o `multi`).
- [x] Rechaza con error de coincidencia de hardware (`hardware_mismatch`) cualquier clave calculada para un `machine_id` diferente.
- [x] Rechaza con error de firma inválida (`invalid_signature`) cualquier clave alterada o con firma corrupta.
- [x] Provee método para activar y persistir la licencia en la configuración del sistema, actualizando la edición activa de la aplicación inmediatamente.
- [x] Expone handlers de comunicación IPC tipados y seguros entre el proceso principal y el proceso de renderizado.
- [x] Incluye pruebas unitarias automatizadas que cubren la generación de ID, validación de firmas correctas, rechazo de firmas adulteradas y rechazo por máquina cruzada.
