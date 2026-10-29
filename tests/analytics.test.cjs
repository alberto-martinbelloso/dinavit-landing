const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const pages = {
    "index.html": ["/", "home"],
    "productos/creatina/index.html": ["/productos/creatina/", "creatina"],
    "productos/creatina-6-razones/index.html": ["/productos/creatina-6-razones/", "creatina-6-razones"],
    "out-of-stock/index.html": ["/out-of-stock/", "out-of-stock"],
};
const excludedPages = ["archive/inicio-anterior.html", "email-confirmed/index.html", "politica-privacidad/index.html", "politica-cookies/index.html", "aviso-legal/index.html"];

// Execute the actual shared script without contacting either analytics service.
function harness(pathname = "/", consent, tracking = true, options = {}) {
    const ids = new Map();
    const cookies = new Map();
    const timers = [];
    if (consent) cookies.set("dinavit_cookie_consent", encodeURIComponent(JSON.stringify(consent)));
    function element() {
        return {
            hidden: true,
            handlers: {},
            addEventListener(name, callback) { this.handlers[name] = callback; },
            focus() { this.focused = true; },
            remove() { ids.delete(this.id); },
        };
    }
    const banner = element();
    ids.set("cookie-banner", banner);
    if (options.returnLink) ids.set("return-to-origin", element());
    const dialog = options.dialog ? { closed: false, close() { this.closed = true; } } : null;
    const accept = element();
    const reject = element();
    accept.getAttribute = () => "accept";
    reject.getAttribute = () => "reject";
    const document = {
        body: { dataset: tracking ? { trackingPage: "true" } : {} },
        getElementById: (id) => ids.get(id) || null,
        querySelector: () => dialog,
        querySelectorAll: (selector) => selector === "[data-cookie-action]" ? [reject, accept] : [],
        createElement: element,
        head: { appendChild(node) { ids.set(node.id, node); } },
        referrer: options.referrer || "",
    };
    Object.defineProperty(document, "cookie", {
        get: () => [...cookies].map(([key, value]) => `${key}=${value}`).join("; "),
        set: (value) => {
            const [pair] = value.split(";");
            const index = pair.indexOf("=");
            const name = pair.slice(0, index);
            if (value.includes("Max-Age=0")) cookies.delete(name);
            else cookies.set(name, pair.slice(index + 1));
        },
    });
    const location = new URL(pathname, "https://www.dinavit.com");
    const window = {
        GA_MEASUREMENT_ID: "G-TEST123",
        META_PIXEL_ID: "12345",
        location: { pathname: location.pathname, search: location.search, hash: location.hash, origin: location.origin, protocol: location.protocol, hostname: location.hostname, href: location.href },
        history: { length: options.historyLength || 1, backCalls: 0, back() { this.backCalls += 1; } },
        handlers: {},
        addEventListener(name, callback) { this.handlers[name] = callback; },
        setTimeout(callback) { timers.push(callback); },
    };
    const storage = new Map();
    vm.runInNewContext(source, {
        document,
        window,
        URL,
        localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        IntersectionObserver: class { observe() {} },
    });
    return {
        window, ids, banner, dialog,
        accept: () => accept.handlers.click(),
        reject: () => reject.handlers.click(),
        ga: () => (window.dataLayer || []).map((args) => Array.from(args)),
        meta: () => (window.fbq?.queue || []).map((args) => Array.from(args)),
        runTimers: () => timers.splice(0).forEach((callback) => callback()),
    };
}

const item = { currency: "EUR", value: 64.95, items: [{ item_id: "3", item_name: "Dinavit CORE", quantity: 2 }] };
const measurementCalls = (calls) => calls.filter(([command]) => command === "event" || command === "track" || command === "trackCustom");
function assertDestination(h, expectedOrigin) {
    const destination = new URL(h.window.location.href, h.window.location.origin);
    assert.equal(destination.pathname, "/out-of-stock");
    assert.equal(destination.searchParams.get("return_to"), expectedOrigin);
}

