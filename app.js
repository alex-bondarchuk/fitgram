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

/* ---------- catalog: categories & products ---------- */
const CATS = [
  { id: 'A', letter: 'А', name: 'Вуглеводи: крупи, хліб, картопля', color: '#3b82f6', def: 360 },
  { id: 'B', letter: 'Б', name: 'Білки: м’ясо, риба, яйця', color: '#ef4444', def: 500 },
  { id: 'V', letter: 'В', name: 'Овочі та гриби', color: '#22c55e', def: 120 },
  { id: 'G', letter: 'Г', name: 'Жири та соуси', color: '#eab308', def: 216 },
  { id: 'D', letter: 'Д', name: 'Молочні продукти', color: '#a855f7', def: 261 },
  { id: 'E', letter: 'Е', name: 'Фрукти та ягоди', color: '#ec4899', def: 285 },
  { id: 'Ye', letter: 'Є', name: 'Горіхи та насіння', color: '#6b7280', def: 120 },
  { id: 'Zh', letter: 'Ж', name: 'Вільна категорія', color: '#f97316', def: 440 },
];
// ккал, білки, жири, вуглеводи — на 100 г (або на 1 шт, якщо unit: 'pcs')
const P = (id, cat, name, kcal, p, f, c, extra = {}) => ({ id, cat, name, kcal, p, f, c, ...extra });
const DRY = { note: 'вага сухого продукту' };
const PRODUCTS = [
  P('A1', 'A', 'Бобові', 310, 20, 2, 52, DRY),
  P('A2', 'A', 'Будь-яка крупа', 330, 10, 2, 68, DRY),
  P('A3', 'A', 'Картопля', 77, 2, 0.4, 16.3),
  P('A4', 'A', 'Кукурудза свіжа', 86, 3.3, 1.4, 19),
  P('A5', 'A', 'Лаваш', 240, 8, 1, 49),
  P('A6', 'A', 'Макарони т.с.', 340, 12, 2, 68, DRY),
  P('A7', 'A', 'Рис (не шліфований)', 330, 7.5, 2.5, 70, DRY),
  P('A8', 'A', 'Хлібці', 320, 10, 2, 65),
  P('A9', 'A', 'Цільнозернове борошно', 320, 11, 2, 64),
  P('A10', 'A', 'Цільнозерновий хліб', 250, 9, 3.5, 45),

  P('B1', 'B', 'Куряче або індиче філе', 110, 22, 2.5, 0),
  P('B2', 'B', 'Морепродукти', 100, 20, 1.5, 1),
  P('B3', 'B', 'Печінка', 130, 19, 4, 4),
  P('B4', 'B', 'Риба (від 5% жиру)', 170, 18, 10.5, 0),
  P('B5', 'B', 'Риба (до 5% жиру)', 110, 20, 3, 0),
  P('B6', 'B', 'Телятина', 170, 20, 10, 0),
  P('B7', 'B', 'Яйця (цілі)', 78.5, 6.3, 5.5, 0.5, { unit: 'pcs' }),

  P('V1', 'V', 'Гриби', 20, 3.5, 0.5, 1),
  P('V2', 'V', 'Овочі (квашені також і зелень)', 20, 1.5, 0.2, 3.5),

  P('G1', 'G', 'Авокадо', 160, 2, 15, 4),
  P('G2', 'G', 'Будь-яка олія', 900, 0, 100, 0),
  P('G3', 'G', 'Гірчиця', 65, 5, 3.5, 4),
  P('G4', 'G', 'Кетчуп', 100, 1, 0.2, 23),
  P('G5', 'G', 'Майонез', 600, 1, 65, 2),
  P('G6', 'G', 'Оливки', 115, 1, 11, 4),

  P('D1', 'D', 'Кефір 1%', 42, 3.4, 1, 4.7),
  P('D2', 'D', 'Молоко 1%', 40, 3.3, 1, 4.8),
  P('D3', 'D', 'Несолодкий йогурт 1% жиру', 43, 4, 1, 4.5),
  P('D4', 'D', 'Сир кисломолочний нежирний', 80, 17, 0.5, 1.8),
  P('D5', 'D', 'Сири м’які, тверді, плавлені', 350, 20, 29, 1),
  P('D6', 'D', 'Сметана 15%', 150, 2.6, 15, 3),

  P('E1', 'E', 'Банани, виноград, хурма', 95, 1, 0.3, 22),
  P('E2', 'E', 'Фрукти та ягоди', 50, 0.8, 0.3, 11),

  P('Y1', 'Ye', 'Будь-які горіхи', 600, 16, 54, 14),
  P('Y2', 'Ye', 'Насіння', 600, 20, 52, 14),

  P('Z1', 'Zh', 'Банани, виноград, хурма, манго…', 95, 1, 0.3, 22),
  P('Z2', 'Zh', 'Будь-що (солодощі, снеки, ковбаси…)', 500, 5, 28, 55),
  P('Z3', 'Zh', 'Фрукти та ягоди', 50, 0.8, 0.3, 11),
];

