# Checklist posterior al lanzamiento de CHONGSEB

Fecha del lanzamiento: ____________________

## Web y servicios

- [ ] La página web carga correctamente por HTTPS.
- [ ] El chat responde sin exponer claves ni errores internos.
- [ ] Las variables necesarias están cargadas en Netlify.
- [ ] Las suscripciones de Mercado Pago y PayPal están configuradas y probadas en el entorno correspondiente.
- [ ] Los webhooks de pago registran los eventos esperados.

## Discord

- [ ] El bot principal está en línea mediante `npm start`.
- [ ] El bot responde a `!nutria-control` cuando lo invoca `👑 Fundador`.
- [ ] Un usuario sin `👑 Fundador` recibe el rechazo de acceso.
- [ ] El botón **Estadísticas** muestra miembros, bots, roles y canales.
- [ ] La estructura de canales, roles y permisos fue revisada después de ejecutar `npm run discord:chongseb`.
- [ ] El bot de música está desplegado, si aplica.
- [ ] MEE6 está invitado y configurado, si aplica.
- [ ] Ticket Tool está invitado y configurado, si aplica.
- [ ] Sapphire está invitado y configurado, si aplica.

## Difusión y seguimiento

- [ ] Los mensajes de marketing están listos para publicarse.
- [ ] Los enlaces públicos fueron revisados antes de compartirlos.
- [ ] Los logs de GitHub Actions y Netlify no muestran errores.
- [ ] Se revisaron métricas, pagos y reportes durante las primeras 24 horas.

## Comandos operativos

```powershell
npm install
npm start
```

Para sincronizar la estructura de Discord sin reconstruir todo:

```powershell
npm run discord:chongseb
```

Usa `npm run discord:rebuild` únicamente cuando quieras reconstruir el servidor y aceptes la confirmación destructiva solicitada por el script.
