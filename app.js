const scrollButtons = document.querySelectorAll("[data-scroll-target]");
const revealNodes = document.querySelectorAll(".reveal");
const currentYear = document.getElementById("current-year");
const cookieBanner = document.getElementById("cookie-banner");
const cookieButtons = document.querySelectorAll("[data-cookie-action]");

const COOKIE_CONSENT_KEY = "dinavit-cookie-consent";
const COOKIE_CONSENT_NAME = "dinavit_cookie_consent";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

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
    return getConfigValue("GA_MEASUREMENT_ID");
}

function getMetaPixelId() {
    return getConfigValue("META_PIXEL_ID");
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
    gtag("config", measurementId, { anonymize_ip: true });

    flushPendingEvents();
}

// Equivale al código base oficial de Meta Pixel, pero se ejecuta solo tras el
// consentimiento. fbq encola las llamadas hasta que se descarga fbevents.js.
function loadMetaPixelIfConfigured() {
    const pixelId = getMetaPixelId();

    if (!pixelId || document.getElementById("meta-pixel-consent-script")) {
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

    window.fbq("init", pixelId);
    window.fbq("track", "PageView");

    flushPendingMetaEvents();
}

const MAX_PENDING_EVENTS = 20;
const pendingEvents = [];

// Envía un evento a GA4. Si el visitante todavía no ha respondido al banner,
// el evento se guarda en memoria (no en el dispositivo) y solo se envía si
// acepta; si rechaza, se descarta. Sin esto perderíamos siempre los eventos
// que ocurren antes de que decida, como el view_item de la carga inicial.
function trackEvent(name, params = {}) {
    trackMetaEvent(name, params);

    if (typeof window.gtag !== "function") {
        if (pendingEvents.length < MAX_PENDING_EVENTS) {
            pendingEvents.push({ name, params });
        }

        return;
    }

    window.gtag("event", name, params);
}

// Los eventos en cola llegan a GA con la hora del envío, no la del clic.
function flushPendingEvents() {
    if (typeof window.gtag !== "function") {
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

// Eventos de GA4 que también se envían a Meta, con su evento estándar.
const META_EVENT_NAMES = {
    view_item: "ViewContent",
    add_to_cart: "AddToCart",
    begin_checkout: "InitiateCheckout",
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
    };
}

// Igual que trackEvent con GA: si el visitante aún no ha aceptado, el evento
// espera en memoria y solo se envía a Meta si acepta.
function trackMetaEvent(name, params) {
    const metaName = META_EVENT_NAMES[name];
    if (!metaName) {
        return;
    }

    const metaParams = toMetaParams(params);

    if (typeof window.fbq !== "function") {
        if (pendingMetaEvents.length < MAX_PENDING_EVENTS) {
            pendingMetaEvents.push({ metaName, metaParams });
        }

        return;
    }

    window.fbq("track", metaName, metaParams);
}

function flushPendingMetaEvents() {
    while (pendingMetaEvents.length > 0) {
        const { metaName, metaParams } = pendingMetaEvents.shift();
        window.fbq("track", metaName, metaParams);
    }
}

// Envía un evento y navega después. Sin esto, la navegación puede cancelar la
// petición del evento antes de que salga. GA4 avisa por event_callback; el
// temporizador garantiza que el usuario navegue aunque el aviso no llegue.
function trackEventAndNavigate(name, params, url) {
    trackMetaEvent(name, params);

    if (typeof window.gtag !== "function") {
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
}

if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
}

const initialConsent = getStoredConsent();
if (initialConsent) {
    applyConsent(initialConsent);
}

// Quien respondió al banner antes de añadir Meta solo consintió la analítica:
// sin el campo marketing hay que volver a preguntarle.
if (typeof initialConsent?.marketing === "boolean") {
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
