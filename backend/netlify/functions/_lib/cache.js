const MAX_ENTRIES = 100;
const store = new Map();
const key = (text) => String(text).trim().toLowerCase().replace(/\s+/g, " ");
function get(question) { const k=key(question); if(!store.has(k)) return null; const v=store.get(k); store.delete(k); store.set(k,v); return v; }
function set(question, answer) { const k=key(question); store.delete(k); store.set(k,answer); if(store.size>MAX_ENTRIES) store.delete(store.keys().next().value); }
function intentarCalculoSimple(question) {
  const s=String(question).trim(); let m=s.match(/(\d+(?:\.\d+)?)\s*%\s*de\s*(\d+(?:\.\d+)?)/i);
  if(m) return `${m[1]}% de ${m[2]} es ${(Number(m[1])/100)*Number(m[2])}`;
  m=s.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/); if(!m) return null;
  const a=Number(m[1]), b=Number(m[3]); const values={"+":a+b,"-":a-b,"*":a*b,"/":b===0?"indefinido (división entre 0)":a/b};
  return `${m[1]} ${m[2]} ${m[3]} = ${values[m[2]]}`;
}
module.exports={get,set,intentarCalculoSimple,MAX_ENTRIES};
