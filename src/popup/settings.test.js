import { describe, expect, it } from "vitest";
import { normalizeCookieMode, normalizeDomain, normalizeSettings } from "./settings.js";

describe("normalizeDomain", () => {
  it("normalizes protocol, www, path and port", () => {
    expect(normalizeDomain("https://www.Example.com:443/path?q=1")).toBe("example.com");
  });

  it("returns empty string for falsy input", () => {
    expect(normalizeDomain("")).toBe("");
    expect(normalizeDomain(null)).toBe("");
  });
});

describe("normalizeCookieMode", () => {
  it("accepts supported values", () => {
    expect(normalizeCookieMode("strict")).toBe("strict");
    expect(normalizeCookieMode("balanced")).toBe("balanced");
    expect(normalizeCookieMode("off")).toBe("off");
  });

  it("falls back to strict", () => {
    expect(normalizeCookieMode("weird")).toBe("strict");
    expect(normalizeCookieMode(undefined)).toBe("strict");
  });
});

describe("normalizeSettings", () => {
  it("fills defaults and normalizes whitelist", () => {
    const settings = normalizeSettings({
      enabled: false,
      cookieMode: "balanced",
      modalTypes: { promo: false },
      whitelist: ["https://www.Shop.com", "shop.com", "blog.shop.com"]
    });

    expect(settings.enabled).toBe(false);
    expect(settings.cookieMode).toBe("balanced");
    expect(settings.modalTypes).toEqual({
      promo: false,
      auth: true,
      cookies: true
    });
    expect(settings.whitelist).toEqual(["shop.com", "shop.com", "blog.shop.com"]);
  });
});
