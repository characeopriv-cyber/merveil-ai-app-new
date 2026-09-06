import { json, requestId, requireUser, supabaseAdmin } from '../_lib.js';

const body = req => { try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return {}; } };

async function project(id, uid) {
  const { data } = await supabaseAdmin.from('developer_projects').select('id,name,slug,stage,status_label').eq('id', id).eq('owner_user_id', uid).maybeSingle();
  return data;
}

export default async function handler(req, res) {
  requestId(req, res);
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const auth = await requireUser(req);
  if (!auth.user) return json(res, 401, { error: 'authentication_required' });
  const b = body(req);
  const id = String(req.query?.project_id || b.project_id || '').trim();
  if (!id) return json(res, 400, { error: 'project_id_required' });
  const p = await project(id, auth.user.id);
  if (!p) return json(res, 404, { error: 'project_not_found' });

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin.from('developer_deployments').select('id,provider,status,url,external_id,logs,created_at,ready_at').eq('project_id', id).eq('owner_user_id', auth.user.id).order('created_at', { ascending: false }).limit(20);
    if (error) return json(res, 500, { error: 'deployments_read_failed' });
    return json(res, 200, { project: p, deployments: data || [] });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const provider = String(b.provider || 'cloudflare').toLowerCase();
  if (!['cloudflare'].includes(provider)) return json(res, 400, { error: 'unsupported_provider' });

  const { data: build } = await supabaseAdmin.from('developer_builds').select('id,status,logs').eq('project_id', id).eq('owner_user_id', auth.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!build || !['passed', 'success', 'ready'].includes(String(build.status || '').toLowerCase())) return json(res, 409, { error: 'successful_build_required', build_status: build?.status || null });

  const { data: deployment, error } = await supabaseAdmin.from('developer_deployments').insert({ project_id: id, owner_user_id: auth.user.id, provider, status: 'queued', logs: `Deployment queued for ${p.name}` }).select('id,provider,status,url,external_id,logs,created_at,ready_at').single();
  if (error) return json(res, 500, { error: 'deployment_create_failed' });
  await supabaseAdmin.from('developer_projects').update({ stage: 'deploying', status_label: 'Deployment queued', updated_at: new Date().toISOString() }).eq('id', id).eq('owner_user_id', auth.user.id);
  return json(res, 202, { deployment });
}
