const scrollButtons = document.querySelectorAll("[data-scroll-target]");
const revealNodes = document.querySelectorAll(".reveal");
const currentYear = document.getElementById("current-year");
const cookieBanner = document.getElementById("cookie-banner");
const cookieButtons = document.querySelectorAll("[data-cookie-action]");

const COOKIE_CONSENT_KEY = "dinavit-cookie-consent";
const COOKIE_CONSENT_NAME = "dinavit_cookie_consent";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
let activeConsent = null;
const trackingEnabled = document.body.dataset.trackingPage === "true";
let navigationInProgress = false;
let pendingNavigation = null;
const RETURN_ROUTES = new Set(["/", "/productos/creatina", "/productos/creatina-6-razones"]);

const PAGE_VARIANTS = {
    "/": "home",
    "/productos/creatina": "creatina",
    "/productos/creatina-6-razones": "creatina-6-razones",
    "/out-of-stock": "out-of-stock",
    "/email-confirmed": "email-confirmed",
    "/politica-privacidad": "politica-privacidad",
    "/politica-cookies": "politica-cookies",
    "/aviso-legal": "aviso-legal",
};
const pagePath = window.location.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "") || "/";
const pageVariant = document.body.dataset.landingVariant || PAGE_VARIANTS[pagePath] || pagePath;

function withPageContext(params = {}) {
    return { ...params, landing_variant: pageVariant };
}

// Only return to our home or product pages, never an external URL supplied
// through the query string. Preserve query parameters and section anchors.
function allowedReturnURL(value) {
    if (!value) return null;
    try {
        const candidate = new URL(value, window.location.origin);
        const route = candidate.pathname.replace(/\/index\.html$/, "").replace(/\/$/, "") || "/";
        if (candidate.origin !== window.location.origin || !RETURN_ROUTES.has(route)) return null;
        return candidate;
    } catch {
        return null;
    }
}

function purchaseDestination(url) {
    const destination = new URL(url, window.location.origin);
    const origin = allowedReturnURL(window.location.href);
    if (destination.origin === window.location.origin &&
        destination.pathname.replace(/\/$/, "") === "/out-of-stock" && origin) {
        destination.searchParams.set("return_to", origin.pathname + origin.search + origin.hash);
        return destination.pathname + destination.search + destination.hash;
    }
    return url;
}

function configureReturnLink() {
    const link = document.getElementById("return-to-origin");
    if (!link) return;
    const current = new URL(window.location.href);
    const origin = allowedReturnURL(current.searchParams.get("return_to")) ||
        allowedReturnURL(document.referrer);
    link.href = origin ? origin.pathname + origin.search + origin.hash : "/";
    const referrer = allowedReturnURL(document.referrer);
    if (origin && referrer && origin.pathname === referrer.pathname &&
        origin.search === referrer.search && window.history.length > 1) {
        // Back restores the exact scroll position and, when available, the
        // browser's cached cart. The href remains a safe fallback for new tabs.
        link.addEventListener("click", (event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            window.history.back();
        });
    }
}

function getCookieValue(name) {
    const key = `${name}=`;
    const parts = document.cookie.split(";");

    for (const part of parts) {
        const cookie = part.trim();
        if (cookie.startsWith(key)) {
            return cookie.slice(key.length);
        }
    }

    return null;
}

function setCookieValue(name, value, maxAgeSeconds) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function getStoredConsent() {
    const cookieRaw = getCookieValue(COOKIE_CONSENT_NAME);
    if (cookieRaw) {
        try {
            return JSON.parse(decodeURIComponent(cookieRaw));
        } catch {
            // Ignore malformed cookie value.
        }
    }

    try {
        const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function setStoredConsent(consent) {
    try {
        const encoded = encodeURIComponent(JSON.stringify(consent));
        setCookieValue(COOKIE_CONSENT_NAME, encoded, COOKIE_MAX_AGE_SECONDS);
    } catch {
        // Ignore serialization and cookie errors.
    }

    try {
        localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consent));
    } catch {
        // Ignore storage errors and keep banner visible.
    }
}

function getConfigValue(key) {
    if (typeof window[key] === "string" && window[key].trim()) {
        return window[key].trim();
    }

    return null;
}

function getAnalyticsMeasurementId() {
    return trackingEnabled ? getConfigValue("GA_MEASUREMENT_ID") : null;
}

function getMetaPixelId() {
    return trackingEnabled ? getConfigValue("META_PIXEL_ID") : null;
}

function showCookieBanner() {
    if (!cookieBanner) {
        return;
    }

    cookieBanner.hidden = false;
}

function hideCookieBanner() {
    if (!cookieBanner) {
        return;
    }

    cookieBanner.hidden = true;
}

