"use strict";

const APP_VERSION = "0.2.0";

/* ========= Stockage ========= */

const STORE_KEY = "dbdbuilder.v1";
const UI_KEY = "dbdbuilder.ui";

function emptyState() {
  return { version: 1, builds: [], teams: [], customPerks: [], renames: {} };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyState();
    return Object.assign(emptyState(), JSON.parse(raw));
  } catch (e) {
    console.error(e);
    return emptyState();
  }
}

// Remplace les anciens noms de perks (PERK_ALIASES) dans les builds et les équipes.
// Renvoie le nombre de perks convertis.
function migratePerks(st) {
  let n = 0;
  const fix = (perks) => perks.map((k) => {
    if (k && PERK_ALIASES[k]) { n++; return perks.includes(PERK_ALIASES[k]) ? null : PERK_ALIASES[k]; }
    return k;
  });
  st.builds.forEach((b) => { b.perks = fix(b.perks); });
  st.teams.forEach((t) => t.players.forEach((p) => { p.perks = fix(p.perks); }));
  for (const [old, cur] of Object.entries(PERK_ALIASES)) {
    if (st.renames[old] && !st.renames[cur]) st.renames[cur] = st.renames[old];
    delete st.renames[old];
  }
  return n;
}

let state = loadState();
if (migratePerks(state)) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    toast("Impossible d'enregistrer dans le navigateur. Exporte tes données.");
  }
}

let ui = { q: "", role: "all", killer: "", tag: "", sort: "updated", favOnly: false };
try { Object.assign(ui, JSON.parse(localStorage.getItem(UI_KEY) || "{}")); } catch (e) { /* ignore */ }
function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* ignore */ } }

/* ========= Utilitaires ========= */

const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = (o) => JSON.parse(JSON.stringify(o));

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function norm(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘]/g, "'").toLowerCase();
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), Math.min(8000, Math.max(2200, msg.length * 55)));
}

function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "";
}

/* ========= Perks ========= */

function buildPerkIndex() {
  const idx = new Map();
  for (const [en, fr, cats, flag] of SURVIVOR_PERKS) idx.set(en, { key: en, en, fr, role: "survivor", cats: cats.split(" "), unverified: flag === "?" });
  for (const [en, fr, cats, flag] of KILLER_PERKS) idx.set(en, { key: en, en, fr, role: "killer", cats: cats.split(" "), unverified: flag === "?" });
  for (const c of state.customPerks) idx.set(c.key, { key: c.key, en: "", fr: c.name, role: c.role, cats: [], custom: true });
  return idx;
}
let PERKS = buildPerkIndex();

function perk(key) { return PERKS.get(key); }
function perkName(key) {
  if (!key) return "";
  if (state.renames[key]) return state.renames[key];
  const p = perk(key);
  return p ? p.fr : key;
}
function catsLabel(role) { return role === "killer" ? KILLER_CATEGORIES : SURVIVOR_CATEGORIES; }

/* ========= Recommandations ========= */

function recommend(perks, role, excludeBuildId) {
  const chosen = perks.filter(Boolean);
  const taken = new Set(chosen);
  const scores = new Map(); // key -> {score, reasons[]}
  const add = (key, pts, reason) => {
    if (taken.has(key)) return;
    const p = perk(key);
    if (!p || p.role !== role) return;
    const r = scores.get(key) || { score: 0, reasons: [] };
    r.score += pts;
    r.reasons.push(reason);
    scores.set(key, r);
  };

  for (const k of chosen) {
    for (const [a, b, why] of SYNERGIES) {
      if (a === k) add(b, 3, `${why} (avec ${perkName(k)})`);
      else if (b === k) add(a, 3, `${why} (avec ${perkName(k)})`);
    }
    // Ce que tu associes souvent dans tes propres builds
    const counts = new Map();
    for (const bd of state.builds) {
      if (bd.id === excludeBuildId || bd.role !== role || !bd.perks.includes(k)) continue;
      for (const other of bd.perks) if (other && other !== k) counts.set(other, (counts.get(other) || 0) + 1);
    }
    for (const [other, n] of counts) add(other, n, `Tu l'associes ${n} fois à ${perkName(k)} dans tes builds`);
  }

  return [...scores.entries()]
    .sort((x, y) => y[1].score - x[1].score || perkName(x[0]).localeCompare(perkName(y[0])))
    .slice(0, 8);
}

function warnings(perks) {
  const out = [];
  const exh = perks.filter((k) => k && EXHAUSTION_PERKS.includes(k));
  if (exh.length > 1) out.push(`Plusieurs perks d'épuisement (${exh.map(perkName).join(", ")}) : un seul peut servir à la fois.`);
  const hexes = perks.filter((k) => k && k.startsWith("Hex:"));
  if (perks.includes("Hex: Undying") && hexes.length === 1) out.push("Sort : Immortel n'a d'intérêt qu'avec un autre sort.");
  if (perks.includes("Hex: Pentimento") && perks.includes("Hex: Undying")) out.push("Sort : Repentir a besoin de totems purifiés : Immortel joue contre lui.");
  return out;
}

/* ========= Génération de build ========= */

function synergyPartners(key) {
  return SYNERGIES.flatMap(([a, b]) => (a === key ? [b] : b === key ? [a] : []));
}

function canAdd(key, chosen) {
  if (chosen.includes(key)) return false;
  if (EXHAUSTION_PERKS.includes(key) && chosen.some((k) => EXHAUSTION_PERKS.includes(k))) return false;
  if (key === "Hex: Undying" && !chosen.some((k) => k.startsWith("Hex:"))) return false;
  if ((key === "Hex: Undying" && chosen.includes("Hex: Pentimento")) || (key === "Hex: Pentimento" && chosen.includes("Hex: Undying"))) return false;
  return true;
}

function weightedPick(items, weight) {
  const total = items.reduce((s, x) => s + weight(x), 0);
  let r = Math.random() * total;
  for (const x of items) { r -= weight(x); if (r <= 0) return x; }
  return items[items.length - 1];
}

// Remplit les emplacements non verrouillés avec des perks des catégories choisies.
function generatePerks(role, cats, current, locked) {
  const result = current.map((k, i) => (locked[i] && k ? k : null));
  const free = result.map((k, i) => (k ? -1 : i)).filter((i) => i >= 0);
  const all = [...PERKS.values()].filter((p) => p.role === role && !p.custom);
  // Répartit les catégories sur les emplacements libres, en tournant à partir d'un point aléatoire.
  const start = Math.floor(Math.random() * cats.length);
  free.forEach((slot, n) => {
    const cat = cats[(start + n) % cats.length];
    const chosen = result.filter(Boolean);
    const partners = new Set(chosen.flatMap(synergyPartners));
    const weight = (p) => (partners.has(p.key) ? 5 : 1);
    let pool = all.filter((p) => p.cats.includes(cat) && canAdd(p.key, chosen));
    if (!pool.length) pool = all.filter((p) => p.cats.some((c) => cats.includes(c)) && canAdd(p.key, chosen));
    if (!pool.length) pool = all.filter((p) => canAdd(p.key, chosen));
    if (pool.length) result[slot] = weightedPick(pool, weight).key;
  });
  return result;
}

/* ========= Sélecteur de perks ========= */

const picker = { role: "survivor", taken: new Set(), onPick: null, onRename: null, cat: "" };

function openPicker({ role, taken, onPick, onRename = null }) {
  Object.assign(picker, { role, taken: new Set(taken.filter(Boolean)), onPick, onRename, cat: "" });
  $("#pickerSearch").value = "";
  renderPickerCats();
  renderPickerList();
  $("#picker").showModal();
  $("#pickerSearch").focus();
}

