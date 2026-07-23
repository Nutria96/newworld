# Configuración de archivos multimedia

La implementación usa Firebase Storage mediante su bucket de Google Cloud Storage. El navegador sube directamente con una URL firmada de corta duración; las credenciales permanecen en Netlify y el bucket debe seguir privado.

## 1. Habilitar el bucket

1. En Firebase Console abre el proyecto usado por CHONGSEB.
2. Ve a **Build → Storage → Get started** y crea el bucket en una región cercana.
3. No habilites acceso público ni reglas abiertas.
4. En Google Cloud IAM, concede a la cuenta `FIREBASE_CLIENT_EMAIL` únicamente los permisos necesarios sobre ese bucket: crear, leer, consultar metadatos y borrar objetos. El rol predefinido **Storage Object Admin** sirve para iniciar; después conviene reemplazarlo por un rol personalizado mínimo.
5. La cuenta de servicio debe poder firmar URLs. Si Netlify usa una clave JSON privada de esa misma cuenta, el SDK firma localmente y no necesita una API adicional.

## 2. CORS

Ejecuta con Google Cloud CLI, sustituyendo el bucket:

```powershell
gcloud storage buckets update gs://TU_BUCKET --cors-file=firebase-storage-cors.json
```

Para un Deploy Preview agrega su origen HTTPS exacto al archivo CORS. Google Cloud Storage no acepta comodines parciales como `https://*.netlify.app`.

## 3. Variables de Netlify

Configura en **Production** y **Deploy Previews**:

```text
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_STORAGE_BUCKET
MEDIA_SESSION_SECRET
MEDIA_UPLOADS_ENABLED=true
MEDIA_MAX_FILE_BYTES=52428800
MEDIA_MAX_FILES_PER_MESSAGE=5
MEDIA_SIGNED_URL_TTL_SECONDS=900
```

`MEDIA_SESSION_SECRET` debe tener al menos 32 caracteres aleatorios. No uses claves del SDK web de Firebase: la integración firma operaciones en el backend.

## 4. Privacidad y límites

- Máximo 5 archivos por mensaje y 50 MiB por archivo.
- Formatos ejecutables, HTML, JavaScript y SVG están bloqueados.
- Los objetos se separan por ámbito, usuario y conversación.
- Los enlaces de lectura vencen; no son URLs públicas permanentes.
- El chat adulto exige una sesión aprobada antes de firmar una subida o descarga.
- La zona infantil no ofrece carga de archivos. Antes de habilitarla se necesita moderación de contenido real, antivirus y consentimiento parental; una lista de extensiones no es suficiente.
- Los archivos adjuntos se conservan en el historial visual. La IA recibe únicamente nombre y tipo, no el contenido del archivo.

## 5. Despliegue

El nuevo paquete `@google-cloud/storage` se instala durante el build. Después de guardar variables y CORS, crea un Deploy Preview y prueba manualmente una imagen, un audio, un PDF y un archivo rechazado. No se hicieron subidas reales durante la implementación.