function loadGoogleAnalyticsIfConfigured() {
    const measurementId = getAnalyticsMeasurementId();

    if (!measurementId || document.getElementById("ga-consent-script")) {
        return;
    }

    const script = document.createElement("script");
    script.id = "ga-consent-script";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() {
        window.dataLayer.push(arguments);
    }

    window.gtag = gtag;
    gtag("js", new Date());
    gtag("consent", "default", {
        analytics_storage: "granted",
    });
    gtag("config", measurementId, { anonymize_ip: true, landing_variant: pageVariant });

    flushPendingEvents();
}

// Equivale al código base oficial de Meta Pixel, pero se ejecuta solo tras el
// consentimiento. fbq encola las llamadas hasta que se descarga fbevents.js.
function loadMetaPixelIfConfigured() {
    const pixelId = getMetaPixelId();

    if (!pixelId) {
        return;
    }

    if (document.getElementById("meta-pixel-consent-script")) {
        window.fbq("consent", "grant");
        flushPendingMetaEvents();
        return;
    }

    if (typeof window.fbq !== "function") {
        const fbq = function () {
            fbq.callMethod
                ? fbq.callMethod.apply(fbq, arguments)
                : fbq.queue.push(arguments);
        };

        fbq.push = fbq;
        fbq.loaded = true;
        fbq.version = "2.0";
        fbq.queue = [];
        window.fbq = fbq;
        window._fbq = window._fbq || fbq;
    }

    const script = document.createElement("script");
    script.id = "meta-pixel-consent-script";
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);

    window.fbq("consent", "grant");
    window.fbq("init", pixelId);
    window.fbq("track", "PageView", withPageContext());

    flushPendingMetaEvents();
}

const MAX_PENDING_EVENTS = 20;
const pendingEvents = [];

// Envía un evento a GA4. Si el visitante todavía no ha respondido al banner,
// el evento se guarda en memoria (no en el dispositivo) y solo se envía si
// acepta; si rechaza, se descarta. Sin esto perderíamos siempre los eventos
// que ocurren antes de que decida, como el view_item de la carga inicial.
function trackEvent(name, params = {}) {
    if (!trackingEnabled) return;
    params = withPageContext(params);
    trackMetaEvent(name, params);

    if (activeConsent?.analytics === false) {
        return;
    }

    if (activeConsent?.analytics !== true || typeof window.gtag !== "function") {
        if (pendingEvents.length < MAX_PENDING_EVENTS) {
            pendingEvents.push({ name, params });
        }

        return;
    }

    window.gtag("event", name, params);
}

// Los eventos en cola llegan a GA con la hora del envío, no la del clic.
function flushPendingEvents() {
    if (activeConsent?.analytics !== true || typeof window.gtag !== "function") {
        return;
    }

    while (pendingEvents.length > 0) {
        const { name, params } = pendingEvents.shift();
        window.gtag("event", name, params);
    }
}

function discardPendingEvents() {
    pendingEvents.length = 0;
}

// Eventos de GA4 que también se envían a Meta; purchase_intent es personalizado.
const META_EVENT_NAMES = {
    view_item: "ViewContent",
    add_to_cart: "AddToCart",
    purchase_intent: "purchase_intent",
};

const pendingMetaEvents = [];

function toMetaParams(params) {
    const items = params.items || [];

    return {
        currency: params.currency,
        value: params.value,
        content_type: "product",
        content_name: items[0]?.item_name,
        content_ids: items.map((item) => item.item_id).filter(Boolean),
        contents: items
            .filter((item) => item.item_id)
            .map((item) => ({ id: item.item_id, quantity: item.quantity ?? 1 })),
        landing_variant: pageVariant,
    };
}

// Igual que trackEvent con GA: si el visitante aún no ha aceptado, el evento
// espera en memoria y solo se envía a Meta si acepta.
function trackMetaEvent(name, params) {
    if (!trackingEnabled) return;
    const metaName = META_EVENT_NAMES[name];
    if (!metaName || activeConsent?.marketing === false) {
        return;
    }

    const metaParams = toMetaParams(params);
    const command = name === "purchase_intent" ? "trackCustom" : "track";

    if (activeConsent?.marketing !== true || typeof window.fbq !== "function") {
        if (pendingMetaEvents.length < MAX_PENDING_EVENTS) {
            pendingMetaEvents.push({ command, metaName, metaParams });
        }

        return;
    }

    window.fbq(command, metaName, metaParams);
}

function flushPendingMetaEvents() {
    if (activeConsent?.marketing !== true || typeof window.fbq !== "function") {
        return;
    }
    while (pendingMetaEvents.length > 0) {
        const { command, metaName, metaParams } = pendingMetaEvents.shift();
        window.fbq(command, metaName, metaParams);
    }
}

// Called only once for a click (or after the pending consent decision).
function sendEventAndNavigate(name, params, url) {
    trackMetaEvent(name, params);

    if (activeConsent?.analytics !== true || typeof window.gtag !== "function") {
        window.location.href = url;
        return;
    }

    let hasNavigated = false;

    function navigate() {
        if (hasNavigated) {
            return;
        }

        hasNavigated = true;
        window.location.href = url;
    }

    window.gtag("event", name, { ...params, event_callback: navigate });
    window.setTimeout(navigate, 600);
}