function renderPickerCats() {
  const cats = catsLabel(picker.role);
  const chip = (k, label) => `<button type="button" class="chip ${(picker.cat || "") === k ? "on" : ""}" data-cat="${k}" aria-pressed="${(picker.cat || "") === k}">${esc(label)}</button>`;
  $("#pickerCats").innerHTML = [chip("", "Toutes")]
    .concat(Object.entries(cats).map(([k, v]) => chip(k, v)))
    .join("");
}

function pickerItems() {
  const q = norm($("#pickerSearch").value);
  return [...PERKS.values()]
    .filter((p) => p.role === picker.role)
    .filter((p) => !picker.cat || p.cats.includes(picker.cat))
    .filter((p) => !q || norm(perkName(p.key)).includes(q) || norm(p.fr).includes(q) || norm(p.en).includes(q))
    .sort((a, b) => perkName(a.key).localeCompare(perkName(b.key), "fr"));
}

function renderPickerList() {
  const cats = catsLabel(picker.role);
  const items = pickerItems();
  $("#pickerList").innerHTML = items.length
    ? items.map((p) => `
      <li data-key="${esc(p.key)}" class="${picker.taken.has(p.key) ? "taken" : ""}">
        <button type="button" class="p-pick" ${picker.taken.has(p.key) ? 'disabled title="Déjà dans ce build"' : ""}>
        <span class="p-icon" style="color:${perkVisual(p).color}" data-tip="${esc(p.key)}">${perkIconHtml(p.key)}</span>
        <div class="p-name">${esc(perkName(p.key))}${p.custom ? " <span class='p-cats'>perso</span>" : ""}${p.unverified && !state.renames[p.key] ? ` <span class="p-unverified" title="Nom français absent du site officiel : à vérifier dans le jeu (✎ pour corriger)">non vérifié</span>` : ""}
          <div class="p-en">${esc(p.en)}${p.cats.length ? ` · <span class="p-cats">${p.cats.map((c) => esc(cats[c] || c)).join(", ")}</span>` : ""}</div>
        </div>
        </button>
        <button class="edit" type="button" data-rename="${esc(p.key)}" title="Corriger le nom français" aria-label="Corriger le nom de ${esc(perkName(p.key))}">✎</button>
      </li>`).join("")
    : `<li class="muted">Aucun perk trouvé. Tu peux l'ajouter ci-dessous.</li>`;
  if (!items.length) {
    $(".custom-perk").open = true;
    if (!$("#customName").value) $("#customName").value = $("#pickerSearch").value.trim();
  }
  renderRenamesBar();
}

// Corrections de noms faites avec ✎ (hors perks perso) : elles masquent les noms officiels.
function officialRenames() {
  return Object.keys(state.renames).filter((k) => PERKS.has(k) && !PERKS.get(k).custom);
}

function renderRenamesBar() {
  const keys = officialRenames();
  $("#renamesBar").hidden = !keys.length;
  if (!keys.length) return;
  $("#renamesInfo").textContent = `${keys.length} nom${keys.length > 1 ? "s" : ""} corrigé${keys.length > 1 ? "s" : ""} par toi : `
    + keys.map((k) => `${state.renames[k]} (officiel : ${perk(k).fr})`).join(", ");
}

$("#renamesReset").addEventListener("click", () => {
  const keys = officialRenames();
  if (!keys.length || !confirm(`Effacer tes ${keys.length} correction(s) de noms et revenir aux noms officiels ?`)) return;
  keys.forEach((k) => delete state.renames[k]);
  save();
  renderPickerList();
  toast("Noms officiels rétablis");
  if (picker.onRename) picker.onRename();
});

$("#pickerSearch").addEventListener("input", renderPickerList);
$("#pickerSearch").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const first = pickerItems().find((p) => !picker.taken.has(p.key));
  if (first) choosePerk(first.key);
});
$("#pickerCats").addEventListener("click", (e) => {
  const c = e.target.closest("[data-cat]");
  if (!c) return;
  picker.cat = c.dataset.cat;
  renderPickerCats();
  renderPickerList();
});
$("#pickerList").addEventListener("click", (e) => {
  const ren = e.target.closest("[data-rename]");
  if (ren) {
    const key = ren.dataset.rename;
    const name = prompt("Nom français du perk :", perkName(key));
    if (name === null) return;
    if (name.trim()) state.renames[key] = name.trim();
    else delete state.renames[key];
    save();
    renderPickerList();
    if (picker.onRename) picker.onRename();
    return;
  }
  const li = e.target.closest("li[data-key]");
  if (li && !li.classList.contains("taken")) choosePerk(li.dataset.key);
});
$("#customAdd").addEventListener("click", () => {
  const name = $("#customName").value.trim();
  if (!name) return;
  const official = [...PERKS.values()].find((p) => !p.custom && p.role === picker.role && [perkName(p.key), p.fr, p.en].some((n) => norm(n) === norm(name)));
  if (official) {
    $("#pickerSearch").value = name;
    $("#customName").value = "";
    renderPickerList();
    toast(`« ${perkName(official.key)} » existe déjà dans la liste`);
    return;
  }
  // Un perk perso est propre à un rôle : le même nom peut exister côté survivant et côté tueur.
  const same = state.customPerks.find((c) => c.role === picker.role && norm(c.name) === norm(name));
  let key = same?.key;
  if (!key) {
    key = `custom:${picker.role}:${name}`;
    state.customPerks.push({ key, name, role: picker.role });
    save();
    PERKS = buildPerkIndex();
  }
  $("#customName").value = "";
  choosePerk(key);
});
$("#customName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); $("#customAdd").click(); }
});

function choosePerk(key) {
  $("#picker").close();
  if (picker.onPick) picker.onPick(key);
}

/* ========= Composants ========= */

// Icône officielle si elle existe, sinon l'icône SVG de catégorie (aussi utilisée si l'image ne charge pas).
function perkIconHtml(k) {
  const v = perkVisual(perk(k));
  const img = typeof PERK_IMAGES !== "undefined" && PERK_IMAGES[k];
  return img
    ? `<img class="perk-img" src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-key="${esc(k)}">`
    : v.svg;
}

function diamondHtml(k) {
  if (!k) return `<div class="diamond"><span>+</span></div>`;
  const v = perkVisual(perk(k));
  return `<div class="diamond" style="--c:${v.color}" data-tip="${esc(k)}"><span>${perkIconHtml(k)}</span></div>`;
}

/* ========= Infobulles des perks ========= */

const TIP_SOURCES = {
  "site": "Site officiel (résumé)",
  "wiki-fr": "Wiki officiel (français)",
  "wiki-en": "Wiki officiel (anglais, peut être daté)",
};

