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
- Las URL firmadas de los flujos se almacenan exclusivamente como secretos cifrados del Worker `pasaporte-eanista-api` en Cloudflare.
- GitHub Pages solo conoce las rutas públicas `/api/pa08` y `/api/pa09` del proxy.
- El navegador puede observar el endpoint que consume; por ello PA08 no confía en que la URL sea secreta y aplica códigos temporales, expiración, uso único, validación de entrada y respuestas mínimas.
- Nunca se publican credenciales de SharePoint, tokens de usuario ni datos personales en el repositorio.

## Integración productiva prevista

La interfaz pública no consulta SharePoint directamente. PA08 actúa como frontera de confianza, valida la identidad por correo y devuelve únicamente los campos requeridos para el pasaporte.

El dashboard administrativo utiliza PA09 a través del proxy de Cloudflare, exige un código temporal enviado al correo institucional autorizado y carga las listas de SharePoint solo después de validarlo.

## Administrador de experiencias

`admin-experiencias.html` incorpora un constructor sin código que funciona sin Copilot, Azure ni servicios de IA externos. Permite crear y clonar experiencias, editar preguntas, definir obligatoriedad y condiciones, ordenar campos, probar la versión móvil o de escritorio, importar y exportar JSON y publicar una versión inmutable.

La plantilla `foundershub-form-definition.json` es el primer formulario migrado. Separa los datos reutilizables de identidad de las respuestas propias de FoundersHub y declara las listas objetivo `PE_EXPERIENCIAS`, `PE_FORMULARIOS`, `PE_INSCRIPCIONES`, `PE_RESPUESTAS` y la biblioteca `PE_ADJUNTOS`.

Los borradores se conservan localmente para evitar pérdida de trabajo. Al publicar, el administrador usa un token temporal y PA11 guarda una versión en `PE_FORMULARIOS`; la URL firmada del flujo permanece únicamente en Cloudflare.

PA11 también aprovisiona las siete listas del módulo, registra inscripciones de manera idempotente y permite verificar que una repetición no haya creado duplicados. No crea participaciones finales automáticamente.

La versión V3 añade etiquetas de formulario (`Eventos`, `Satisfacción`, `Inscripción Fases`, `Impacta InHouse`), consulta administrativa de respuestas y la transición explícita `INSCRITO → PARTICIPANDO`. Solo esa transición crea una fila idempotente en `PE_PARTICIPACIONES`, usando `PASAPORTE|IDInscripcion` como clave de origen para impedir duplicados. Las evidencias preguntan primero si se entregarán mediante enlace o archivo; los archivos se guardan en `PE_ADJUNTOS/{IDPersona}/{IDInscripcion}/` y la respuesta conserva únicamente metadatos y URL.

## Cliente de integración

`api-client.js` concentra el contrato entre la interfaz y la API. Expone funciones para búsqueda, coincidencias, confirmación de identidad, registro provisional, prellenado, validación académica, prototipos y consultas administrativas. La interfaz nunca necesita conocer las URLs privadas de SharePoint.

Pruebas locales:

```powershell
node --test .\tests\api-client.test.cjs
```

## Fuente visual

La interfaz conserva el diseño validado del prototipo y se publica automáticamente desde la rama `main`.

