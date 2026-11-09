// Cloudflare Worker для FitGram:
//   • доступ лише для схвалених користувачів (розробник підтверджує кнопками в чаті з ботом);
//   • пересилання звіту користувачу в чат із ботом.
//
// Налаштування Worker-а:
//   Settings → Bindings → KV namespace:  змінна USERS  (сховище списку користувачів)
//   Settings → Variables and Secrets:
//     BOT_TOKEN       (Secret)  — токен бота від @BotFather
//     WEBHOOK_SECRET  (Secret)  — вигадайте довгий пароль із латинських літер, цифр, _ та -
//     ADMIN_ID        (Text)    — ваш Telegram ID (його покаже бот за командою /myid)
//     ALLOWED_ORIGIN  (Text, необов’язково) — напр. https://alex-bondarchuk.github.io
//     APP_URL         (Text, необов’язково) — адреса застосунку для кнопки «Відкрити FitGram»
//
// Маршрути:
//   POST /auth      {initData}        → {ok, status: approved|pending|denied, admin}
//   POST /report    {initData, text}  → надсилає звіт (лише для схвалених); також приймається POST /
//   POST /webhook                     → оновлення від Telegram (кнопки «Додати/Відхилити», /start, /users, /myid)
//   GET  /setup?key=WEBHOOK_SECRET    → одноразово підключає webhook і команди бота

const enc = new TextEncoder();
const MAX_USERS = 200;
const APP_URL_DEFAULT = 'https://alex-bondarchuk.github.io/fitgram/';

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

/* ---------- Telegram Bot API ---------- */
async function tgCall(env, method, payload) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, description: String(e) };
  }
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sendHtml = (env, chat_id, text, extra = {}) =>
  tgCall(env, 'sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
const openButton = (env) => ({
  reply_markup: { inline_keyboard: [[{ text: '🏋️ Відкрити FitGram', web_app: { url: env.APP_URL || APP_URL_DEFAULT } }]] },
});

/* ---------- реєстр користувачів (KV: u:<id> → {id, n, u, s, t}) ---------- */
const adminId = (env) => Number(env.ADMIN_ID) || 0;
const isAdmin = (env, id) => adminId(env) !== 0 && id === adminId(env);
const getRec = (env, id) => env.USERS.get('u:' + id, 'json');
const putRec = (env, rec) =>
  env.USERS.put('u:' + rec.id, JSON.stringify(rec), { metadata: { s: rec.s, n: rec.n, u: rec.u } });
const who = (r) => `${esc(r.n)}${r.u ? ` (@${esc(r.u)})` : ''} · <code>${r.id}</code>`;

function newRec(user) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return { id: user.id, n: (name || user.username || String(user.id)).slice(0, 60), u: String(user.username || '').slice(0, 40), s: 'pending', t: Date.now() };
}

// 'admin' | 'approved' | 'pending' | 'denied' | 'none'
async function statusOf(env, user) {
  if (isAdmin(env, user.id)) return 'admin';
  const rec = await getRec(env, user.id);
  return rec ? rec.s : 'none';
}

// Створює запит і надсилає розробнику повідомлення з кнопками. Повторно не сповіщає.
async function requestAccess(env, user) {
  const list = await env.USERS.list({ prefix: 'u:', limit: MAX_USERS + 1 });
  if (list.keys.length >= MAX_USERS) return 'denied';
  const rec = newRec(user);
  await putRec(env, rec);
  await sendHtml(env, adminId(env), `🆕 <b>Запит на доступ до FitGram</b>\n${who(rec)}`, {
    reply_markup: { inline_keyboard: [[
      { text: '✅ Додати', callback_data: `ap:${rec.id}` },
      { text: '❌ Відхилити', callback_data: `dn:${rec.id}` },
    ]] },
  });
  return 'pending';
}

