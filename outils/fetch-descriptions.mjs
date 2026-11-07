// Génère descriptions.js : la description de chaque perk, pour les infobulles.
// Usage (depuis le dossier du projet) : node outils/fetch-descriptions.mjs
//
// Sources, de la plus fiable à la moins fiable :
//   1. site officiel deadbydaylight.com, fiches personnages en français (résumé officiel du perk) ;
//   2. wiki officiel en français (deadbydaylight.fandom.com/fr), bloc « Description » de la page du perk ;
//   3. wiki officiel en anglais, si aucune page française n'est trouvée.
import fs from "node:fs";

const H = { headers: { "User-Agent": "DBDBuilder-perso/1.0 (usage personnel)" } };
const getJson = async (url) => {
  const r = await fetch(url, H);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
};

// Clés de perks du projet
const ctx = {};
new Function("ctx", fs.readFileSync("data.js", "utf8").replace(/^const /gm, "var ") +
  "; ctx.perks = [...SURVIVOR_PERKS, ...KILLER_PERKS];")(ctx);
const keys = ctx.perks.map((p) => p[0]);
const norm = (s) => s.replace(/[’‘]/g, "'").replace(/\s*:\s*/g, ":").toLowerCase().trim();
const alias = { "barbecue & chili": "barbecue & chilli", "hex:blood favor": "hex:blood favour", "hangman's trick": "scourge hook:hangman's trick" };
const byNorm = new Map(keys.map((k) => [norm(k), k]));
const keyOf = (enTitle) => { const n = norm(enTitle); return byNorm.get(alias[n] || n); };

const out = {};

/* ---------- 1. Site officiel ---------- */
function collectChars(json) {
  const chars = new Map();
  (function walk(o) {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") {
      if (o.slug && o.role && o.title) chars.set(o.slug, o);
      Object.values(o).forEach(walk);
    }
  })(json);
  return [...chars.values()];
}
const enList = collectChars(await getJson("https://deadbydaylight.com/page-data/game/characters/page-data.json"));
const frList = collectChars(await getJson("https://deadbydaylight.com/page-data/fr/jeu/personnages/page-data.json"));
const enSlugById = new Map();
for (const c of enList) {
  const pd = (await getJson(`https://deadbydaylight.com/page-data/game/characters/${c.slug}/page-data.json`)).result.data.pageData;
  enSlugById.set(pd.id, pd);
}
for (const c of frList) {
  const fr = (await getJson(`https://deadbydaylight.com/page-data/fr/jeu/personnages/${c.slug}/page-data.json`)).result.data.pageData;
  const loc = (fr.localizations || []).find((l) => l.locale === "en");
  const en = loc && enSlugById.get("Characters_" + loc.id);
  if (!en) continue;
  const skip = fr.role === "killer" ? 1 : 0; // le premier élément d'un tueur est son pouvoir
  en.powerPerks.slice(skip).forEach((p, i) => {
    const key = keyOf(p.title || "");
    const text = (fr.powerPerks[i + skip] || {}).content;
    if (key && text) out[key] = { text: cleanMarkdown(text), src: "site" };
  });
}

