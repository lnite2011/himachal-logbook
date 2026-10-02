(() => {
"use strict";
const cfg = window.TRIP;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $("#app");
const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !/[?&]remote\b/.test(location.search); // ?remote tests the GitHub path locally
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FLAG = ["#2f6fb5", "#f4f4f0", "#d6403a", "#3f9b5e", "#f1c232"]; // blue, white, red, green, yellow
const NS = "http://www.w3.org/2000/svg";

/* ---------- storage ---------- */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: still works, just no offline copy */ } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const TOKEN_KEY = "himachal:key";
const CHAPTERS_KEY = "himachal:chapters"; // set by a shared link: which chapters this guest may see
const ALWAYS = ["summary", "itinerary"]; // the home page is built from these two
const allowed = (() => { try { return JSON.parse(store.get(CHAPTERS_KEY) || "null"); } catch { return null; } })();
const isGuest = !!allowed;
if (allowed) cfg.chapters = cfg.chapters.filter((c) => ALWAYS.includes(c.id) || allowed.includes(c.id));
$$(".tabs a[data-tab]").forEach((a) => { if (a.dataset.tab !== "home" && !cfg.chapters.some((c) => c.id === a.dataset.tab)) a.remove(); });
$(".tabs").style.setProperty("--n", $$(".tabs > *").length);
if (isGuest) $("#drawer-share")?.remove();
const getToken = () => store.get(TOKEN_KEY);

/* ---------- fetching Markdown from GitHub (or local files in dev) ---------- */
class AuthError extends Error {}
class MissingError extends Error {}

const cacheOf = (file) => { try { return JSON.parse(store.get("md:" + file) || "null"); } catch { return null; } };

async function fetchFile(file) {
  const cached = cacheOf(file);
  const r = cfg.repo;
  let url, headers = {};
  if (isLocal) {
    url = `${cfg.localBase}${file}?t=${Date.now()}`;
  } else {
    url = `https://api.github.com/repos/${r.owner}/${r.name}/contents/${r.path}/${file}?ref=${r.ref}`;
    headers = { Accept: "application/vnd.github.raw+json", Authorization: `Bearer ${getToken()}`, "X-GitHub-Api-Version": "2022-11-28" };
    if (cached?.etag) headers["If-None-Match"] = cached.etag;
  }
  const res = await fetch(url, { headers, cache: "no-cache" });
  if (res.status === 304 && cached) return { ...cached, fresh: false };
  if (res.status === 401 || res.status === 403) throw new AuthError(`GitHub answered ${res.status}`);
  if (res.status === 404) throw new MissingError(file);
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const doc = { text: await res.text(), etag: res.headers.get("ETag"), at: Date.now() };
  const changed = !cached || cached.text !== doc.text;
  store.set("md:" + file, JSON.stringify(doc));
  return { ...doc, fresh: changed };
}

const memo = new Map();
/** Resolve with whatever we have fastest (cache), then call onUpdate if GitHub has something newer. */
async function getDoc(file, onUpdate, { force = false } = {}) {
  const cached = cacheOf(file);
  const live = fetchFile(file).catch((e) => { if (e instanceof AuthError || !cached) throw e; return { ...cached, offline: true }; });
  if (cached && !force) {
    live.then((d) => { if (d.fresh && onUpdate) onUpdate(d); }).catch(() => {});
    memo.set(file, cached);
    return { ...cached, stale: true };
  }
  const d = await live;
  memo.set(file, d);
  return d;
}

/* ---------- markdown helpers ---------- */
marked.setOptions({ gfm: true, breaks: false });
const slug = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s/g, "-");
const plain = (md) => md.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`~>]/g, "").replace(/\s+/g, " ").trim();
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clean = (html) => DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
const inline = (md) => clean(marked.parseInline(md));
const chapterByFile = (f) => cfg.chapters.find((c) => c.file.toLowerCase() === f.toLowerCase());

function renderMarkdown(md, { dropH1 = true, sectioned = false, openFirst = 2 } = {}) {
  const box = document.createElement("div");
  box.className = "prose";
  box.innerHTML = clean(marked.parse(md));
  if (dropH1) $("h1", box)?.remove();
  const seen = {};
  $$("h2,h3,h4", box).forEach((h) => {
    let s = slug(h.textContent) || "section";
    if (seen[s]) s += "-" + seen[s]++; else seen[s] = 1;
    h.id = s;
  });
  $$("table", box).forEach((t) => {
    const w = document.createElement("div");
    w.className = "tablewrap";
    t.replaceWith(w); w.append(t);
  });
  $$("a[href]", box).forEach((a) => {
    const href = a.getAttribute("href");
    if (/^https?:|^mailto:|^tel:/.test(href)) { a.target = "_blank"; a.rel = "noopener noreferrer"; return; }
    const [path, hash] = href.split("#");
    if (!path && hash) { a.setAttribute("href", "#"); a.dataset.anchor = hash; return; }
    const ch = chapterByFile(path.replace(/^\.\//, ""));
    if (ch) { a.setAttribute("href", `#/c/${ch.id}${hash ? "?h=" + hash : ""}`); return; }
    a.removeAttribute("href"); // a file that isn't part of the site
    a.classList.add("dead");
  });
  const tone = (el) => {
    const t = el.textContent.trim();
    if (/^(🔴|❌|🚨)/u.test(t)) el.dataset.tone = "alert";
    else if (/^(⚠|🟠|⏳|🌨|🌡)/u.test(t)) el.dataset.tone = "warn";
    else if (/^(✅|🟢|🔒)/u.test(t)) el.dataset.tone = "ok";
  };
  $$("li, p", box).forEach(tone);
  $$("blockquote", box).forEach((b) => b.classList.add("callout"));
  if (sectioned) {
    // each H2 becomes a collapsible card: less wall-of-text, one tap to open
    const kids = [...box.childNodes];
    const out = document.createDocumentFragment();
    let cur = null, n = 0;
    kids.forEach((k) => {
      if (k.nodeType === 1 && k.tagName === "H2") {
        cur = document.createElement("details"); cur.className = "sect"; if (n++ < openFirst) cur.open = true;
        const sm = document.createElement("summary"); sm.append(k); cur.append(sm);
        const body = document.createElement("div"); body.className = "sect-body"; cur.append(body); out.append(cur);
      } else if (cur) cur.lastChild.append(k); else out.append(k);
    });
    box.replaceChildren(out);
    // long sections (e.g. the days) fold again at each H3
    $$(".sect-body", box).forEach((body) => {
      const hs = [...body.children].filter((k) => k.tagName === "H3");
      if (hs.length < 3) return;
      const kids2 = [...body.childNodes], out2 = document.createDocumentFragment();
      let sub = null;
      kids2.forEach((k) => {
        if (k.nodeType === 1 && k.tagName === "H3") {
          sub = document.createElement("details"); sub.className = "sub";
          const sm = document.createElement("summary"); sm.append(k); sub.append(sm);
          const b = document.createElement("div"); b.className = "sub-body"; sub.append(b); out2.append(sub);
        } else if (sub) sub.lastChild.append(k); else out2.append(k);
      });
      body.replaceChildren(out2);
    });
  }
  $$("input[type=checkbox]", box).forEach((i) => i.closest("li")?.classList.add("task", i.checked ? "done" : "open"));
  return box;
}

