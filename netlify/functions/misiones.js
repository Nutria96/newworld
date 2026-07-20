const {json,method}=require("./_lib/http");
const misiones=[{id:"primera-visita",titulo:"Explora Chongseb",puntos:10},{id:"apoyo",titulo:"Apoya el proyecto",puntos:100}];
exports.handler=async(event)=>{const bad=method(event,"GET");if(bad)return bad;return json(200,{misiones});};
