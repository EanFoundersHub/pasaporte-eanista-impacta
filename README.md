# Pasaporte Eanista Impacta

Interfaz demostrativa del Pasaporte Eanista para Impacta.

Sitio: https://eanfoundershub.github.io/pasaporte-eanista-impacta/

## Prueba controlada

- Persona existente: documento `DEMO1001`.
- Coincidencia aproximada: nombre `María Fernanda`.
- Persona externa: usar el botón de demostración disponible en la interfaz.

## Arquitectura viva

- GitHub Pages publica exclusivamente la interfaz.
- Power Automate PA08 envía y valida el código temporal y consulta SharePoint.
- SharePoint conserva personas, participaciones y trazabilidad.
- No se utiliza Power Apps ni Sites de GPT.

## Seguridad

- Este repositorio no contiene información personal real.
- La versión pública utiliza datos de demostración controlados.
- Las URL de los flujos no se guardan en el código fuente: GitHub Actions las recibe desde los secretos `PA08_FLOW_URL` y `PA09_ADMIN_URL`.
- El navegador puede observar el endpoint que consume; por ello PA08 no confía en que la URL sea secreta y aplica códigos temporales, expiración, uso único, validación de entrada y respuestas mínimas.
- Nunca se publican credenciales de SharePoint, tokens de usuario ni datos personales en el repositorio.

## Integración productiva prevista

La interfaz pública no consulta SharePoint directamente. PA08 actúa como frontera de confianza, valida la identidad por correo y devuelve únicamente los campos requeridos para el pasaporte.

El dashboard administrativo utiliza PA09, exige un código temporal enviado al correo institucional autorizado y carga las listas de SharePoint solo después de validarlo.

## Fuente visual

La interfaz conserva el diseño validado del prototipo y se publica automáticamente desde la rama `main`.