const sections = (md) => {
  const out = {};
  md.split(/^## /m).slice(1).forEach((s) => { const nl = s.indexOf("\n"); out[s.slice(0, nl).trim()] = s.slice(nl + 1); });
  return out;
};

/* ---------- parsing the trip out of the Markdown ---------- */
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function short(t, n = 74) {
  const one = t.split(/(?<=[.!?])\s/)[0];
  return one.length <= n ? one : one.slice(0, n - 1).replace(/\s+\S*$/, "") + "…";
}

function parseDays(md) {
  const days = [];
  const re = /^###\s+Day\s+(\d+)\s+—\s+(.+)$/gm;
  let m;
  while ((m = re.exec(md))) {
    const head = m[2];
    const after = md.slice(m.index + m[0].length);
    const end = after.search(/^#{2,3}\s/m);
    const body = (end < 0 ? after : after.slice(0, end)).trim();
    const dm = head.match(/^([A-Za-z]{3})\s+(\d+)\s+([A-Za-z]{3})/);
    const alt = head.match(/\(([\d,]+)\s*m\)/);
    const place = head.replace(/^[^·]*·\s*/, "").replace(/\([\d,]+\s*m\)/, "").replace(/\s*—.*$/, "").replace(/[★*]/g, "").trim();
    const note = (head.match(/—\s*(.+)$/) || [])[1];
    const first = body.split(/\n\s*\n|\n(?=[-*] )/)[0] || "";
    days.push({
      n: +m[1], dow: dm?.[1], d: dm ? +dm[2] : null, mon: dm?.[3], place,
      alt: alt ? +alt[1].replace(/,/g, "") : null,
      star: /★/.test(head), note: note ? plain(note) : "",
      blurb: short(plain(first.replace(/^[-*]\s*/, ""))),
      lead: short(plain(first.replace(/^[-*]\s*/, "")), 230),
      bullets: body.split("\n").filter((l) => /^[-*]\s/.test(l)).map((l) => short(plain(l.replace(/^[-*]\s*/, "")), 105)).filter((l) => l.length > 12 && !/^(sleep|✅? ?booked)/i.test(l)).slice(0, 4),
    });
  }
  return days;
}

function parseFacts(md) {
  const facts = [];
  const top = md.split(/^## /m)[0];
  top.split("\n").forEach((l) => {
    const m = l.match(/^- \*\*([^*:]+):\*\*\s*(.*)$/);
    if (m) facts.push({ k: m[1], v: m[2] });
    else if (facts.length && /^\s{2,}\S/.test(l)) facts[facts.length - 1].v += " " + l.trim();
  });
  return facts;
}

function parseDates(whenText) {
  const m = plain(whenText).match(/(\d+)\s*[–-]\s*\w*\s*(\d+)\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[3].slice(0, 3).toLowerCase()];
  return { start: new Date(+m[4], mon, +m[1]), end: new Date(+m[4], mon, +m[2]) };
}

function tripStatus(range, days) {
  if (!range) return "";
  const day = 864e5, now = new Date(), t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const idx = Math.round((t0 - range.start) / day);
  const total = Math.round((range.end - range.start) / day) + 1;
  if (idx < 0) return `${-idx} ${-idx === 1 ? "day" : "days"} to go`;
  if (idx < total) { const d = days.find((x) => x.n === idx + 1); return `Day ${idx + 1} of ${total}${d ? " · " + d.place : ""}`; }
  return "Home again";
}

/* ---------- artwork (drawn in code, so nothing to license) ---------- */
function el(name, attrs = {}, parent) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent?.append(e);
  return e;
}
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }

function ridgePath(seed, W, base, amp, step = 16) {
  const r = rng(seed), p1 = r() * 6, p2 = r() * 6, p3 = r() * 6;
  const f1 = 0.0042 + r() * 0.002, f2 = f1 * 2.7, f3 = f1 * 6.1;
  let d = `M0 600 L0 ${base}`;
  for (let x = 0; x <= W; x += step) {
    const v = 0.58 * (1 - Math.abs(Math.sin(x * f1 + p1))) + 0.3 * (1 - Math.abs(Math.sin(x * f2 + p2))) + 0.12 * Math.sin(x * f3 + p3);
    d += ` L${x} ${(base - amp * v).toFixed(1)}`;
  }
  return d + ` L${W} 600 Z`;
}

function buildScene(host) {
  const W = 1600;
  const layers = [
    { seed: 11, base: 330, amp: 230, color: "#b7addf", snow: true, k: 0.05 },
    { seed: 29, base: 390, amp: 210, color: "#8e86cf", snow: true, k: 0.11 },
    { seed: 47, base: 450, amp: 150, color: "#6c7fc4", snow: false, k: 0.2 },
    { seed: 83, base: 510, amp: 90, color: "#4a8fb5", snow: false, k: 0.32 },
  ];
  host.innerHTML = "";
  // sun-mandala sits behind the far ridge
  const sun = el("svg", { class: "sun", viewBox: "-160 -160 320 320", "aria-hidden": "true" }, host);
  const g = el("g", { class: "mandala" }, sun);
  el("circle", { r: 58, fill: "url(#sunfill)" }, g);
  [[84, 12, 5, 15], [108, 18, 4, 12], [134, 24, 3.5, 10]].forEach(([rad, n, rx, ry], i) => {
    for (let k = 0; k < n; k++) {
      const a = (360 / n) * k + i * 7;
      el("ellipse", { cx: 0, cy: -rad, rx, ry, transform: `rotate(${a})`, fill: "none", stroke: "#fff3c4", "stroke-opacity": 0.9 - i * 0.12, "stroke-width": 1.6 }, g);
    }
  });
  for (let k = 0; k < 60; k++) el("circle", { cx: 0, cy: -150, r: 1.5, fill: "#fff3c4", "fill-opacity": 0.8, transform: `rotate(${k * 6})` }, g);
  const defs = el("defs", {}, sun);
  const rg = el("radialGradient", { id: "sunfill" }, defs);
  el("stop", { offset: 0, "stop-color": "#ffe2a0" }, rg); el("stop", { offset: 1, "stop-color": "#f0a23a" }, rg);

  layers.forEach((L, i) => {
    const s = el("svg", { class: "layer", viewBox: `0 0 ${W} 600`, preserveAspectRatio: "xMidYMax slice", "aria-hidden": "true", style: `--k:${L.k}` }, host);
    if (L.snow) {
      const d = el("defs", {}, s), id = "sn" + i;
      const lg = el("linearGradient", { id, gradientUnits: "userSpaceOnUse", x1: 0, x2: 0, y1: L.base - L.amp, y2: L.base }, d);
      [[0, "#fff"], [0.2, "#fff"], [0.27, L.color], [1, L.color]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, lg));
      el("path", { d: ridgePath(L.seed, W, L.base, L.amp), fill: `url(#${id})` }, s);
    } else {
      el("path", { d: ridgePath(L.seed, W, L.base, L.amp), fill: L.color }, s);
    }
  });
  // foreground hills + pines, in page colour so the hero melts into the page
  const f = el("svg", { class: "layer front", viewBox: `0 0 ${W} 600`, preserveAspectRatio: "xMidYMax slice", "aria-hidden": "true", style: "--k:.45" }, host);
  const r = rng(5);
  for (let i = 0; i < 46; i++) {
    const x = r() * W, y = 560 - Math.abs(Math.sin(x * 0.006)) * 40 - r() * 14, h = 26 + r() * 40;
    const pine = el("g", { fill: i % 3 ? "#2f8a5b" : "#4aa56c", transform: `translate(${x.toFixed(0)} ${y.toFixed(0)})` }, f);
    [[0, 1], [0.28, 0.8], [0.52, 0.6]].forEach(([dy, sc]) => el("path", { d: `M0 ${-h * (1 - dy)} L${(h * 0.36 * sc).toFixed(1)} ${-h * (0.52 - dy * 0.4)} L${(-h * 0.36 * sc).toFixed(1)} ${-h * (0.52 - dy * 0.4)}Z` }, pine));
    el("rect", { x: -1.5, y: -h * 0.12, width: 3, height: h * 0.14 }, pine);
  }
  el("path", { d: ridgePath(131, W, 585, 38, 12), style: "fill:var(--bg)" }, f);
}

