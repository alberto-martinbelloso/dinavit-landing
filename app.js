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

function getAnalyticsMeasurementId() {
    if (
        typeof window.GA_MEASUREMENT_ID === "string" &&
        window.GA_MEASUREMENT_ID.trim()
    ) {
        return window.GA_MEASUREMENT_ID.trim();
    }

    return null;
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

const MAX_PENDING_EVENTS = 20;
const pendingEvents = [];

// Envía un evento a GA4. Si el visitante todavía no ha respondido al banner,
// el evento se guarda en memoria (no en el dispositivo) y solo se envía si
// acepta; si rechaza, se descarta. Sin esto perderíamos siempre los eventos
// que ocurren antes de que decida, como el view_item de la carga inicial.
function trackEvent(name, params = {}) {
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

// Envía un evento y navega después. Sin esto, la navegación puede cancelar la
// petición del evento antes de que salga. GA4 avisa por event_callback; el
// temporizador garantiza que el usuario navegue aunque el aviso no llegue.
function trackEventAndNavigate(name, params, url) {
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

function clearCookie(name) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${secure}`;
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

    const analyticsCookieNames = document.cookie
        .split(";")
        .map((cookie) => cookie.trim().split("=")[0])
        .filter(
            (name) =>
                name &&
                (name === "_gid" || name === "_gat" || name.startsWith("_ga")),
        );

    analyticsCookieNames.forEach((name) => {
        clearCookie(name);
    });
}

function applyConsent(consent) {
    if (consent?.analytics === true) {
        const measurementId = getAnalyticsMeasurementId();
        if (measurementId) {
            window[`ga-disable-${measurementId}`] = false;
        }

        loadGoogleAnalyticsIfConfigured();
        return;
    }

    disableGoogleAnalyticsIfConfigured();
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
    hideCookieBanner();
} else {
    showCookieBanner();
}

cookieButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const action = button.getAttribute("data-cookie-action");

        if (action === "accept") {
            saveConsentAndClose({ analytics: true, updatedAt: Date.now() });
            return;
        }

        if (action === "reject") {
            saveConsentAndClose({ analytics: false, updatedAt: Date.now() });
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
