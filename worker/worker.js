// Cloudflare Worker: приймає звіт від Mini App і надсилає його користувачу в чат із ботом.
// Змінні Worker-а (Settings → Variables and Secrets):
//   BOT_TOKEN       (Secret)  — токен бота від @BotFather
//   ALLOWED_ORIGIN  (Text, необов’язково) — напр. https://alex-bondarchuk.github.io

const enc = new TextEncoder();

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}
const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

// Перевірка підпису initData за https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// Повертає об’єкт користувача Telegram або null.
export async function verifyInitData(initData, botToken, maxAgeSec = 86400) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !botToken) return null;
  params.delete('hash');
  const check = [...params.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  if (toHex(await hmac(secret, check)) !== hash) return null;
  const age = Date.now() / 1000 - Number(params.get('auth_date') || 0);
  if (!(age < maxAgeSec)) return null;
  try { return JSON.parse(params.get('user')); } catch (e) { return null; }
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    const reply = (obj, status = 200) =>
      new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply({ ok: false, error: 'POST only' }, 405);

    let body;
    try { body = await request.json(); } catch (e) { return reply({ ok: false, error: 'bad json' }, 400); }

    const user = await verifyInitData(String(body.initData || ''), env.BOT_TOKEN);
    if (!user || !user.id) return reply({ ok: false, error: 'unauthorized' }, 401);

    const text = String(body.text || '').slice(0, 4000);
    if (!text) return reply({ ok: false, error: 'empty report' }, 400);

    const tg = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: user.id, text }),
    });
    const data = await tg.json().catch(() => ({}));
    if (!data.ok) return reply({ ok: false, error: data.description || 'telegram error' }, 502);
    return reply({ ok: true });
  },
};
