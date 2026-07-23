# CHONGSEB — primeros tres días

## Día 0: inmediatamente después del deploy

- [ ] Confirmar GitHub Actions en verde y guardar el enlace de la ejecución.
- [ ] Confirmar el deploy de producción y su commit en Netlify.
- [ ] Abrir el dominio final en escritorio y móvil.
- [ ] Revisar consola del navegador y logs de Netlify Functions.
- [ ] Probar chat con una pregunta sencilla y otra que solicite fuentes.
- [ ] Confirmar que un fallo del proveedor muestra el mensaje amigable.
- [ ] Verificar que `/adult` rechaza sesiones no aprobadas.
- [ ] Probar PWA, manifest, icono y actualización del Service Worker.
- [ ] Confirmar que robots y sitemap usan el dominio correcto.
- [ ] Revisar que ninguna clave aparezca en HTML, JavaScript público o respuestas.

## Día 1: pagos y almacenamiento

- [ ] Probar Mercado Pago y PayPal primero en Sandbox/test.
- [ ] Validar creación, aprobación, cancelación y webhook de una suscripción de prueba.
- [ ] Confirmar que Firebase guarda el estado esperado sin datos excesivos.
- [ ] Verificar alertas de Telegram solamente si están configuradas.
- [ ] Antes de un pago Live, comprobar moneda, importe, destinatario y política de reembolso.
- [ ] Si se autoriza una transacción real pequeña, realizarla con un medio propio y respetar el mínimo del proveedor.
- [ ] Verificar el registro del pago y reembolsarlo si era únicamente una prueba.
- [ ] Subir una imagen y un audio pequeños; comprobar progreso, descarga temporal y expiración.
- [ ] Intentar un ejecutable bloqueado y confirmar el rechazo.
- [ ] Revisar consumo y cuotas de Firebase, SerpAPI, DeepSeek y Netlify.

## Día 2: Discord

- [ ] Ejecutar `setup-chongseb.js` sin `--rebuild`.
- [ ] Probar bienvenida y rol comunitario con una cuenta secundaria.
- [ ] Confirmar permisos de MEE6, Ticket Tool y Sapphire con privilegio mínimo.
- [ ] Abrir y cerrar un ticket; comprobar que sea privado.
- [ ] Confirmar que el rol adulto no pueda autoasignarse.
- [ ] Ejecutar `!nutria-control` como Fundador.
- [ ] Confirmar que un usuario normal sea rechazado por el panel.
- [ ] Probar `!play`, `!queue`, `!skip` y desconexión por inactividad del DJ.
- [ ] Revisar logs del bot y reinicio automático del proveedor.

## Día 3: usuarios y comunicación

- [ ] Invitar inicialmente a un grupo pequeño de hasta 10 usuarios que hayan aceptado participar.
- [ ] Recoger comentarios sobre navegación, accesibilidad y errores.
- [ ] No añadir menores a áreas adultas ni pedir documentos por Discord.
- [ ] Publicar contenido de marketing solo desde cuentas autorizadas.
- [ ] Revisar cada texto de `global_posts.txt`, `LANZAMIENTO_FOROS.txt` o `social_posts.txt` antes de publicarlo.
- [ ] Adaptar cada mensaje a las reglas de la comunidad; evitar publicaciones repetidas.
- [ ] Registrar enlaces y respuestas en un log de difusión.
- [ ] Responder consultas reales sin automatizar mensajes privados masivos.

## Monitoreo diario

- [ ] Errores 4xx/5xx y duración de Netlify Functions.
- [ ] Fallos de autenticación y picos de rate limit.
- [ ] Uso de almacenamiento y objetos pendientes.
- [ ] Pagos incompletos, duplicados, disputas y webhooks rechazados.
- [ ] Errores del chat y gasto de APIs.
- [ ] Reportes de Discord, tickets abiertos y acciones de moderación.
- [ ] Disponibilidad del bot musical.

## Respuesta ante incidentes

1. Desactiva la función afectada con su bandera de entorno cuando exista.
2. No borres logs ni bases de datos.
3. Revoca inmediatamente cualquier secreto expuesto y genera uno nuevo.
4. Detén pagos Live si existe riesgo de cobro incorrecto.
5. Retira permisos del bot comprometido y rota `DISCORD_TOKEN`.
6. Documenta hora, alcance, usuarios afectados y corrección.
7. Publica una explicación transparente si el incidente afectó usuarios.

## Métricas iniciales

- Disponibilidad y errores por ruta.
- Preguntas atendidas y fallidas, sin almacenar contenido sensible.
- Conversión a contacto o pago.
- Suscripciones activas verificadas por webhook.
- Archivos subidos y espacio consumido.
- Miembros activos, tickets resueltos y retención del Discord.

No declares éxito por visitas, pagos o candidatos inexistentes. Reporta únicamente eventos confirmados por los proveedores correspondientes.