function descHtml(text) {
  return text.split("\n").map((line) => {
    let h = esc(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if (/^["“«]/.test(line)) return `<p class="tip-quote">${h}</p>`;
    if (line.startsWith("• ")) return `<p class="tip-bullet">${h.slice(2)}</p>`;
    return `<p>${h}</p>`;
  }).join("");
}

function tipHtml(key) {
  const p = perk(key);
  if (!p) return "";
  const d = typeof PERK_DESCRIPTIONS !== "undefined" && PERK_DESCRIPTIONS[key];
  const cats = catsLabel(p.role);
  return `
    <div class="tip-head">
      <span class="tip-icon">${perkIconHtml(key)}</span>
      <div><strong>${esc(perkName(key))}</strong>${p.en ? `<div class="tip-en">${esc(p.en)}</div>` : ""}</div>
    </div>
    ${p.cats.length ? `<div class="tip-cats">${p.cats.map((c) => esc(cats[c] || c)).join(" · ")}</div>` : ""}
    <div class="tip-desc">${d ? descHtml(d.text) : `<p class="muted">${p.custom ? "Perk perso : pas de description." : "Pas de description disponible."}</p>`}</div>
    ${d ? `<div class="tip-src">Source : ${TIP_SOURCES[d.src] || d.src}</div>` : ""}`;
}

const tip = { el: $("#perkTip"), target: null, pressTimer: null, longPressed: false };

function showTip(target) {
  const key = target.dataset.tip;
  if (!key) return;
  tip.target = target;
  // Une fenêtre modale passe au-dessus de tout : l'infobulle doit être dedans pour rester visible.
  const host = target.closest("dialog") || document.body;
  if (tip.el.parentNode !== host) host.appendChild(tip.el);
  tip.el.innerHTML = tipHtml(key);
  tip.el.hidden = false;
  // Position : sous l'icône si possible, sinon au-dessus ; toujours dans l'écran.
  const r = target.getBoundingClientRect();
  const w = tip.el.offsetWidth, h = tip.el.offsetHeight, m = 12;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(m, Math.min(left, window.innerWidth - w - m));
  let top = r.bottom + 10;
  if (top + h > window.innerHeight - m) top = Math.max(m, r.top - h - 10);
  tip.el.style.left = left + "px";
  tip.el.style.top = top + "px";
}

function hideTip() {
  tip.el.hidden = true;
  tip.target = null;
}

// Souris : survol
document.addEventListener("mouseover", (e) => {
  const t = e.target.closest("[data-tip]");
  if (t && t !== tip.target) showTip(t);
  else if (!t && tip.target && !e.target.closest("#perkTip")) hideTip();
});
document.addEventListener("scroll", hideTip, true);
// Clavier : l'infobulle suit le focus ; Échap la ferme.
document.addEventListener("focusin", (e) => {
  if (!e.target.matches?.(":focus-visible")) return;
  const t = e.target.closest("[data-tip]") || e.target.querySelector("[data-tip]");
  if (t) showTip(t);
});
document.addEventListener("focusout", hideTip);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideTip(); });

// Écran tactile : appui long
document.addEventListener("touchstart", (e) => {
  const t = e.target.closest("[data-tip]");
  tip.longPressed = false;
  if (!t) { hideTip(); return; }
  clearTimeout(tip.pressTimer);
  tip.pressTimer = setTimeout(() => { tip.longPressed = true; showTip(t); }, 450);
}, { passive: true });
document.addEventListener("touchend", () => clearTimeout(tip.pressTimer));
document.addEventListener("touchmove", () => clearTimeout(tip.pressTimer), { passive: true });
// Après un appui long, on n'ouvre pas le sélecteur de perk
document.addEventListener("click", (e) => {
  if (tip.longPressed) { tip.longPressed = false; e.preventDefault(); e.stopPropagation(); }
}, true);
document.addEventListener("contextmenu", (e) => { if (e.target.closest("[data-tip]")) e.preventDefault(); });

// Image qui ne charge pas (hors ligne, lien cassé) : on remet l'icône de catégorie.
document.addEventListener("error", (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains("perk-img")) return;
  const span = document.createElement("span");
  span.className = "perk-fallback";
  span.innerHTML = perkVisual(perk(img.dataset.key)).svg;
  img.replaceWith(span);
}, true);

function slotsHtml(perks, dupes = new Set(), locks = null) {
  return perks.map((k, i) => {
    const name = perkName(k);
    const lockBtn = locks && k
      ? `<button type="button" class="lock ${locks[i] ? "on" : ""}" data-lock="${i}" aria-pressed="${!!locks[i]}" title="${locks[i] ? "Gardé lors d'une nouvelle génération" : "Garder ce perk lors d'une nouvelle génération"}">${locks[i] ? "🔒 gardé" : "🔓 garder"}</button>`
      : "";
    return `
      <div class="perk-slot ${k ? "filled" : ""} ${k && dupes.has(k) ? "dupe" : ""} ${locks && locks[i] && k ? "locked" : ""}">
        <button type="button" class="perk-slot-main" data-slot="${i}" aria-label="${k ? `Perk ${i + 1} : ${esc(name)}, changer` : `Perk ${i + 1} : choisir un perk`}">
          ${diamondHtml(k)}
          <div class="name ${k ? "" : "empty-name"}">${k ? esc(name) : "Choisir un perk"}</div>
        </button>
        ${k ? `<div class="slot-tools">${lockBtn}<button type="button" class="remove" data-clear="${i}" aria-label="Retirer ${esc(name)}">retirer</button></div>` : ""}
      </div>`;
  }).join("");
}

function miniPerks(perks) {
  return `<div class="mini-perks">${perks.map((k) => `
    <div class="mp">${k ? diamondHtml(k) : `<div class="diamond"></div>`}${k ? esc(perkName(k)) : "<span class='muted'>—</span>"}</div>`).join("")}</div>`;
}

function stars(n) { return n ? `<span class="stars" title="${n}/5">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>` : ""; }

function allTags() {
  const seen = new Map();
  state.builds.flatMap((b) => b.tags || []).forEach((t) => { if (!seen.has(norm(t))) seen.set(norm(t), t); });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "fr"));
}

/* ========= Vue : mes builds ========= */

