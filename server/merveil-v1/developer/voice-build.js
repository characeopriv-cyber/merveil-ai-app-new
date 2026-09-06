import { json, requestId, requireUser, supabaseAdmin } from '../_lib.js';
import { generate } from '../intelligence-router.js';

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

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

function extractText(data) {
  return String(data?.text || data?.output_text || data?.transcript || '').trim();
}

async function transcribe(audio, contentType) {
  const key = process.env.OPENAI_API_KEY || process.env.MERVEIL_OPENAI_API_KEY;
  if (!key) throw new Error('voice_provider_not_configured');
  const form = new FormData();
  const bytes = Buffer.from(audio, 'base64');
  form.append('file', new Blob([bytes], { type: contentType || 'audio/webm' }), 'voice.webm');
  form.append('model', process.env.MERVEIL_TRANSCRIBE_MODEL || 'gpt-4o-transcribe');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  const text = await response.text();
  if (!response.ok) throw new Error(`transcription_upstream_${response.status}`);
  let data; try { data = JSON.parse(text); } catch { data = {}; }
  const transcript = extractText(data);
  if (!transcript) throw new Error('transcription_empty');
  return transcript;
}

export default async function handler(req, res) {
  requestId(req, res);
  if (req.method === 'OPTIONS') return json(res, 204, null);
  const u = await user(req);
  if (!u) return json(res, 401, { error: 'authentication_required' });
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const projectId = String(b.project_id || '').trim();
  if (!projectId) return json(res, 400, { error: 'project_id_required' });
  const { data: project } = await supabaseAdmin.from('developer_projects').select('id,name,meta').eq('id', projectId).eq('owner_user_id', u.id).maybeSingle();
  if (!project) return json(res, 404, { error: 'project_not_found' });

  try {
    let transcript = String(b.transcript || '').trim();
    if (!transcript && b.audio_base64) {
      const size = Buffer.byteLength(String(b.audio_base64), 'base64');
      if (size > MAX_AUDIO_BYTES) return json(res, 413, { error: 'audio_too_large' });
      transcript = await transcribe(String(b.audio_base64), String(b.content_type || 'audio/webm'));
    }
    if (!transcript) return json(res, 400, { error: 'transcript_or_audio_required' });
    if (transcript.length > 12000) transcript = transcript.slice(0, 12000);

    const planPrompt = `Convert this developer voice instruction into a safe Merveil build plan. Preserve the user's intent. Do not claim files were changed. Return concise JSON-like text with: intent, summary, stack, files_to_create_or_change, commands, tests, deployment_notes, clarification_needed. If the request is ambiguous or destructive, set clarification_needed=true and explain what must be confirmed. User instruction: ${transcript}`;
    const result = await generate({ capability: 'website', maxTokens: 1200, temperature: 0.2, messages: [{ role: 'user', content: planPrompt }] });

    await supabaseAdmin.from('developer_chatbot_usage').insert({ user_id: u.id, project_id: projectId, feature: 'voice-to-build', units: 1, provider: result.provider, model: result.model });
    return json(res, 200, { data: { transcript, plan: result.reply, project_id: projectId, access: 'free_by_default', next_step: 'review_plan_before_build' } });
  } catch (error) {
    console.error('[voice-build]', error);
    return json(res, 503, { error: error.message === 'voice_provider_not_configured' ? 'voice_provider_not_configured' : 'voice_build_unavailable' });
  }
}
