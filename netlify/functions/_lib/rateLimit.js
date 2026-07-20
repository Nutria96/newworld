const MAX_POR_SESION=30, VENTANA_MS=6*60*60*1000, sesiones=new Map();
function checarLimite(id="anon") { const now=Date.now(); for(const [k,v] of sesiones) if(now-v.inicio>VENTANA_MS) sesiones.delete(k); const d=sesiones.get(id)||{conteo:0,inicio:now}; d.conteo++; sesiones.set(id,d); return {permitido:d.conteo<=MAX_POR_SESION,restantes:Math.max(0,MAX_POR_SESION-d.conteo),limite:MAX_POR_SESION}; }
module.exports={checarLimite,MAX_POR_SESION};
