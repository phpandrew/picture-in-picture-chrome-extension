// Options page: window mode, default size, pop-out monitor/position, and
// which sites auto-open PiP on tab switch.

const DEFAULT_SITES = `https://www.youtube.com/*
https://youtube.com/*
https://music.youtube.com/*
https://www.netflix.com/*
https://vimeo.com/*
https://www.twitch.tv/*`;

const DEFAULTS = {
  windowMode: "floating",
  pipStyle: "controls",
  pipSizeW: 0,
  pipSizeH: 0,
  popoutDisplay: "current",
  popoutAnchor: "bottom-right",
  popoutMargin: 24,
  enabledSites: DEFAULT_SITES,
};

const ANCHORS = [
  "top-left", "top-center", "top-right",
  "middle-left", "center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

const $ = (id) => document.getElementById(id);
let anchor = DEFAULTS.popoutAnchor;

function renderAnchors() {
  const grid = $("anchor");
  grid.textContent = "";
  for (const a of ANCHORS) {
    const b = document.createElement("button");
    b.type = "button";
    b.title = a.replace("-", " ");
    b.setAttribute("aria-label", b.title);
    b.setAttribute("aria-pressed", String(a === anchor));
    b.addEventListener("click", () => { anchor = a; renderAnchors(); });
    grid.appendChild(b);
  }
}

async function renderDisplays(selected) {
  const sel = $("display");
  sel.textContent = "";
  const add = (value, label) => {
    const o = document.createElement("option");
    o.value = value; o.textContent = label;
    sel.appendChild(o);
  };
  add("current", "Same monitor as the browser window");
  add("primary", "Primary monitor");
  try {
    const displays = await chrome.system.display.getInfo();
    displays.forEach((d, i) => {
      const b = d.bounds;
      const name = d.name && !/^\d+$/.test(d.name) ? d.name : `Monitor ${i + 1}`;
      add(d.id, `${name} — ${b.width}×${b.height}${d.isPrimary ? " (primary)" : ""} at ${b.left},${b.top}`);
    });
  } catch (_) {}
  sel.value = [...sel.options].some((o) => o.value === selected) ? selected : "current";
}

function mode() {
  const r = document.querySelector('input[name=mode]:checked');
  return r ? r.value : "floating";
}

function syncModeUI() {
  const floating = mode() === "floating";
  $("floatNote").hidden = !floating;
  for (const row of $("placement").querySelectorAll(".row")) row.classList.toggle("disabled", floating);
  $("styleRow").classList.toggle("disabled", !floating);
  const minimal = (document.querySelector("input[name=style]:checked") || {}).value === "minimal";
  $("sizeRow").classList.toggle("disabled", floating && minimal);
}

function fill(s) {
  for (const r of document.querySelectorAll("input[name=mode]")) r.checked = r.value === s.windowMode;
  for (const r of document.querySelectorAll("input[name=style]")) r.checked = r.value === s.pipStyle;
  $("w").value = s.pipSizeW > 0 ? s.pipSizeW : "";
  $("h").value = s.pipSizeH > 0 ? s.pipSizeH : "";
  $("margin").value = s.popoutMargin;
  $("sites").value = s.enabledSites;
  anchor = ANCHORS.includes(s.popoutAnchor) ? s.popoutAnchor : DEFAULTS.popoutAnchor;
  renderAnchors();
  syncModeUI();
  return renderDisplays(s.popoutDisplay);
}

function status(msg) {
  $("status").textContent = msg;
  clearTimeout(status.t);
  status.t = setTimeout(() => ($("status").textContent = ""), 3000);
}

const num = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

document.querySelectorAll("input[name=mode], input[name=style]").forEach((r) => r.addEventListener("change", syncModeUI));

$("save").addEventListener("click", async () => {
  const prevSites = (await chrome.storage.local.get({ enabledSites: DEFAULT_SITES })).enabledSites;
  const sites = $("sites").value.trim();
  await chrome.storage.local.set({
    windowMode: mode(),
    pipStyle: (document.querySelector("input[name=style]:checked") || {}).value || "controls",
    pipSizeW: num($("w").value),
    pipSizeH: num($("h").value),
    popoutDisplay: $("display").value,
    popoutAnchor: anchor,
    popoutMargin: Math.max(0, parseInt($("margin").value, 10) || 0),
    enabledSites: sites,
  });
  if (sites !== prevSites) chrome.runtime.sendMessage({ type: "updateSites" });
  status("Saved.");
});

$("reset").addEventListener("click", () => {
  fill(DEFAULTS);
  status("Defaults restored — click Save to apply.");
});

chrome.storage.local.get(DEFAULTS, fill);
