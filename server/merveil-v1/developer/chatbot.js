import { json, requestId, requireUser, supabaseAdmin } from '../_lib.js';
import { generate } from '../intelligence-router.js';
const body=req=>{try{return typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}catch{return{};}};
async function user(req){const a=await requireUser(req);if(a.user)return a.user;const cookie=String(req.headers.cookie||'');if(!cookie)return null;try{const proto=String(req.headers['x-forwarded-proto']||'https').split(',')[0],host=String(req.headers.host||'').split(',')[0];const r=await fetch(`${proto}://${host}/api/auth-session?reason=developer`,{headers:{cookie},cache:'no-store'});const b=await r.json().catch(()=>null);return r.ok&&b?.authenticated?b.user:null;}catch{return null;}}
export default async function handler(req,res){
 requestId(req,res);if(req.method==='OPTIONS')return json(res,204,null);const u=await user(req);if(!u)return json(res,401,{error:'authentication_required'});if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
 const b=body(req),projectId=String(b.project_id||'').trim()||null;if(projectId){const {data:p}=await supabaseAdmin.from('developer_projects').select('id').eq('id',projectId).eq('owner_user_id',u.id).maybeSingle();if(!p)return json(res,404,{error:'project_not_found'});}
 const messages=Array.isArray(b.messages)?b.messages.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-20).map(m=>({role:m.role,content:m.content.slice(0,8000)})):[];if(!messages.length)return json(res,400,{error:'messages_required'});
 const capability=String(b.capability||'developer').toLowerCase();
 try{
  const result=await generate({messages,maxTokens:b.max_tokens,temperature:b.temperature,capability});
  const {error:usageError}=await supabaseAdmin.from('developer_chatbot_usage').insert({user_id:u.id,project_id:projectId,feature:'chatbot',units:1,provider:result.provider,model:result.model});
  if(usageError)console.warn('[developer-chatbot-usage]',usageError.message);
  return json(res,200,{data:{reply:result.reply,model:'merveil-intelligence',capability:result.capability,provider:'merveil',routing:'automatic',access:'free_by_default'}});
 }catch(error){console.error('[developer-chatbot]',error);return json(res,503,{error:'merveil_intelligence_unavailable'});}
}