function buildFlags(host) {
  host.innerHTML = "";
  const W = host.clientWidth || innerWidth, H = 190;
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true" }, host);
  [{ y0: 14, sag: 74, y1: 52, off: 0, n: 1 }, { y0: 70, sag: 66, y1: 36, off: 2, n: 1 }].forEach((s, si) => {
    const q = (t) => ({ x: -20 * (1 - t) * (1 - t) + 2 * (1 - t) * t * (W / 2) + (W + 20) * t * t, y: (1 - t) * (1 - t) * s.y0 + 2 * (1 - t) * t * (s.y0 + s.sag * 1.7) + t * t * s.y1 });
    let d = ""; for (let t = 0; t <= 1.001; t += 0.02) { const p = q(t); d += (d ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1); }
    el("path", { d, fill: "none", stroke: "rgba(255,255,255,.8)", "stroke-width": 1.4 }, svg);
    const count = Math.floor(W / 30);
    for (let i = 1; i < count; i++) {
      const t = i / count, p = q(t), p2 = q(t + 0.01), ang = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
      const g = el("g", { transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)})` }, svg);
      const f = el("path", { class: "flag", d: "M0 0 H20 L20 18 Q10 22 0 18Z", fill: FLAG[(i + s.off) % 5], style: `animation-delay:${(-((i * 37) % 50) / 10).toFixed(1)}s` }, g);
      if ((i + s.off) % 5 === 1) f.setAttribute("stroke", "rgba(0,0,0,.12)");
    }
  });
}

/* elevation profile = the ridge we'll walk */
function ridgeChart(days) {
  const pts = days.filter((d) => d.alt != null);
  if (pts.length < 2) return null;
  const W = 1000, H = 330, padX = 74, top = 58, bot = 262;
  const maxA = Math.max(4600, ...pts.map((p) => p.alt)); // Kunzum, for the horizon
  const X = (i) => padX + (i * (W - padX * 2)) / (pts.length - 1);
  const Y = (a) => bot - (a / maxA) * (bot - top);
  const P = pts.map((p, i) => ({ ...p, x: X(i), y: Y(p.alt) }));
  let line = `M${P[0].x} ${P[0].y}`;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i - 1] || P[i], b = P[i], c = P[i + 1], d2 = P[i + 2] || c;
    line += ` C${b.x + (c.x - a.x) / 6} ${b.y + (c.y - a.y) / 6} ${c.x - (d2.x - b.x) / 6} ${c.y - (d2.y - b.y) / 6} ${c.x} ${c.y}`;
  }
  const wrap = document.createElement("div");
  wrap.className = "ridge";
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Altitude of each night's sleep, day by day" }, wrap);
  const defs = el("defs", {}, svg);
  const g = el("linearGradient", { id: "rg", x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
  el("stop", { offset: 0, "stop-color": "#fff" }, g); el("stop", { offset: 0.5, "stop-color": "var(--ridge-mid)" }, g); el("stop", { offset: 1, "stop-color": "var(--ridge-low)" }, g);
  [1000, 2000, 3000, 4000].forEach((a) => {
    el("line", { x1: 0, x2: W, y1: Y(a), y2: Y(a), class: "gridline" }, svg);
    const t = el("text", { x: 4, y: Y(a) - 5, class: "gridlbl" }, svg); t.textContent = a.toLocaleString() + " m";
  });
  el("path", { d: `${line} L${P.at(-1).x} ${bot + 30} L${P[0].x} ${bot + 30}Z`, fill: "url(#rg)", class: "ridge-fill" }, svg);
  el("path", { d: line, class: "ridge-line", fill: "none" }, svg);
  const top0 = Math.max(...P.map((p) => p.alt));
  P.forEach((p, i) => {
    const a = el("a", { href: `#day-${p.n}`, class: "peak", tabindex: 0, "aria-label": `Day ${p.n}, ${p.place}, ${p.alt} metres`, "data-day": p.n }, svg);
    el("line", { x1: p.x, x2: p.x, y1: p.y, y2: p.y - 30, class: "pole" }, a);
    el("path", { d: `M${p.x} ${p.y - 30} h18 l-4 6 4 6 h-18Z`, fill: FLAG[i % 5], class: "pflag", style: `animation-delay:${-i * 0.7}s` }, a);
    el("circle", { cx: p.x, cy: p.y, r: 4.5, class: "knot" }, a);
    const lab = el("text", { x: p.x, y: p.y - 40, class: "alt" + (p.alt === top0 ? " top" : ""), "text-anchor": "middle" }, a); lab.textContent = p.alt.toLocaleString();
    const dn = el("text", { x: p.x, y: bot + 22, class: "dn", "text-anchor": "middle" }, a); dn.textContent = "Day " + p.n;
    const pl = el("text", { x: p.x, y: bot + 40, class: "pl", "text-anchor": "middle" }, a); pl.textContent = p.place.replace(/^New /, "").replace(/ base$/, "").split(/\s*[\/,]\s*/)[0];
  });
  return wrap;
}


