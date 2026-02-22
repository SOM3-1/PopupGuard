(function () {
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

  const TEXT = {
    cookie: [
      "cookie",
      "cookies",
      "consent",
      "privacy",
      "gdpr",
      "tracking"
    ],
    promo: [
      "newsletter",
      "subscribe",
      "sign up",
      "signup",
      "offer",
      "discount",
      "save",
      "promo",
      "promotion",
      "spin",
      "wheel",
      "spin to win",
      "scratch",
      "scratch to win",
      "win",
      "prize",
      "coupon",
      "voucher",
      "unlock offer",
      "unlock discount",
      "enter your email",
      "enter email",
      "sms sign up",
      "text club"
    ],
    auth: [
      "sign in",
      "signin",
      "log in",
      "login",
      "create account",
      "join now",
      "member",
      "sign up",
      "signup"
    ],
    close: [
      "close",
      "dismiss",
      "not now",
      "no thanks",
      "no thank you",
      "skip",
      "maybe later",
      "continue as guest",
      "x"
    ],
    chat: [
      "chat",
      "live chat",
      "chat with us",
      "message us",
      "customer support",
      "support",
      "help",
      "assistant",
      "agent"
    ],
    cookieReject: [
      "reject",
      "reject all",
      "decline",
      "refuse",
      "essential only",
      "necessary only",
      "only necessary",
      "strictly necessary"
    ],
    cookieManage: [
      "manage",
      "preferences",
      "settings",
      "customize",
      "options"
    ],
    cookieAccept: [
      "accept",
      "accept all",
      "allow all",
      "agree",
      "got it",
      "ok"
    ]
  };

  let settings = { ...DEFAULT_SETTINGS };
  let observer = null;
  let lastScanAt = 0;
  let scheduled = false;
  let cleanupIntervalsStarted = false;
  const recentActions = new WeakMap();
  const DEBUG = false;
  const DEBUG_STORAGE_KEY = "popupguardLastAction";

  function normalizeSettings(raw) {
    return {
      enabled: raw?.enabled ?? DEFAULT_SETTINGS.enabled,
      cookieMode: ["strict", "balanced", "off"].includes(raw?.cookieMode)
        ? raw.cookieMode
        : DEFAULT_SETTINGS.cookieMode,
      modalTypes: {
        promo: raw?.modalTypes?.promo ?? DEFAULT_SETTINGS.modalTypes.promo,
        auth: raw?.modalTypes?.auth ?? DEFAULT_SETTINGS.modalTypes.auth,
        cookies: raw?.modalTypes?.cookies ?? DEFAULT_SETTINGS.modalTypes.cookies
      },
      whitelist: Array.isArray(raw?.whitelist) ? raw.whitelist : DEFAULT_SETTINGS.whitelist
    };
  }

  function normalizeDomain(input) {
    if (!input) return "";
    let value = String(input).trim().toLowerCase();
    value = value.replace(/^https?:\/\//, "");
    value = value.replace(/^www\./, "");
    value = value.split("/")[0];
    value = value.split(":")[0];
    return value;
  }

  function isWhitelisted(hostname) {
    const host = normalizeDomain(hostname);
    return settings.whitelist.some((entry) => {
      const normalized = normalizeDomain(entry);
      return normalized && (host === normalized || host.endsWith(`.${normalized}`));
    });
  }

  function getVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getText(el) {
    if (!(el instanceof HTMLElement)) return "";
    const text = [
      el.innerText || "",
      el.getAttribute("aria-label") || "",
      el.getAttribute("title") || "",
      el.value || ""
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return text;
  }

  function hasAny(text, list) {
    return list.some((token) => text.includes(token));
  }

  function getClickables(root) {
    if (!root || !(root instanceof Element)) return [];
    const nodes = root.querySelectorAll(
      "button, a, [role='button'], input[type='button'], input[type='submit'], [aria-label]"
    );
    return Array.from(nodes).filter((el) => getVisible(el));
  }

  function isLikelyNavigatingLink(el) {
    if (!(el instanceof HTMLAnchorElement)) return false;
    const href = (el.getAttribute("href") || "").trim().toLowerCase();
    if (!href) return false;
    if (href === "#" || href.startsWith("javascript:")) return false;
    if (href.startsWith("#")) return true;

    try {
      const resolved = new URL(el.href, location.href);
      return (
        resolved.origin !== location.origin ||
        resolved.pathname !== location.pathname ||
        resolved.hash.length > 0
      );
    } catch {
      return true;
    }
  }

  function clickElement(el) {
    try {
      if (typeof el.click === "function") {
        el.click();
      } else {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      }
      return true;
    } catch {
      return false;
    }
  }

  function getVisibleElement(selector) {
    const el = document.querySelector(selector);
    if (!el || !(el instanceof HTMLElement)) return null;
    return getVisible(el) ? el : null;
  }

  function debugLog(...args) {
    if (!DEBUG) return;
    console.debug("[PopupGuard]", ...args);
  }

  function recordDebugAction(payload) {
    const entry = {
      host: location.hostname,
      path: location.pathname,
      ts: Date.now(),
      ...payload
    };
    try {
      const result = chrome.storage?.local?.set({ [DEBUG_STORAGE_KEY]: entry });
      if (result?.catch) result.catch(() => {});
    } catch {
      // no-op
    }
    debugLog("Action", entry);
  }

  function classifyContainer(el) {
    const text = getText(el);
    const attrs = `${el.id || ""} ${el.className || ""}`.toLowerCase();
    const iframeMeta =
      el instanceof HTMLIFrameElement
        ? `${el.src || ""} ${el.name || ""} ${el.title || ""}`.toLowerCase()
        : "";
    const combined = `${text} ${attrs} ${iframeMeta}`;

    const cookieish = hasAny(combined, TEXT.cookie) || hasAny(attrs, ["cookie", "consent"]);
    const authish = hasAny(combined, TEXT.auth) || hasAny(attrs, ["login", "signin", "auth"]);
    const promoish =
      hasAny(combined, TEXT.promo) ||
      hasAny(attrs, ["modal", "popup", "newsletter", "promo"]) ||
      hasAny(iframeMeta, ["spin", "wheel", "coupon", "promo", "klaviyo", "attentive", "privy", "wisepops"]);

    if (cookieish) return "cookies";
    if (authish) return "auth";
    if (promoish) return "promo";
    return null;
  }

  function isLikelyChatWidget(el) {
    if (!(el instanceof HTMLElement)) return false;
    const text = getText(el);
    const attrs = `${el.id || ""} ${el.className || ""}`.toLowerCase();
    const combined = `${text} ${attrs}`;

    const providerHints = [
      "intercom",
      "drift",
      "zendesk",
      "zopim",
      "gorgias",
      "crisp",
      "freshchat",
      "livechat",
      "tawk",
      "tidio",
      "helpscout",
      "hubspot-messages",
      "chatwoot"
    ];

    const hasChatTerms = hasAny(combined, TEXT.chat);
    const hasProviderHints = hasAny(combined, providerHints);
    const ariaLabel = el.getAttribute("aria-label")?.toLowerCase() || "";
    const title = el.getAttribute("title")?.toLowerCase() || "";
    const roleHint = ariaLabel.includes("chat") || title.includes("chat");

    // Chat launchers are often small fixed bubbles/buttons in the corner.
    const rect = el.getBoundingClientRect();
    const smallCornerWidget =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.width <= 420 &&
      rect.height <= 420 &&
      (rect.right > window.innerWidth * 0.6 || rect.left < window.innerWidth * 0.4) &&
      rect.bottom > window.innerHeight * 0.45;

    return hasProviderHints || roleHint || (hasChatTerms && smallCornerWidget);
  }

  function looksLikeOverlayContainer(el) {
    if (!(el instanceof HTMLElement) || !getVisible(el)) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    const viewportArea = window.innerWidth * window.innerHeight;

    const fixedOrSticky = style.position === "fixed" || style.position === "sticky";
    const dialogish = el.getAttribute("role") === "dialog" || el.getAttribute("aria-modal") === "true";
    const classHint = `${el.id || ""} ${el.className || ""}`.toLowerCase();
    const hinted = hasAny(classHint, ["modal", "popup", "dialog", "drawer", "overlay"]);

    // Full page sections on real sign-in pages should not be treated like popups.
    const likelyFullPageContent =
      style.position !== "fixed" &&
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.width >= window.innerWidth * 0.8 &&
      rect.height >= window.innerHeight * 0.5;

    if (likelyFullPageContent && !dialogish) return false;
    if (fixedOrSticky) return true;
    if (dialogish) return true;
    if (hinted && area <= viewportArea * 0.95) return true;
    return false;
  }

  function isLikelyAuthRoute() {
    const path = (location.pathname || "").toLowerCase();
    return [
      "/signin",
      "/sign-in",
      "/login",
      "/log-in",
      "/account/signin",
      "/account/login",
      "/auth"
    ].some((segment) => path.includes(segment));
  }

  function findLikelyContainers() {
    const selectors = [
      "[role='dialog']",
      "[aria-modal='true']",
      "[class*='modal']",
      "[class*='popup']",
      "[class*='dialog']",
      "[id*='modal']",
      "[id*='popup']",
      "[id*='cookie']",
      "[class*='cookie']",
      "[id*='consent']",
      "[class*='consent']"
    ];

    const nodes = new Set();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((el) => {
        if (getVisible(el)) nodes.add(el);
      });
    }

    document.querySelectorAll("body > div, body > section, body > aside").forEach((el) => {
      if (!(el instanceof HTMLElement) || !getVisible(el)) return;
      const style = window.getComputedStyle(el);
      if (style.position === "fixed" || style.position === "sticky") {
        const rect = el.getBoundingClientRect();
        if (rect.width > window.innerWidth * 0.25 || rect.height > 100) {
          const kind = classifyContainer(el);
          if (kind) nodes.add(el);
        }
      }
    });

    document.querySelectorAll("iframe").forEach((iframe) => {
      if (!(iframe instanceof HTMLIFrameElement) || !getVisible(iframe)) return;
      const meta = `${iframe.src || ""} ${iframe.title || ""} ${iframe.name || ""}`.toLowerCase();
      if (!hasAny(meta, ["spin", "wheel", "coupon", "promo", "newsletter", "klaviyo", "attentive", "privy", "wisepops"])) {
        return;
      }

      let target = iframe;
      let parent = iframe.parentElement;
      for (let i = 0; i < 4 && parent; i += 1) {
        if (!(parent instanceof HTMLElement)) break;
        const style = window.getComputedStyle(parent);
        if (style.position === "fixed" || style.position === "sticky" || getVisible(parent)) {
          target = parent;
        }
        parent = parent.parentElement;
      }
      nodes.add(target);
    });

    return Array.from(nodes);
  }

  function pickCookieAction(clickables) {
    const mode = settings.cookieMode || "strict";
    const candidates = clickables.map((el) => ({ el, text: getText(el) }));
    const safeCandidates = candidates.filter(
      (c) => !(c.el instanceof HTMLAnchorElement && isLikelyNavigatingLink(c.el))
    );
    const safeNonLinkCandidates = safeCandidates.filter((c) => !(c.el instanceof HTMLAnchorElement));

    const firstMatch = (pool, predicate) => pool.find((c) => predicate(c.text))?.el || null;

    if (mode === "off") return null;

    return (
      firstMatch(safeCandidates, (t) => hasAny(t, TEXT.cookieReject)) ||
      firstMatch(safeCandidates, (t) => hasAny(t, TEXT.close) && !hasAny(t, TEXT.cookieAccept)) ||
      (mode === "balanced" ? firstMatch(safeNonLinkCandidates, (t) => hasAny(t, TEXT.cookieManage)) : null) ||
      null
    );
  }

  function pickModalAction(clickables) {
    const candidates = clickables.map((el) => ({ el, text: getText(el) }));
    const match = candidates.find((c) => hasAny(c.text, TEXT.close));
    if (match) return match.el;

    const iconClose = candidates.find((c) => {
      const aria = c.el.getAttribute("aria-label")?.toLowerCase() || "";
      const title = c.el.getAttribute("title")?.toLowerCase() || "";
      return aria === "close" || title === "close";
    });
    return iconClose?.el || null;
  }

  function isScrollLocked() {
    const html = document.documentElement;
    const body = document.body;
    const check = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return (
        style.overflow === "hidden" ||
        style.overflowY === "hidden" ||
        style.overflow === "clip" ||
        style.overflowY === "clip" ||
        style.position === "fixed"
      );
    };
    return check(html) || check(body);
  }

  function removeLockLikeClasses(el) {
    if (!el?.classList) return;
    Array.from(el.classList).forEach((cls) => {
      if (/(modal|popup|dialog|overlay|backdrop|scroll|lock|cookie|consent|onetrust|ot-)/i.test(cls)) {
        el.classList.remove(cls);
      }
    });
  }

  function forceUnlockElement(el) {
    if (!el) return;
    [
      ["overflow", "auto"],
      ["overflow-y", "auto"],
      ["overflow-x", "auto"],
      ["position", "static"],
      ["top", "auto"],
      ["left", "auto"],
      ["right", "auto"],
      ["bottom", "auto"],
      ["height", "auto"],
      ["max-height", "none"],
      ["touch-action", "auto"]
    ].forEach(([prop, value]) => el.style.setProperty(prop, value, "important"));
    el.style.removeProperty("padding-right");
    removeLockLikeClasses(el);
  }

  function unblockPageScroll(reason = "") {
    const html = document.documentElement;
    const body = document.body;
    if (html) {
      html.style.removeProperty("overflow");
      html.style.removeProperty("overflow-y");
      html.style.removeProperty("overflow-x");
      html.style.removeProperty("position");
      html.style.removeProperty("height");
      html.style.removeProperty("max-height");
      html.style.removeProperty("touch-action");
      removeLockLikeClasses(html);
    }
    if (body) {
      body.style.removeProperty("overflow");
      body.style.removeProperty("overflow-y");
      body.style.removeProperty("overflow-x");
      body.style.removeProperty("position");
      body.style.removeProperty("height");
      body.style.removeProperty("max-height");
      body.style.removeProperty("touch-action");
      body.style.removeProperty("padding-right");
      removeLockLikeClasses(body);
    }

    if (isScrollLocked()) {
      forceUnlockElement(html);
      forceUnlockElement(body);
      if (String(reason).startsWith("cookies:")) {
        recordDebugAction({ kind: "cookies", action: "force-unlock", detail: reason });
      }
      debugLog("Forced scroll unlock", reason || "unknown");
    }
  }

  function cleanupBackdropOverlays() {
    const candidates = document.querySelectorAll(
      "body > div, body > section, body > aside, [class*='overlay'], [class*='backdrop'], [id*='overlay'], [id*='backdrop']"
    );
    candidates.forEach((el) => {
      if (!(el instanceof HTMLElement) || !getVisible(el)) return;
      if (el.getAttribute("data-popupguard-hidden") === "1") return;
      const style = window.getComputedStyle(el);
      if (style.position !== "fixed") return;
      if (style.pointerEvents === "none") return;

      const rect = el.getBoundingClientRect();
      const coversMostViewport =
        rect.width >= window.innerWidth * 0.9 && rect.height >= window.innerHeight * 0.7;
      if (!coversMostViewport) return;

      const text = getText(el);
      const attrs = `${el.id || ""} ${el.className || ""}`.toLowerCase();
      const looksBackdrop =
        !text ||
        hasAny(attrs, ["backdrop", "overlay", "veil", "mask"]) ||
        /(rgba?\(.+,\s*0\.[1-9]\d*\)|#000)/.test(style.backgroundColor);

      const z = Number.parseInt(style.zIndex || "0", 10);
      if (looksBackdrop && z >= 10) {
        hideElement(el);
      }
    });
  }

  function hideVendorNodes(selectors, matcher) {
    const nodes = document.querySelectorAll(selectors);
    let changed = false;

    nodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const text = getText(node);
      const attrs = `${node.id || ""} ${node.className || ""}`.toLowerCase();
      if (matcher && !matcher({ node, text, attrs })) return;
      hideElement(node);
      changed = true;
    });

    return changed;
  }

  function cleanupOneTrustArtifacts() {
    return hideVendorNodes(
      "#onetrust-banner-sdk, #onetrust-consent-sdk, #onetrust-pc-sdk, .onetrust-pc-dark-filter, .otFloatingRoundedCorner, .ot-sdk-container",
      ({ text, attrs }) => attrs.includes("onetrust") || attrs.includes("ot-") || hasAny(text, TEXT.cookie)
    );
  }

  function cleanupCookiebotArtifacts() {
    return hideVendorNodes(
      "#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay, .CybotCookiebotDialogBodyUnderlay, [id*='Cookiebot'], [class*='Cookiebot']",
      ({ attrs, text }) => attrs.includes("cookiebot") || hasAny(text, TEXT.cookie)
    );
  }

  function cleanupDidomiArtifacts() {
    return hideVendorNodes(
      "#didomi-host, .didomi-popup-open, .didomi-popup-container, .didomi-popup-backdrop, [class*='didomi']",
      ({ attrs, text }) => attrs.includes("didomi") || hasAny(text, TEXT.cookie)
    );
  }

  function cleanupTrustArcArtifacts() {
    return hideVendorNodes(
      "#truste-consent-track, #truste-consent-content, .truste_overlay, .trustarc-banner-container, [class*='truste'], [class*='trustarc']",
      ({ attrs, text }) => hasAny(attrs, ["truste", "trustarc"]) || hasAny(text, TEXT.cookie)
    );
  }

  function tryOneTrustCookieAction() {
    const mode = settings.cookieMode || "strict";
    const hasOneTrust = Boolean(
      document.querySelector("#onetrust-banner-sdk, #onetrust-consent-sdk, #onetrust-pc-sdk")
    );
    if (!hasOneTrust) return false;

    const rejectBtn =
      getVisibleElement("#onetrust-reject-all-handler") ||
      getVisibleElement("#onetrust-reject-all-button") ||
      getVisibleElement("#onetrust-pc-btn-handler + #onetrust-reject-all-handler");
    if (rejectBtn && clickElement(rejectBtn)) {
      recordDebugAction({ kind: "cookies", action: "vendor-click", detail: "onetrust:reject-all" });
      return true;
    }

    if (mode !== "balanced") return false;

    const pcRoot = getVisibleElement("#onetrust-pc-sdk");
    if (pcRoot) {
      const checkedToggles = Array.from(
        pcRoot.querySelectorAll("input.category-switch-handler[type='checkbox']:checked")
      ).filter((el) => el instanceof HTMLInputElement && !el.disabled);

      checkedToggles.forEach((input) => {
        try {
          input.click();
        } catch {
          // ignore per-toggle errors
        }
      });

      const saveBtn =
        pcRoot.querySelector(".save-preference-btn-handler") ||
        pcRoot.querySelector("button.onetrust-close-btn-handler");
      if (saveBtn instanceof HTMLElement && getVisible(saveBtn) && clickElement(saveBtn)) {
        recordDebugAction({
          kind: "cookies",
          action: "vendor-click",
          detail: `onetrust:save-preferences:${checkedToggles.length}`
        });
        return true;
      }
    }

    const prefBtn = getVisibleElement("#onetrust-pc-btn-handler");
    if (prefBtn && clickElement(prefBtn)) {
      recordDebugAction({ kind: "cookies", action: "vendor-click", detail: "onetrust:open-preferences" });
      return true;
    }

    return false;
  }

  function tryCookiebotCookieAction() {
    const mode = settings.cookieMode || "strict";
    const hasCookiebot = Boolean(
      document.querySelector(
        "#CybotCookiebotDialog, #CybotCookiebotDialogBody, #CybotCookiebotDialogBodyUnderlay, [id*='Cookiebot']"
      )
    );
    if (!hasCookiebot) return false;

    const rejectBtn =
      getVisibleElement("#CybotCookiebotDialogBodyButtonDecline") ||
      getVisibleElement("#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll") ||
      getVisibleElement("#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll");
    if (rejectBtn && clickElement(rejectBtn)) {
      recordDebugAction({ kind: "cookies", action: "vendor-click", detail: "cookiebot:reject" });
      return true;
    }

    if (mode !== "balanced") return false;

    const saveBtn =
      getVisibleElement("#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowSelection") ||
      getVisibleElement("#CybotCookiebotDialogBodyLevelButtonCustomize") ||
      getVisibleElement("#CybotCookiebotDialogBodyButtonDetails");
    if (saveBtn && clickElement(saveBtn)) {
      recordDebugAction({ kind: "cookies", action: "vendor-click", detail: "cookiebot:preferences-or-save" });
      return true;
    }

    return false;
  }

  function tryDidomiCookieAction() {
    const mode = settings.cookieMode || "strict";
    const host = document.querySelector("#didomi-host, [class*='didomi']");
    if (!host) return false;

    const clickByText = (terms) => {
      const nodes = Array.from(document.querySelectorAll("button, [role='button']"));
      const candidate = nodes.find((node) => {
        if (!(node instanceof HTMLElement) || !getVisible(node)) return false;
        const text = getText(node);
        const attrs = `${node.id || ""} ${node.className || ""}`.toLowerCase();
        return (
          hasAny(text, terms) ||
          hasAny(attrs, ["didomi-notice-disagree-button", "didomi-continue-without-agreeing"])
        );
      });
      return candidate ? clickElement(candidate) : false;
    };

    if (
      clickByText(["reject", "decline", "disagree", "continue without agreeing", "essential only"])
    ) {
      recordDebugAction({ kind: "cookies", action: "vendor-click", detail: "didomi:reject" });
      return true;
    }

    if (mode !== "balanced") return false;

    if (clickByText(["preferences", "manage", "customize", "settings"])) {
      recordDebugAction({ kind: "cookies", action: "vendor-click", detail: "didomi:open-preferences" });
      return true;
    }

    // If preference panel is open, try saving the current selection after turning off toggles.
    const checkedToggles = Array.from(
      document.querySelectorAll(
        "#didomi-host input[type='checkbox']:checked, [class*='didomi'] input[type='checkbox']:checked"
      )
    ).filter((el) => el instanceof HTMLInputElement && !el.disabled);

    checkedToggles.forEach((input) => {
      try {
        input.click();
      } catch {
        // ignore
      }
    });

    if (checkedToggles.length > 0) {
      const saveNodes = Array.from(document.querySelectorAll("button, [role='button']"));
      const saveBtn = saveNodes.find((node) => {
        if (!(node instanceof HTMLElement) || !getVisible(node)) return false;
        const text = getText(node);
        return hasAny(text, ["save", "confirm choices", "apply", "agree to selected"]);
      });
      if (saveBtn && clickElement(saveBtn)) {
        recordDebugAction({
          kind: "cookies",
          action: "vendor-click",
          detail: `didomi:save-preferences:${checkedToggles.length}`
        });
        return true;
      }
    }

    return false;
  }

  const COOKIE_VENDOR_ADAPTERS = [
    { id: "onetrust", cleanup: cleanupOneTrustArtifacts, tryAction: tryOneTrustCookieAction },
    { id: "cookiebot", cleanup: cleanupCookiebotArtifacts, tryAction: tryCookiebotCookieAction },
    { id: "didomi", cleanup: cleanupDidomiArtifacts, tryAction: tryDidomiCookieAction },
    { id: "trustarc", cleanup: cleanupTrustArcArtifacts }
  ];

  function tryCookieVendorActions() {
    for (const adapter of COOKIE_VENDOR_ADAPTERS) {
      if (typeof adapter.tryAction !== "function") continue;
      let acted = false;
      try {
        acted = Boolean(adapter.tryAction());
      } catch {
        acted = false;
      }
      if (acted) return adapter.id;
    }
    return null;
  }

  function runCookieVendorAdapters(phase = "generic") {
    let changedAny = false;
    for (const adapter of COOKIE_VENDOR_ADAPTERS) {
      let changed = false;
      try {
        changed = Boolean(adapter.cleanup());
      } catch {
        changed = false;
      }

      if (changed) {
        changedAny = true;
        unblockPageScroll(`cookies:${adapter.id}:${phase}`);
        recordDebugAction({ kind: "cookies", action: "vendor-cleanup", detail: `${adapter.id}:${phase}` });
      }
    }
    return changedAny;
  }

  function hideElement(el) {
    if (!(el instanceof HTMLElement)) return;
    el.setAttribute("data-popupguard-hidden", "1");
    el.style.setProperty("display", "none", "important");
    el.style.setProperty("visibility", "hidden", "important");
    el.style.setProperty("pointer-events", "none", "important");
  }

  function canActOnContainer(container, kind) {
    const now = Date.now();
    const last = recentActions.get(container);
    const cooldownMs = kind === "cookies" ? 3000 : 1200;
    if (last && now - last < cooldownMs) return false;
    recentActions.set(container, now);
    return true;
  }

  function logCookieScrollIssue(stage) {
    if (!DEBUG || !isScrollLocked()) return;
    const html = document.documentElement ? window.getComputedStyle(document.documentElement) : null;
    const body = document.body ? window.getComputedStyle(document.body) : null;
    debugLog("Cookie scroll still locked", stage, {
      html: html
        ? { overflow: html.overflow, overflowY: html.overflowY, position: html.position }
        : null,
      body: body
        ? { overflow: body.overflow, overflowY: body.overflowY, position: body.position }
        : null,
      htmlClass: document.documentElement?.className || "",
      bodyClass: document.body?.className || ""
    });
  }

  function tryDismissContainer(container, kind) {
    if (!settings.modalTypes[kind]) return false;
    if (kind === "cookies" && (settings.cookieMode || "strict") === "off") return false;
    if (!canActOnContainer(container, kind)) return false;

    if (isLikelyChatWidget(container)) return false;
    if ((kind === "auth" || kind === "promo") && isLikelyAuthRoute()) return false;

    if ((kind === "auth" || kind === "promo") && !looksLikeOverlayContainer(container)) {
      return false;
    }

    if (kind === "cookies") {
      const vendorAction = tryCookieVendorActions();
      if (vendorAction) {
        unblockPageScroll(`cookies:${vendorAction}:vendor-action`);
        cleanupBackdropOverlays();
        runCookieVendorAdapters("post-vendor-action");
        window.setTimeout(() => logCookieScrollIssue("after-vendor-action"), 200);
        return true;
      }
    }

    const clickables = getClickables(container);
    const action = kind === "cookies" ? pickCookieAction(clickables) : pickModalAction(clickables);
    if (action && clickElement(action)) {
      recordDebugAction({
        kind,
        action: "click",
        detail: (getText(action) || action.id || action.className || action.tagName || "").slice(0, 120)
      });
      unblockPageScroll(`${kind}:click`);
      cleanupBackdropOverlays();
      if (kind === "cookies") runCookieVendorAdapters("post-click");
      if (kind === "cookies") window.setTimeout(() => logCookieScrollIssue("after-click"), 200);
      return true;
    }

    const text = getText(container);
    if (kind === "cookies") {
      // Avoid clicking "accept" as a fallback; hide the banner if no reject/close is available.
      if (hasAny(text, TEXT.cookie)) {
        hideElement(container);
        recordDebugAction({ kind: "cookies", action: "hide", detail: "no-safe-cookie-button" });
        unblockPageScroll("cookies:hide");
        cleanupBackdropOverlays();
        runCookieVendorAdapters("post-hide");
        window.setTimeout(() => logCookieScrollIssue("after-hide"), 200);
        return true;
      }
      return false;
    }

    if (kind === "promo" || kind === "auth") {
      hideElement(container);
      recordDebugAction({ kind, action: "hide", detail: "fallback-hide" });
      unblockPageScroll(`${kind}:hide`);
      cleanupBackdropOverlays();
      return true;
    }

    return false;
  }

  function scanAndDismiss() {
    if (!settings.enabled) return;
    if (isWhitelisted(location.hostname)) return;

    const containers = findLikelyContainers();
    let changed = false;

    for (const container of containers) {
      const kind = classifyContainer(container);
      if (!kind) continue;
      if (tryDismissContainer(container, kind)) {
        changed = true;
      }
    }

    if (changed) {
      // A second pass often catches stacked overlays after the first closes.
      window.setTimeout(() => {
        if (settings.enabled && !isWhitelisted(location.hostname)) {
          findLikelyContainers().forEach((container) => {
            const kind = classifyContainer(container);
            if (kind) tryDismissContainer(container, kind);
          });
        }
      }, 250);
    }

    if (changed) {
      cleanupBackdropOverlays();
      runCookieVendorAdapters("scan-pass");
    }
  }

  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;

    const now = Date.now();
    const wait = Math.max(0, 150 - (now - lastScanAt));

    window.setTimeout(() => {
      scheduled = false;
      lastScanAt = Date.now();
      scanAndDismiss();
    }, wait);
  }

  async function loadSettings() {
    try {
      const raw = await chrome.storage.sync.get(["enabled", "cookieMode", "modalTypes", "whitelist"]);
      settings = normalizeSettings(raw);
    } catch {
      settings = { ...DEFAULT_SETTINGS };
    }
  }

  async function init() {
    await loadSettings();
    scheduleScan();

    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      scheduleScan();
    });

    const root = document.documentElement || document;
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-hidden", "open"]
    });

    window.addEventListener("load", scheduleScan, { once: true });
    document.addEventListener("DOMContentLoaded", scheduleScan, { once: true });
    document.addEventListener("click", () => {
      window.setTimeout(scheduleScan, 100);
    });

    if (!cleanupIntervalsStarted) {
      cleanupIntervalsStarted = true;
      [500, 1200, 2500, 5000, 9000].forEach((ms) => {
        window.setTimeout(scheduleScan, ms);
      });
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    if (changes.enabled || changes.cookieMode || changes.modalTypes || changes.whitelist) {
      loadSettings().then(scheduleScan);
    }
  });

  init().catch(() => {});
})();
