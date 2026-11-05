// Manual toggle (toolbar button, Alt+P, global shortcut) for "floating" mode.
//
// background.js injects this together with autoPip.js *synchronously* inside
// the click/command handler, so this frame gets the user activation that
// documentPictureInPicture.requestWindow() needs. That is what lets the
// configured window size apply to manual opens, not only auto-PiP.
//
// Pop-out mode is handled entirely by background.js (popout.js); this script
// does nothing in that mode.

(async () => {
  if (!window.__autoPipContentLoaded) return;

  const s = await chrome.storage.local.get({
    windowMode: "floating",
    pipSizeW: 0,
    pipSizeH: 0,
    pipStyle: "controls",
  });
  if (s.windowMode === "popout" || window.__pipPopoutActive) return;

  const report = (result) => {
    try { chrome.runtime.sendMessage({ type: "manualPipResult", ...result }); } catch (_) {}
  };

  // Toggle off whichever PiP this frame owns.
  if (window._autoPipWindow && !window._autoPipWindow.closed) {
    window._autoPipWindow.close();
    report({ ok: true, action: "closed" });
    return;
  }
  if (document.pictureInPictureElement) {
    await document.exitPictureInPicture().catch(() => {});
    report({ ok: true, action: "closed" });
    return;
  }

  const video = findLargestPlayingVideo();
  if (!video) return; // another frame may have the video; stay silent

  const size = pipSizeFor(video, s);
  let result;
  if (s.pipStyle !== "minimal" && typeof window.documentPictureInPicture !== "undefined") {
    result = await openDocumentPipFor(video, size, () => openNativePipFor(video));
  } else {
    result = await openNativePipFor(video);
  }
  if (result && result.ok) {
    window.__pipManualOpen = true;
    const clear = () => { window.__pipManualOpen = false; };
    if (window._autoPipWindow && !window._autoPipWindow.closed) {
      window._autoPipWindow.addEventListener("pagehide", clear, { once: true });
    } else {
      video.addEventListener("leavepictureinpicture", clear, { once: true });
    }
  }
  report({ ...result, wanted: s.pipStyle, action: result && result.ok ? "opened" : undefined });
})();