/* ---------- the trip map: terrain, a route, and an overlay per day ---------- */
let tripMap = null, playTimer = null;
function mapSection() {
  const s = document.createElement("section");
  s.className = "wrap mapsec";
  s.innerHTML = `<h2 class="sec">Where the road goes</h2><p class="sec-sub">Tap a pin for the day, or ride along.</p>
    <div class="mapbox">
      <div id="tmap" role="application" aria-label="Map of the trip"></div>
      <button class="play" id="play" type="button"><span aria-hidden="true">▶</span> Ride along</button>
      <aside class="ov" id="ov" hidden aria-live="polite"></aside>
      <ul class="mkey" aria-hidden="true"><li><i class="k-drive"></i>Drive</li><li><i class="k-side"></i>Day trip</li><li><i class="k-fly"></i>Flight</li></ul>
    </div>
    <p class="map-note">Roads are drawn simply, not turn by turn. Map © OpenStreetMap contributors, SRTM · style © OpenTopoMap (CC-BY-SA).</p>`;
  return s;
}

function initTripMap(days) {
  const box = $("#tmap");
  if (!box) return;
  stopPlay();
  if (tripMap) { tripMap.remove(); tripMap = null; }
  if (!window.L) { box.innerHTML = `<p class="nomap">The map needs a connection. Everything else works offline.</p>`; $("#play")?.remove(); return; }
  const M = cfg.map, byDay = Object.fromEntries(days.map((d) => [d.n, d]));
  const map = (tripMap = L.map(box, { scrollWheelZoom: false, zoomControl: true, attributionControl: false }));
  L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 15, subdomains: "abc" }).addTo(map);
  const STYLE = {
    drive: { color: "#f39a1e", weight: 4, opacity: 0.6, lineCap: "round" },
    side: { color: "#1f8a90", weight: 3, opacity: 0.7, dashArray: "2 8", lineCap: "round" },
    fly: { color: "#c2394a", weight: 3, opacity: 0.7, dashArray: "6 8", lineCap: "round" },
  };
  const lines = M.segments.filter((sg) => byDay[sg.day]).map((sg) => ({ ...sg, line: L.polyline(sg.pts, STYLE[sg.type]).addTo(map) }));
  const dayLoc = {};
  Object.values(M.places).forEach((p) => p.days.forEach((n) => (dayLoc[n] = p)));
  M.sights.filter((x) => byDay[x.day]).forEach((x) => {
    L.marker(x.ll, { icon: L.divIcon({ className: "pinwrap", html: `<span class="tdot"></span>`, iconSize: [14, 14] }), title: x.name })
      .addTo(map).bindTooltip(x.name, { direction: "top", offset: [0, -6] }).on("click", () => select(x.day, true));
  });
  Object.values(M.places).forEach((p) => {
    const ds = p.days.filter((n) => byDay[n]); if (!ds.length) return;
    const label = ds.length > 1 ? `${ds[0]}–${ds.at(-1)}` : `${ds[0]}`;
    L.marker(p.ll, { icon: L.divIcon({ className: "pinwrap", html: `<span class="tpin">${label}</span>`, iconSize: [0, 0] }), title: `${p.name}, day ${label}`, riseOnHover: true })
      .addTo(map).on("click", () => select(ds[0], true));
  });
  const all = [...Object.entries(M.places).filter(([k]) => k !== "delhi").map(([, p]) => p.ll), ...M.sights.map((x) => x.ll)]; // Delhi is far south: it only comes into view on its own day
  map.fitBounds(L.latLngBounds(all).pad(0.08), { maxZoom: 9 });
  const refit = () => { map.invalidateSize(); if (!cur) map.fitBounds(L.latLngBounds(all).pad(0.08), { maxZoom: 9 }); };
  setTimeout(refit, 300); addEventListener("load", refit);

  L.DomEvent.disableClickPropagation($("#ov")); L.DomEvent.disableScrollPropagation($("#ov"));
  L.control.attribution({ prefix: false }).addAttribution("© OSM · SRTM · OpenTopoMap").addTo(map);

  let cur = 0;
  const nums = days.map((d) => d.n).filter((n) => dayLoc[n]);
  function select(n, user) {
    if (user) stopPlay();
    cur = n;
    const d = byDay[n], p = dayLoc[n]; if (!d) return;
    lines.forEach((l) => l.line.setStyle(l.day === n ? { ...STYLE[l.type], weight: 7, opacity: 1, dashArray: l.type === "drive" ? null : STYLE[l.type].dashArray } : { ...STYLE[l.type], opacity: 0.3 }));
    lines.filter((l) => l.day === n).forEach((l) => l.line.bringToFront());
    const pts = lines.filter((l) => l.day === n).flatMap((l) => l.pts); pts.push(p.ll);
    const narrow = box.clientWidth < 700;
    map.flyToBounds(L.latLngBounds(pts).pad(0.35), { duration: reduceMotion ? 0 : 1.1, maxZoom: 10, paddingTopLeft: narrow ? [0, 0] : [380, 0], paddingBottomRight: narrow ? [0, 260] : [0, 0] });
    $$(".peak").forEach((k) => k.classList.toggle("on", +k.dataset.day === n));
    const img = cfg.dayImages[n] || "flags";
    const co = p.days.filter((x) => byDay[x]);
    const i = nums.indexOf(n);
    const ov = $("#ov"); ov.hidden = false;
    ov.innerHTML = `
      <button class="ov-x" type="button" aria-label="Close">×</button>
      <img src="img/${img}.jpg" alt="">
      <div class="ov-b">
        ${co.length > 1 ? `<div class="ov-days">${co.map((x) => `<button type="button" data-d="${x}" class="${x === n ? "on" : ""}">Day ${x}</button>`).join("")}</div>` : ""}
        <p class="ov-when">Day ${d.n} · ${esc([d.dow, d.d, d.mon].filter(Boolean).join(" "))}</p>
        <h3>${esc(d.place)}${d.star ? ' <span class="star">★</span>' : ""}</h3>
        ${d.alt ? `<p class="ov-alt">⛰️ ${d.alt.toLocaleString()} m</p>` : ""}
        ${d.lead ? `<p class="ov-lead">${esc(d.lead)}</p>` : ""}
        ${d.bullets?.length ? `<ul>${d.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` : ""}
        <div class="ov-nav">
          <button type="button" data-step="-1" ${i <= 0 ? "disabled" : ""} aria-label="Previous day">‹</button>
          <a class="btn" href="#/c/itinerary?day=${n}">Read day ${n}</a>
          <button type="button" data-step="1" ${i >= nums.length - 1 ? "disabled" : ""} aria-label="Next day">›</button>
        </div>
      </div>`;
  }
  $("#ov").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.classList.contains("ov-x")) { stopPlay(); cur = 0; $("#ov").hidden = true; lines.forEach((l) => l.line.setStyle(STYLE[l.type])); $$(".peak.on").forEach((k) => k.classList.remove("on")); map.fitBounds(L.latLngBounds(all).pad(0.08), { maxZoom: 9 }); }
    else if (b.dataset.step) select(nums[nums.indexOf(cur) + +b.dataset.step], true);
    else if (b.dataset.d) select(+b.dataset.d, true);
  });
  $("#play").onclick = () => {
    if (playTimer) return stopPlay();
    $("#play").innerHTML = `<span aria-hidden="true">❚❚</span> Pause`;
    let i = nums.indexOf(cur) + 1; if (i <= 0 || i >= nums.length) i = 0;
    const step = () => { if (i >= nums.length) return stopPlay(); select(nums[i++]); };
    step(); playTimer = setInterval(step, 4200);
  };
}
function stopPlay() {
  clearInterval(playTimer); playTimer = null;
  const b = $("#play"); if (b) b.innerHTML = `<span aria-hidden="true">▶</span> Ride along`;
}

