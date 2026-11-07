// Icônes SVG maison (trait 24×24), affichées dans les losanges de perks.
// Chaque perk prend l'icône de sa première catégorie, sauf ceux qui ont une icône à eux.

const ICONS = {
  // Catégories
  medkit: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M12 10.5v6M9 13.5h6"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="m5.6 5.6 3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6"/>',
  shield: '<path d="M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>',
  eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.3 2 12 2 12s4 7 10 7c1.8 0 3.4-.6 4.8-1.4"/>',
  skull: '<path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 4.5 3 5.5V20h10v-3.5c1.5-1 3-2.5 3-5.5a8 8 0 0 0-8-8z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><path d="M10 20v-2M14 20v-2"/>',
  door: '<path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18"/><circle cx="15" cy="12" r="1"/>',
  bag: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V5h8v3M3 13h18M11 13v2h2v-2"/>',
  hourglass: '<path d="M6 2h12M6 22h12M7 2v3l5 7-5 7v3M17 2v3l-5 7 5 7v3"/>',
  claws: '<path d="M6 3c2.5 6 2.5 12 0 18M12 3c2.5 6 2.5 12 0 18M18 3c2.5 6 2.5 12 0 18"/>',
  hook: '<path d="M12 2v11a4 4 0 1 1-8 0v-1M9 2h6"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 2-5 5-5 8 0 4 3 7 7 7z"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"/>',
  // Icônes propres à certains perks
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  burst: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/><circle cx="12" cy="12" r="2"/>',
  pulse: '<path d="M3 12h4l2-5 4 10 2-5h6"/>',
  speed: '<path d="M3 8h9M3 12h13M3 16h7M15 6l5 6-5 6"/>',
  vault: '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M6 6c3-4 9-4 12 0M16 4l2 2-2.5 1.5"/>',
  dagger: '<path d="M14.5 3.5 20.5 9.5 11 19l-4 1 1-4zM7 17l-4 4M12.5 5.5l6 6"/>',
  rise: '<path d="M12 21V8M7 13l5-5 5 5M5 3h14"/>',
  bandage: '<path d="M4.5 14.5 14.5 4.5a3.5 3.5 0 0 1 5 5l-10 10a3.5 3.5 0 0 1-5-5z"/><path d="M11 11h.01M13 13h.01M11 13h.01M13 11h.01"/>',
  people: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 2-5 5-5s5 2 5 5M11 20c0-3 2-5 5-5s5 2 5 5"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  window: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/>',
  star: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.3 6L12 16.8l-5.4 2.6 1.3-6-4.5-4.1 6-.7z"/>',
  feather: '<path d="M20 4C10 4 5 10 5 19M5 19l4-4M20 4c0 9-6 13-11 11"/>',
  file: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-15-1 9-6 15-15 15zM5 19l7-7"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"/>',
  candle: '<path d="M9 11h6v10H9zM12 11V8M12 3c1.6 1.5 1.6 3 0 4-1.6-1-1.6-2.5 0-4z"/>',
  radar: '<circle cx="12" cy="12" r="2"/><path d="M12 2a10 10 0 0 1 10 10M12 6a6 6 0 0 1 6 6M12 22A10 10 0 0 1 2 12"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  drop: '<path d="M12 3s7 7 7 12a7 7 0 0 1-14 0c0-5 7-12 7-12z"/>',
  waves: '<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>',
  power: '<path d="M12 3v9M7 6a8 8 0 1 0 10 0"/>',
};

const CATEGORY_ICON = {
  survivor: { heal: "medkit", chase: "bolt", gen: "gear", info: "eye", rescue: "lifebuoy", antitunnel: "shield", stealth: "eyeoff", totem: "skull", endgame: "door", item: "bag" },
  killer: { slow: "hourglass", info: "eye", chase: "claws", hook: "hook", hex: "flame", stealth: "eyeoff", endgame: "door" },
};

const CATEGORY_COLOR = {
  survivor: { heal: "#6fbf73", chase: "#ff4a4f", gen: "#e6b84a", info: "#6aa8e8", rescue: "#ef8a3c", antitunnel: "#b9c2cc", stealth: "#a487ea", totem: "#d8cfb8", endgame: "#4fc1b0", item: "#c49a6c" },
  killer: { slow: "#e6b84a", info: "#6aa8e8", chase: "#ff4a4f", hook: "#ef8a3c", hex: "#c06bff", stealth: "#a487ea", endgame: "#4fc1b0" },
};

const PERK_ICON = {
  // Survivants
  "Borrowed Time": "clock", "Dead Hard": "burst", "Adrenaline": "pulse", "Sprint Burst": "speed",
  "Lithe": "vault", "Balanced Landing": "vault", "Decisive Strike": "dagger", "Unbreakable": "rise",
  "Self-Care": "bandage", "Kindred": "people", "Prove Thyself": "people", "Bond": "people",
  "Spine Chill": "alert", "Alert": "alert", "Windows of Opportunity": "window", "Hope": "star",
  "Lightweight": "feather", "Off the Record": "file", "Deliverance": "unlock", "Breakout": "unlock",
  "We'll Make It": "heart", "Empathy": "heart", "Botany Knowledge": "leaf", "Wake Up!": "bell",
  // Tueurs
  "Barbecue & Chilli": "radar", "Lethal Pursuer": "crosshair", "Nowhere to Hide": "crosshair",
  "Pop Goes the Weasel": "burst", "Spirit Fury": "burst", "Brutal Strength": "burst",
  "Bloodhound": "drop", "Sloppy Butcher": "drop", "No Way Out": "lock", "Remember Me": "lock",
  "Blood Warden": "lock", "Whispers": "waves", "I'm All Ears": "waves", "Stridor": "waves",
  "Bamboozle": "window", "Thanatophobia": "skull", "Dead Man's Switch": "power",
};

// Renvoie { svg, color } pour un perk donné (p = entrée de l'index des perks).
function perkVisual(p) {
  if (!p) return { svg: svgIcon("question"), color: "#8a8088" };
  const cat = p.cats[0];
  const color = (CATEGORY_COLOR[p.role] || {})[cat] || "#8a8088";
  let name = PERK_ICON[p.key];
  if (!name && p.key.startsWith("Boon:")) name = "candle";
  if (!name) name = (CATEGORY_ICON[p.role] || {})[cat] || "question";
  return { svg: svgIcon(name), color };
}

function svgIcon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.question}</svg>`;
}
