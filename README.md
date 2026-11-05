# Picture-in-Picture Plus (Brave/Chromium fork)

Fork of the [Picture-in-Picture Chrome Extension](https://github.com/GoogleChromeLabs/picture-in-picture-chrome-extension),
built on the options page and PiP controls window from
[PR #119](https://github.com/GoogleChromeLabs/picture-in-picture-chrome-extension/pull/119), with window settings added.

## Install (Brave)

1. `brave://extensions` → enable **Developer mode**
2. **Load unpacked** → pick the `src` folder

## Usage

- Toolbar button or `Alt+P`: toggle
- `Ctrl+Shift+8`: global toggle (works when the browser isn't focused)
- Double-click the toolbar button: settings
- Right-click the toolbar button: turn automatic PiP on tab switch on/off

## Settings

| Setting | Floating PiP | Pop-out window |
|---|---|---|
| Default size (W × H, H auto from aspect ratio) | ✅ | ✅ |
| Monitor (browser's monitor / primary / a specific one) | — | ✅ |
| Position (3×3 grid: corners, edges, center) + edge margin | — | ✅ |
| Always on top | ✅ | — |

**Why two modes:** Chromium won't let a site or extension set where an
always-on-top PiP window opens. It picks the spot itself and remembers where
you last dragged it. So:

- **Floating PiP** opens the always-on-top Document PiP window (with
  play/seek/volume controls) at your configured size. Drag it once and the
  browser keeps opening it there.
- **Pop-out window** moves the tab into a borderless popup window placed on
  the monitor and position you chose, with the video filling it. It can't
  stay on top. Return it with `Alt+P` or the **Back to tab** button (top right,
  shows on mouse move). The tab goes back to its original window and position.

## Files

- `background.js`: toolbar/shortcut handling, auto-PiP registration
- `popout.js`: pop-out window mode (monitor, placement, return)
- `autoPip.js`: content script: video finder, Document PiP controls window, auto-PiP
- `manualPip.js`: manual toggle in floating mode
- `options.html` / `options.js`: settings page

`script.js` from upstream is no longer used.
