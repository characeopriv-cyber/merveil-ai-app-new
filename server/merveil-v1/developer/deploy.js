import { json, requestId, requireUser, supabaseAdmin } from '../_lib.js';

const API = 'https://api.cloudflare.com/client/v4';
const SOURCE_BRANCH = 'developer-platform-cloudflare';
const body = req => { try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return {}; } };
const cfg = () => ({ accountId: String(process.env.CLOUDFLARE_ACCOUNT_ID || ''), token: String(process.env.CLOUDFLARE_API_TOKEN || '') });

async function project(id, uid) {
  const { data } = await supabaseAdmin.from('developer_projects').select('id,name,slug,stage,status_label').eq('id', id).eq('owner_user_id', uid).maybeSingle();
  return data;
}

async function cloudflareProject(id, uid) {
  const { data } = await supabaseAdmin.from('developer_provider_connections')
    .select('metadata,external_account_id')
    .eq('project_id', id).eq('owner_user_id', uid).eq('provider', 'cloudflare').maybeSingle();
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
    const { data, error } = await supabaseAdmin.from('developer_deployments')
      .select('id,provider,status,url,external_id,logs,created_at,ready_at')
      .eq('project_id', id).eq('owner_user_id', auth.user.id).order('created_at', { ascending: false }).limit(20);
    if (error) return json(res, 500, { error: 'deployments_read_failed' });
    return json(res, 200, { project: p, deployments: data || [] });
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const provider = String(b.provider || 'cloudflare').toLowerCase();
  if (provider !== 'cloudflare') return json(res, 400, { error: 'unsupported_provider' });

  const { data: build } = await supabaseAdmin.from('developer_builds')
    .select('id,status,logs,created_at').eq('project_id', id).eq('owner_user_id', auth.user.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!build || !['passed', 'success', 'ready'].includes(String(build.status || '').toLowerCase())) {
    return json(res, 409, { error: 'successful_build_required', build_status: build?.status || null });
  }

  const { accountId, token } = cfg();
  const connection = await cloudflareProject(id, auth.user.id);
  const pagesName = connection?.metadata?.pages_project?.name;
  if (!accountId || !token) return json(res, 503, { error: 'cloudflare_not_configured' });
  if (!pagesName) return json(res, 409, { error: 'cloudflare_project_not_provisioned' });

  const { data: deployment, error: insertError } = await supabaseAdmin.from('developer_deployments').insert({
    project_id: id,
    owner_user_id: auth.user.id,
    provider,
    status: 'deploying',
    logs: `Starting Cloudflare Pages deployment for ${p.name}`
  }).select('id,provider,status,url,external_id,logs,created_at,ready_at').single();
  if (insertError) return json(res, 500, { error: 'deployment_create_failed' });

  try {
    // The current Pages project is Git-integrated. This explicitly asks Cloudflare
    // to build the configured production branch instead of pretending the DB
    // workspace itself has already been uploaded as an artifact.
    const form = new FormData();
    form.append('branch', SOURCE_BRANCH);
    form.append('commit_dirty', 'false');
    form.append('commit_message', `Merveil Developer deployment: ${p.name}`);

    const r = await fetch(`${API}/accounts/${accountId}/pages/projects/${encodeURIComponent(pagesName)}/deployments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    const x = await r.json().catch(() => ({}));
    if (!r.ok || !x.success || !x.result?.id) {
      const details = (x.errors || []).map(e => e.message).filter(Boolean).join('; ');
      await supabaseAdmin.from('developer_deployments').update({
        status: 'failed',
        logs: `Cloudflare deployment failed${details ? `: ${details}` : ''}`
      }).eq('id', deployment.id).eq('owner_user_id', auth.user.id);
      await supabaseAdmin.from('developer_projects').update({ stage: 'build', status_label: 'Deployment failed', updated_at: new Date().toISOString() }).eq('id', id).eq('owner_user_id', auth.user.id);
      return json(res, 502, { error: 'cloudflare_deployment_failed', deployment_id: deployment.id, details: x.errors || [] });
    }

    const cf = x.result;
    const url = cf.url || cf.aliases?.[0] || null;
    await supabaseAdmin.from('developer_deployments').update({
      status: cf.latest_stage?.status === 'success' ? 'ready' : 'deploying',
      url,
      external_id: cf.id,
      logs: `Cloudflare deployment ${cf.id} started`,
      ready_at: cf.latest_stage?.status === 'success' ? new Date().toISOString() : null
    }).eq('id', deployment.id).eq('owner_user_id', auth.user.id);
    await supabaseAdmin.from('developer_projects').update({ stage: 'deployed', status_label: cf.latest_stage?.status === 'success' ? 'Deployed' : 'Deployment running', updated_at: new Date().toISOString() }).eq('id', id).eq('owner_user_id', auth.user.id);

    return json(res, 202, {
      deployment: { id: deployment.id, provider, status: cf.latest_stage?.status === 'success' ? 'ready' : 'deploying', external_id: cf.id, url },
      cloudflare: { project: pagesName, branch: SOURCE_BRANCH, deployment_id: cf.id, status: cf.latest_stage?.status || 'queued', url }
    });
  } catch (error) {
    console.error('[developer-deploy]', error);
    await supabaseAdmin.from('developer_deployments').update({ status: 'failed', logs: 'Cloudflare deployment request failed' }).eq('id', deployment.id).eq('owner_user_id', auth.user.id);
    return json(res, 502, { error: 'cloudflare_provider_error', deployment_id: deployment.id });
  }
}
