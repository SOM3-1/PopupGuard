# PopupGuard Release Checklist

Use this checklist before publishing a new version.

## Product Readiness

- Confirm core popup handling works on a test set of sites
- Confirm sign-in pages are not hidden or broken
- Confirm chat widgets are not closed by mistake
- Confirm cookie handling works in `Strict`, `Balanced`, and `Off` modes
- Confirm disabled-site behavior works (per-site disable / re-enable)
- Confirm popup UI is readable and all controls work

## Browser Testing

- Chrome (latest stable)
- Edge (latest stable)
- Firefox (latest stable)

For each browser, test:

- Install/load extension
- Toggle global on/off
- Toggle popup types
- Cookie mode selector
- Disabled sites list add/remove
- Debug panel and `Clear` action

## Site Test Pass (Minimum)

Test on a varied set of sites:

- Retail/e-commerce
- News/media
- Blogs/content sites
- SaaS/product sites
- Documentation sites

Track issues:

- Site URL
- What popup appeared
- What PopupGuard did
- Whether page broke (scroll lock, hidden content, redirect, chat widget closed)

## Technical Checks

- `npm ci`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run build:firefox`

## Versioning

- Update version in `package.json`
- Update version in `public/manifest.json`
- Update version in `public/manifest.firefox.json`
- Add release notes / changelog entry

## Store Submission Files

- Privacy policy URL published and accessible
- Store short description
- Store full description
- Extension icons verified (16/32/48/128)
- Screenshots prepared
- Support email / support URL ready

## Permissions Review

Confirm permission explanations are accurate and user-friendly:

- `storage`
- `tabs`
- host access (`<all_urls>`)

## Packaging

- Build Chrome package from `dist/` after `npm run build`
- Build Firefox package from `dist/` after `npm run build:firefox`
- Verify the correct manifest is included before packaging

## Final Publish Gate

- No known critical regressions
- No known sign-in page blanking issues
- No known cookie loops on top tested sites
- No known chat widget false positives on top tested sites
- Support contact is valid

If any item above fails, do not publish until resolved.
