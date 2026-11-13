# Pasaporte Eanista Impacta

Interfaz demostrativa del Pasaporte Eanista para Impacta.

Sitio: https://eanfoundershub.github.io/pasaporte-eanista-impacta/

## Prueba controlada

- Persona existente: documento `DEMO1001`.
- Coincidencia aproximada: nombre `María Fernanda`.
- Persona externa: usar el botón de demostración disponible en la interfaz.

## Seguridad

- Este repositorio no contiene información personal real.
- La versión pública utiliza datos de demostración controlados.
- La conexión productiva debe invocar un flujo de Power Automate protegido con Microsoft Entra ID y limitado al tenant Universidad Ean.
- Nunca se deben guardar URL de flujo con firma SAS, secretos, tokens o credenciales en el repositorio.

## Integración productiva prevista

La interfaz pública no consulta SharePoint directamente. La integración productiva debe usar Microsoft Entra ID en el navegador y un flujo HTTP de Power Automate restringido al tenant institucional. El flujo valida la identidad, consulta las listas privadas y devuelve únicamente los campos necesarios y enmascarados.

## Fuente visual

Los archivos publicados se copian sin rediseño desde `mvp_impacta/public_demo/dist`.

