# Prueba manual del panel didáctico

1. Publica primero en un Deploy Preview.
2. Comprueba que `DEEPSEEK_API_KEY` y `AI_MODEL` estén disponibles en el contexto **Deploy Previews** de Netlify.
3. En el chat principal pregunta: `¿Cómo puedo diseñar un flyer legible para un evento?`
4. Confirma que la respuesta textual aparezca siempre.
5. Si DeepSeek devuelve recursos reales, debe aparecer debajo un panel **📚 Aprende más sobre este tema** con un máximo de tres tarjetas.
6. Verifica que **Cerrar sugerencias** elimine solamente el panel de esa respuesta.
7. Prueba también una pregunta sin recursos sociales conocidos: el panel no debe aparecer.
8. En la sección adulta, inicia sesión con una cuenta aprobada y repite una pregunta educativa segura.

Solo se aceptan URLs HTTPS de TikTok, Facebook, `fb.watch` e Instagram. Las URLs de otros dominios, mal formadas o sin título se descartan tanto en Netlify como en el navegador. No se realizaron llamadas a DeepSeek durante la implementación.
