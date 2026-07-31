const PRODUCT = {
    name: "Creatina Monohidrato Micronizada",
    image: "/images/new/prod-1.jpg",
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

const cartTrigger = document.getElementById("cart-trigger");
const cartCount = document.getElementById("cart-count");
const cartOverlay = document.getElementById("cart-overlay");
const cartDrawer = document.getElementById("cart-drawer");
const cartClose = document.getElementById("cart-close");
const cartItemsEl = document.getElementById("cart-items");
const cartEmptyEl = document.getElementById("cart-empty");
const cartSubtotalEl = document.getElementById("cart-subtotal");
const cartCheckoutButton = document.getElementById("cart-checkout");

const soldoutOverlay = document.getElementById("soldout-overlay");
const soldoutClose = document.getElementById("soldout-close");

const stickyCta = document.getElementById("sticky-cta");
const stickyAddToCartButton = document.getElementById("sticky-add-to-cart");
const stickyPackEl = document.getElementById("sticky-cta-pack");
const stickyCurrentPriceEl = document.getElementById("sticky-cta-current");
const stickyComparePriceEl = document.getElementById("sticky-cta-compare");

let selectedPack = Array.from(packButtons).find((btn) =>
    btn.classList.contains("is-active"),
);

const cart = [];

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
    thumbButtons[currentImageIndex].classList.add("is-active");
    thumbButtons[currentImageIndex].scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
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

function renderCart() {
    cartItemsEl.innerHTML = "";

    if (cart.length === 0) {
        cartEmptyEl.hidden = false;
        cartItemsEl.appendChild(cartEmptyEl);
        cartCheckoutButton.disabled = true;
        cartCount.hidden = true;
        cartSubtotalEl.textContent = formatPrice(0);
        return;
    }

    cartEmptyEl.hidden = true;
    cartCheckoutButton.disabled = false;

    let subtotal = 0;
    let totalQty = 0;

    cart.forEach((item, index) => {
        subtotal += item.price * item.qty;
        totalQty += item.qty;

        const row = document.createElement("div");
        row.className = "cart-item";
        row.innerHTML = `
            <img src="${PRODUCT.image}" alt="" />
            <div>
                <p class="cart-item-name">${PRODUCT.name}</p>
                <p class="cart-item-meta">${item.label}</p>
                <div class="cart-item-qty">
                    <button type="button" data-action="decrease" aria-label="Restar unidad">−</button>
                    <span>${item.qty}</span>
                    <button type="button" data-action="increase" aria-label="Sumar unidad">+</button>
                </div>
            </div>
            <div>
                <p class="cart-item-price">${formatPrice(item.price * item.qty)}</p>
                <button type="button" class="cart-item-remove" data-action="remove">Eliminar</button>
            </div>
        `;

        row.querySelector('[data-action="increase"]').addEventListener(
            "click",
            () => {
                cart[index].qty += 1;
                renderCart();
            },
        );

        row.querySelector('[data-action="decrease"]').addEventListener(
            "click",
            () => {
                if (cart[index].qty > 1) {
                    cart[index].qty -= 1;
                } else {
                    cart.splice(index, 1);
                }
                renderCart();
            },
        );

        row.querySelector('[data-action="remove"]').addEventListener(
            "click",
            () => {
                cart.splice(index, 1);
                renderCart();
            },
        );

        cartItemsEl.appendChild(row);
    });

    cartSubtotalEl.textContent = formatPrice(subtotal);
    cartCount.hidden = false;
    cartCount.textContent = String(totalQty);
}

function openCart() {
    cartOverlay.hidden = false;
    cartDrawer.classList.add("is-open");
    cartDrawer.setAttribute("aria-hidden", "false");
}

function closeCart() {
    cartOverlay.hidden = true;
    cartDrawer.classList.remove("is-open");
    cartDrawer.setAttribute("aria-hidden", "true");
}

function addSelectedPackToCart() {
    if (!selectedPack) {
        return;
    }

    const packId = selectedPack.getAttribute("data-pack-id");
    const price = parseFloat(selectedPack.getAttribute("data-price"));
    const label = selectedPack.getAttribute("data-label");

    const existing = cart.find((item) => item.packId === packId);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ packId, label, price, qty: 1 });
    }

    renderCart();
    openCart();
}

addToCartButton.addEventListener("click", addSelectedPackToCart);
stickyAddToCartButton.addEventListener("click", addSelectedPackToCart);
guaranteeAddToCartButton?.addEventListener("click", addSelectedPackToCart);

cartTrigger.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

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

cartCheckoutButton.addEventListener("click", () => {
    if (cart.length === 0) {
        return;
    }
    closeCart();
    soldoutOverlay.hidden = false;
});

function closeSoldout() {
    soldoutOverlay.hidden = true;
}

soldoutClose.addEventListener("click", closeSoldout);
soldoutOverlay.addEventListener("click", (event) => {
    if (event.target === soldoutOverlay) {
        closeSoldout();
    }
});

renderCart();
