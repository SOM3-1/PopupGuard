# PopupGuard Store Listing Draft

This file contains plain-language draft text for browser store listings.

Replace placeholders before publishing.

## Product Name

PopupGuard

## One-Line Tagline (Optional)

Reduce promo, login, and cookie popups while keeping per-site control.

## Short Description (Chrome Web Store style)

Closes common promo, login, and cookie popups with per-site disable controls and privacy-first cookie handling.

## Full Description (Draft)

PopupGuard helps reduce common website popups so pages are easier to use.

It can handle:

- Promo and newsletter popups
- Sign-in and login prompts
- Cookie banners

PopupGuard works on websites by default and gives you control over how it behaves.

### Features

- Global on/off toggle
- Separate toggles for promo, login, and cookie popups
- Cookie modes (`Strict`, `Balanced`, `Off`)
- Disable PopupGuard on a specific site
- Disabled sites list
- Debug panel showing the last action taken on the current site

### Privacy

PopupGuard is designed to work locally in your browser.

- No remote servers
- No analytics
- No browsing data collection
- No automatic cookie accept by default

See privacy policy: https://github.com/SOM3-1/PopupGuard/blob/main/docs/PRIVACY_POLICY.md

### Important Notes

- Website popup systems vary, so behavior may differ between sites
- Some cookie banners only offer accept/OK options, which limits what any extension can do automatically
- If a site breaks, disable PopupGuard for that site and report it
- PopupGuard is a convenience tool that users operate at their own discretion

### Support

- Support email: dush.gowda@gmail.com
- Project page / issue tracker: https://github.com/SOM3-1/PopupGuard

## Permissions Explanation (Store Notes / FAQ Draft)

### Why does PopupGuard need access to all websites?

PopupGuard needs to run on websites you visit so it can detect and close popup overlays and cookie banners on those pages.

PopupGuard processes popup detection locally in your browser and does not send page data to a server.

### Why does PopupGuard use storage?

PopupGuard stores your preferences, such as:

- Enabled/disabled state
- Popup type toggles
- Cookie mode
- Disabled sites list

### Why does PopupGuard use tabs?

PopupGuard uses `tabs` to detect the current site in the popup UI so you can disable or re-enable PopupGuard for that site.

## Screenshot Ideas

- Main popup UI with global toggle and popup type toggles
- Current site section showing "Disable on This Site"
- Cookie mode selector (`Strict / Balanced / Off`)
- Disabled sites list
- Debug panel
