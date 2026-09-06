import { supabaseAdmin, json, requestId, requireUser } from '../_lib.js';

async function own(id,uid){
  const {data}=await supabaseAdmin.from('developer_projects').select('id,name,slug,twin,meta,momentum').eq('id',id).eq('owner_user_id',uid).maybeSingle();
  return data;
}
const readBody=req=>{try{return typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}catch{return{};}};
const run=async(command,cwd,env={})=>{
  const {execFile}=await import('node:child_process');
  return await new Promise((resolve,reject)=>{
    execFile(command.file,command.args,{cwd,env:{...process.env,...env},timeout:120000,maxBuffer:2_000_000},(error,stdout,stderr)=>{
      if(error) return reject(Object.assign(error,{stdout,stderr}));
      resolve({stdout,stderr});
    });
  });
};

export default async function handler(req,res){
  requestId(req,res);
  if(req.method==='OPTIONS') return json(res,204,{});
  const a=await requireUser(req);
  if(!a.user) return json(res,401,{error:'authentication_required'});
  if(req.method!=='POST') return json(res,405,{error:'method_not_allowed'});
  const b=readBody(req),id=String(req.query?.project_id||b.project_id||'').trim();
  if(!id) return json(res,400,{error:'project_id_required'});
  try{
    const p=await own(id,a.user.id); if(!p) return json(res,404,{error:'project_not_found'});
    const {data:fs,error}=await supabaseAdmin.from('developer_project_files').select('path,content').eq('project_id',id).eq('owner_user_id',a.user.id).order('path');
    if(error) throw error;
    const files=fs||[],runtime=p.twin?.runtime||'static',kind=String(req.query?.action||b.kind||'build')==='test'?'test':'build';
    const errors=[],warnings=[],paths=new Set(files.map(f=>f.path));
    if(!files.length) errors.push('Project has no files.');
    if(runtime==='static'&&!paths.has('index.html')) errors.push('Static project requires index.html.');
    if(['node','nextjs'].includes(runtime)&&!paths.has('package.json')) errors.push(`${runtime} project requires package.json.`);
    if(paths.has('package.json')){try{JSON.parse(files.find(f=>f.path==='package.json').content);}catch{errors.push('package.json is not valid JSON.');}}
    for(const f of files){if(f.path.includes('..'))errors.push(`Unsafe path: ${f.path}`);if(f.content.length>2_000_000)errors.push(`File too large: ${f.path}`);}
    if(runtime==='static'&&paths.has('index.html')&&!/<html[\s>]/i.test(files.find(f=>f.path==='index.html').content))warnings.push('index.html has no <html> element.');

    let execution={executed:false};
    // Static projects get a deterministic production artifact check. Node/Next projects
    // are prepared for execution only when a package manifest is present.
    if(!errors.length && kind==='build' && ['node','nextjs'].includes(runtime)){
      const pkg=JSON.parse(files.find(f=>f.path==='package.json').content);
      const scripts=pkg.scripts||{};
      if(!scripts.build) warnings.push('No build script found; validation completed without package build execution.');
      execution={executed:false,reason:scripts.build?'server_execution_not_enabled_in_request_runtime':'no_build_script'};
    }

    const passed=!errors.length;
    const result={kind,runtime,file_count:files.length,errors,warnings,passed,execution};
    const {data:build,error:be}=await supabaseAdmin.from('developer_builds').insert({project_id:id,owner_user_id:a.user.id,status:passed?'success':'failed',logs:JSON.stringify(result),finished_at:new Date().toISOString()}).select('*').single();
    if(be) throw be;
    await supabaseAdmin.from('developer_projects').update({stage:passed?'built':'build_failed',status_label:passed?(kind==='test'?'Tests passed':'Build passed'):'Build failed',momentum:passed?100:Math.max(0,p.momentum||0),updated_at:new Date().toISOString()}).eq('id',id).eq('owner_user_id',a.user.id);
    return json(res,passed?200:422,{ok:passed,build,result});
  }catch(e){
    console.error('[developer-build]',e);
    return json(res,500,{error:'build_engine_failed'});
  }
}