function renderBuilds() {
  // Tueurs déjà joués, sans doublon de casse ni d'accents (« Spirit » = « spirit »).
  const killerMap = new Map();
  state.builds.filter((b) => b.role === "killer" && b.killer).forEach((b) => { if (!killerMap.has(norm(b.killer))) killerMap.set(norm(b.killer), b.killer); });
  const killers = [...killerMap.values()].sort((a, b) => a.localeCompare(b, "fr"));
  const tags = allTags();
  // Un filtre enregistré qui ne correspond plus à rien (build supprimé, renommé, rôle Survivant) est remis à zéro.
  const tagKnown = (t) => tags.some((x) => norm(x) === norm(t));
  const stale = (ui.role === "survivor" && ui.killer) || (ui.killer && !killerMap.has(norm(ui.killer))) || (ui.tag && !tagKnown(ui.tag));
  if (ui.role === "survivor" || (ui.killer && !killerMap.has(norm(ui.killer)))) ui.killer = "";
  if (ui.tag && !tagKnown(ui.tag)) ui.tag = "";
  if (stale) saveUi();
  const app = $("#app");
  app.innerHTML = `
    <div class="toolbar">
      <h1>Mes builds</h1>
      <a class="btn" href="#/new">+ Nouveau build</a>
    </div>
    <div class="filters">
      <input type="search" id="fQ" aria-label="Rechercher un build" placeholder="Chercher (nom, perk, note…)" value="${esc(ui.q)}">
      <select id="fRole" aria-label="Filtrer par rôle">
        <option value="all">Tous les rôles</option>
        <option value="survivor" ${ui.role === "survivor" ? "selected" : ""}>Survivant</option>
        <option value="killer" ${ui.role === "killer" ? "selected" : ""}>Tueur</option>
      </select>
      ${ui.role === "survivor" ? "" : `<select id="fKiller" aria-label="Filtrer par tueur"><option value="">Tous les tueurs</option>${killers.map((k) => `<option ${norm(ui.killer) === norm(k) ? "selected" : ""}>${esc(k)}</option>`).join("")}</select>`}
      <select id="fTag" aria-label="Filtrer par tag"><option value="">Tous les tags</option>${tags.map((t) => `<option ${norm(ui.tag) === norm(t) ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
      <select id="fSort" aria-label="Trier les builds">
        <option value="updated" ${ui.sort === "updated" ? "selected" : ""}>Modifiés récemment</option>
        <option value="fav" ${ui.sort === "fav" ? "selected" : ""}>Favoris d'abord</option>
        <option value="rating" ${ui.sort === "rating" ? "selected" : ""}>Mieux notés</option>
        <option value="name" ${ui.sort === "name" ? "selected" : ""}>Nom (A→Z)</option>
      </select>
    </div>
    <button type="button" class="chip ${ui.favOnly ? "on" : ""}" id="fFav" aria-pressed="${!!ui.favOnly}">★ Favoris seulement</button>
    <span class="count" id="count"></span>
    <div id="cards"></div>`;

  const bind = (id, prop, ev = "change") => $(id).addEventListener(ev, (e) => { ui[prop] = e.target.value; saveUi(); renderCards(); });
  bind("#fQ", "q", "input");
  // Le filtre « tueur » n'existe que pour les rôles Tous / Tueur : on redessine la barre quand le rôle change.
  $("#fRole").addEventListener("change", (e) => { ui.role = e.target.value; if (ui.role === "survivor") ui.killer = ""; saveUi(); renderBuilds(); });
  if ($("#fKiller")) bind("#fKiller", "killer");
  bind("#fTag", "tag");
  bind("#fSort", "sort");
  $("#fFav").addEventListener("click", (e) => { ui.favOnly = !ui.favOnly; e.currentTarget.classList.toggle("on", ui.favOnly); e.currentTarget.setAttribute("aria-pressed", ui.favOnly); saveUi(); renderCards(); });
  $("#count").addEventListener("click", (e) => {
    if (e.target.id !== "resetFilters") return;
    Object.assign(ui, { q: "", role: "all", killer: "", tag: "", favOnly: false });
    saveUi();
    renderBuilds();
  });
  renderCards();
}

function renderCards() {
  const q = norm(ui.q);
  let list = state.builds.filter((b) =>
    (ui.role === "all" || b.role === ui.role) &&
    (!ui.killer || norm(b.killer) === norm(ui.killer)) &&
    (!ui.tag || (b.tags || []).some((t) => norm(t) === norm(ui.tag))) &&
    (!ui.favOnly || b.fav) &&
    (!q || norm([b.name, b.killer, b.notes, b.item !== "Aucun" ? b.item : "", b.power, b.offering, ...(b.addons || []), ...(b.tags || []), ...(b.playstyles || []),
      ...b.perks.map(perkName), ...b.perks.map((k) => perk(k)?.en)].join(" ")).includes(q)));

  const sorters = {
    updated: (a, b) => (b.updated || 0) - (a.updated || 0),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (b.updated || 0) - (a.updated || 0),
    fav: (a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (b.updated || 0) - (a.updated || 0),
    name: (a, b) => a.name.localeCompare(b.name, "fr"),
  };
  list.sort(sorters[ui.sort] || sorters.updated);

  const el = $("#cards");
  const filtering = ui.q || ui.role !== "all" || ui.killer || ui.tag || ui.favOnly;
  $("#count").innerHTML = state.builds.length
    ? `${list.length} build${list.length > 1 ? "s" : ""} sur ${state.builds.length}${filtering ? ` · <button type="button" class="linklike" id="resetFilters">Réinitialiser les filtres</button>` : ""}`
    : "";
  if (!state.builds.length) {
    el.innerHTML = `<div class="empty"><h2>Aucun build pour l'instant</h2><p>Crée ton premier build pour t'en souvenir.</p><a class="btn" href="#/new">Créer un build</a></div>`;
    return;
  }
  if (!list.length) { el.innerHTML = `<div class="empty">Aucun build ne correspond aux filtres.</div>`; return; }

  el.innerHTML = `<div class="cards">${list.map((b) => `
    <article class="card" data-id="${b.id}">
      <div class="card-head">
        <div>
          <div class="card-title">${esc(b.name)}</div>
          <div class="card-meta">${b.role === "killer" ? esc(b.killer || "") : esc(b.item && b.item !== "Aucun" ? b.item : "")} ${stars(b.rating)}</div>
        </div>
        <div class="row">
          <span class="badge ${b.role}">${b.role === "killer" ? "Tueur" : "Survivant"}</span>
          <button class="fav ${b.fav ? "on" : ""}" data-act="fav" title="Favori" aria-label="Favori" aria-pressed="${!!b.fav}">★</button>
        </div>
      </div>
      ${miniPerks(b.perks)}
      ${(b.playstyles || []).length || (b.tags || []).length ? `<div class="chips">${[...(b.playstyles || []), ...(b.tags || []).map((t) => "#" + t)].map((t) => `<span class="chip static">${esc(t)}</span>`).join("")}</div>` : ""}
      ${b.notes ? `<p class="muted" style="font-size:.88rem;margin:.5rem 0 0">${esc(b.notes.length > 140 ? b.notes.slice(0, 140) + "…" : b.notes)}</p>` : ""}
      <div class="card-actions">
        <a class="btn small" href="#/edit/${b.id}">Modifier</a>
        <button class="btn small ghost" data-act="dup">Dupliquer</button>
        <button class="btn small ghost" data-act="copy" title="Copier le build sous forme de texte">Copier en texte</button>
        <button class="btn small ghost" data-act="export" title="Télécharger ce build en JSON">Exporter ce build</button>
        <button class="btn small danger" data-act="del">Supprimer</button>
      </div>
      <div class="card-meta" style="font-size:.75rem;margin-top:.4rem">Modifié le ${fmtDate(b.updated)}</div>
    </article>`).join("")}</div>`;

  el.onclick = (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const b = state.builds.find((x) => x.id === btn.closest(".card").dataset.id);
    if (!b) return;
    const act = btn.dataset.act;
    if (act === "fav") { b.fav = !b.fav; save(); renderCards(); }
    if (act === "dup") {
      const c = clone(b);
      const base = b.name.replace(/ \(copie(?: \d+)?\)$/, "");
      const used = new Set(state.builds.map((x) => x.name));
      let name = `${base} (copie)`;
      for (let n = 2; used.has(name); n++) name = `${base} (copie ${n})`;
      Object.assign(c, { id: uid(), name, created: Date.now(), updated: Date.now(), fav: false });
      state.builds.push(c); save(); toast(`Copie « ${name} » créée : tu modifies la copie`); location.hash = "#/edit/" + c.id;
    }
    if (act === "copy") copyBuild(b);
    if (act === "export") exportBuild(b);
    if (act === "del" && confirm(`Supprimer le build « ${b.name} » ?`)) {
      state.builds = state.builds.filter((x) => x.id !== b.id); save(); renderCards(); toast("Build supprimé");
    }
  };
}

function buildText(b) {
  const lines = [`${b.name} — ${b.role === "killer" ? "Tueur" + (b.killer ? " : " + b.killer : "") : "Survivant"}`];
  lines.push("Perks : " + b.perks.filter(Boolean).map(perkName).join(" / "));
  if (b.role === "survivor" && b.item && b.item !== "Aucun") lines.push("Objet : " + b.item);
  if (b.role === "killer" && b.power) lines.push("Pouvoir : " + b.power);
  const addons = (b.addons || []).filter(Boolean);
  if (addons.length) lines.push("Add-ons : " + addons.join(", "));
  if (b.offering) lines.push("Offrande : " + b.offering);
  if ((b.playstyles || []).length) lines.push("Style : " + b.playstyles.join(", "));
  if ((b.tags || []).length) lines.push("Tags : " + b.tags.map((t) => "#" + t).join(" "));
  if (b.rating) lines.push("Note : " + b.rating + "/5");
  if (b.notes) lines.push("Notes : " + b.notes);
  return lines.join("\n");
}

async function copyBuild(b) {
  try { await navigator.clipboard.writeText(buildText(b)); toast("Build copié"); }
  catch (e) { prompt("Copie ce texte :", buildText(b)); }
}

/* ========= Vue : éditeur ========= */

function newBuild() {
  return {
    id: uid(), name: "", role: "survivor", killer: "", perks: [null, null, null, null],
    item: "Aucun", power: "", addons: ["", ""], offering: "", playstyles: [], tags: [],
    notes: "", rating: 0, fav: false, created: Date.now(), updated: Date.now(),
  };
}

function renderEditor(id) {
  const existing = id && state.builds.find((b) => b.id === id);
  if (id && !existing) { $("#app").innerHTML = `<div class="empty">Build introuvable. <a href="#/builds">Retour</a></div>`; return; }
  const d = existing ? clone(existing) : newBuild();

  $("#app").innerHTML = `
    <div class="toolbar"><h1>${existing ? "Modifier le build" : "Nouveau build"}</h1>
      <div class="role-toggle" id="role" role="group" aria-label="Rôle du build">
        <button type="button" data-role="survivor">Survivant</button>
        <button type="button" data-role="killer">Tueur</button>
      </div>
    </div>
    <div class="editor-grid">
      <div>
        <div class="panel">
          <label class="field"><span>Nom du build *</span><input id="eName" value="${esc(d.name)}" placeholder="ex. Anti-tunnel solo"></label>
          <div id="killerField">
            <label class="field"><span>Tueur joué</span><input id="eKiller" list="killerList" value="${esc(d.killer)}" placeholder="Choisir ou taper un nom"></label>
            <datalist id="killerList">${KILLERS.map((k) => `<option value="${esc(k)}">`).join("")}</datalist>
          </div>
          <div class="row" style="justify-content:space-between;flex-wrap:wrap;margin-top:1.5rem">
            <h2 style="margin:0">Perks</h2>
            <div class="row">
              <button type="button" class="btn ghost small" id="rerollBtn" hidden title="Relancer avec les mêmes catégories">↻ Relancer</button>
              <button type="button" class="btn small" id="genBtn">🎲 Générer</button>
            </div>
          </div>
          <div class="perk-slots" id="slots"></div>
          <div id="warns"></div>
        </div>

        <div class="panel" style="margin-top:1rem">
          <h2 style="margin-top:0">Équipement</h2>
          <div class="grid-3">
            <label class="field" id="itemField"><span>Objet</span>
              <select id="eItem">${(d.item && !SURVIVOR_ITEMS.includes(d.item) ? [...SURVIVOR_ITEMS, d.item] : SURVIVOR_ITEMS).map((i) => `<option ${d.item === i ? "selected" : ""}>${esc(i)}</option>`).join("")}</select>
            </label>
            <label class="field" id="powerField"><span>Pouvoir</span><input id="ePower" value="${esc(d.power)}" placeholder="ex. Piège à ours"></label>
            <label class="field"><span>Add-on 1</span><input id="eAdd0" value="${esc(d.addons[0])}"></label>
            <label class="field"><span>Add-on 2</span><input id="eAdd1" value="${esc(d.addons[1])}"></label>
          </div>
          <label class="field"><span>Offrande</span><input id="eOffering" value="${esc(d.offering)}" placeholder="ex. Bouquet de lys mortuaires"></label>
        </div>

        <div class="panel" style="margin-top:1rem">
          <h2 style="margin-top:0">Notes</h2>
          <div class="field" role="group" aria-label="Style de jeu"><span>Style de jeu</span><div class="chips" id="ePlay"></div></div>
          <label class="field"><span>Tags (séparés par des virgules)</span><input id="eTags" value="${esc(d.tags.join(", "))}" placeholder="ex. solo, soirée, à tester"></label>
          <label class="field"><span>Comment le jouer, points forts, contres</span><textarea id="eNotes">${esc(d.notes)}</textarea></label>
          <div class="row" style="justify-content:space-between;flex-wrap:wrap">
            <div class="stars-input" id="eRating" title="Ton ressenti" role="group" aria-label="Note"></div>
            <button type="button" class="chip" id="eFav" aria-pressed="false">★ Favori</button>
          </div>
        </div>

        <div class="actions-bar">
          <button class="btn" id="saveBtn">Enregistrer</button>
          <a class="btn ghost" href="#/builds" id="eCancel">Annuler</a>
          ${existing ? `<button class="btn ghost" id="copyBtn">Copier en texte</button><button class="btn danger" id="delBtn">Supprimer</button>` : ""}
        </div>
      </div>

      <aside>
        <div class="panel" style="position:sticky;top:80px">
          <h2 style="margin-top:0">Perks recommandés</h2>
          <div id="recos"></div>
        </div>
      </aside>
    </div>

    <dialog id="genDialog" class="gen-dialog">
      <h2 style="margin-top:0">Générer un build</h2>
      <p class="muted">Coche une ou plusieurs catégories : les perks sont répartis entre elles. Les perks gardés (🔒) ne changent pas.</p>
      <div class="chips" id="genCats"></div>
      <div class="actions-bar">
        <button type="button" class="btn" id="genGo">🎲 Générer</button>
        <button type="button" class="btn ghost" id="genCancel">Annuler</button>
      </div>
    </dialog>`;

  const locks = [false, false, false, false];
  let genCats = (ui.genCats && ui.genCats[d.role]) || [];
  let genDraft = [];
  let generated = false;

  const refresh = () => {
    document.querySelectorAll("#role button").forEach((b) => { b.classList.toggle("on", b.dataset.role === d.role); b.setAttribute("aria-pressed", b.dataset.role === d.role); });
    $("#killerField").hidden = d.role !== "killer";
    $("#itemField").hidden = d.role !== "survivor";
    $("#powerField").hidden = d.role !== "killer";
    $("#slots").innerHTML = slotsHtml(d.perks, new Set(), locks);
    $("#rerollBtn").hidden = !generated || !genCats.length;
    $("#warns").innerHTML = warnings(d.perks).map((w) => `<div class="warn">${esc(w)}</div>`).join("");
    const recos = recommend(d.perks, d.role, d.id);
    $("#recos").innerHTML = !d.perks.some(Boolean)
      ? `<p class="muted">Choisis un perk : je te propose ceux qui vont bien avec.</p>`
      : recos.length
        ? `<ul class="reco-list">${recos.map(([k, r]) => `
            <li><div class="reco-text"><strong>${esc(perkName(k))}</strong><div class="reco-why">${r.reasons.map(esc).join("<br>")}</div></div>
            <button class="btn small" data-reco="${esc(k)}" ${d.perks.every(Boolean) ? "disabled title='Les 4 emplacements sont pris'" : ""}>Ajouter</button></li>`).join("")}</ul>`
        : `<p class="muted">Pas de synergie connue pour ces perks. Plus tu enregistres de builds, plus les suggestions s'enrichissent.</p>`;
    $("#ePlay").innerHTML = PLAYSTYLES.map((p) => `<button type="button" class="chip ${d.playstyles.includes(p) ? "on" : ""}" data-play="${esc(p)}" aria-pressed="${d.playstyles.includes(p)}">${esc(p)}</button>`).join("");
    $("#eRating").innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" data-rate="${n}" class="${n <= d.rating ? "on" : ""}" aria-label="${n} étoile${n > 1 ? "s" : ""} sur 5" aria-pressed="${d.rating === n}">★</button>`).join("");
    $("#eFav").classList.toggle("on", d.fav);
    $("#eFav").setAttribute("aria-pressed", d.fav);
  };
  refresh();

  $("#role").addEventListener("click", (e) => {
    const r = e.target.closest("[data-role]")?.dataset.role;
    if (!r || r === d.role) return;
    if (d.perks.some(Boolean) && !confirm("Changer de rôle vide les perks choisis. Continuer ?")) return;
    d.role = r;
    d.perks = [null, null, null, null];
    locks.fill(false);
    genCats = (ui.genCats && ui.genCats[d.role]) || [];
    generated = false;
    refresh();
  });

  const catLabels = () => catsLabel(d.role);
  const runGenerate = () => {
    if (!genCats.length) return;
    d.perks = generatePerks(d.role, genCats, d.perks, locks);
    generated = true;
    const nameInput = $("#eName");
    if (!nameInput.value.trim() || nameInput.dataset.generated === "1") {
      nameInput.value = genCats.map((c) => catLabels()[c]).join(" + ") + " (généré)";
      nameInput.dataset.generated = "1";
    }
    refresh();
  };
  const renderGenCats = () => {
    $("#genCats").innerHTML = Object.entries(catLabels()).map(([k, v]) =>
      `<button type="button" class="chip ${genDraft.includes(k) ? "on" : ""}" data-gcat="${k}" aria-pressed="${genDraft.includes(k)}">${esc(v)}</button>`).join("");
    $("#genGo").disabled = !genDraft.length;
  };
  $("#genBtn").addEventListener("click", () => { genDraft = [...genCats]; renderGenCats(); $("#genDialog").showModal(); });
  $("#genCancel").addEventListener("click", () => $("#genDialog").close());
  $("#genCats").addEventListener("click", (e) => {
    const c = e.target.closest("[data-gcat]")?.dataset.gcat;
    if (!c) return;
    genDraft = genDraft.includes(c) ? genDraft.filter((x) => x !== c) : [...genDraft, c];
    renderGenCats();
  });
  $("#genGo").addEventListener("click", () => {
    genCats = genDraft;
    ui.genCats = Object.assign({}, ui.genCats, { [d.role]: genCats });
    saveUi();
    $("#genDialog").close();
    runGenerate();
  });
  $("#rerollBtn").addEventListener("click", runGenerate);
  $("#eName").addEventListener("input", (e) => { e.target.dataset.generated = ""; });

  $("#slots").addEventListener("click", (e) => {
    const lk = e.target.closest("[data-lock]");
    if (lk) { const i = +lk.dataset.lock; locks[i] = !locks[i]; refresh(); $(`[data-lock="${i}"]`)?.focus(); return; }
    const clr = e.target.closest("[data-clear]");
    if (clr) { const i = +clr.dataset.clear; d.perks[i] = null; locks[i] = false; refresh(); $(`[data-slot="${i}"]`)?.focus(); return; }
    const slot = e.target.closest("[data-slot]");
    if (!slot) return;
    const i = +slot.dataset.slot;
    openPicker({ role: d.role, taken: d.perks.filter((_, j) => j !== i), onPick: (k) => { d.perks[i] = k; refresh(); $(`[data-slot="${i}"]`)?.focus(); }, onRename: refresh });
  });
  $("#recos").addEventListener("click", (e) => {
    const k = e.target.closest("[data-reco]")?.dataset.reco;
    if (!k) return;
    const i = d.perks.indexOf(null);
    if (i >= 0) { d.perks[i] = k; refresh(); }
  });
  $("#ePlay").addEventListener("click", (e) => {
    const p = e.target.closest("[data-play]")?.dataset.play;
    if (!p) return;
    d.playstyles = d.playstyles.includes(p) ? d.playstyles.filter((x) => x !== p) : [...d.playstyles, p];
    refresh();
  });
  $("#eRating").addEventListener("click", (e) => {
    const n = +(e.target.closest("[data-rate]")?.dataset.rate || 0);
    if (!n) return;
    d.rating = d.rating === n ? 0 : n;
    refresh();
  });
  $("#eFav").addEventListener("click", () => { d.fav = !d.fav; refresh(); });

  const collect = () => {
    d.name = $("#eName").value.trim();
    d.killer = $("#eKiller").value.trim();
    d.item = $("#eItem").value;
    d.power = $("#ePower").value.trim();
    d.addons = [$("#eAdd0").value.trim(), $("#eAdd1").value.trim()];
    d.offering = $("#eOffering").value.trim();
    d.tags = [...new Set($("#eTags").value.split(",").map((t) => t.trim()).filter(Boolean))];
    d.notes = $("#eNotes").value.trim();
    if (d.role === "survivor") { d.killer = ""; d.power = ""; } else { d.item = "Aucun"; }
  };

  const initialSnapshot = (collect(), JSON.stringify(d));
  $("#eCancel").addEventListener("click", (e) => {
    collect();
    if (JSON.stringify(d) !== initialSnapshot && !confirm("Abandonner les modifications de ce build ?")) e.preventDefault();
  });

  $("#saveBtn").addEventListener("click", () => {
    collect();
    if (!d.name) { toast("Donne un nom au build"); $("#eName").focus(); return; }
    d.updated = Date.now();
    const i = state.builds.findIndex((b) => b.id === d.id);
    if (i >= 0) state.builds[i] = d; else state.builds.push(d);
    save();
    toast("Build enregistré");
    location.hash = "#/builds";
  });
  $("#copyBtn")?.addEventListener("click", () => { collect(); copyBuild(d); });
  $("#delBtn")?.addEventListener("click", () => {
    if (!confirm(`Supprimer le build « ${existing.name} » ?`)) return;
    state.builds = state.builds.filter((b) => b.id !== d.id);
    save();
    toast("Build supprimé");
    location.hash = "#/builds";
  });
  if (!existing) $("#eName").focus();
}

