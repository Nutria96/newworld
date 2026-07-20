const { createClient }=require("@supabase/supabase-js");
function getSupabaseAdmin(){ const {SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:key}=process.env; if(!url||!key) throw new Error("Supabase no configurado"); return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}); }
module.exports={getSupabaseAdmin};