function cleanMarkdown(s) {
  return s.replace(/&nbsp;/g, " ").replace(/ /g, " ").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

/* ---------- 2 et 3. Wiki ---------- */
// Extrait le bloc <div class="perkDesc ..."> et le convertit en texte avec **gras** et puces.
function extractDesc(html) {
  const start = html.search(/<div class="perkDesc[ "]/);
  if (start < 0) return null;
  let depth = 0, i = start, end = -1;
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = start;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0][1] === "/" ? -1 : 1;
    if (depth === 0) { end = m.index; break; }
  }
  let h = html.slice(html.indexOf(">", start) + 1, end);
  h = removeBalanced(h, /<span class="tooltiptext/); // texte des infobulles du wiki
  h = h.replace(/<img[^>]*>/g, "")
    .replace(/<(b|strong)[^>]*>/g, "**").replace(/<\/(b|strong)>/g, "**")
    .replace(/<li[^>]*>/g, "\n• ").replace(/<br\s*\/?>/g, "\n").replace(/<\/?p[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#160;|&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));
  return h.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n")
    .replace(/\*\*\*\*/g, "")            // gras vide
    .replace(/\*\*(\s+)\*\*/g, "$1")      // deux gras séparés par un espace : on les fusionne sans coller les mots
    .replace(/ +([.,;)])/g, "$1")
    .replace(/^This description is based on the changes announced[^\n]*?Patch [\d.]+\s*/, "")
    .split("\n").map(fixBold).join("\n").trim();
}
// Parcourt les ** par paires : retire les espaces à l'intérieur du gras, et en ajoute un
// à l'extérieur quand le gras est collé à un mot.
function fixBold(line) {
  const parts = line.split("**");
  if (parts.length % 2 === 0) return line.replace(/\*\*/g, ""); // gras non apparié : on l'enlève
  let s = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    const inner = parts[i].trim();
    let after = parts[i + 1];
    const lead = /\s$/.test(s) || s === "" || /[('"«’/]$/.test(s) ? "" : " ";
    if (after && /^[\p{L}\p{N}]/u.test(after)) after = " " + after;
    s += inner ? `${lead}**${inner}**${after}` : after;
  }
  return s.replace(/ {2,}/g, " ");
}
function removeBalanced(h, openRe) {
  for (;;) {
    const s = h.search(openRe);
    if (s < 0) return h;
    let depth = 0, end = -1;
    const re = /<\/?span\b[^>]*>/g;
    re.lastIndex = s;
    let m;
    while ((m = re.exec(h))) {
      depth += m[0][1] === "/" ? -1 : 1;
      if (depth === 0) { end = m.index + m[0].length; break; }
    }
    if (end < 0) return h;
    h = h.slice(0, s) + " " + h.slice(end);
  }
}
async function wikiDesc(base, title) {
  const r = await getJson(`${base}/api.php?action=parse&format=json&redirects=1&prop=text&page=${encodeURIComponent(title)}`).catch(() => null);
  return r && r.parse ? extractDesc(r.parse.text["*"]) : null;
}

const missing = keys.filter((k) => !out[k]);
for (const k of missing) {
  // Page française : lien interlangue de la page anglaise, sinon recherche par titre
  const q = (await getJson(`https://deadbydaylight.fandom.com/api.php?action=query&format=json&redirects=1&prop=langlinks&lllang=fr&titles=${encodeURIComponent(k)}`)).query;
  const page = Object.values(q.pages)[0];
  let frTitle = page && page.langlinks ? page.langlinks[0]["*"] : null;
  if (!frTitle) {
    const frName = ctx.perks.find((p) => p[0] === k)[1];
    const s = await getJson(`https://deadbydaylight.fandom.com/fr/api.php?action=query&format=json&list=search&srlimit=1&srsearch=${encodeURIComponent(frName)}`);
    const hit = s.query.search[0];
    if (hit && norm(hit.title) === norm(frName)) frTitle = hit.title;
  }
  let text = frTitle ? await wikiDesc("https://deadbydaylight.fandom.com/fr", frTitle) : null;
  if (text) { out[k] = { text, src: "wiki-fr" }; continue; }
  text = await wikiDesc("https://deadbydaylight.fandom.com", (page && page.title) || k);
  if (text) out[k] = { text, src: "wiki-en" };
}

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync("descriptions.js",
  `// Généré par outils/fetch-descriptions.mjs le ${today}. Ne pas modifier à la main : relancer le script.\n` +
  `// src : "site" = site officiel (résumé en français), "wiki-fr" = wiki officiel français, "wiki-en" = wiki anglais.\n` +
  `const PERK_DESCRIPTIONS = ${JSON.stringify(out, null, 1)};\n`);

const count = (s) => Object.values(out).filter((d) => d.src === s).length;
console.log(`site ${count("site")}, wiki-fr ${count("wiki-fr")}, wiki-en ${count("wiki-en")}, total ${Object.keys(out).length}/${keys.length}`);
console.log("sans description :", keys.filter((k) => !out[k]));