/* ========= Vue : équipes ========= */

function newTeam() {
  return {
    id: uid(), name: "Nouvelle équipe", notes: "", updated: Date.now(),
    players: [1, 2, 3, 4].map((n) => ({ pseudo: `Joueur ${n}`, perks: [null, null, null, null] })),
  };
}

function renderTeams() {
  const list = [...state.teams].sort((a, b) => b.updated - a.updated);
  $("#app").innerHTML = `
    <div class="toolbar"><h1>Équipes</h1><button class="btn" id="newTeam">+ Nouvelle équipe</button></div>
    <p class="muted">Prépare les builds de 4 survivants côte à côte : le site repère les doublons et les catégories que personne ne couvre.</p>
    ${list.length ? `<div class="cards">${list.map((t) => `
      <article class="card" data-id="${t.id}">
        <div class="card-head"><div class="card-title">${esc(t.name)}</div></div>
        <div class="card-meta">${t.players.map((p) => esc(p.pseudo)).join(" · ")}</div>
        <div class="card-actions">
          <a class="btn small" href="#/team/${t.id}">Ouvrir</a>
          <button class="btn small danger" data-del="${t.id}">Supprimer</button>
        </div>
        <div class="card-meta" style="font-size:.75rem;margin-top:.4rem">Modifiée le ${fmtDate(t.updated)}</div>
      </article>`).join("")}</div>` : `<div class="empty">Aucune équipe enregistrée.</div>`}`;

  $("#newTeam").addEventListener("click", () => {
    const t = newTeam();
    state.teams.push(t);
    save();
    location.hash = "#/team/" + t.id;
  });
  $(".cards")?.addEventListener("click", (e) => {
    const id = e.target.closest("[data-del]")?.dataset.del;
    if (!id) return;
    const t = state.teams.find((x) => x.id === id);
    if (t && confirm(`Supprimer l'équipe « ${t.name} » ?`)) {
      state.teams = state.teams.filter((x) => x.id !== id);
      save();
      renderTeams();
    }
  });
}

