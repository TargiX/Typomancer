/* Website traffic and allowlisted game events. No identities, form values or recordings. */
(() => {
  "use strict";
  const site = {"id": "1bb0c07e-4980-49d0-ae22-00c47dc9b746", "name": "Typomancer", "hosts": ["typomancer.xyz", "www.typomancer.xyz"], "paths": ["/"]};
  if (!site.hosts.includes(location.hostname) || navigator.doNotTrack === "1" ||
      navigator.doNotTrack === "yes" || navigator.globalPrivacyControl === true ||
      document.getElementById("site-traffic")) return;
  // Fail closed: authentication/recovery links do not load third-party code.
  if (/[?&#](?:token|code|reset-password|access_token|id_token|email)=?/i.test(location.search + location.hash)) return;
  window.siteTrafficBeforeSend = (type, payload) => {
    if (type !== "event" || !payload || navigator.doNotTrack === "1" ||
        navigator.globalPrivacyControl === true) return null;
    // Product events: only the game's own names, with flat allowlisted values
    // (the app sanitises them first; this is the second gate).
    const name = payload.name;
    if (name !== undefined && (typeof name !== "string" || !/^typomancer_[a-z_]{1,48}$/.test(name))) return null;
    let data;
    if (name && payload.data && typeof payload.data === "object") {
      data = {};
      for (const [key, value] of Object.entries(payload.data).slice(0, 20)) {
        if (!/^[a-z_]{1,32}$/.test(key)) continue;
        if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) data[key] = value;
        else if (typeof value === "string" && /^[a-z0-9._:/-]{1,64}$/.test(value)) data[key] = value;
      }
    }
    if (/[?&#](?:token|code|reset-password|access_token|id_token|email)=?/i.test(location.search + location.hash)) return null;
    let path = "/other";
    let referrer = "";
    try {
      const url = new URL(payload.url || location.href, location.origin);
      if (url.origin !== location.origin) return null;
      if (/[?&#](?:token|code|reset-password|access_token|id_token|email)=?/i.test(url.search + url.hash)) return null;
      path = site.paths.includes(url.pathname) ? url.pathname : "/other";
    } catch { return null; }
    try {
      const ref = new URL(payload.referrer);
      if (["https:", "http:"].includes(ref.protocol) && ref.hostname !== location.hostname) referrer = ref.origin;
    } catch { /* Internal and malformed referrers are omitted. */ }
    return {
      website: site.id,
      hostname: location.hostname,
      url: path,
      title: site.name,
      referrer,
      language: navigator.language,
      screen: `${screen.width}x${screen.height}`,
      ...(name ? { name, data: data || {} } : {}),
    };
  };
  const script = document.createElement("script");
  script.id = "site-traffic";
  script.defer = true;
  script.src = "https://stats.phosphene.cc/script.js";
  script.referrerPolicy = "no-referrer";
  const options = {
    "website-id": site.id,
    "domains": site.hosts.join(","),
    "before-send": "siteTrafficBeforeSend",
    "exclude-search": "true",
    "exclude-hash": "true",
    "do-not-track": "true",
    "performance": "false",
  };
  for (const [key, value] of Object.entries(options)) script.setAttribute(`data-${key}`, value);
  document.head.appendChild(script);
})();