/* ---------- /users: список для розробника ---------- */
async function usersView(env, patch) {
  const list = await env.USERS.list({ prefix: 'u:', limit: 1000 });
  const byId = new Map(list.keys.map((k) => {
    const m = k.metadata || {};
    const id = Number(k.name.slice(2));
    return [id, { id, s: m.s || 'denied', n: m.n || String(id), u: m.u || '' }];
  }));
  if (patch) byId.set(patch.id, patch); // KV-список оновлюється з невеликою затримкою
  const order = { pending: 0, approved: 1, denied: 2 };
  const all = [...byId.values()].sort((a, b) => (order[a.s] - order[b.s]) || a.n.localeCompare(b.n));
  const shown = all.slice(0, 40);
  const icon = { pending: '⏳', approved: '✅', denied: '🚫' };
  const short = (n) => (n.length > 18 ? n.slice(0, 17) + '…' : n);
  const keyboard = shown.map((r) =>
    r.s === 'pending' ? [{ text: `✅ ${short(r.n)}`, callback_data: `ap:${r.id}:l` }, { text: '❌', callback_data: `dn:${r.id}:l` }]
    : r.s === 'approved' ? [{ text: `🚫 Вилучити ${short(r.n)}`, callback_data: `rv:${r.id}:l` }]
    : [{ text: `✅ Додати ${short(r.n)}`, callback_data: `ap:${r.id}:l` }]);
  const text = all.length
    ? `👥 <b>Користувачі FitGram</b> (${all.length})\n\n${shown.map((r) => `${icon[r.s]} ${who(r)}`).join('\n')}${all.length > shown.length ? `\n…і ще ${all.length - shown.length}` : ''}`
    : '👥 Користувачів ще немає.';
  return { text, ...(keyboard.length ? { reply_markup: { inline_keyboard: keyboard } } : {}) };
}

/* ---------- обробка webhook ---------- */
async function onMessage(env, m) {
  if (!m.from || !m.chat || m.chat.type !== 'private') return;
  const u = m.from;
  const cmd = String(m.text).trim().split(/\s+/)[0].split('@')[0].toLowerCase();
  if (cmd === '/myid') return sendHtml(env, m.chat.id, `Ваш Telegram ID: <code>${u.id}</code>`);
  if (!adminId(env)) return sendHtml(env, m.chat.id, `Бот ще не налаштований: розробник має вказати ADMIN_ID. Ваш ID: <code>${u.id}</code>`);
  if (!env.USERS) return;

  if (cmd === '/users') {
    if (!isAdmin(env, u.id)) return;
    const v = await usersView(env);
    return sendHtml(env, m.chat.id, v.text, v.reply_markup ? { reply_markup: v.reply_markup } : {});
  }
  if (cmd !== '/start') return;

  let st = await statusOf(env, u);
  const wasNew = st === 'none';
  if (wasNew) st = await requestAccess(env, u);
  if (st === 'admin') {
    return sendHtml(env, m.chat.id, '👑 Ви адміністратор FitGram.\nЗапити на доступ приходитимуть сюди з кнопками «Додати» / «Відхилити». Список користувачів — /users.', openButton(env));
  }
  if (st === 'approved') return sendHtml(env, m.chat.id, '👋 Вітаю! Доступ відкрито — натисніть кнопку, щоб запустити FitGram.', openButton(env));
  if (st === 'pending') {
    return sendHtml(env, m.chat.id, wasNew
      ? '📨 Запит на доступ надіслано адміністратору. Щойно його підтвердять, я напишу сюди.'
      : '⏳ Запит на доступ уже надіслано адміністратору. Очікуйте підтвердження, я напишу сюди.');
  }
  return sendHtml(env, m.chat.id, '🚫 Доступ до FitGram не надано.');
}

async function onCallback(env, cb) {
  const answer = (text) => tgCall(env, 'answerCallbackQuery', { callback_query_id: cb.id, text });
  if (!env.USERS || !isAdmin(env, cb.from.id)) return answer('Недостатньо прав');
  const [act, idStr, ctx] = String(cb.data || '').split(':');
  const id = Number(idStr);
  const rec = id && ['ap', 'dn', 'rv'].includes(act) ? await getRec(env, id) : null;
  if (!rec) return answer('Користувача не знайдено');

  rec.s = act === 'ap' ? 'approved' : 'denied';
  await putRec(env, rec);
  if (act === 'ap') await sendHtml(env, rec.id, '✅ <b>Доступ до FitGram відкрито!</b>\nНатисніть кнопку нижче, щоб почати.', openButton(env));
  else await sendHtml(env, rec.id, act === 'dn' ? '🚫 Доступ до FitGram не надано.' : '🚫 Доступ до FitGram закрито.');
  await answer(act === 'ap' ? 'Додано ✅' : act === 'dn' ? 'Відхилено' : 'Вилучено');

  const msg = cb.message;
  if (!msg) return;
  if (ctx === 'l') {
    const v = await usersView(env, rec);
    return tgCall(env, 'editMessageText', { chat_id: msg.chat.id, message_id: msg.message_id, text: v.text, parse_mode: 'HTML', ...(v.reply_markup ? { reply_markup: v.reply_markup } : {}) });
  }
  const label = act === 'ap' ? '✅ Додано' : act === 'dn' ? '❌ Відхилено' : '🚫 Вилучено';
  return tgCall(env, 'editMessageText', { chat_id: msg.chat.id, message_id: msg.message_id, text: `${label}: ${who(rec)}`, parse_mode: 'HTML' });
}