function renderTeam(id) {
  const t = state.teams.find((x) => x.id === id);
  if (!t) { $("#app").innerHTML = `<div class="empty">Équipe introuvable. <a href="#/teams">Retour</a></div>`; return; }
  const survBuilds = state.builds.filter((b) => b.role === "survivor").sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const persist = () => { t.updated = Date.now(); save(); };

  $("#app").innerHTML = `
    <div class="toolbar">
      <input id="tName" value="${esc(t.name)}" style="max-width:420px;font:800 1.4rem Cinzel,serif" aria-label="Nom de l'équipe">
      <div class="row">
        <button class="btn" id="tCopy" title="Créer une copie de cette équipe">Dupliquer l'équipe</button>
        <a class="btn ghost" href="#/teams">← Équipes</a>
      </div>
    </div>
    <div class="team-grid" id="cols">${t.players.map((p, i) => `
      <div class="panel team-col" data-col="${i}">
        <input class="pseudo" value="${esc(p.pseudo)}" aria-label="Pseudo du joueur ${i + 1}" style="font-weight:600">
        <select class="load" style="margin-top:.5rem" aria-label="Copier un build dans la colonne du joueur ${i + 1}">
          <option value="">Copier un build ici…</option>
          ${survBuilds.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}
        </select>
        <div class="perk-slots"></div>
        <div class="col-warns"></div>
        <button class="btn small ghost saveAs" type="button">Enregistrer comme build</button>
      </div>`).join("")}</div>
    <div id="teamWarns"></div>
    <div class="grid-2" style="margin-top:1rem">
      <div class="panel">
        <h2 style="margin-top:0">Couverture de l'équipe</h2>
        <div class="table-wrap" id="coverage"></div>
      </div>
      <div class="panel">
        <h2 style="margin-top:0">À combler</h2>
        <div id="gaps"></div>
        <label class="field" style="margin-top:1rem"><span>Notes d'équipe</span><textarea id="tNotes" placeholder="Stratégie, qui fait quoi…">${esc(t.notes)}</textarea></label>
      </div>
    </div>`;

  const refresh = () => {
    const counts = new Map();
    t.players.forEach((p) => new Set(p.perks.filter(Boolean)).forEach((k) => counts.set(k, (counts.get(k) || 0) + 1)));
    const dupes = new Set([...counts].filter(([, n]) => n > 1).map(([k]) => k));

    document.querySelectorAll("#cols .team-col").forEach((col) => {
      const p = t.players[+col.dataset.col];
      $(".perk-slots", col).innerHTML = slotsHtml(p.perks, dupes);
      $(".col-warns", col).innerHTML = warnings(p.perks).map((w) => `<div class="warn">${esc(w)}</div>`).join("");
    });
    $("#teamWarns").innerHTML = dupes.size
      ? `<div class="warn">Perks en double dans l'équipe : ${[...dupes].map(perkName).map(esc).join(", ")}.</div>` : "";

    const cats = Object.entries(SURVIVOR_CATEGORIES);
    const per = t.players.map((p) => p.perks.filter(Boolean).flatMap((k) => perk(k)?.cats || []));
    $("#coverage").innerHTML = `<table class="coverage">
      <thead><tr><th>Catégorie</th>${t.players.map((p) => `<th>${esc(p.pseudo)}</th>`).join("")}<th>Total</th></tr></thead>
      <tbody>${cats.map(([c, label]) => {
        const row = per.map((list) => list.filter((x) => x === c).length);
        const total = row.reduce((a, b) => a + b, 0);
        return `<tr><td>${esc(label)}</td>${row.map((n) => `<td>${n ? "<span class='dot'></span>".repeat(n) : ""}</td>`).join("")}<td class="${total ? "" : "zero"}">${total}</td></tr>`;
      }).join("")}</tbody></table>`;

    const used = new Set(counts.keys());
    const missing = cats.filter(([c]) => !per.some((l) => l.includes(c)));
    $("#gaps").innerHTML = missing.length
      ? missing.map(([c, label]) => {
          const ideas = [...PERKS.values()].filter((p) => p.role === "survivor" && p.cats.includes(c) && !used.has(p.key))
            .slice(0, 4).map((p) => esc(perkName(p.key)));
          return `<p><strong>${esc(label)}</strong> : personne ne le couvre.<br><span class="muted">Idées : ${ideas.join(", ")}</span></p>`;
        }).join("")
      : `<p class="muted">Toutes les catégories sont couvertes par au moins un joueur.</p>`;
  };
  refresh();

  $("#tName").addEventListener("input", (e) => { t.name = e.target.value.trim() || "Équipe"; persist(); });
  $("#tCopy").addEventListener("click", () => {
    const name = prompt("Nom de la copie de l'équipe :", `${t.name} (copie)`);
    if (name === null) return;
    const c = Object.assign(clone(t), { id: uid(), name: name.trim() || `${t.name} (copie)`, updated: Date.now() });
    state.teams.push(c);
    save();
    toast(`Copie « ${c.name} » enregistrée`);
    location.hash = "#/team/" + c.id;
  });
  $("#tNotes").addEventListener("input", (e) => { t.notes = e.target.value; persist(); });
  $("#cols").addEventListener("input", (e) => {
    if (!e.target.classList.contains("pseudo")) return;
    t.players[+e.target.closest("[data-col]").dataset.col].pseudo = e.target.value.trim() || "Joueur";
    persist();
    refresh();
  });
  $("#cols").addEventListener("change", (e) => {
    if (!e.target.classList.contains("load") || !e.target.value) return;
    const b = state.builds.find((x) => x.id === e.target.value);
    const p = t.players[+e.target.closest("[data-col]").dataset.col];
    if (b) { p.perks = [...b.perks]; persist(); refresh(); toast(`Perks de « ${b.name} » copiés (pas de lien avec le build)`); }
    e.target.value = "";
  });
  $("#cols").addEventListener("click", (e) => {
    const col = e.target.closest("[data-col]");
    if (!col) return;
    const p = t.players[+col.dataset.col];
    if (e.target.closest(".saveAs")) {
      if (!p.perks.some(Boolean)) { toast("Aucun perk à enregistrer"); return; }
      const name = prompt("Nom du build :", `${t.name} – ${p.pseudo}`);
      if (!name) return;
      const b = Object.assign(newBuild(), { name: name.trim(), perks: [...p.perks], tags: ["équipe"] });
      state.builds.push(b);
      save();
      toast(`Build « ${b.name} » enregistré dans Mes builds (tag « équipe »)`);
      return;
    }
    const clr = e.target.closest("[data-clear]");
    if (clr) { p.perks[+clr.dataset.clear] = null; persist(); refresh(); return; }
    const slot = e.target.closest("[data-slot]");
    if (!slot) return;
    const i = +slot.dataset.slot;
    openPicker({ role: "survivor", taken: p.perks.filter((_, j) => j !== i), onPick: (k) => { p.perks[i] = k; persist(); refresh(); }, onRename: refresh });
  });
}