/* ---------- state & storage ---------- */
const KEY = 'fitgram_v1';
const defaults = () => ({
  updatedAt: 0,
  profile: { name: '', sex: 'm', age: 30, height: 175, weight: 75, activity: 1.375, goal: 'maintain' },
  goals: { kcal: CATS.reduce((s, c) => s + c.def, 0), p: 140, f: 70, c: 250, steps: 10000 },
  catKcal: Object.fromEntries(CATS.map((c) => [c.id, c.def])),
  customProducts: [],
  food: {}, steps: {}, workouts: {}, weights: {},
});
let state = defaults();

function merge(base, extra) {
  const out = { ...base, ...extra };
  out.profile = { ...base.profile, ...(extra.profile || {}) };
  out.goals = { ...base.goals, ...(extra.goals || {}) };
  out.catKcal = { ...base.catKcal, ...(extra.catKcal || {}) };
  out.customProducts = Array.isArray(extra.customProducts) ? extra.customProducts : [];
  out.food = {}; // старий формат (список записів) відкидаємо, новий — { id продукту: кількість }
  for (const [k, v] of Object.entries(extra.food || {})) if (v && typeof v === 'object' && !Array.isArray(v)) out.food[k] = v;
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
const ACTIVITY = [[1.2, 'Сидячий (без тренувань)'], [1.375, 'Легка (1–3 тренування/тиждень)'], [1.55, 'Помірна (3–5 тренувань/тиждень)'],
  [1.725, 'Висока (6–7 тренувань/тиждень)'], [1.9, 'Дуже висока (фізична робота + спорт)']];
const GOALS = [['lose', 'Схуднути'], ['maintain', 'Підтримувати вагу'], ['gain', 'Набрати масу']];

const ui = { tab: 'food', date: todayKey(), sheet: null, collapsed: {} };

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

/* ---------- FOOD (category budgets) ---------- */
const allProducts = () => PRODUCTS.concat(state.customProducts);
const prodById = (id) => allProducts().find((p) => p.id === id);
const catById = (id) => CATS.find((c) => c.id === id);
const perOf = (p) => (p.unit === 'pcs' ? 1 : 100);
const unitLbl = (p) => (p.unit === 'pcs' ? 'шт' : 'г');
const kcalOf = (p, a) => (p.kcal * a) / perOf(p);
const macroOf = (p, a, k) => ((p[k] || 0) * a) / perOf(p);
const dayFood = () => state.food[ui.date] || {};
const catBudget = (c) => num(state.catKcal[c.id]);

function catUsed(c, skipId) {
  const day = dayFood();
  return allProducts().reduce((s, p) => s + (p.cat === c.id && p.id !== skipId ? kcalOf(p, day[p.id] || 0) : 0), 0);
}
// скільки всього цього продукту можна з’їсти за день, якщо решта в категорії лишається як є
function maxAmt(p) {
  if (!(p.kcal > 0)) return 0;
  const c = catById(p.cat);
  const left = catBudget(c) - catUsed(c, p.id);
  return Math.max(0, Math.floor((left / p.kcal) * perOf(p) + 1e-9));
}
function dayTotals() {
  const day = dayFood(), t = { kcal: 0, p: 0, f: 0, c: 0 };
  for (const p of allProducts()) {
    const a = day[p.id] || 0;
    if (!a) continue;
    t.kcal += kcalOf(p, a); t.p += macroOf(p, a, 'p'); t.f += macroOf(p, a, 'f'); t.c += macroOf(p, a, 'c');
  }
  return t;
}
// пропорційно розподіляє total ккал між категоріями; залишок округлення йде у найбільшу
function spreadKcal(vals, total) {
  const sum = CATS.reduce((s, c) => s + num(vals[c.id]), 0);
  const out = {}; let acc = 0, big = CATS[0].id;
  for (const c of CATS) {
    out[c.id] = sum > 0 ? Math.round((num(vals[c.id]) * total) / sum) : Math.round(total / CATS.length);
    acc += out[c.id];
    if (out[c.id] > out[big]) big = c.id;
  }
  out[big] += Math.round(total) - acc;
  return out;
}

function foodView() {
  const t = dayTotals(), g = state.goals;
  const budget = CATS.reduce((s, c) => s + catBudget(c), 0);
  const pct = budget > 0 ? Math.min(100, (t.kcal / budget) * 100) : 0;
  const day = dayFood();
  let html = `<h2>Раціон</h2>${dateNav()}
  <div class="card">
    <div class="center"><div class="big">${fmt(t.p)} г</div><div class="hint">білків${g.p ? ` · ціль ${fmt(g.p)} г` : ''}</div></div>
    <div class="row" style="margin-top:14px"><span class="hint">Калорії</span><span><b>${fmt(t.kcal)}</b> / ${fmt(budget)} ккал</span></div>
    <div class="track" style="margin-top:6px"><div class="fill${t.kcal > budget ? ' over' : ''}" style="width:${pct}%"></div></div>
    <div class="hint center" style="margin-top:8px">Жири ${fmt(t.f)} г · Вуглеводи ${fmt(t.c)} г</div>
  </div>
  <button class="btn ghost" data-a="cats-settings" style="margin-bottom:14px">⚙️ Калорії по категоріях</button>`;
  for (const c of CATS) {
    const b = catBudget(c), left = b - catUsed(c), open = !ui.collapsed[c.id];
    const cp = b > 0 ? Math.min(100, ((b - left) / b) * 100) : 0;
    html += `<div class="cat"><button class="cat-head" data-a="toggle-cat" data-id="${c.id}">
      <span class="badge" style="background:${c.color}">${c.letter}</span>
      <span class="cat-info"><span class="cat-name">${esc(c.name)}</span>
        <span class="sub${left < 0 ? ' bad' : ''}">${left >= 0 ? 'залишилось' : 'понад ліміт'} ${fmt(Math.abs(left))} з ${fmt(b)} ккал</span></span>
      <span class="chev">${open ? '▾' : '▸'}</span></button>
      <div class="track thin"><div class="fill${left < 0 ? ' over' : ''}" style="width:${cp}%;${left < 0 ? '' : 'background:' + c.color}"></div></div>`;
    if (open) {
      html += allProducts().filter((p) => p.cat === c.id).map((p) => {
        const a = day[p.id] || 0, mx = maxAmt(p), over = a > mx;
        const sub = a > 0
          ? `з’їдено: ${fmt(kcalOf(p, a))} ккал · ${r1(macroOf(p, a, 'p'))} г білка`
          : `${fmt(kcalOf(p, mx))} ккал · ${r1(macroOf(p, mx, 'p'))} г білка`;
        return `<button class="prow" data-a="open-product" data-id="${p.id}">
          <span class="pname"><span class="name">${esc(p.name)}</span><span class="sub">${sub}</span></span>
          <span class="amt${a > 0 ? ' on' : ''}${over ? ' bad' : ''}">${fmt(a)} / ${fmt(mx)} ${unitLbl(p)}</span></button>`;
      }).join('');
      html += `<button class="addp" data-a="add-custom" data-cat="${c.id}">+ Додати свій продукт</button>`;
    }
    html += '</div>';
  }
  return html;
}

function field(label, id, value, opts = {}) {
  const { type = 'text', inputmode = '', ph = '', attrs = '' } = opts;
  return `<div class="field"><label for="${id}">${label}</label>
    <input id="${id}" type="${type}" ${inputmode ? `inputmode="${inputmode}"` : ''} placeholder="${esc(ph)}" value="${esc(value)}" ${attrs}></div>`;
}

/* --- product sheet (slider + manual input) --- */
function productSheet() {
  const p = prodById(ui.sheet.id), c = catById(p.cat);
  const cur = dayFood()[p.id] || 0, mx = maxAmt(p);
  const step = p.unit === 'pcs' ? 1 : (mx <= 60 ? 1 : 5);
  const smax = Math.max(mx, cur, step);
  ui.sheet.amt = cur;
  const u = unitLbl(p);
  return `<div class="row" style="justify-content:flex-start;gap:10px"><span class="badge" style="background:${c.color}">${c.letter}</span><h3 style="margin:0">${esc(p.name)}</h3></div>
    <div class="hint" style="margin-top:4px">${esc(c.name)}${p.note ? ' · ' + esc(p.note) : ''} · ${r1(p.kcal)} ккал на ${p.unit === 'pcs' ? '1 шт' : '100 г'}</div>
    <div class="center" style="margin:14px 0 6px"><span class="big" id="p-big">${cur}</span> <span class="hint">${u}</span></div>
    <input type="range" id="p-range" class="slider" min="0" max="${smax}" step="${step}" value="${Math.min(cur, smax)}">
    <div class="row hint"><span>0</span><span>макс. ${fmt(mx)} ${u}</span></div>
    <div class="field" style="margin-top:12px"><label for="p-num">Або введіть вручну (${u})</label>
      <input id="p-num" type="text" inputmode="decimal" value="${cur || ''}" placeholder="0"></div>
    <div class="card" id="p-info"></div>
    <button class="btn" data-a="save-product">Зберегти</button>
    ${cur > 0 ? '<button class="btn danger" data-a="clear-product">Скинути</button>' : ''}
    ${p.custom ? '<button class="btn danger" data-a="delete-custom">Видалити продукт</button>' : ''}`;
}
function setProductAmt(v, from) {
  const a = Math.max(0, v);
  ui.sheet.amt = a;
  if (from !== 'range') $('#p-range').value = a;
  if (from !== 'num') $('#p-num').value = a || '';
  updateProductInfo();
}
function updateProductInfo() {
  const s = ui.sheet, p = prodById(s.id), c = catById(p.cat), a = s.amt;
  const left = catBudget(c) - catUsed(c, p.id) - kcalOf(p, a);
  $('#p-big').textContent = String(r1(a));
  $('#p-info').innerHTML = `<div class="grid3">
      <div class="stat"><b>${fmt(kcalOf(p, a))}</b><span>ккал</span></div>
      <div class="stat"><b>${r1(macroOf(p, a, 'p'))}</b><span>білки, г</span></div>
      <div class="stat"><b>${r1(macroOf(p, a, 'f'))} / ${r1(macroOf(p, a, 'c'))}</b><span>жири / вугл., г</span></div></div>
    <div class="hint center${left < 0 ? ' bad' : ''}" style="margin-top:10px">${left >= 0
      ? `У категорії ${c.letter} залишиться ${fmt(left)} ккал`
      : `Понад ліміт категорії ${c.letter} на ${fmt(-left)} ккал`}</div>`;
}
function saveProduct() {
  const a = Math.round(ui.sheet.amt * 10) / 10;
  const day = state.food[ui.date] || (state.food[ui.date] = {});
  if (a > 0) day[ui.sheet.id] = a; else delete day[ui.sheet.id];
  if (!Object.keys(day).length) delete state.food[ui.date];
  persist(); closeSheet(); render(); haptic();
}

/* --- category budgets sheet --- */
function catsSheet() {
  return `<h3>Калорії по категоріях</h3>
    <div class="hint" style="margin-bottom:10px">Вкажіть, скільки ккал на добу виділяєте на кожну категорію — додаток сам порахує, скільки грамів кожного продукту можна з’їсти.</div>
    ${CATS.map((c) => `<div class="catset"><span class="badge" style="background:${c.color}">${c.letter}</span>
      <label for="c-${c.id}">${esc(c.name)}</label>
      <input id="c-${c.id}" data-catin="${c.id}" type="text" inputmode="numeric" value="${catBudget(c)}"></div>`).join('')}
    <div class="row" style="margin:12px 0"><b>Разом на добу</b><b id="c-sum"></b></div>
    <div class="field"><label for="c-total">Розподілити пропорційно на загальну ціль, ккал</label>
      <div class="inline"><input id="c-total" type="text" inputmode="numeric" placeholder="напр. 2200">
        <button class="btn small ghost" data-a="spread-cats">Розподілити</button></div></div>
    <button class="btn" data-a="save-cats">Зберегти</button>`;
}
function readCatInputs() {
  const v = {}; for (const c of CATS) v[c.id] = Math.max(0, Math.round(num($('#c-' + c.id).value)));
  return v;
}
function updateCatSum() {
  const v = readCatInputs();
  $('#c-sum').textContent = fmt(CATS.reduce((s, c) => s + v[c.id], 0)) + ' ккал';
}

/* --- custom product sheet --- */
function customSheet() {
  const c = catById(ui.sheet.cat);
  return `<h3>Новий продукт · ${c.letter}</h3>
    ${field('Назва', 'u-name', '', { ph: 'Напр. Гречка' })}
    <div class="field"><label for="u-unit">Одиниця</label><select id="u-unit"><option value="g">Грами (г)</option><option value="pcs">Штуки (шт)</option></select></div>
    <div class="grid2">
      ${field('Ккал на 100 г / 1 шт', 'u-kcal', '', { inputmode: 'decimal' })}
      ${field('Білки, г', 'u-p', '', { inputmode: 'decimal' })}
      ${field('Жири, г', 'u-f', '', { inputmode: 'decimal' })}
      ${field('Вуглеводи, г', 'u-c', '', { inputmode: 'decimal' })}
    </div>
    <div class="hint" style="margin-bottom:12px">Значення вказуються на 100 г (або на 1 шт, якщо обрано штуки). БЖУ можна не заповнювати.</div>
    <button class="btn" data-a="save-custom">Додати</button>`;
}
function saveCustom() {
  const g = (n) => $('#u-' + n).value;
  const name = g('name').trim(), kcal = num(g('kcal'));
  if (!name) return toast('Вкажіть назву');
  if (kcal <= 0) return toast('Вкажіть калорійність');
  state.customProducts.push({ id: 'u_' + uid(), cat: ui.sheet.cat, name, unit: g('unit'), kcal, p: num(g('p')), f: num(g('f')), c: num(g('c')), custom: true });
  persist(); closeSheet(); render(); toast('Продукт додано ✓');
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
const PLACES = { home: ['🏠', 'Домашнє тренування'], gym: ['🏋️', 'Тренування в залі'] };
const workoutReps = (w) => (w.place === 'home' ? (w.rounds || 0) * (w.reps || 0) : (w.reps || 0));
function workoutView() {
  const list = state.workouts[ui.date] || [];
  const days = []; for (let i = 6; i >= 0; i--) days.push(shift(ui.date, -i));
  const all = days.flatMap((d) => state.workouts[d] || []);
  const reps = all.reduce((a, w) => a + workoutReps(w), 0);
  const home = all.filter((w) => w.place === 'home').length, gym = all.filter((w) => w.place === 'gym').length;
  let html = `<h2>Тренування</h2>${dateNav()}
  <div class="card"><div class="hint" style="margin-bottom:8px">За останні 7 днів</div>
    <div class="grid3"><div class="stat"><b>${all.length}</b><span>тренувань</span></div>
      <div class="stat"><b>${fmt(reps)}</b><span>повторень</span></div>
      <div class="stat"><b>${home} / ${gym}</b><span>вдома / у залі</span></div></div></div>
  <button class="btn" data-a="add-workout">+ Записати тренування</button>`;
  if (!list.length) html += `<div class="empty">У цей день тренувань немає.<br>Час порухатись 💪</div>`;
  else html += `<div class="meal-title" style="margin-top:16px"><span>${esc(dateLabel(ui.date))}</span></div>` +
    list.map((w) => {
      const pl = PLACES[w.place];
      const title = pl ? `${pl[0]} ${pl[1]}` : `⭐ ${esc(w.type || 'Тренування')}`;
      const sub = w.place === 'home' ? `Кругів: ${w.rounds} · Повторень: ${w.reps}`
        : w.place === 'gym' ? `Повторень: ${w.reps}` : `${w.min || 0} хв${w.note ? ' · ' + esc(w.note) : ''}`;
      return `<button class="item" data-a="edit-workout" data-id="${w.id}">
        <div><div class="name">${title}</div><div class="sub">${sub}</div></div>
        <div class="kc">${pl ? workoutReps(w) + ' повт.' : (w.kcal ? fmt(w.kcal) + ' ккал' : '')}</div></button>`;
    }).join('');
  return html;
}
function workoutSheet() {
  const s = ui.sheet;
  const cur = s.id ? (state.workouts[ui.date] || []).find((w) => w.id === s.id) : null;
  const place = cur && cur.place ? cur.place : 'home';
  return `<h3>${cur ? 'Редагувати тренування' : 'Нове тренування'}</h3>
    <div class="field"><label for="w-place">Тип тренування</label>
      <select id="w-place"><option value="home" ${place === 'home' ? 'selected' : ''}>Домашнє</option>
        <option value="gym" ${place === 'gym' ? 'selected' : ''}>У залі</option></select></div>
    <div id="w-rounds-wrap" style="${place === 'home' ? '' : 'display:none'}">${field('Кількість кругів', 'w-rounds', (cur && cur.rounds) || '', { inputmode: 'numeric' })}</div>
    ${field('Кількість повторень', 'w-reps', (cur && cur.reps) || '', { inputmode: 'numeric' })}
    <button class="btn" data-a="save-workout">Зберегти</button>
    ${cur ? '<button class="btn danger" data-a="delete-workout">Видалити</button>' : ''}`;
}
function saveWorkout() {
  const place = $('#w-place').value;
  const reps = Math.round(num($('#w-reps').value)), rounds = Math.round(num($('#w-rounds').value));
  if (place === 'home' && rounds <= 0) return toast('Вкажіть кількість кругів');
  if (reps <= 0) return toast('Вкажіть кількість повторень');
  const item = { id: ui.sheet.id || uid(), place, reps };
  if (place === 'home') item.rounds = rounds;
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
    <button class="btn ghost" data-a="apply-goals">Застосувати (ккал розподіляться по категоріях)</button>`;
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
    <div class="hint" style="margin-bottom:10px">Калорії задаються по категоріях у розділі «Раціон».</div>
    <div class="grid2">
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
function openSheet(type, id, extra) { ui.sheet = { type, id, ...extra }; renderSheet(); }
function closeSheet() { ui.sheet = null; renderSheet(); }
function renderSheet() {
  const el = $('#sheet');
  if (!ui.sheet) { el.innerHTML = ''; return; }
  const builders = { product: productSheet, cats: catsSheet, custom: customSheet, workout: workoutSheet };
  const body = builders[ui.sheet.type]();
  el.innerHTML = `<div class="overlay" data-a="close-sheet"></div><div class="sheet"><div class="grab"></div>${body}</div>`;
  if (ui.sheet.type === 'product') updateProductInfo();
  if (ui.sheet.type === 'cats') updateCatSum();
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
  'toggle-cat': (el) => { ui.collapsed[el.dataset.id] = !ui.collapsed[el.dataset.id]; render(); },
  'open-product': (el) => openSheet('product', el.dataset.id),
  'save-product': saveProduct,
  'clear-product': () => { ui.sheet.amt = 0; saveProduct(); },
  'cats-settings': () => openSheet('cats'),
  'spread-cats': () => {
    const total = Math.round(num($('#c-total').value));
    if (total <= 0) return toast('Вкажіть загальну ціль');
    const out = spreadKcal(readCatInputs(), total);
    for (const c of CATS) $('#c-' + c.id).value = out[c.id];
    updateCatSum();
  },
  'save-cats': () => {
    const v = readCatInputs();
    Object.assign(state.catKcal, v);
    state.goals.kcal = CATS.reduce((s, c) => s + v[c.id], 0);
    persist(); closeSheet(); render(); toast('Збережено ✓');
  },
  'add-custom': (el) => openSheet('custom', null, { cat: el.dataset.cat }),
  'save-custom': saveCustom,
  'delete-custom': () => {
    const id = ui.sheet.id;
    state.customProducts = state.customProducts.filter((p) => p.id !== id);
    for (const k of Object.keys(state.food)) { delete state.food[k][id]; if (!Object.keys(state.food[k]).length) delete state.food[k]; }
    persist(); closeSheet(); render();
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
  'apply-goals': () => {
    const c = calc(); if (!c) return;
    Object.assign(state.goals, { p: c.p, f: c.f, c: c.c });
    state.catKcal = spreadKcal(state.catKcal, c.kcal);
    state.goals.kcal = c.kcal;
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
const onInput = (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.bind) onBind(t);
  else if (t.id === 'p-range') setProductAmt(num(t.value), 'range');
  else if (t.id === 'p-num') setProductAmt(num(t.value), 'num');
  else if (t.id === 'w-place') $('#w-rounds-wrap').style.display = t.value === 'home' ? '' : 'none';
  else if (t.dataset && t.dataset.catin !== undefined) updateCatSum();
};
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
