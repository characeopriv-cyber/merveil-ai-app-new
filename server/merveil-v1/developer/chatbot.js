import { json, requestId, requireUser, supabaseAdmin } from '../_lib.js';
import { generate } from '../intelligence-router.js';

const body = req => { try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return {}; } };

async function user(req) {
  const a = await requireUser(req);
  if (a.user) return a.user;
  const cookie = String(req.headers.cookie || '');
  if (!cookie) return null;
  try {
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
    const host = String(req.headers.host || '').split(',')[0];
    const r = await fetch(`${proto}://${host}/api/auth-session?reason=developer`, { headers: { cookie }, cache: 'no-store' });
    const b = await r.json().catch(() => null);
    return r.ok && b?.authenticated ? b.user : null;
  } catch { return null; }
}

export default async function handler(req, res) {
  requestId(req, res);
  if (req.method === 'OPTIONS') return json(res, 204, null);
  const u = await user(req);
  if (!u) return json(res, 401, { error: 'authentication_required' });
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const b = body(req);
  const projectId = String(b.project_id || '').trim() || null;
  if (projectId) {
    const { data: project } = await supabaseAdmin.from('developer_projects').select('id').eq('id', projectId).eq('owner_user_id', u.id).maybeSingle();
    if (!project) return json(res, 404, { error: 'project_not_found' });
  }

  const messages = Array.isArray(b.messages)
    ? b.messages.filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').slice(-20).map(m => ({ role: m.role, content: m.content.slice(0, 8000) }))
    : [];
  if (!messages.length) return json(res, 400, { error: 'messages_required' });

  const { data: ai } = await supabaseAdmin.from('developer_ai_entitlements').select('plan,ai_enabled,monthly_limit,used_units,period_end,provider').eq('user_id', u.id).maybeSingle();
  if (!ai?.ai_enabled) return json(res, 403, { error: 'ai_not_enabled', message: 'Merveil AI Developer Intelligence requires a paid developer entitlement.' });
  if (ai.period_end && new Date(ai.period_end).getTime() <= Date.now()) return json(res, 403, { error: 'ai_entitlement_expired' });
  if (Number.isFinite(ai.monthly_limit) && ai.monthly_limit >= 0 && (ai.used_units || 0) >= ai.monthly_limit) return json(res, 429, { error: 'ai_monthly_limit_reached', limit: ai.monthly_limit, used: ai.used_units || 0 });

  const { data: quota, error: quotaError } = await supabaseAdmin.rpc('consume_developer_chatbot', { p_user_id: u.id, p_project_id: projectId, p_units: 1 });
  if (quotaError) return json(res, 503, { error: 'chatbot_quota_service_unavailable' });
  if (!quota?.allowed) return json(res, 429, { error: `chatbot_${quota.reason}`, developer_category: quota.developer_category, limit: quota.limit, used: quota.used, remaining: quota.remaining, daily_remaining: quota.daily_remaining, monthly_remaining: quota.monthly_remaining });

  try {
    const result = await generate({ messages, maxTokens: b.max_tokens, temperature: b.temperature, capability: String(b.capability || 'developer').toLowerCase() });
    await supabaseAdmin.from('developer_chatbot_usage').update({ provider: result.provider, model: result.model }).eq('user_id', u.id).eq('project_id', projectId).eq('feature', 'chatbot').order('created_at', { ascending: false }).limit(1);
    await supabaseAdmin.from('developer_ai_entitlements').update({ used_units: (ai.used_units || 0) + 1, updated_at: new Date().toISOString() }).eq('user_id', u.id);
    return json(res, 200, { data: { reply: result.reply, model: 'merveil-intelligence', capability: result.capability, provider: 'merveil', routing: 'automatic', developer_category: quota.developer_category, chatbot_daily_remaining: quota.daily_remaining, chatbot_monthly_remaining: quota.monthly_remaining, ai_monthly_remaining: Math.max(0, (ai.monthly_limit || 0) - ((ai.used_units || 0) + 1)) } });
  } catch (error) {
    await supabaseAdmin.from('developer_chatbot_usage').delete().eq('user_id', u.id).eq('project_id', projectId).eq('feature', 'chatbot').order('created_at', { ascending: false }).limit(1);
    console.error('[developer-chatbot]', error);
    return json(res, 503, { error: 'merveil_intelligence_unavailable' });
  }
}