/* ========= Export / import ========= */

function download(content, type, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const today = () => new Date().toISOString().slice(0, 10);
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "build";

$("#importBtn").addEventListener("click", () => $("#importInput").click());

$("#exportBtn").addEventListener("click", () => {
  download(JSON.stringify(state, null, 2), "application/json", `dbd-builds-${today()}.json`);
  toast("Sauvegarde téléchargée");
});

// Export d'un seul build : on emporte aussi les perks personnalisés et renommés qu'il utilise.
function exportBuild(b) {
  const keys = new Set(b.perks.filter(Boolean));
  const out = emptyState();
  out.builds = [clone(b)];
  out.customPerks = state.customPerks.filter((c) => keys.has(c.key)).map(clone);
  keys.forEach((k) => { if (state.renames[k]) out.renames[k] = state.renames[k]; });
  download(JSON.stringify(out, null, 2), "application/json", `dbd-build-${slug(b.name)}-${today()}.json`);
  toast("Build téléchargé");
}

// Complète un build ou une équipe importé(e) : un fichier fait à la main ou ancien ne doit pas casser l'éditeur.
function normalizeBuild(b) {
  const out = Object.assign(newBuild(), b);
  const str = (v, d = "") => (typeof v === "string" ? v : d);
  out.name = str(b.name);
  out.killer = str(b.killer);
  out.item = str(b.item, "Aucun") || "Aucun";
  out.power = str(b.power);
  out.offering = str(b.offering);
  out.notes = str(b.notes);
  out.perks = [0, 1, 2, 3].map((i) => (typeof b.perks[i] === "string" ? b.perks[i] : null));
  out.addons = [0, 1].map((i) => str((b.addons || [])[i]));
  out.tags = Array.isArray(b.tags) ? b.tags.filter((t) => typeof t === "string") : [];
  out.playstyles = Array.isArray(b.playstyles) ? b.playstyles.filter((t) => typeof t === "string") : [];
  out.rating = Number.isInteger(b.rating) ? Math.min(5, Math.max(0, b.rating)) : 0;
  out.fav = b.fav === true;
  out.created = Number.isFinite(b.created) ? b.created : Date.now();
  out.updated = Number.isFinite(b.updated) ? b.updated : Date.now();
  return out;
}

function normalizeTeam(t) {
  const out = Object.assign(newTeam(), t);
  out.name = typeof t.name === "string" && t.name ? t.name : "Équipe importée";
  out.notes = typeof t.notes === "string" ? t.notes : "";
  out.updated = Number.isFinite(t.updated) ? t.updated : Date.now();
  out.players = t.players.map((p, i) => Object.assign({}, p, {
    pseudo: typeof p.pseudo === "string" && p.pseudo ? p.pseudo : `Joueur ${i + 1}`,
    perks: [0, 1, 2, 3].map((j) => (typeof p.perks[j] === "string" ? p.perks[j] : null)),
  }));
  return out;
}

// Renvoie un message d'erreur précis, ou null si le fichier est une sauvegarde valide.
function validateImport(data) {
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);
  if (!isObj(data)) return "le fichier n'est pas une sauvegarde DBD Builder";
  if (!Array.isArray(data.builds)) return "liste « builds » absente";
  for (const [i, b] of data.builds.entries()) {
    const where = `build n°${i + 1}`;
    if (!isObj(b)) return `${where} : format invalide`;
    if (typeof b.id !== "string" || !b.id) return `${where} : identifiant manquant`;
    if (typeof b.name !== "string") return `${where} : nom manquant`;
    if (b.role !== "survivor" && b.role !== "killer") return `${where} (${b.name}) : rôle invalide`;
    if (!Array.isArray(b.perks) || b.perks.some((k) => k !== null && typeof k !== "string")) return `${where} (${b.name}) : perks invalides`;
  }
  for (const [i, t] of (data.teams ?? []).entries()) {
    const where = `équipe n°${i + 1}`;
    if (!isObj(t) || typeof t.id !== "string") return `${where} : format invalide`;
    if (!Array.isArray(t.players) || t.players.some((p) => !isObj(p) || !Array.isArray(p.perks))) return `${where} : joueurs invalides`;
  }
  if (data.customPerks != null && (!Array.isArray(data.customPerks) || data.customPerks.some((c) => !c || typeof c.key !== "string"))) return "perks personnalisés invalides";
  if (data.renames != null && !isObj(data.renames)) return "renommages invalides";
  return null;
}

