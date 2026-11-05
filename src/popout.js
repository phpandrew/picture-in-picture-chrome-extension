// Pop-out mode: move the tab into a chromeless popup window that is sized and
// placed from the settings (monitor, 3x3 anchor, margin), with the video
// filling it. Unlike the floating PiP window this one can be positioned, but
// browsers don't let extensions keep it always-on-top.
//
// Loaded by background.js via importScripts().

const POPOUT_DEFAULTS = {
  pipSizeW: 0,
  pipSizeH: 0,
  popoutDisplay: "current", // "current" | "primary" | display id
  popoutAnchor: "bottom-right", // top|middle|bottom - left|center|right, or "center"
  popoutMargin: 24,
};

async function getPopouts() {
  const { popouts = {} } = await chrome.storage.session.get("popouts");
  return popouts;
}
async function setPopouts(popouts) {
  await chrome.storage.session.set({ popouts });
}

async function isPoppedOut(tabId) {
  return !!(await getPopouts())[tabId];
}

// ── Injected functions (run in the page, must be self-contained) ───────────

function __popoutMeasure() {
  const vids = Array.from(document.querySelectorAll("video"))
    .filter((v) => v.readyState > 0 && v.videoWidth > 0);
  let best = null, bestScore = -1;
  for (const v of vids) {
    const r = v.getBoundingClientRect();
    const score = (!v.paused && !v.ended ? 1e9 : 0) + r.width * r.height;
    if (score > bestScore) { bestScore = score; best = v; }
  }
  if (!best) return null;
  return {
    score: bestScore,
    vw: best.videoWidth,
    vh: best.videoHeight,
    href: location.href,
    isTop: window === window.top,
  };
}

// targetIsHere: this frame holds the video. iframeHref: set in the top frame
// when the video lives in a child frame, so the iframe element gets enlarged.
function __popoutEnter(targetIsHere, iframeHref) {
  const STYLE_ID = "__pip_popout_style";
  const css = `
    [data-pip-popout] {
      position: fixed !important; inset: 0 !important;
      width: 100vw !important; height: 100vh !important;
      max-width: none !important; max-height: none !important;
      min-width: 0 !important; min-height: 0 !important;
      margin: 0 !important; padding: 0 !important; border: 0 !important;
      background: #000 !important; object-fit: contain !important;
      transform: none !important; opacity: 1 !important; visibility: visible !important;
      z-index: 2147483646 !important; display: block !important;
    }
    [data-pip-popout]::backdrop { background: #000; }
    html, body { overflow: hidden !important; }
    #__pip_popout_return {
      position: fixed !important; inset: 10px 10px auto auto !important;
      margin: 0 !important; padding: 6px 10px !important;
      font: 600 12px/1 system-ui, sans-serif !important; color: #fff !important;
      background: rgba(0,0,0,.65) !important; border: 1px solid rgba(255,255,255,.3) !important;
      border-radius: 6px !important; cursor: pointer !important;
      z-index: 2147483647 !important; opacity: 0; transition: opacity .2s;
    }
    #__pip_popout_return.show, #__pip_popout_return:hover { opacity: 1; }
  `;
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  // Top layer escapes ancestor transforms / overflow / stacking contexts.
  const lift = (el) => {
    el.setAttribute("data-pip-popout", "");
    try {
      if (!el.hasAttribute("popover")) {
        el.setAttribute("popover", "manual");
        el.setAttribute("data-pip-popover-added", "");
      }
      el.showPopover();
    } catch (_) {}
  };

  let el = null;
  if (targetIsHere) {
    const vids = Array.from(document.querySelectorAll("video"))
      .filter((v) => v.readyState > 0 && v.videoWidth > 0);
    let bestScore = -1;
    for (const v of vids) {
      const r = v.getBoundingClientRect();
      const score = (!v.paused && !v.ended ? 1e9 : 0) + r.width * r.height;
      if (score > bestScore) { bestScore = score; el = v; }
    }
    if (el) {
      el.setAttribute("data-pip-controls-was", el.controls ? "1" : "0");
      el.controls = true;
    }
  } else if (iframeHref) {
    const frames = Array.from(document.querySelectorAll("iframe"));
    el = frames.find((f) => { try { return f.src && new URL(f.src, location.href).href === iframeHref; } catch (_) { return false; } })
      || frames.find((f) => { try { return f.src && new URL(f.src, location.href).origin === new URL(iframeHref).origin; } catch (_) { return false; } })
      || frames.sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      })[0];
  }
  if (el) lift(el);

  // "Return to tab" button, top frame only (popup windows have no toolbar).
  if (window === window.top && !document.getElementById("__pip_popout_return")) {
    const btn = document.createElement("button");
    btn.id = "__pip_popout_return";
    btn.textContent = "⤶ Back to tab";
    btn.title = "Return this tab to its window (Alt+P)";
    btn.setAttribute("popover", "manual");
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      chrome.runtime.sendMessage({ type: "popoutReturn" });
    });
    document.documentElement.appendChild(btn);
    try { btn.showPopover(); } catch (_) {}
    let t = 0;
    const wake = () => {
      btn.classList.add("show");
      clearTimeout(t);
      t = setTimeout(() => btn.classList.remove("show"), 1800);
    };
    window.__pipPopoutWake = wake;
    document.addEventListener("mousemove", wake, true);
    wake();
  }
  window.__pipPopoutActive = true;
  return { w: window.innerWidth, h: window.innerHeight };
}

