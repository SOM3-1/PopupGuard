# PopupGuard

PopupGuard is a browser extension that helps close common website popups.

It tries to close:

- Promo and newsletter popups
- Sign-in and login popups
- Cookie popups (it tries safer choices like reject when possible)

It works on all websites by default.
You can turn it off for one site or turn it off completely.

## What This Repo Is

This repo is the source code for the PopupGuard extension.

## What You Can Do in the Extension

- Turn PopupGuard on or off
- Turn popup types on or off (promo, login, cookies)
- Choose cookie mode (`Strict`, `Balanced`, `Off`)
- Disable PopupGuard on a specific website
- Manage the list of disabled websites
- See the last action PopupGuard took on the current site (debug panel)
- Clear debug data from the popup UI

## Cookie Modes

- `Strict`: tries reject/decline/close only
- `Balanced`: may open cookie preferences and try to save safer choices (for supported cookie systems)
- `Off`: PopupGuard does not interact with cookie popups

## Current Safety Improvements

- Avoids hiding full sign-in pages (auth route guard)
- Tries not to close chat widgets
- Restores page scroll after popup/cookie overlays when possible
- Includes adapter-based handling for common cookie systems (OneTrust, Cookiebot, Didomi, TrustArc cleanup)

## Quick Start (Firefox First)

If you want to test on Firefox first:

1. Install packages:

```bash
npm install
```

2. Build Firefox version:

```bash
npm run build:firefox
```

3. Load it in Firefox:

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on...`
3. Select `dist/manifest.json`

Firefox removes temporary add-ons after restart.

Important:

- Run `npm run build:firefox` again before reloading in Firefox after code changes
- If you run `npm run build`, it switches `dist/manifest.json` back to the Chrome/Edge version

## Run It (Chrome or Edge)

1. Install packages:

```bash
npm install
```

2. Build:

```bash
npm run build
```

3. Load in browser:

1. Open `chrome://extensions` (or `edge://extensions`)
2. Turn on Developer mode
3. Click `Load unpacked`
4. Select the `dist/` folder

## Run It (Firefox, Temporary Add-on)

1. Build the Firefox version:

```bash
npm run build:firefox
```

2. Load it in Firefox:

1. Open `about:debugging#/runtime/this-firefox`
2. Click `Load Temporary Add-on...`
3. Select `dist/manifest.json`

Firefox removes temporary add-ons after restart.

## Dev Commands

```bash
npm run lint
npm test
npm run build
npm run build:firefox
```

## Project Docs

- Privacy policy template: `docs/PRIVACY_POLICY.md`
- Disclaimer template: `docs/DISCLAIMER.md`
- Release checklist: `docs/RELEASE_CHECKLIST.md`
- Store listing draft: `docs/STORE_LISTING.md`

## Notes

- Some websites may still need custom fixes later.
- Some cookie popups only offer `OK` or `Accept`, so there is no perfect automatic action on every site.
- PopupGuard is a convenience tool and should be used at your own discretion.
- Disable PopupGuard on any site where it causes issues or where you want manual control.

Happy browsing.
