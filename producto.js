const PRODUCT = {
    name: "Dinavit CORE",
    image: "/images/product/dinavit-core/1.png",
};

const packButtons = document.querySelectorAll(".pdp-pack");
const thumbButtons = document.querySelectorAll(".pdp-thumb");
const mainImage = document.getElementById("pdp-main-image");
const addToCartButton = document.getElementById("pdp-add-to-cart");
const guaranteeAddToCartButton = document.getElementById("pdp-guarantee-cta");
const galleryZoomButton = document.getElementById("pdp-gallery-zoom");
const galleryPrevButton = document.getElementById("pdp-gallery-prev");
const galleryNextButton = document.getElementById("pdp-gallery-next");

const thumbsTrack = document.getElementById("pdp-thumbs");
const thumbsPrevButton = document.getElementById("pdp-thumbs-prev");
const thumbsNextButton = document.getElementById("pdp-thumbs-next");

const galleryImages = Array.from(thumbButtons).map((button) =>
    button.getAttribute("data-full"),
);

const lightbox = document.getElementById("lightbox");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxCounter = document.getElementById("lightbox-counter");
const lightboxClose = document.getElementById("lightbox-close");
const lightboxPrev = document.getElementById("lightbox-prev");
const lightboxNext = document.getElementById("lightbox-next");

let lightboxIndex = 0;

const stickyCta = document.getElementById("sticky-cta");
const stickyAddToCartButton = document.getElementById("sticky-add-to-cart");
const stickyPackEl = document.getElementById("sticky-cta-pack");
const stickyCurrentPriceEl = document.getElementById("sticky-cta-current");
const stickyComparePriceEl = document.getElementById("sticky-cta-compare");

let selectedPack = Array.from(packButtons).find((btn) =>
    btn.classList.contains("is-active"),
);

function updateStickyCta() {
    if (!selectedPack) {
        return;
    }
    const price = parseFloat(selectedPack.getAttribute("data-price"));
    const compare = parseFloat(selectedPack.getAttribute("data-compare"));
    stickyPackEl.textContent = selectedPack.getAttribute("data-label");
    stickyCurrentPriceEl.textContent = formatPrice(price);
    stickyComparePriceEl.textContent = formatPrice(compare);
}

function formatPrice(value) {
    return `${value.toFixed(2).replace(".", ",")} €`;
}

function trackProductEvent(name, params) {
    window.trackEvent?.(name, params);
}

packButtons.forEach((button) => {
    button.addEventListener("click", () => {
        packButtons.forEach((btn) => {
            btn.classList.remove("is-active");
            btn.setAttribute("aria-checked", "false");
        });
        button.classList.add("is-active");
        button.setAttribute("aria-checked", "true");
        selectedPack = button;
        updateStickyCta();
    });
});

updateStickyCta();

let currentImageIndex = 0;

function selectImage(index) {
    currentImageIndex = (index + galleryImages.length) % galleryImages.length;
    thumbButtons.forEach((btn) => btn.classList.remove("is-active"));
    const activeThumb = thumbButtons[currentImageIndex];
    activeThumb.classList.add("is-active");
    thumbsTrack.scrollTo({
        left:
            activeThumb.offsetLeft -
            (thumbsTrack.clientWidth - activeThumb.offsetWidth) / 2,
        behavior: "smooth",
    });
    mainImage.src = galleryImages[currentImageIndex];
}

thumbButtons.forEach((button, index) => {
    button.addEventListener("click", () => selectImage(index));
});

galleryPrevButton.addEventListener("click", () => selectImage(currentImageIndex - 1));
galleryNextButton.addEventListener("click", () => selectImage(currentImageIndex + 1));

function updateThumbsNavState() {
    const maxScroll = thumbsTrack.scrollWidth - thumbsTrack.clientWidth;
    thumbsPrevButton.disabled = thumbsTrack.scrollLeft <= 4;
    thumbsNextButton.disabled = thumbsTrack.scrollLeft >= maxScroll - 4;
}

thumbsPrevButton.addEventListener("click", () => {
    thumbsTrack.scrollBy({ left: -thumbsTrack.clientWidth * 0.8, behavior: "smooth" });
});

thumbsNextButton.addEventListener("click", () => {
    thumbsTrack.scrollBy({ left: thumbsTrack.clientWidth * 0.8, behavior: "smooth" });
});

thumbsTrack.addEventListener("scroll", updateThumbsNavState);
window.addEventListener("resize", updateThumbsNavState);
updateThumbsNavState();

function openLightbox(index) {
    lightboxIndex = index;
    lightboxImage.src = galleryImages[lightboxIndex];
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${galleryImages.length}`;
    lightbox.hidden = false;
}

function closeLightbox() {
    lightbox.hidden = true;
    selectImage(lightboxIndex);
}

function showLightboxImage(index) {
    lightboxIndex = (index + galleryImages.length) % galleryImages.length;
    lightboxImage.src = galleryImages[lightboxIndex];
    lightboxCounter.textContent = `${lightboxIndex + 1} / ${galleryImages.length}`;
}

galleryZoomButton.addEventListener("click", () => {
    openLightbox(currentImageIndex);
});

lightboxClose.addEventListener("click", closeLightbox);
lightboxPrev.addEventListener("click", () => showLightboxImage(lightboxIndex - 1));
lightboxNext.addEventListener("click", () => showLightboxImage(lightboxIndex + 1));

lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
        closeLightbox();
    }
});

document.addEventListener("keydown", (event) => {
    if (lightbox.hidden) {
        return;
    }
    if (event.key === "Escape") {
        closeLightbox();
    } else if (event.key === "ArrowLeft") {
        showLightboxImage(lightboxIndex - 1);
    } else if (event.key === "ArrowRight") {
        showLightboxImage(lightboxIndex + 1);
    }
});

function addSelectedPackToCart() {
    if (!selectedPack) return;
    window.DinavitCart.addPack({
        packId: selectedPack.getAttribute("data-pack-id"),
        price: parseFloat(selectedPack.getAttribute("data-price")),
        label: selectedPack.getAttribute("data-label"),
    });
}

addToCartButton.addEventListener("click", addSelectedPackToCart);
stickyAddToCartButton.addEventListener("click", addSelectedPackToCart);
guaranteeAddToCartButton?.addEventListener("click", addSelectedPackToCart);

const siteHeader = document.querySelector(".site-header");

function setStickyCtaVisible(visible) {
    if (visible) {
        document.documentElement.style.setProperty(
            "--sticky-cta-height",
            `${stickyCta.offsetHeight}px`,
        );
    }
    stickyCta.classList.toggle("is-visible", visible);
    document.body.classList.toggle("has-sticky-cta", visible);
}

function checkStickyCta() {
    const headerHeight = siteHeader.offsetHeight;
    const buttonBottom = addToCartButton.getBoundingClientRect().bottom;
    setStickyCtaVisible(buttonBottom <= headerHeight);
}

window.addEventListener("scroll", checkStickyCta, { passive: true });
window.addEventListener("resize", checkStickyCta);
checkStickyCta();

trackProductEvent("view_item", {
    currency: "EUR",
    value: selectedPack ? parseFloat(selectedPack.getAttribute("data-price")) : 0,
    items: [
        {
            item_id: selectedPack?.getAttribute("data-pack-id"),
            item_name: PRODUCT.name,
            item_variant: selectedPack?.getAttribute("data-label"),
        },
    ],
});
