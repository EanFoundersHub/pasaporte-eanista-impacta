# Despliegue remoto preparado

## Arquitectura

1. GitHub Pages publica HTML, CSS y JavaScript sin secretos.
2. Cloudflare Worker valida origen, tamaño, acción y token temporal.
3. Power Automate mantiene las URL firmadas y se conecta a SharePoint.
4. SharePoint conserva personas, participaciones, formularios, inscripciones, respuestas y auditoría.

## Secretos del Worker

Configurar en Cloudflare como secretos cifrados, nunca en GitHub:

- `PA08_FLOW_URL`
- `PA09_ADMIN_URL`
- `PA11_FLOW_URL`
- `TOKEN_SECRET`: mínimo 32 caracteres aleatorios.

Variable no secreta opcional:

- `ADMIN_EMAILS`: correos autorizados separados por coma.

## Orden para terminar cuando el equipo esté disponible

1. Importar y activar `PA11_Pasaporte_Formularios_Experiencias_V2.zip`.
2. Guardar su URL HTTP como `PA11_FLOW_URL` en Cloudflare.
3. Crear `TOKEN_SECRET` en Cloudflare.
4. Sustituir el código del Worker por `cloudflare-worker.js` y desplegar.
5. Publicar esta carpeta en el repositorio de GitHub Pages.
6. Validar el código administrativo desde `admin.html`.
7. Abrir `admin-experiencias.html`, publicar FoundersHub y comprobar el registro en `PE_FORMULARIOS`.
8. Ejecutar `probar_pa11_live.ps1` y conservar la salida como evidencia.

## Controles incluidos

- CORS limitado al dominio de GitHub Pages.
- Tokens HMAC temporales distintos para usuario y administrador.
- El participante no puede aprovisionar listas ni publicar formularios.
- La inscripción ignora el `idPersona` del navegador y usa la identidad firmada.
- No se guardan tokens en `localStorage`; desaparecen al cerrar la sesión del navegador.
- No se transmiten documentos mediante URL.
- PA11 no crea ni elimina participaciones históricas.

## Límites actuales

- La prueba contra Microsoft 365 requiere importar PA11 y configurar sus tres secretos.
- Los adjuntos de prototipos todavía necesitan una biblioteca de SharePoint y un flujo dedicado.
- La publicación actual conserva versiones; la edición concurrente de un mismo borrador deberá incorporar control ETag en una fase posterior.