test("only the four authorized pages include the tracking setup and consent banner", () => {
    for (const file of Object.keys(pages)) {
        const html = fs.readFileSync(path.join(root, file), "utf8");
        assert.equal((html.match(/src="\/config\.js"/g) || []).length, 1, file);
        assert.equal((html.match(/src="\/app\.js(?:\?[^"]*)?"/g) || []).length, 1, file);
        assert.ok(html.indexOf('src="/config.js"') < html.indexOf('src="/app.js'), file);
        assert.equal((html.match(/id="cookie-banner"/g) || []).length, 1, file);
        assert.ok(html.includes('data-cookie-action="accept"'), file);
        assert.ok(html.includes('data-cookie-action="reject"'), file);
        assert.ok(html.includes('href="/cookies.css"'), file);
        assert.ok(html.includes('data-tracking-page="true"'), file);
    }
    for (const file of excludedPages) {
        const html = fs.readFileSync(path.join(root, file), "utf8");
        assert.equal(html.includes('src="/config.js"'), false, file);
        assert.equal(html.includes('data-tracking-page="true"'), false, file);
        assert.equal(html.includes('id="cookie-banner"'), false, file);
    }
});

test("excluded pages cannot load tags or send events even with saved consent", () => {
    const h = harness("/inicio-anterior/", { analytics: true, marketing: true }, false);
    h.window.trackEvent("view_item", item);
    h.window.trackEventAndNavigate("purchase_intent", item, "/out-of-stock");
    assert.equal(h.ids.has("ga-consent-script"), false);
    assert.equal(h.ids.has("meta-pixel-consent-script"), false);
    assert.equal(h.ga().length, 0);
    assert.equal(h.meta().length, 0);
    assert.equal(h.banner.hidden, true);
    assertDestination(h, null);
});

test("each page sends its own variant to GA configuration and Meta PageView", () => {
    for (const [pathname, variant] of Object.values(pages)) {
        const h = harness(pathname, { analytics: true, marketing: true });
        assert.equal(h.ga().find(([command]) => command === "config")[2].landing_variant, variant);
        assert.equal(h.meta().find(([command, event]) => command === "track" && event === "PageView")[2].landing_variant, variant);
    }
    const h = harness("/productos/creatina-6-razones/index.html", { analytics: true, marketing: true });
    assert.equal(h.ga().find(([command]) => command === "config")[2].landing_variant, "creatina-6-razones");
});

test("unknown consent loads no tags and sends queued events once after acceptance", () => {
    const h = harness("/productos/creatina-6-razones/");
    h.window.trackEvent("view_item", item);
    assert.equal(h.ids.has("ga-consent-script"), false);
    assert.equal(h.ids.has("meta-pixel-consent-script"), false);
    assert.equal(h.ga().length, 0);
    assert.equal(h.meta().length, 0);
    assert.equal(h.banner.hidden, false);
    h.accept();
    assert.equal(h.ga().filter(([command, name]) => command === "event" && name === "view_item").length, 1);
    const meta = h.meta().filter(([command, name]) => command === "track" && name === "ViewContent");
    assert.equal(meta.length, 1);
    assert.equal(meta[0][2].landing_variant, "creatina-6-razones");
    assert.equal(meta[0][2].contents[0].id, "3");
    assert.equal(meta[0][2].contents[0].quantity, 2);
    assert.equal(h.banner.hidden, true);
});

test("rejection discards pending and later events instead of replaying them on acceptance", () => {
    const h = harness();
    h.window.trackEvent("view_item", item);
    h.reject();
    h.window.trackEvent("add_to_cart", item);
    h.accept();
    assert.equal(h.ga().filter(([command]) => command === "event").length, 0);
    assert.equal(h.meta().filter(([command, name]) => command === "track" && name !== "PageView").length, 0);
});

test("revocation blocks events even while tracking functions still exist", () => {
    const h = harness("/", { analytics: true, marketing: true });
    h.reject();
    const gaBefore = measurementCalls(h.ga()).length;
    const metaBefore = measurementCalls(h.meta()).length;
    h.window.trackEvent("add_to_cart", item);
    h.window.trackEventAndNavigate("purchase_intent", item, "/out-of-stock");
    assert.equal(measurementCalls(h.ga()).length, gaBefore);
    assert.equal(measurementCalls(h.meta()).length, metaBefore);
    assertDestination(h, "/");
    h.accept();
    assert.ok(h.meta().some(([command, action]) => command === "consent" && action === "grant"));
    h.window.trackEvent("add_to_cart", item);
    assert.equal(h.ga().filter(([command, name]) => command === "event" && name === "add_to_cart").length, 1);
    assert.equal(h.meta().filter(([command, name]) => command === "track" && name === "AddToCart").length, 1);
});

test("analytics and marketing consent stay independent", () => {
    const gaOnly = harness("/", { analytics: true, marketing: false });
    gaOnly.window.trackEvent("view_item", item);
    assert.equal(gaOnly.ga().filter(([command]) => command === "event").length, 1);
    assert.equal(gaOnly.meta().length, 0);
    const metaOnly = harness("/", { analytics: false, marketing: true });
    metaOnly.window.trackEvent("view_item", item);
    assert.equal(metaOnly.ga().length, 0);
    assert.ok(metaOnly.meta().some(([command, name]) => command === "track" && name === "ViewContent"));
});

test("purchase intent includes context, uses Meta trackCustom and preserves navigation", () => {
    const h = harness("/productos/creatina/", { analytics: true, marketing: true });
    h.window.trackEventAndNavigate("purchase_intent", item, "/out-of-stock");
    const ga = h.ga().find(([command, name]) => command === "event" && name === "purchase_intent");
    const meta = h.meta().find(([command, name]) => command === "trackCustom" && name === "purchase_intent");
    assert.equal(ga[2].landing_variant, "creatina");
    assert.equal(meta[2].landing_variant, "creatina");
    assert.equal(meta[2].value, 64.95);
    h.runTimers();
    assertDestination(h, "/productos/creatina/");
    assert.equal(h.meta().some(([, name]) => name === "Purchase"), false);
    assert.equal(h.meta().some(([, name]) => name === "InitiateCheckout"), false);
    assert.equal(h.ga().some(([, name]) => name === "begin_checkout"), false);
});

test("queued purchase intent is also sent as a custom Meta event after consent", () => {
    const h = harness();
    h.window.trackEvent("purchase_intent", item);
    assert.equal(h.ga().length, 0);
    assert.equal(h.meta().length, 0);
    h.accept();
    assert.equal(h.ga().filter(([command, name]) => command === "event" && name === "purchase_intent").length, 1);
    assert.equal(h.meta().filter(([command, name]) => command === "trackCustom" && name === "purchase_intent").length, 1);
    assert.equal(h.meta().some(([, name]) => name === "InitiateCheckout"), false);
});

test("buying before a consent decision waits on the source page and sends once after acceptance", () => {
    const sourceURL = "/productos/creatina-6-razones/?utm_content=test#dv-oferta";
    const h = harness(sourceURL, undefined, true, { dialog: true });
    const initialURL = h.window.location.href;
    h.window.trackEventAndNavigate("purchase_intent", item, "/out-of-stock");
    h.window.trackEventAndNavigate("purchase_intent", item, "/out-of-stock");
    assert.equal(h.window.location.href, initialURL);
    assert.equal(h.dialog.closed, true);
    assert.equal(h.banner.hidden, false);
    assert.equal(h.ga().length, 0);
    assert.equal(h.meta().length, 0);
    h.accept();
    assert.equal(h.ga().filter(([, name]) => name === "purchase_intent").length, 1);
    assert.equal(h.meta().filter(([, name]) => name === "purchase_intent").length, 1);
    h.runTimers();
    assertDestination(h, sourceURL);
});

test("rejecting after clicking Buy continues without sending the intent", () => {
    const h = harness();
    h.window.trackEventAndNavigate("purchase_intent", item, "/out-of-stock");
    h.reject();
    assertDestination(h, "/");
    assert.equal(h.ga().length, 0);
    assert.equal(h.meta().length, 0);
});

test("multiple clicks produce only one intent until navigation, and browser Back resets the guard", () => {
    const h = harness("/", { analytics: true, marketing: true });
    h.window.trackEventAndNavigate("purchase_intent", item, "/out-of-stock");
    h.window.trackEventAndNavigate("purchase_intent", item, "/out-of-stock");
    assert.equal(h.ga().filter(([, name]) => name === "purchase_intent").length, 1);
    assert.equal(h.meta().filter(([, name]) => name === "purchase_intent").length, 1);
    h.runTimers();
    assertDestination(h, "/");
    h.window.location.href = "https://www.dinavit.com/";
    h.window.handlers.pageshow({ persisted: true });
    h.window.trackEventAndNavigate("purchase_intent", item, "/out-of-stock");
    assert.equal(h.ga().filter(([, name]) => name === "purchase_intent").length, 2);
});

test("return links preserve every allowed source and use Back for the matching previous page", () => {
    for (const origin of ["/#packs", "/productos/creatina/?utm_content=a#pdp-packs", "/productos/creatina-6-razones/#dv-oferta"]) {
        const referrer = new URL(origin, "https://www.dinavit.com");
        referrer.hash = "";
        const h = harness(`/out-of-stock?return_to=${encodeURIComponent(origin)}`, undefined, true,
            { returnLink: true, referrer: referrer.href, historyLength: 2 });
        const link = h.ids.get("return-to-origin");
        assert.equal(link.href, origin);
        let prevented = false;
        link.handlers.click({ button: 0, preventDefault() { prevented = true; } });
        assert.equal(prevented, true);
        assert.equal(h.window.history.backCalls, 1);
    }
});

test("direct visits use a safe fallback; external or archived destinations are never accepted", () => {
    for (const origin of ["https://evil.example/", "//evil.example/", "javascript:alert(1)", "/inicio-anterior", "/politica-privacidad"]) {
        const h = harness(`/out-of-stock?return_to=${encodeURIComponent(origin)}`, undefined, true, { returnLink: true });
        assert.equal(h.ids.get("return-to-origin").href, "/");
    }
    const h = harness("/out-of-stock", undefined, true, {
        returnLink: true, referrer: "https://www.dinavit.com/productos/creatina-6-razones/",
    });
    assert.equal(h.ids.get("return-to-origin").href, "/productos/creatina-6-razones/");
});

test("the previous home is preserved in a directory excluded from public assets", () => {
    assert.equal(fs.existsSync(path.join(root, "inicio-anterior")), false);
    assert.ok(fs.readFileSync(path.join(root, "archive/inicio-anterior.html"), "utf8").includes("Mantente fuerte, activo e independiente"));
    assert.match(fs.readFileSync(path.join(root, ".assetsignore"), "utf8"), /^archive\/$/m);
});