$("#importInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); }
  catch (err) { toast("Fichier invalide : ce n'est pas du JSON"); return; }
  const problem = validateImport(data);
  if (problem) { toast("Import impossible : " + problem); return; }

  const count = (cur, inc, key = "id") => {
    const have = new Set(cur.map((x) => x[key]));
    const added = (inc || []).filter((x) => !have.has(x[key])).length;
    return { added, updated: (inc || []).length - added };
  };
  const merge = (cur, inc, key = "id") => {
    const map = new Map(cur.map((x) => [x[key], x]));
    (inc || []).forEach((x) => map.set(x[key], x));
    return [...map.values()];
  };
  const nb = count(state.builds, data.builds);
  const nt = count(state.teams, data.teams);
  // Les éléments de même identifiant sont remplacés par ceux du fichier : on le dit avant, avec le décompte.
  const overwritten = nb.updated + nt.updated;
  if (overwritten) {
    const localById = new Map([...state.builds, ...state.teams].map((x) => [x.id, x]));
    const newerHere = [...(data.builds || []), ...(data.teams || [])].filter((x) => localById.has(x.id) && (localById.get(x.id).updated || 0) > (x.updated || 0)).length;
    const msg = `${overwritten} élément(s) existant(s) seront remplacés par la version du fichier (${nb.updated} build(s), ${nt.updated} équipe(s)).`
      + (newerHere ? `\n\nAttention : ${newerHere} d'entre eux ont été modifiés plus récemment sur cet appareil que dans le fichier.` : "")
      + "\n\nContinuer l'import ?";
    if (!confirm(msg)) { toast("Import annulé, rien n'a été modifié"); return; }
  }
  data.builds = (data.builds || []).map(normalizeBuild);
  data.teams = (data.teams || []).map(normalizeTeam);
  state.builds = merge(state.builds, data.builds);
  state.teams = merge(state.teams, data.teams);
  state.customPerks = merge(state.customPerks, data.customPerks, "key");
  state.renames = Object.assign({}, state.renames, data.renames);
  migratePerks(state);
  save();
  PERKS = buildPerkIndex();
  const part = (n, label) => (n.added || n.updated) ? `${label} : ${n.added} ajouté(s), ${n.updated} mis à jour` : "";
  const parts = [part(nb, "builds"), part(nt, "équipes")].filter(Boolean);
  toast(parts.length ? "Import terminé — " + parts.join(" · ") : "Import terminé : le fichier ne contient ni build ni équipe");
  route();
});

// CSV pour Google Sheets / Excel : séparateur « ; » (Excel FR), BOM UTF-8 pour les accents.
$("#csvBtn").addEventListener("click", () => {
  if (!state.builds.length) { toast("Aucun build à exporter"); return; }
  // Une cellule qui commence par = + - @ serait interprétée comme une formule : on la neutralise.
  const cell = (v) => {
    let t = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
    return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const head = ["Nom", "Rôle", "Tueur", "Objet", "Pouvoir", "Perk 1", "Perk 2", "Perk 3", "Perk 4",
    "Add-on 1", "Add-on 2", "Offrande", "Styles", "Tags", "Note /5", "Favori", "Notes", "Modifié le"];
  const rows = state.builds.map((b) => [
    b.name, b.role === "killer" ? "Tueur" : "Survivant", b.killer, b.item && b.item !== "Aucun" ? b.item : "", b.power,
    ...[0, 1, 2, 3].map((i) => (b.perks[i] ? perkName(b.perks[i]) : "")),
    (b.addons || [])[0], (b.addons || [])[1], b.offering,
    (b.playstyles || []).join(", "), (b.tags || []).join(", "),
    b.rating || "", b.fav ? "oui" : "", b.notes, b.updated ? new Date(b.updated).toLocaleDateString("sv-SE") : "",
  ]);
  const csv = [head, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  download("\ufeff" + csv, "text/csv;charset=utf-8", `dbd-builds-${today()}.csv`);
  toast("CSV téléchargé");
});

/* ========= Version ========= */

$("#appVersion").textContent = "v" + APP_VERSION;

/* ========= Routeur ========= */

// Une équipe créée puis quittée sans rien y mettre est supprimée, pour ne pas en accumuler.
let lastTeamId = null;
function dropPristineTeam(id) {
  const t = state.teams.find((x) => x.id === id);
  if (!t || t.name !== "Nouvelle équipe" || t.notes) return;
  if (t.players.some((p, i) => p.perks.some(Boolean) || p.pseudo !== `Joueur ${i + 1}`)) return;
  state.teams = state.teams.filter((x) => x.id !== id);
  save();
}

function route() {
  const [, view = "builds", id] = (location.hash || "#/builds").split("/");
  if (lastTeamId && !(view === "team" && id === lastTeamId)) dropPristineTeam(lastTeamId);
  lastTeamId = view === "team" ? id : null;
  const nav = { builds: "builds", new: "new", teams: "teams", team: "teams" }[view] || "builds";
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === nav));
  if (view === "new") renderEditor(null);
  else if (view === "edit") renderEditor(id);
  else if (view === "teams") renderTeams();
  else if (view === "team") renderTeam(id);
  else renderBuilds();
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();