function __popoutExit() {
  document.querySelectorAll("[data-pip-popout]").forEach((el) => {
    try { el.hidePopover(); } catch (_) {}
    if (el.hasAttribute("data-pip-popover-added")) {
      el.removeAttribute("popover");
      el.removeAttribute("data-pip-popover-added");
    }
    if (el.hasAttribute("data-pip-controls-was")) {
      el.controls = el.getAttribute("data-pip-controls-was") === "1";
      el.removeAttribute("data-pip-controls-was");
    }
    el.removeAttribute("data-pip-popout");
  });
  const btn = document.getElementById("__pip_popout_return");
  if (btn) btn.remove();
  if (window.__pipPopoutWake) {
    document.removeEventListener("mousemove", window.__pipPopoutWake, true);
    window.__pipPopoutWake = null;
  }
  const st = document.getElementById("__pip_popout_style");
  if (st) st.remove();
  window.__pipPopoutActive = false;
}

function __popoutInnerSize() {
  return { w: window.innerWidth, h: window.innerHeight };
}

// ── Geometry ────────────────────────────────────────────────────────────────

async function pickDisplay(setting, win) {
  const displays = await chrome.system.display.getInfo();
  if (!displays.length) return null;
  if (setting && setting !== "current" && setting !== "primary") {
    const d = displays.find((x) => x.id === setting);
    if (d) return d;
  }
  if (setting === "primary") return displays.find((x) => x.isPrimary) || displays[0];
  // "current": the monitor holding the centre of the browser window.
  if (win && win.left != null) {
    const cx = win.left + win.width / 2, cy = win.top + win.height / 2;
    const hit = displays.find((d) => {
      const b = d.bounds;
      return cx >= b.left && cx < b.left + b.width && cy >= b.top && cy < b.top + b.height;
    });
    if (hit) return hit;
  }
  return displays.find((x) => x.isPrimary) || displays[0];
}

function placeIn(workArea, outerW, outerH, anchor, margin) {
  const wa = workArea;
  const m = Math.max(0, margin | 0);
  const w = Math.min(outerW, wa.width - 2 * m);
  const h = Math.min(outerH, wa.height - 2 * m);
  const [v, hz] = anchor === "center" ? ["middle", "center"] : anchor.split("-");
  const left =
    hz === "left" ? wa.left + m :
    hz === "right" ? wa.left + wa.width - w - m :
    wa.left + Math.round((wa.width - w) / 2);
  const top =
    v === "top" ? wa.top + m :
    v === "bottom" ? wa.top + wa.height - h - m :
    wa.top + Math.round((wa.height - h) / 2);
  return { left: Math.round(left), top: Math.round(top), width: Math.round(w), height: Math.round(h) };
}

