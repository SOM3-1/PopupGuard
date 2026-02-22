export const DEFAULT_SETTINGS = {
  enabled: true,
  cookieMode: "strict",
  modalTypes: {
    promo: true,
    auth: true,
    cookies: true
  },
  whitelist: []
};

export function normalizeDomain(input) {
  if (!input) return "";
  let value = String(input).trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.replace(/^www\./, "");
  value = value.split("/")[0];
  value = value.split(":")[0];
  return value;
}

export function normalizeCookieMode(value) {
  return ["strict", "balanced", "off"].includes(value)
    ? value
    : DEFAULT_SETTINGS.cookieMode;
}

export function normalizeSettings(raw) {
  return {
    enabled: raw?.enabled ?? DEFAULT_SETTINGS.enabled,
    cookieMode: normalizeCookieMode(raw?.cookieMode),
    modalTypes: {
      promo: raw?.modalTypes?.promo ?? DEFAULT_SETTINGS.modalTypes.promo,
      auth: raw?.modalTypes?.auth ?? DEFAULT_SETTINGS.modalTypes.auth,
      cookies: raw?.modalTypes?.cookies ?? DEFAULT_SETTINGS.modalTypes.cookies
    },
    whitelist: Array.isArray(raw?.whitelist)
      ? raw.whitelist.map(normalizeDomain).filter(Boolean)
      : []
  };
}
