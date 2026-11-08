(() => {
'use strict';

/* ---------- helpers ---------- */
const tg = window.Telegram && window.Telegram.WebApp;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (n) => Math.round(n).toLocaleString('uk-UA');
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const shift = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const todayKey = () => dkey(new Date());
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const haptic = (t = 'light') => { try { tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred(t); } catch (e) {} };

/* ---------- state & storage ---------- */
const KEY = 'fitgram_v1';
const defaults = () => ({
  updatedAt: 0,
  profile: { name: '', sex: 'm', age: 30, height: 175, weight: 75, activity: 1.375, goal: 'maintain' },
  goals: { kcal: 2200, p: 140, f: 70, c: 250, steps: 10000 },
  food: {}, steps: {}, workouts: {}, weights: {},
});
let state = defaults();

function merge(base, extra) {
  const out = { ...base, ...extra };
  out.profile = { ...base.profile, ...(extra.profile || {}) };
  out.goals = { ...base.goals, ...(extra.goals || {}) };
  return out;
}
function loadLocal() {
  try { const raw = localStorage.getItem(KEY); if (raw) state = merge(defaults(), JSON.parse(raw)); } catch (e) {}
}

const cloud = tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9') ? tg.CloudStorage : null;
const CHUNK = 1200; // Telegram CloudStorage: value limit 4096 chars; keep a safe margin for non-ASCII
let cloudTimer = null, cloudChunks = 0;

function cloudSave() {
  if (!cloud) return;
  const s = JSON.stringify(state);
  const parts = s.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) || [];
  parts.forEach((p, i) => cloud.setItem('fg_' + i, p));
  if (cloudChunks > parts.length) {
    const stale = []; for (let i = parts.length; i < cloudChunks; i++) stale.push('fg_' + i);
    cloud.removeItems(stale);
  }
  cloudChunks = parts.length;
  cloud.setItem('fg_n', String(parts.length));
}
function cloudLoad() {
  if (!cloud) return;
  cloud.getItem('fg_n', (err, val) => {
    const n = parseInt(val, 10);
    if (err || !n) { cloudSave(); return; }
    cloudChunks = n;
    const keys = []; for (let i = 0; i < n; i++) keys.push('fg_' + i);
    cloud.getItems(keys, (err2, obj) => {
      if (err2 || !obj) return;
      try {
        const remote = JSON.parse(keys.map((k) => obj[k] || '').join(''));
        if ((remote.updatedAt || 0) > (state.updatedAt || 0)) {
          state = merge(defaults(), remote);
          localStorage.setItem(KEY, JSON.stringify(state));
          render();
        } else if ((remote.updatedAt || 0) < (state.updatedAt || 0)) cloudSave();
      } catch (e) {}
    });
  });
}
function persist() {
  state.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(cloudSave, 1200);
}

/* ---------- constants ---------- */
const TABS = [['food', '🍽', 'Харчування'], ['steps', '👟', 'Кроки'], ['workout', '🏋️', 'Тренування'], ['profile', '👤', 'Профіль']];
const MEALS = [['breakfast', 'Сніданок', '🍳'], ['lunch', 'Обід', '🍲'], ['dinner', 'Вечеря', '🍝'], ['snack', 'Перекус', '🍎']];
const WTYPES = { 'Силове': ['🏋️', 5], 'Кардіо': ['🏃', 7], 'Біг': ['👟', 9.8], 'Ходьба': ['🚶', 3.5], 'Велосипед': ['🚴', 7.5],
  'Плавання': ['🏊', 7], 'Йога': ['🧘', 3], 'HIIT': ['🔥', 10], 'Інше': ['⭐', 5] };
const ACTIVITY = [[1.2, 'Сидячий (без тренувань)'], [1.375, 'Легка (1–3 тренування/тиждень)'], [1.55, 'Помірна (3–5 тренувань/тиждень)'],
  [1.725, 'Висока (6–7 тренувань/тиждень)'], [1.9, 'Дуже висока (фізична робота + спорт)']];
const GOALS = [['lose', 'Схуднути'], ['maintain', 'Підтримувати вагу'], ['gain', 'Набрати масу']];

const ui = { tab: 'food', date: todayKey(), sheet: null };

/* ---------- date nav ---------- */
function dateLabel(k) {
  const t = todayKey();
  if (k === t) return 'Сьогодні';
  if (k === shift(t, -1)) return 'Вчора';
  return parseKey(k).toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'long' });
}
function dateNav() {
  return `<div class="datenav">
    <button class="arrow" data-a="prev" aria-label="Попередній день">‹</button>
    <button class="datelabel" data-a="today">${esc(dateLabel(ui.date))}</button>
    <button class="arrow" data-a="next" aria-label="Наступний день" ${ui.date >= todayKey() ? 'disabled' : ''}>›</button>
  </div>`;
}