// ── Toggle ──────────────────────────────────────────────────────────────────

async function popoutToggle(tab) {
  if (!tab || !tab.id) return { ok: false, error: "No tab" };
  const popouts = await getPopouts();
  if (popouts[tab.id]) return popIn(tab.id);

  const s = await chrome.storage.local.get(POPOUT_DEFAULTS);

  const frames = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: __popoutMeasure,
  });
  const best = frames
    .filter((f) => f.result)
    .sort((a, b) => b.result.score - a.result.score)[0];
  if (!best) return { ok: false, error: "No video found" };

  await chrome.scripting.executeScript({
    target: { tabId: tab.id, frameIds: [best.frameId] },
    func: __popoutEnter,
    args: [true, null],
  });
  if (best.frameId !== 0) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: __popoutEnter,
      args: [false, best.result.href],
    });
  }

  const origWin = await chrome.windows.get(tab.windowId);
  const display = await pickDisplay(s.popoutDisplay, origWin);
  const wa = display ? display.workArea : { left: 0, top: 0, width: 1920, height: 1080 };

  const aspect = best.result.vw / best.result.vh || 16 / 9;
  let cw = s.pipSizeW > 0 ? s.pipSizeW : 480;
  let ch = s.pipSizeH > 0 ? s.pipSizeH : Math.round(cw / aspect);

  // First guess for window chrome (popup title bar); corrected below.
  let frameW = 0, frameH = 32;
  let bounds = placeIn(wa, cw + frameW, ch + frameH, s.popoutAnchor, s.popoutMargin);

  const win = await chrome.windows.create({
    tabId: tab.id,
    type: "popup",
    focused: true,
    ...bounds,
  });

  popouts[tab.id] = { windowId: tab.windowId, index: tab.index, popupId: win.id };
  await setPopouts(popouts);

  // Measure the real content area and correct so the *video area* matches
  // the configured size, then re-anchor with the final outer size.
  try {
    const [{ result: inner }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      func: __popoutInnerSize,
    });
    const now = await chrome.windows.get(win.id);
    const dw = inner ? now.width - inner.w : -1;
    const dh = inner ? now.height - inner.h : -1;
    // Ignore nonsense (e.g. page zoom != 100%); keep the first guess then.
    if (dw >= 0 && dw < 200 && dh >= 0 && dh < 200) {
      frameW = dw;
      frameH = dh;
      bounds = placeIn(wa, cw + frameW, ch + frameH, s.popoutAnchor, s.popoutMargin);
      await chrome.windows.update(win.id, bounds);
    }
  } catch (_) {}

  return { ok: true, action: "opened" };
}

async function popIn(tabId) {
  const popouts = await getPopouts();
  const rec = popouts[tabId];
  delete popouts[tabId];
  await setPopouts(popouts);
  if (!rec) return { ok: false, error: "Not popped out" };

  let target = null;
  try { target = await chrome.windows.get(rec.windowId); } catch (_) {}

  if (target && target.type === "normal") {
    try {
      await chrome.tabs.move(tabId, { windowId: target.id, index: rec.index });
    } catch (_) {
      // Some Chromium builds refuse moves out of popup windows: hop through a
      // normal window first, then move into the original one.
      const tmp = await chrome.windows.create({ tabId, type: "normal", focused: false });
      try {
        await chrome.tabs.move(tabId, { windowId: target.id, index: rec.index });
      } catch (_) {
        target = tmp;
      }
    }
  } else {
    target = await chrome.windows.create({ tabId, type: "normal", focused: true });
  }

  try { await chrome.tabs.update(tabId, { active: true }); } catch (_) {}
  try { await chrome.windows.update(target.id, { focused: true }); } catch (_) {}
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: __popoutExit,
    });
  } catch (_) {}
  return { ok: true, action: "closed" };
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const popouts = await getPopouts();
  if (popouts[tabId]) {
    delete popouts[tabId];
    await setPopouts(popouts);
  }
});
