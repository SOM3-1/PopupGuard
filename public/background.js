const DEFAULT_SETTINGS = {
  enabled: true,
  cookieMode: "strict",
  modalTypes: {
    promo: true,
    auth: true,
    cookies: true
  },
  whitelist: []
};

function normalizeSettings(raw) {
  const modalTypes = {
    promo: raw?.modalTypes?.promo ?? DEFAULT_SETTINGS.modalTypes.promo,
    auth: raw?.modalTypes?.auth ?? DEFAULT_SETTINGS.modalTypes.auth,
    cookies: raw?.modalTypes?.cookies ?? DEFAULT_SETTINGS.modalTypes.cookies
  };

  return {
    enabled: raw?.enabled ?? DEFAULT_SETTINGS.enabled,
    cookieMode: ["strict", "balanced", "off"].includes(raw?.cookieMode)
      ? raw.cookieMode
      : DEFAULT_SETTINGS.cookieMode,
    modalTypes,
    whitelist: Array.isArray(raw?.whitelist) ? raw.whitelist : DEFAULT_SETTINGS.whitelist
  };
}

async function ensureDefaults() {
  const current = await chrome.storage.sync.get(["enabled", "cookieMode", "modalTypes", "whitelist"]);
  const normalized = normalizeSettings(current);
  await chrome.storage.sync.set(normalized);
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults().catch(() => {});
});

chrome.runtime.onStartup?.addListener(() => {
  ensureDefaults().catch(() => {});
});