async function handleWebhook(request, env) {
  if (!env.WEBHOOK_SECRET || request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  let update;
  try { update = await request.json(); } catch (e) { return new Response('ok'); }
  try {
    if (update.callback_query) await onCallback(env, update.callback_query);
    else if (update.message && update.message.text) await onMessage(env, update.message);
  } catch (e) { /* завжди відповідаємо 200, щоб Telegram не повторював запит */ }
  return new Response('ok');
}

/* ---------- одноразове підключення webhook ---------- */
async function handleSetup(url, env, reply) {
  if (!env.WEBHOOK_SECRET || url.searchParams.get('key') !== env.WEBHOOK_SECRET) return reply({ ok: false, error: 'forbidden' }, 403);
  const base = [
    { command: 'start', description: 'Запросити доступ / відкрити FitGram' },
    { command: 'myid', description: 'Показати мій Telegram ID' },
  ];
  const webhook = await tgCall(env, 'setWebhook', { url: `${url.origin}/webhook`, secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'] });
  const commands = await tgCall(env, 'setMyCommands', { commands: base });
  const adminCommands = adminId(env)
    ? await tgCall(env, 'setMyCommands', {
        commands: [...base, { command: 'users', description: 'Користувачі: додати / вилучити' }],
        scope: { type: 'chat', chat_id: adminId(env) },
      })
    : null;
  return reply({
    webhook: webhook.ok ? 'ok' : webhook,
    commands: commands.ok ? 'ok' : commands,
    adminCommands: adminCommands ? (adminCommands.ok ? 'ok' : adminCommands) : 'пропущено: ADMIN_ID не вказано',
    kvBound: !!env.USERS,
    adminIdSet: adminId(env) !== 0,
  });
}

/* ---------- основний обробник ---------- */
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
    const reply = (obj, status = 200) =>
      new Response(JSON.stringify(obj, null, 2), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    try {
      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (request.method === 'GET' && path === '/setup') return await handleSetup(url, env, reply);
      if (request.method !== 'POST') return reply({ ok: false, error: 'POST only' }, 405);
      if (path === '/webhook') return await handleWebhook(request, env);
      if (path !== '/' && path !== '/auth' && path !== '/report') return reply({ ok: false, error: 'not found' }, 404);

      if (!env.USERS) return reply({ ok: false, error: 'KV-сховище USERS не підключено до Worker-а' }, 500);
      if (!adminId(env)) return reply({ ok: false, error: 'ADMIN_ID не вказано' }, 503);

      let body;
      try { body = await request.json(); } catch (e) { return reply({ ok: false, error: 'bad json' }, 400); }
      const user = await verifyInitData(String(body.initData || ''), env.BOT_TOKEN);
      if (!user || !user.id) return reply({ ok: false, error: 'unauthorized' }, 401);

      let st = await statusOf(env, user);

      if (path === '/auth') {
        if (st === 'none') st = await requestAccess(env, user);
        return reply({ ok: true, status: st === 'admin' ? 'approved' : st, admin: st === 'admin' });
      }

      // звіт: лише для схвалених користувачів
      if (st !== 'admin' && st !== 'approved') return reply({ ok: false, error: 'forbidden' }, 403);
      const text = String(body.text || '').slice(0, 4000);
      if (!text) return reply({ ok: false, error: 'empty report' }, 400);
      const data = await tgCall(env, 'sendMessage', { chat_id: user.id, text });
      if (!data.ok) return reply({ ok: false, error: data.description || 'telegram error' }, 502);
      return reply({ ok: true });
    } catch (e) {
      return reply({ ok: false, error: 'server error' }, 500);
    }
  },
};
