const {json,method}=require("./_lib/http");
exports.handler=async(event)=>{const bad=method(event,"POST");if(bad)return bad;return json(501,{error:"Bitso aún no está configurado. No se generan direcciones ni depósitos sin una cuenta Business real."});};