/* ---------- views ---------- */
const Chapter = (id) => cfg.chapters.find((c) => c.id === id);

function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#i-${name}"/></svg>`; }

function heroHTML(inner = "") {
  return `<section class="hero" id="hero">
    <div class="scene" id="scene"></div>
    <div class="clouds" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="flags" id="flags"></div>
    <div class="hero-copy">${inner}</div>
  </section>`;
}

function mountHero() {
  buildScene($("#scene"));
  buildFlags($("#flags"));
  onScroll();
}

function gateView(error) {
  app.innerHTML = heroHTML(`
    <p class="om" aria-hidden="true">༄༅།</p>
    <h1 class="title">Himachal</h1>
    <p class="deva" lang="hi">हिमाचल प्रदेश</p>`) + `
    <section class="wrap gate">
      <h2>Psst, this logbook is just for us.</h2>
      <p>Paste a read-only GitHub key to peek inside on this device. It stays in this browser and goes to GitHub, nowhere else.</p>
      <form id="gate-form" autocomplete="off">
        <label for="tok">GitHub key</label>
        <input id="tok" type="password" inputmode="text" autocapitalize="off" spellcheck="false" placeholder="github_pat_…" required>
        <button class="btn" type="submit">Open the logbook</button>
        <p class="gate-err" role="alert" ${error ? "" : "hidden"}>${error ? esc(error) : ""}</p>
      </form>
      <details>
        <summary>How do I get a key?</summary>
        <ol>
          <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub › New fine-grained token</a>.</li>
          <li>Under <em>Repository access</em> choose <em>Only select repositories</em> and pick <strong>${esc(cfg.repo.name)}</strong>.</li>
          <li>Under <em>Permissions › Repository</em> set <strong>Contents</strong> to <em>Read-only</em>. Nothing else.</li>
          <li>Set an expiry after the trip, generate, and paste it above.</li>
        </ol>
      </details>
    </section>`;
  mountHero();
  $("#gate-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const v = $("#tok").value.trim();
    const btn = $("button", e.target); btn.disabled = true; btn.textContent = "Checking…";
    store.set(TOKEN_KEY, v);
    try {
      await fetchFile(cfg.chapters[0].file);
      route();
    } catch (err) {
      store.del(TOKEN_KEY);
      gateView(err instanceof AuthError || err instanceof MissingError
        ? "GitHub refused that key. Check that it hasn’t expired and has Contents: read-only access to " + cfg.repo.name + "."
        : "Couldn’t reach GitHub. Check your connection and try again.");
    }
  });
}