function trackEventAndNavigate(name, params, url) {
    if (navigationInProgress) return;
    navigationInProgress = true;
    const destination = purchaseDestination(url);
    if (!trackingEnabled) {
        window.location.href = destination;
        return;
    }
    params = withPageContext(params);
    if (typeof activeConsent?.analytics !== "boolean" ||
        typeof activeConsent?.marketing !== "boolean") {
        // Keep intent in memory on the source page. Both Accept and Reject
        // continue the journey, but Reject must never send this event.
        pendingNavigation = { name, params, url: destination };
        window.DinavitCart?.close?.();
        document.querySelector("dialog[open]")?.close();
        showCookieBanner();
        cookieButtons[0]?.focus();
        return;
    }
    sendEventAndNavigate(name, params, destination);
}

window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        navigationInProgress = false;
        pendingNavigation = null;
    }
});

window.trackEvent = trackEvent;
window.trackEventAndNavigate = trackEventAndNavigate;

// GA y Meta escriben sus cookies en el dominio raíz (.dinavit.com), así que
// para borrarlas hay que repetir el borrado indicando cada dominio padre.
function clearCookie(name) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    const hostParts = window.location.hostname.split(".");
    const domainAttributes = [""];

    for (let i = 0; i < hostParts.length - 1; i += 1) {
        domainAttributes.push(`; domain=.${hostParts.slice(i).join(".")}`);
    }

    domainAttributes.forEach((domain) => {
        document.cookie = `${name}=; Max-Age=0; path=/${domain}; SameSite=Lax${secure}`;
    });
}

function getCookieNames() {
    return document.cookie
        .split(";")
        .map((cookie) => cookie.trim().split("=")[0])
        .filter(Boolean);
}

function disableGoogleAnalyticsIfConfigured() {
    discardPendingEvents();

    const measurementId = getAnalyticsMeasurementId();
    if (measurementId) {
        window[`ga-disable-${measurementId}`] = true;
    }

    const script = document.getElementById("ga-consent-script");
    if (script) {
        script.remove();
    }

    if (typeof window.gtag === "function") {
        window.gtag("consent", "update", { analytics_storage: "denied" });
    }

    getCookieNames()
        .filter(
            (name) =>
                name === "_gid" || name === "_gat" || name.startsWith("_ga"),
        )
        .forEach(clearCookie);
}

function disableMetaPixel() {
    pendingMetaEvents.length = 0;

    if (typeof window.fbq === "function") {
        window.fbq("consent", "revoke");
    }

    getCookieNames()
        .filter((name) => name === "_fbp" || name === "_fbc")
        .forEach(clearCookie);
}

function applyConsent(consent) {
    activeConsent = consent;
    if (consent?.analytics === true) {
        const measurementId = getAnalyticsMeasurementId();
        if (measurementId) {
            window[`ga-disable-${measurementId}`] = false;
        }

        loadGoogleAnalyticsIfConfigured();
    } else {
        disableGoogleAnalyticsIfConfigured();
    }

    if (consent?.marketing === true) {
        loadMetaPixelIfConfigured();
    } else {
        disableMetaPixel();
    }
}

function saveConsentAndClose(consent) {
    setStoredConsent(consent);
    applyConsent(consent);
    hideCookieBanner();
    if (pendingNavigation) {
        const { name, params, url } = pendingNavigation;
        pendingNavigation = null;
        sendEventAndNavigate(name, params, url);
    }
}

if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
}

configureReturnLink();

const initialConsent = trackingEnabled ? getStoredConsent() : null;
if (initialConsent) {
    applyConsent(initialConsent);
}

// Quien respondió al banner antes de añadir Meta solo consintió la analítica:
// sin el campo marketing hay que volver a preguntarle.
if (!trackingEnabled || typeof initialConsent?.marketing === "boolean") {
    hideCookieBanner();
} else {
    showCookieBanner();
}

cookieButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const action = button.getAttribute("data-cookie-action");

        if (action === "accept") {
            saveConsentAndClose({
                analytics: true,
                marketing: true,
                updatedAt: Date.now(),
            });
            return;
        }

        if (action === "reject") {
            saveConsentAndClose({
                analytics: false,
                marketing: false,
                updatedAt: Date.now(),
            });
            return;
        }
    });
});

scrollButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const targetSelector = button.getAttribute("data-scroll-target");
        const target = targetSelector
            ? document.querySelector(targetSelector)
            : null;

        if (!target) {
            return;
        }

        target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
});

const revealObserver = new IntersectionObserver(
    (entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) {
                return;
            }

            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
        });
    },
    {
        threshold: 0.16,
        rootMargin: "0px 0px -5% 0px",
    },
);

revealNodes.forEach((node) => {
    revealObserver.observe(node);
});
