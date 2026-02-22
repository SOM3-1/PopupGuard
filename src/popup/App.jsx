import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, normalizeDomain, normalizeSettings } from "./settings.js";

async function getActiveTabDomain() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return "";
    const url = new URL(tab.url);
    return normalizeDomain(url.hostname);
  } catch {
    return "";
  }
}

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [manualDomain, setManualDomain] = useState("");
  const [currentDomain, setCurrentDomain] = useState("");
  const [lastAction, setLastAction] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [raw, activeDomain, debugState] = await Promise.all([
        chrome.storage.sync.get(["enabled", "cookieMode", "modalTypes", "whitelist"]),
        getActiveTabDomain(),
        chrome.storage.local.get(["popupguardLastAction"])
      ]);
      if (!mounted) return;
      setSettings(normalizeSettings(raw));
      setCurrentDomain(activeDomain);
      setLastAction(debugState?.popupguardLastAction || null);
      setLoading(false);
    }

    load().catch(() => {
      if (mounted) setLoading(false);
    });

    const onChanged = (changes, areaName) => {
      if (areaName === "sync" && (changes.enabled || changes.cookieMode || changes.modalTypes || changes.whitelist)) {
        chrome.storage.sync.get(["enabled", "cookieMode", "modalTypes", "whitelist"]).then((raw) => {
          if (mounted) setSettings(normalizeSettings(raw));
        });
      }
      if (areaName === "local" && changes.popupguardLastAction) {
        if (mounted) setLastAction(changes.popupguardLastAction.newValue || null);
      }
    };

    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  function persist(nextOrUpdater) {
    setSettings((prev) => {
      const nextValue =
        typeof nextOrUpdater === "function" ? nextOrUpdater(prev) : nextOrUpdater;
      const normalized = normalizeSettings(nextValue);
      chrome.storage.sync.set(normalized).catch(() => {});
      return normalized;
    });
  }

  function setEnabled(nextEnabled) {
    persist((prev) => ({ ...prev, enabled: nextEnabled }));
  }

  function setCookieMode(cookieMode) {
    persist((prev) => ({ ...prev, cookieMode }));
  }

  function toggleType(type) {
    persist((prev) => ({
      ...prev,
      modalTypes: {
        ...prev.modalTypes,
        [type]: !prev.modalTypes[type]
      }
    }));
  }

  function addWhitelistDomain(domainInput) {
    const domain = normalizeDomain(domainInput);
    if (!domain) return;
    persist((prev) => {
      const nextList = Array.from(new Set([...prev.whitelist, domain])).sort();
      return { ...prev, whitelist: nextList };
    });
    setManualDomain("");
  }

  function removeWhitelistDomain(domain) {
    persist((prev) => ({
      ...prev,
      whitelist: prev.whitelist.filter((item) => item !== domain)
    }));
  }

  async function clearDebugData() {
    await chrome.storage.local.remove("popupguardLastAction");
    setLastAction(null);
  }

  const currentWhitelisted = currentDomain && settings.whitelist.includes(currentDomain);
  const currentSiteLastAction =
    currentDomain && lastAction?.host && normalizeDomain(lastAction.host) === currentDomain
      ? lastAction
      : null;

  if (loading) {
    return <div className="panel loading">Loading…</div>;
  }

  return (
    <div className="panel">
      <header className="header">
        <div className="brand">
          <img src="/icons/icon-32.png" alt="" width="20" height="20" />
          <div>
            <h1>PopupGuard</h1>
            <p>Auto-closes promo, login, and cookie prompts.</p>
          </div>
        </div>
        <label className="switchRow headerSwitch">
          <input
            className="switchInput"
            type="checkbox"
            role="switch"
            checked={settings.enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            aria-label="Enable PopupGuard"
          />
          <span className="switchTrack" aria-hidden="true">
            <span className="switchThumb" />
          </span>
          <span className="switchStateText">{settings.enabled ? "On" : "Off"}</span>
        </label>
      </header>

      <section className="section">
        <h2>Extension State</h2>
        <p className="stateSummary">
          PopupGuard is currently <strong>{settings.enabled ? "enabled" : "disabled"}</strong>.
        </p>
      </section>

      <section className="section">
        <h2>Modal Types</h2>
        <div className={`settingList ${!settings.enabled ? "isDisabled" : ""}`}>
          <label className={`settingRow ${settings.modalTypes.promo ? "selected" : ""}`}>
            <span className="settingText">
              <span className="settingTitle">Promotions / Newsletter</span>
              <span className="settingHint">
                Closes offer, discount, spin-wheel, and signup promo overlays.
              </span>
            </span>
            <input
              className="switchInput"
              type="checkbox"
              role="switch"
              checked={settings.modalTypes.promo}
              onChange={() => toggleType("promo")}
              disabled={!settings.enabled}
              aria-label="Enable promotions and newsletter popup handling"
            />
            <span className="switchTrack" aria-hidden="true">
              <span className="switchThumb" />
            </span>
          </label>

          <label className={`settingRow ${settings.modalTypes.auth ? "selected" : ""}`}>
            <span className="settingText">
              <span className="settingTitle">Sign in / Login</span>
              <span className="settingHint">
                Closes account, login, and member gate prompts when detected.
              </span>
            </span>
            <input
              className="switchInput"
              type="checkbox"
              role="switch"
              checked={settings.modalTypes.auth}
              onChange={() => toggleType("auth")}
              disabled={!settings.enabled}
              aria-label="Enable sign in and login popup handling"
            />
            <span className="switchTrack" aria-hidden="true">
              <span className="switchThumb" />
            </span>
          </label>

          <label className={`settingRow ${settings.modalTypes.cookies ? "selected" : ""}`}>
            <span className="settingText">
              <span className="settingTitle">Cookies</span>
              <span className="settingHint">
                Uses privacy-first actions such as reject, decline, or essential only when available.
              </span>
            </span>
            <input
              className="switchInput"
              type="checkbox"
              role="switch"
              checked={settings.modalTypes.cookies}
              onChange={() => toggleType("cookies")}
              disabled={!settings.enabled}
              aria-label="Enable cookie popup handling"
            />
            <span className="switchTrack" aria-hidden="true">
              <span className="switchThumb" />
            </span>
          </label>
        </div>
        {!settings.enabled ? (
          <p className="sectionHint">Enable PopupGuard to change modal-type toggles.</p>
        ) : null}
        <div className="cookieModeRow">
          <label htmlFor="cookieMode" className="cookieModeLabel">
            Cookie Mode
          </label>
          <select
            id="cookieMode"
            className="selectInput"
            value={settings.cookieMode}
            onChange={(e) => setCookieMode(e.target.value)}
            disabled={!settings.enabled || !settings.modalTypes.cookies}
          >
            <option value="strict">Strict</option>
            <option value="balanced">Balanced</option>
            <option value="off">Off</option>
          </select>
        </div>
        <p className="sectionHint">
          Strict: reject/close only. Balanced: may open non-link preferences. Off: does not act on cookie popups.
        </p>
      </section>

      <section className="section">
        <h2>Current Site</h2>
        <div className="currentSite">
          <code>{currentDomain || "Unavailable"}</code>
          {currentDomain ? (
            <button
              type="button"
              className="smallBtn"
              onClick={() =>
                currentWhitelisted
                  ? removeWhitelistDomain(currentDomain)
                  : addWhitelistDomain(currentDomain)
              }
            >
              {currentWhitelisted ? "Enable on This Site" : "Disable on This Site"}
            </button>
          ) : null}
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6b7280" }}>
          {currentWhitelisted
            ? "PopupGuard is disabled for this site."
            : "PopupGuard is active on this site."}
        </p>
      </section>

      <section className="section">
        <h2>Disabled Sites</h2>
        <div className="addRow">
          <input
            type="text"
            placeholder="example.com"
            value={manualDomain}
            onChange={(e) => setManualDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addWhitelistDomain(manualDomain);
            }}
          />
          <button type="button" className="smallBtn" onClick={() => addWhitelistDomain(manualDomain)}>
            Add
          </button>
        </div>

        <ul className="list">
          {settings.whitelist.length === 0 ? (
            <li className="empty">No disabled sites</li>
          ) : (
            settings.whitelist.map((domain) => (
              <li key={domain}>
                <code>{domain}</code>
                <button type="button" className="linkBtn" onClick={() => removeWhitelistDomain(domain)}>
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="section">
        <div className="sectionHeaderRow">
          <h2>Debug (Current Site)</h2>
          <button type="button" className="subtleBtn" onClick={clearDebugData}>
            Clear
          </button>
        </div>
        {currentSiteLastAction ? (
          <div className="debugBox">
            <div>
              <strong>{currentSiteLastAction.kind}</strong> · {currentSiteLastAction.action}
            </div>
            {currentSiteLastAction.detail ? <div>{String(currentSiteLastAction.detail)}</div> : null}
            <div className="debugMuted">
              {new Date(currentSiteLastAction.ts).toLocaleString()}
            </div>
          </div>
        ) : (
          <p className="sectionHint">No recent PopupGuard action recorded for this site in this session.</p>
        )}
      </section>
    </div>
  );
}