async function homeView() {
  app.innerHTML = heroHTML(`<div class="loading">Unrolling the scroll…</div>`);
  mountHero();
  let sum, itin;
  const rerender = () => homeView();
  try {
    [sum, itin] = await Promise.all([getDoc("summary.md", rerender), getDoc("itinerary.md", rerender)]);
  } catch (e) { return fail(e); }
  const facts = parseFacts(sum.text);
  const days = parseDays(itin.text);
  const title = plain((sum.text.match(/^#\s+(.+)$/m) || [, cfg.name])[1]);
  const [name, ...rest] = title.split(/\s+[—–-]\s+/);
  const tag = rest.join(" · ");
  const when = facts.find((f) => /when/i.test(f.k));
  const range = when && parseDates(when.v);
  const status = tripStatus(range, days);
  const route = facts.find((f) => /route/i.test(f.k));
  const stat = facts.find((f) => /status/i.test(f.k));
  const secs = sections(sum.text);
  const weatherKey = Object.keys(secs).find((k) => /weather/i.test(k));

  $(".hero-copy").innerHTML = `
    <p class="om" aria-hidden="true">༄༅།</p>
    <h1 class="title">${esc(name.replace(/ Pradesh$/, ""))}</h1>
    <p class="deva" lang="hi">हिमाचल प्रदेश</p>
    <p class="tag">${esc(tag)}</p>
    ${status ? `<p class="status"><span class="dot"></span>${esc(status)}</p>` : ""}`;

  const frag = document.createElement("div");
  frag.className = "home";

  // at a glance: a few big numbers instead of paragraphs
  const alts = days.map((d) => d.alt).filter(Boolean);
  const nights = Math.max(0, (range ? Math.round((range.end - range.start) / 864e5) : days.length - 1));
  const monthName = range ? range.start.toLocaleString("en", { month: "short" }) : "";
  const tiles = [
    range && { big: `${range.start.getDate()}–${range.end.getDate()}`, small: `${monthName} ${range.start.getFullYear()}`, ico: "📅" },
    days.length && { big: `${days.length}`, small: `days · ${nights} nights`, ico: "🌄" },
    alts.length && { big: Math.max(...alts).toLocaleString(), small: "metres, the highest we sleep", ico: "🏔️" },
    { big: `${new Set(days.map((d) => d.place.split(/\s*[\/,]\s*/)[0])).size}`, small: "places to wake up in", ico: "📍" },
  ].filter(Boolean);
  frag.insertAdjacentHTML("beforeend", `<section class="wrap glance"><ul class="tiles">${tiles.map((t) => `<li><span class="ico" aria-hidden="true">${t.ico}</span><b>${esc(t.big)}</b><span>${esc(t.small)}</span></li>`).join("")}</ul>${stat ? `<p class="statusline">${inline(short(plain(stat.v), 110))}</p>` : ""}</section>`);

  if (route) {
    const stops = route.v.split("→").map((s) => plain(s));
    frag.insertAdjacentHTML("beforeend", `<section class="wrap route" aria-label="Route"><ol>${stops.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>`);
  }

  // ridge
  const chart = ridgeChart(days);
  if (chart) {
    const s = document.createElement("section");
    s.className = "wrap";
    s.innerHTML = `<h2 class="sec">Up, up and away</h2><p class="sec-sub">Tap a flag to jump to that day.</p>`;
    const sc = document.createElement("div"); sc.className = "ridge-scroll"; sc.append(chart); s.append(sc);
    frag.append(s);
  }

  // the map
  if (cfg.map && days.length) frag.append(mapSection());

  // postcards: the days, photo first
  if (days.length) {
    const s = document.createElement("section");
    s.className = "wrap";
    s.innerHTML = `<h2 class="sec">Our days</h2>
      <ol class="days">${days.map((d) => {
        const key = cfg.dayImages[d.n] || "flags";
        return `<li id="day-${d.n}"><a class="day" href="#/c/itinerary?day=${d.n}">
          <span class="arch"><img src="img/${key}.jpg" alt="" loading="lazy" decoding="async"><span class="stamp">${d.n}</span>${d.alt ? `<span class="alt-chip">${d.alt.toLocaleString()} m</span>` : ""}</span>
          <span class="day-body"><span class="day-when">${esc([d.dow, d.d, d.mon].filter(Boolean).join(" "))}</span>
          <strong>${esc(d.place)}${d.star ? ' <span class="star" title="Key day">★</span>' : ""}</strong>
          ${d.blurb ? `<span class="day-blurb">${esc(d.blurb)}</span>` : ""}</span></a></li>`;
      }).join("")}</ol>`;
    frag.append(s);
  }

  // photo strip
  if (cfg.gallery?.length) {
    const s = document.createElement("section");
    s.className = "strip";
    s.innerHTML = `<div class="wrap"><h2 class="sec">Along the way</h2></div>
      <div class="strip-row">${cfg.gallery.map((g) => `<figure><img src="img/${g.img}.jpg" alt="${esc(g.cap)}" loading="lazy" decoding="async"><figcaption>${esc(g.cap)}</figcaption></figure>`).join("")}</div>`;
    frag.append(s);
  }

  // weather: one line up top, the detail one tap away
  if (weatherKey) {
    const s = document.createElement("section");
    s.className = "wrap";
    const box = renderMarkdown("## x\n" + secs[weatherKey], { dropH1: false });
    $("h2", box)?.remove();
    const lead = $("p", box); const headline = lead ? short(lead.textContent, 120) : "";
    s.innerHTML = `<h2 class="sec">Sky report</h2>`;
    const d = document.createElement("details"); d.className = "frost sky";
    d.innerHTML = `<summary><span class="snowflake" aria-hidden="true">❄️</span><span>${esc(headline)}</span><em>Details</em></summary>`;
    d.append(box); s.append(d); frag.append(s);
  }

  // chapters: photo tiles
  const grid = document.createElement("section");
  grid.className = "wrap";
  grid.innerHTML = `<h2 class="sec">Pick a chapter</h2><ul class="chapters">${cfg.chapters.map((c) => `
    <li><a href="#/c/${c.id}" style="--img:url('img/${c.img}.jpg')"><span class="ch-ico">${icon(c.icon)}</span><strong>${esc(c.title)}</strong></a></li>`).join("")}</ul>`;
  frag.append(grid);
  frag.append(footer(Math.max(sum.at, itin.at), sum.offline));
  app.append(frag);
  initTripMap(days);
  setActiveTab("home");
  document.title = `${name} · trip logbook`;
}

function footer(at, offline) {
  const f = document.createElement("footer");
  f.className = "foot wrap";
  f.innerHTML = `<p>${offline ? "Offline: showing the last copy saved on this device. " : ""}Content updated from GitHub ${ago(at)}. Edit the notes, push, and this page follows.</p>
    <p><a href="#/credits">Photo credits</a> · Drawn in code: mountains, flags and mandala.</p>`;
  return f;
}

const ago = (t) => {
  if (!t) return "just now";
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

async function chapterView(id, query) {
  const ch = Chapter(id);
  if (!ch) return notFound();
  app.innerHTML = `<div class="loading page-load">Unrolling the scroll…</div>`;
  let doc;
  const rerender = () => chapterView(id, query);
  try { doc = await getDoc(ch.file, rerender); } catch (e) {
    if (e instanceof MissingError) return missing(ch);
    return fail(e);
  }
  const h1 = (doc.text.match(/^#\s+(.+)$/m) || [, ch.title])[1];
  const i = cfg.chapters.indexOf(ch), prev = cfg.chapters[i - 1], next = cfg.chapters[i + 1];
  const prose = renderMarkdown(doc.text, { sectioned: true });
  const heads = $$("h2, h3", prose);
  const toc = heads.map((h) => `<li class="${h.tagName.toLowerCase()}"><a href="#" data-anchor="${h.id}">${esc(plain(h.textContent))}</a></li>`).join("");

  app.innerHTML = `
    <header class="chap-head" style="--img:url('img/${ch.img}.jpg')">
      <div class="wrap">
        <a class="crumb" href="#/">${icon("compass")} Trail</a>
        <h1>${inline(h1)}</h1>
        <p>${esc(ch.blurb)}</p>
      </div>
    </header>
    <div class="wrap chap">
      <aside class="toc">
        <details open id="toc-d"><summary>On this page</summary><ul>${toc}</ul></details>
      </aside>
      <article id="doc"><button class="linkbtn" id="expand" type="button">Open all sections</button></article>
    </div>`;
  $("#doc").append(prose);
  let all = false;
  $("#expand").onclick = (e) => { all = !all; $$(".sect", prose).forEach((d) => (d.open = all)); e.target.textContent = all ? "Close all sections" : "Open all sections"; };
  if (!$(".sect", prose)) $("#expand").remove();
  const nav = document.createElement("nav");
  nav.className = "pager wrap-narrow";
  nav.innerHTML = `${prev ? `<a href="#/c/${prev.id}" rel="prev"><small>Previous</small>${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a href="#/c/${next.id}" rel="next"><small>Next</small>${esc(next.title)}</a>` : "<span></span>"}`;
  $("#doc").append(nav);
  app.append(footer(doc.at, doc.offline));
  if (matchMedia("(max-width: 900px)").matches) $("#toc-d").open = false;
  setActiveTab(id);
  document.title = `${ch.title} · ${cfg.name}`;
  tocSpy(heads);

  // deep links: ?day=5 or ?h=slug
  const q = new URLSearchParams(query || "");
  let target = null;
  if (q.get("day")) target = heads.find((h) => new RegExp(`^Day ${q.get("day")}\\b`).test(h.textContent.trim()));
  if (q.get("h")) target = document.getElementById(q.get("h"));
  if (target) { openAncestors(target); requestAnimationFrame(() => target.scrollIntoView({ block: "start" })); } else scrollTo(0, 0);
}

function tocSpy(heads) {
  if (!("IntersectionObserver" in window)) return;
  const links = new Map($$(".toc a").map((a) => [a.dataset.anchor, a]));
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) { links.forEach((l) => l.classList.remove("on")); links.get(e.target.id)?.classList.add("on"); } });
  }, { rootMargin: "-72px 0px -70% 0px" });
  heads.forEach((h) => io.observe(h));
}

async function creditsView() {
  const credits = cfg.credits || {};
  app.innerHTML = `<header class="chap-head" style="--img:url('img/flags.jpg')"><div class="wrap"><a class="crumb" href="#/">${icon("compass")} Trail</a><h1>Photo credits</h1><p>Every photograph on this site comes from Wikimedia Commons, under the licence shown.</p></div></header>
    <div class="wrap chap one"><article><div class="prose"><ul class="credits">${Object.values(credits).map((c) => `
      <li><img src="${c.file}" alt="" loading="lazy" width="96" height="64"><span><a href="${c.source}" target="_blank" rel="noopener">${esc(c.title.replace(/\.\w+$/, ""))}</a><br>${esc(c.author)} · <a href="${c.licenseUrl}" target="_blank" rel="noopener">${esc(c.license)}</a></span></li>`).join("")}</ul>
      <p>Type: Yatra One and Atkinson Hyperlegible Next (SIL Open Font Licence). Markdown by marked (MIT), sanitising by DOMPurify (Apache-2.0 / MPL-2.0). Mountains, prayer flags and the mandala are drawn in code for this site.</p></div></article></div>`;
  app.append(footer(Date.now()));
  document.title = "Photo credits · " + cfg.name;
  scrollTo(0, 0);
}

function fail(e) {
  if (e instanceof AuthError) { store.del(TOKEN_KEY); return gateView("GitHub no longer accepts the saved key. Paste a fresh one."); }
  app.innerHTML = `<section class="wrap state"><h2>Couldn’t reach the notes.</h2><p>${esc(e.message || "Network error")}. Nothing is saved on this device yet, so there’s nothing to show offline. Check your connection, then <a href="#" onclick="location.reload();return false">try again</a>.</p></section>`;
}
function missing(ch) {
  app.innerHTML = `<section class="wrap state"><h2>${esc(ch.title)} isn’t on GitHub yet.</h2><p><code>${esc(ch.file)}</code> wasn’t found in <code>${esc(cfg.repo.path)}</code>. Commit and push it, then refresh.</p><p><a href="#/">Back to the trail</a></p></section>`;
}
async function joinView(query) {
  const q = new URLSearchParams(query || "");
  const k = q.get("k"), c = (q.get("c") || "").split(",").filter(Boolean);
  if (!k) return gateView();
  app.innerHTML = heroHTML(`<div class="loading">Opening the logbook…</div>`);
  mountHero();
  store.set(TOKEN_KEY, k);
  try {
    await fetchFile(cfg.chapters[0].file);
  } catch (err) {
    store.del(TOKEN_KEY);
    history.replaceState(null, "", location.pathname + location.search + "#/");
    return gateView("This link no longer works. The key behind it may have expired or been revoked. Ask for a fresh link.");
  }
  if (c.length) store.set(CHAPTERS_KEY, JSON.stringify(c)); else store.del(CHAPTERS_KEY);
  // keep the key out of the address bar and the browser history
  history.replaceState(null, "", location.pathname + location.search + "#/");
  location.reload();
}

function notFound() {
  app.innerHTML = `<section class="wrap state"><h2>That page isn’t on the map.</h2><p><a href="#/">Back to the trail</a></p></section>`;
}

/* ---------- chrome: tabs, drawer, scroll ---------- */
function setActiveTab(id) {
  $$(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === id || (id === "home" && a.dataset.tab === "home")));
  $$("#drawer-list a").forEach((a) => a.classList.toggle("on", a.dataset.id === id));
}

const drawer = $("#drawer"), scrim = $("#scrim");
function openDrawer(open) {
  drawer.hidden = scrim.hidden = !open;
  document.body.classList.toggle("lock", open);
  $("#menu-btn").setAttribute("aria-expanded", open);
  if (open) $("#drawer-close").focus();
}
$("#drawer-list").innerHTML = `<li><a href="#/" data-id="home">${icon("compass")}<span><strong>The trail</strong><em>Start here</em></span></a></li>` +
  cfg.chapters.map((c) => `<li><a href="#/c/${c.id}" data-id="${c.id}">${icon(c.icon)}<span><strong>${esc(c.title)}</strong><em>${esc(c.blurb)}</em></span></a></li>`).join("");
$("#menu-btn").onclick = () => openDrawer(drawer.hidden);
$("#tab-more").onclick = () => openDrawer(true);
$("#drawer-close").onclick = scrim.onclick = () => openDrawer(false);
drawer.addEventListener("click", (e) => { if (e.target.closest("a")) openDrawer(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) openDrawer(false); });
$("#lock-btn").onclick = () => {
  if (isLocal) return alert("Local preview reads the files directly; there is no key to remove.");
  store.del(TOKEN_KEY); store.del(CHAPTERS_KEY); cfg.chapters.forEach((c) => store.del("md:" + c.file)); openDrawer(false); route();
};
$("#refresh").onclick = async () => {
  const b = $("#refresh"); b.classList.add("spin");
  memo.clear();
  try { await Promise.all(cfg.chapters.map((c) => fetchFile(c.file).catch(() => {}))); } finally { b.classList.remove("spin"); }
  route();
};

function openAncestors(t) { for (let d = t?.closest("details"); d; d = d.parentElement?.closest("details")) d.open = true; }
// in-page anchors (table of contents, [text](#heading))
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-anchor]");
  if (!a) return;
  e.preventDefault();
  const t = document.getElementById(a.dataset.anchor);
  openAncestors(t);
  t?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
});
// ridge peaks → day cards
document.addEventListener("click", (e) => {
  const a = e.target.closest("a.peak");
  if (!a) return;
  e.preventDefault();
  const t = document.getElementById("day-" + a.dataset.day);
  t?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  t?.classList.add("ping"); setTimeout(() => t.classList.remove("ping"), 1600);
});

let ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = scrollY;
    document.documentElement.style.setProperty("--sy", reduceMotion ? 0 : Math.min(y, 900));
    $("#bar").classList.toggle("solid", y > 60 || !$("#hero"));
  });
}
addEventListener("scroll", onScroll, { passive: true });
let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if ($("#flags")) buildFlags($("#flags")); }, 200); });

function observeReveal() { /* intentionally minimal: the hero is the one orchestrated moment */ }

/* ---------- router ---------- */
function route() {
  openDrawer(false);
  document.body.toggleAttribute("data-locked", !isLocal && !getToken());
  const h = location.hash.replace(/^#/, "") || "/";
  const [path, query] = h.split("?");
  document.body.dataset.view = path === "/" ? "home" : "page";
  $("#bar").classList.toggle("solid", path !== "/");
  if (path === "/join") return joinView(query);
  if (!isLocal && !getToken()) { document.body.dataset.view = "home"; return gateView(); }
  if (path === "/") return homeView();
  if (path === "/credits") return creditsView();
  const m = path.match(/^\/c\/([\w-]+)/);
  if (m) return chapterView(m[1], query);
  notFound();
}
addEventListener("hashchange", route);

fetch("credits.json").then((r) => r.json()).then((c) => { cfg.credits = c; }).catch(() => { cfg.credits = {}; }).finally(() => {
  route();
  if (!isLocal && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
});
})();