/* ---------- FOOD ---------- */
function bar(label, val, goal, cls) {
  const pct = goal > 0 ? Math.min(100, (val / goal) * 100) : 0;
  const over = goal > 0 && val > goal ? ' over' : '';
  return `<div class="bar-row"><div class="top"><span>${label}</span><span>${fmt(val)} / ${fmt(goal)} г</span></div>
    <div class="track"><div class="fill ${cls}${over}" style="width:${pct}%"></div></div></div>`;
}
function foodView() {
  const items = state.food[ui.date] || [];
  const t = items.reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.p, f: a.f + i.f, c: a.c + i.c }), { kcal: 0, p: 0, f: 0, c: 0 });
  const g = state.goals;
  const left = g.kcal - t.kcal;
  const pct = g.kcal > 0 ? Math.min(100, (t.kcal / g.kcal) * 100) : 0;
  let html = `<h2>Харчування</h2>${dateNav()}
  <div class="card">
    <div class="row"><div><div class="big">${fmt(Math.abs(left))}</div><div class="hint">${left >= 0 ? 'ккал залишилось' : 'ккал понад ціль'}</div></div>
      <div style="text-align:right"><div><b>${fmt(t.kcal)}</b> <span class="hint">з ${fmt(g.kcal)} ккал</span></div></div></div>
    <div class="track" style="margin-top:10px"><div class="fill${left < 0 ? ' over' : ''}" style="width:${pct}%"></div></div>
    ${bar('Білки', t.p, g.p, 'p')}${bar('Жири', t.f, g.f, 'f')}${bar('Вуглеводи', t.c, g.c, 'c')}
  </div>
  <button class="btn" data-a="add-food">+ Додати їжу</button>`;
  if (!items.length) html += `<div class="empty">Поки нічого не записано.<br>Додайте перший прийом їжі 👆</div>`;
  for (const [id, title, ic] of MEALS) {
    const list = items.filter((i) => (i.meal || 'snack') === id);
    if (!list.length) continue;
    const sum = list.reduce((a, i) => a + i.kcal, 0);
    html += `<div class="meal-title"><span>${ic} ${title}</span><span>${fmt(sum)} ккал</span></div>`;
    html += list.map((i) => `<button class="item" data-a="edit-food" data-id="${i.id}">
      <div><div class="name">${esc(i.name)}</div><div class="sub">Б ${r1(i.p)} · Ж ${r1(i.f)} · В ${r1(i.c)}</div></div>
      <div class="kc">${fmt(i.kcal)} ккал</div></button>`).join('');
  }
  return html;
}
function recentFoods() {
  const seen = new Set(), out = [];
  for (const k of Object.keys(state.food).sort().reverse()) {
    for (const i of [...state.food[k]].reverse()) {
      const n = i.name.toLowerCase();
      if (seen.has(n)) continue;
      seen.add(n); out.push(i);
      if (out.length >= 8) return out;
    }
  }
  return out;
}
function field(label, id, value, opts = {}) {
  const { type = 'text', inputmode = '', ph = '', attrs = '' } = opts;
  return `<div class="field"><label for="${id}">${label}</label>
    <input id="${id}" type="${type}" ${inputmode ? `inputmode="${inputmode}"` : ''} placeholder="${esc(ph)}" value="${esc(value)}" ${attrs}></div>`;
}
function foodSheet() {
  const s = ui.sheet;
  const cur = s.id ? (state.food[ui.date] || []).find((i) => i.id === s.id) : null;
  const v = cur || { name: '', meal: guessMeal(), kcal: '', p: '', f: '', c: '' };
  s.recent = cur ? [] : recentFoods();
  return `<h3>${cur ? 'Редагувати запис' : 'Додати їжу'}</h3>
    ${s.recent.length ? `<div class="hint">Нещодавні:</div><div class="chips">${s.recent.map((r, i) => `<button class="chip" data-a="fill" data-i="${i}">${esc(r.name)}</button>`).join('')}</div>` : ''}
    ${field('Назва', 'f-name', v.name, { ph: 'Напр. Вівсянка з бананом' })}
    <div class="field"><label for="f-meal">Прийом їжі</label><select id="f-meal">${MEALS.map(([id, t]) => `<option value="${id}" ${v.meal === id ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="grid2">
      ${field('Калорії, ккал', 'f-kcal', v.kcal, { inputmode: 'decimal', ph: 'авто з БЖУ' })}
      ${field('Білки, г', 'f-p', v.p, { inputmode: 'decimal' })}
      ${field('Жири, г', 'f-f', v.f, { inputmode: 'decimal' })}
      ${field('Вуглеводи, г', 'f-c', v.c, { inputmode: 'decimal' })}
    </div>
    <div class="hint" style="margin-bottom:12px">Якщо калорії не вказано — порахуємо з БЖУ (4/9/4 ккал на грам).</div>
    <button class="btn" data-a="save-food">Зберегти</button>
    ${cur ? '<button class="btn danger" data-a="delete-food">Видалити</button>' : ''}`;
}
function guessMeal() {
  const h = new Date().getHours();
  return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
}
function saveFood() {
  const g = (n) => $('#f-' + n).value;
  const name = g('name').trim();
  if (!name) return toast('Вкажіть назву');
  const p = num(g('p')), f = num(g('f')), c = num(g('c'));
  const kcal = g('kcal').trim() === '' ? Math.round(4 * p + 9 * f + 4 * c) : num(g('kcal'));
  if (kcal <= 0 && p + f + c <= 0) return toast('Вкажіть калорії або БЖУ');
  const item = { id: ui.sheet.id || uid(), name, meal: g('meal'), kcal: Math.round(kcal), p: r1(p), f: r1(f), c: r1(c) };
  const arr = state.food[ui.date] || (state.food[ui.date] = []);
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  persist(); closeSheet(); render(); haptic();
}

/* ---------- STEPS ---------- */
function stepsView() {
  const s = state.steps[ui.date] || 0, goal = state.goals.steps || 10000;
  const pct = Math.min(1, s / goal), C = 2 * Math.PI * 52;
  const stepLen = (state.profile.height || 170) * 0.415 / 100; // metres
  const km = (s * stepLen) / 1000;
  const kcal = s * 0.0005 * (state.profile.weight || 70);
  const days = []; for (let i = 6; i >= 0; i--) days.push(shift(ui.date, -i));
  const vals = days.map((d) => state.steps[d] || 0);
  const max = Math.max(goal, ...vals) * 1.05;
  const avg = vals.reduce((a, b) => a + b, 0) / 7;
  return `<h2>Кроки</h2>${dateNav()}
  <div class="card">
    <div class="ring-wrap"><svg class="ring" viewBox="0 0 120 120">
      <circle class="ring-bg" cx="60" cy="60" r="52"/>
      <circle class="ring-fg" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}" transform="rotate(-90 60 60)"/>
      <text x="60" y="62" font-size="21" font-weight="700">${fmt(s)}</text>
      <text x="60" y="80" font-size="9" style="fill:var(--hint)">із ${fmt(goal)} · ${Math.round(pct * 100)}%</text>
    </svg></div>
    <div class="grid2"><div class="stat"><b>${km.toFixed(1)} км</b><span>≈ відстань</span></div>
      <div class="stat"><b>${fmt(kcal)} ккал</b><span>≈ спалено</span></div></div>
  </div>
  <div class="card">
    <h3>Записати кроки</h3>
    <div class="inline"><input id="stepsInput" type="text" inputmode="numeric" placeholder="Кількість кроків" value="${s || ''}">
      <button class="btn small" data-a="save-steps">Зберегти</button></div>
    <div class="chips"><button class="chip" data-a="add-steps" data-n="1000">+1 000</button>
      <button class="chip" data-a="add-steps" data-n="2500">+2 500</button>
      <button class="chip" data-a="add-steps" data-n="5000">+5 000</button></div>
  </div>
  <div class="card">
    <div class="row"><h3 style="margin:0">Останні 7 днів</h3><span class="hint">середнє ${fmt(avg)}</span></div>
    <div class="chart">
      <div class="goal" style="bottom:${(goal / max) * 100}%"></div>
      ${vals.map((v) => `<div class="col"><div class="b${v >= goal ? ' hit' : ''}" style="height:${(v / max) * 100}%"></div></div>`).join('')}
    </div>
    <div class="labels">${days.map((d) => `<span>${parseKey(d).toLocaleDateString('uk-UA', { weekday: 'short' })}</span>`).join('')}</div>
  </div>`;
}
function setSteps(n) {
  n = Math.max(0, Math.round(n));
  if (n) state.steps[ui.date] = n; else delete state.steps[ui.date];
  persist(); render(); haptic();
}

/* ---------- WORKOUTS ---------- */
function workoutView() {
  const list = state.workouts[ui.date] || [];
  const days = []; for (let i = 6; i >= 0; i--) days.push(shift(ui.date, -i));
  const all = days.flatMap((d) => state.workouts[d] || []);
  const wMin = all.reduce((a, w) => a + w.min, 0), wKcal = all.reduce((a, w) => a + w.kcal, 0);
  let html = `<h2>Тренування</h2>${dateNav()}
  <div class="card"><div class="hint" style="margin-bottom:8px">За останні 7 днів</div>
    <div class="grid3"><div class="stat"><b>${all.length}</b><span>тренувань</span></div>
      <div class="stat"><b>${fmt(wMin)}</b><span>хвилин</span></div>
      <div class="stat"><b>${fmt(wKcal)}</b><span>ккал</span></div></div></div>
  <button class="btn" data-a="add-workout">+ Записати тренування</button>`;
  if (!list.length) html += `<div class="empty">У цей день тренувань немає.<br>Час порухатись 💪</div>`;
  else html += `<div class="meal-title" style="margin-top:16px"><span>${esc(dateLabel(ui.date))}</span></div>` +
    list.map((w) => `<button class="item" data-a="edit-workout" data-id="${w.id}">
      <div><div class="name">${(WTYPES[w.type] || WTYPES['Інше'])[0]} ${esc(w.type)}</div>
      <div class="sub">${w.min} хв${w.note ? ' · ' + esc(w.note) : ''}</div></div>
      <div class="kc">${w.kcal ? fmt(w.kcal) + ' ккал' : ''}</div></button>`).join('');
  return html;
}
function workoutSheet() {
  const s = ui.sheet;
  const cur = s.id ? (state.workouts[ui.date] || []).find((w) => w.id === s.id) : null;
  const v = cur || { type: 'Силове', min: '', kcal: '', note: '' };
  return `<h3>${cur ? 'Редагувати тренування' : 'Нове тренування'}</h3>
    <div class="field"><label for="w-type">Тип</label><select id="w-type">${Object.keys(WTYPES).map((t) => `<option ${v.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="grid2">${field('Тривалість, хв', 'w-min', v.min, { inputmode: 'numeric' })}
      ${field('Калорії, ккал', 'w-kcal', v.kcal, { inputmode: 'numeric', ph: 'авто' })}</div>
    <div class="field"><label for="w-note">Нотатка (вправи, вага, підходи)</label>
      <textarea id="w-note" rows="3" placeholder="Напр. присідання 4×8×80 кг">${esc(v.note)}</textarea></div>
    <div class="hint" style="margin-bottom:12px">Якщо калорії не вказано — оцінимо за типом, часом і вашою вагою.</div>
    <button class="btn" data-a="save-workout">Зберегти</button>
    ${cur ? '<button class="btn danger" data-a="delete-workout">Видалити</button>' : ''}`;
}
function saveWorkout() {
  const type = $('#w-type').value, min = Math.round(num($('#w-min').value));
  if (min <= 0) return toast('Вкажіть тривалість');
  let kcal = $('#w-kcal').value.trim() === '' ? 0 : Math.round(num($('#w-kcal').value));
  if (!kcal) kcal = Math.round(WTYPES[type][1] * (state.profile.weight || 70) * (min / 60));
  const item = { id: ui.sheet.id || uid(), type, min, kcal, note: $('#w-note').value.trim() };
  const arr = state.workouts[ui.date] || (state.workouts[ui.date] = []);
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  persist(); closeSheet(); render(); haptic();
}

/* ---------- PROFILE ---------- */
function calc() {
  const p = state.profile;
  if (!(p.age > 0 && p.height > 0 && p.weight > 0)) return null;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const tdee = bmr * p.activity;
  const kcal = tdee * (p.goal === 'lose' ? 0.85 : p.goal === 'gain' ? 1.1 : 1);
  const prot = p.weight * (p.goal === 'lose' ? 2.0 : p.goal === 'gain' ? 1.8 : 1.6);
  const fat = p.weight * 0.9;
  const carb = Math.max(0, (kcal - 4 * prot - 9 * fat) / 4);
  const bmi = p.weight / Math.pow(p.height / 100, 2);
  return { bmr, tdee, kcal: Math.round(kcal), p: Math.round(prot), f: Math.round(fat), c: Math.round(carb), bmi };
}
function bmiCat(b) { return b < 18.5 ? 'недостатня вага' : b < 25 ? 'норма' : b < 30 ? 'надлишкова вага' : 'ожиріння'; }
function derivedHtml() {
  const c = calc();
  if (!c) return '<div class="hint">Заповніть вік, зріст і вагу, щоб побачити розрахунки.</div>';
  return `<div class="grid3">
      <div class="stat"><b>${c.bmi.toFixed(1)}</b><span>ІМТ · ${bmiCat(c.bmi)}</span></div>
      <div class="stat"><b>${fmt(c.bmr)}</b><span>базовий обмін</span></div>
      <div class="stat"><b>${fmt(c.tdee)}</b><span>витрати/день</span></div></div>
    <div class="hint" style="margin:12px 0 8px">Рекомендація під вашу ціль: <b style="color:var(--text)">${fmt(c.kcal)} ккал</b> · Б ${c.p} · Ж ${c.f} · В ${c.c}</div>
    <button class="btn ghost" data-a="apply-goals">Застосувати до моїх цілей</button>`;
}
function weightChartHtml() {
  const keys = Object.keys(state.weights).sort().slice(-30);
  if (keys.length < 2) return '<div class="hint">Вага записується разом зі зміною параметра. Після кількох записів тут з’явиться графік.</div>';
  const vals = keys.map((k) => state.weights[k]);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const W = 300, H = 90, P = 8;
  const pts = vals.map((v, i) => `${P + (i / (vals.length - 1)) * (W - 2 * P)},${H - P - ((v - min) / span) * (H - 2 * P)}`).join(' ');
  const diff = vals[vals.length - 1] - vals[0];
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:90px"><polyline points="${pts}" fill="none" stroke="var(--btn)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>
    <div class="row hint"><span>${parseKey(keys[0]).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}: ${vals[0]} кг</span>
    <span>${diff > 0 ? '+' : ''}${r1(diff)} кг</span>
    <span>${parseKey(keys[keys.length - 1]).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}: ${vals[vals.length - 1]} кг</span></div>`;
}
function bindField(label, path, value, opts = {}) {
  const { numeric = true, inputmode = 'decimal' } = opts;
  return `<div class="field"><label for="b-${path}">${label}</label>
    <input id="b-${path}" type="text" ${numeric ? `inputmode="${inputmode}" data-num` : ''} data-bind="${path}" value="${esc(value)}"></div>`;
}
function selectBind(label, path, options, value) {
  return `<div class="field"><label for="b-${path}">${label}</label><select id="b-${path}" data-bind="${path}" ${typeof options[0][0] === 'number' ? 'data-num' : ''}>
    ${options.map(([v, t]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
}
function profileView() {
  const p = state.profile, g = state.goals;
  return `<h2>Мої параметри</h2>
  <div class="card">
    ${bindField("Ім’я", 'profile.name', p.name, { numeric: false })}
    <div class="grid2">
      ${selectBind('Стать', 'profile.sex', [['m', 'Чоловіча'], ['f', 'Жіноча']], p.sex)}
      ${bindField('Вік', 'profile.age', p.age, { inputmode: 'numeric' })}
      ${bindField('Зріст, см', 'profile.height', p.height)}
      ${bindField('Вага, кг', 'profile.weight', p.weight)}
    </div>
    ${selectBind('Активність', 'profile.activity', ACTIVITY, p.activity)}
    ${selectBind('Ціль', 'profile.goal', GOALS, p.goal)}
  </div>
  <div class="card" id="derived">${derivedHtml()}</div>
  <div class="card"><h3>Динаміка ваги</h3><div id="wchart">${weightChartHtml()}</div></div>
  <div class="card"><h3>Мої щоденні цілі</h3>
    <div class="grid2">
      ${bindField('Калорії, ккал', 'goals.kcal', g.kcal, { inputmode: 'numeric' })}
      ${bindField('Кроки', 'goals.steps', g.steps, { inputmode: 'numeric' })}
      ${bindField('Білки, г', 'goals.p', g.p)}
      ${bindField('Жири, г', 'goals.f', g.f)}
      ${bindField('Вуглеводи, г', 'goals.c', g.c)}
    </div></div>
  <button class="btn danger" data-a="reset">Видалити всі дані</button>`;
}
function onBind(el) {
  const [grp, key] = el.dataset.bind.split('.');
  const val = el.dataset.num !== undefined ? num(el.value) : el.value;
  state[grp][key] = val;
  if (grp === 'profile' && key === 'weight') {
    if (val > 0) state.weights[todayKey()] = val;
    $('#wchart').innerHTML = weightChartHtml();
  }
  persist();
  if (grp === 'profile') $('#derived').innerHTML = derivedHtml();
}

/* ---------- sheet / toast ---------- */
function openSheet(type, id) { ui.sheet = { type, id }; renderSheet(); }
function closeSheet() { ui.sheet = null; renderSheet(); }
function renderSheet() {
  const el = $('#sheet');
  if (!ui.sheet) { el.innerHTML = ''; return; }
  const body = ui.sheet.type === 'food' ? foodSheet() : workoutSheet();
  el.innerHTML = `<div class="overlay" data-a="close-sheet"></div><div class="sheet"><div class="grab"></div>${body}</div>`;
}
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- render ---------- */
function render() {
  const views = { food: foodView, steps: stepsView, workout: workoutView, profile: profileView };
  $('#view').innerHTML = views[ui.tab]();
  $('#tabs').innerHTML = TABS.map(([id, ic, t]) => `<button data-a="tab" data-id="${id}" class="${ui.tab === id ? 'on' : ''}"><span class="ic">${ic}</span>${t}</button>`).join('');
}

/* ---------- events ---------- */
const actions = {
  tab: (el) => { ui.tab = el.dataset.id; render(); window.scrollTo(0, 0); },
  prev: () => { ui.date = shift(ui.date, -1); render(); },
  next: () => { if (ui.date < todayKey()) { ui.date = shift(ui.date, 1); render(); } },
  today: () => { ui.date = todayKey(); render(); },
  'add-food': () => openSheet('food'),
  'edit-food': (el) => openSheet('food', el.dataset.id),
  'save-food': saveFood,
  'delete-food': () => {
    state.food[ui.date] = (state.food[ui.date] || []).filter((i) => i.id !== ui.sheet.id);
    if (!state.food[ui.date].length) delete state.food[ui.date];
    persist(); closeSheet(); render();
  },
  fill: (el) => {
    const r = ui.sheet.recent[+el.dataset.i]; if (!r) return;
    $('#f-name').value = r.name; $('#f-kcal').value = r.kcal; $('#f-p').value = r.p; $('#f-f').value = r.f; $('#f-c').value = r.c;
  },
  'add-workout': () => openSheet('workout'),
  'edit-workout': (el) => openSheet('workout', el.dataset.id),
  'save-workout': saveWorkout,
  'delete-workout': () => {
    state.workouts[ui.date] = (state.workouts[ui.date] || []).filter((w) => w.id !== ui.sheet.id);
    if (!state.workouts[ui.date].length) delete state.workouts[ui.date];
    persist(); closeSheet(); render();
  },
  'close-sheet': closeSheet,
  'save-steps': () => setSteps(num($('#stepsInput').value)),
  'add-steps': (el) => setSteps((state.steps[ui.date] || 0) + num(el.dataset.n)),
  'apply-goals': () => {
    const c = calc(); if (!c) return;
    Object.assign(state.goals, { kcal: c.kcal, p: c.p, f: c.f, c: c.c });
    persist(); render(); toast('Цілі оновлено ✓'); haptic('medium');
  },
  reset: () => {
    const doReset = () => { state = defaults(); persist(); render(); toast('Дані видалено'); };
    if (tg && tg.showConfirm) tg.showConfirm('Видалити всі дані без можливості відновлення?', (ok) => ok && doReset());
    else if (confirm('Видалити всі дані без можливості відновлення?')) doReset();
  },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (el && actions[el.dataset.a]) actions[el.dataset.a](el);
});
const onInput = (e) => { if (e.target.dataset && e.target.dataset.bind) onBind(e.target); };
document.addEventListener('input', onInput);
document.addEventListener('change', onInput);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'stepsInput') actions['save-steps']();
});

/* ---------- init ---------- */
if (tg) {
  try { tg.ready(); tg.expand(); tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}
  if (!localStorage.getItem(KEY) && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    state.profile.name = tg.initDataUnsafe.user.first_name || '';
  }
}
loadLocal();
render();
cloudLoad();
})();
