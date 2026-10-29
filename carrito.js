// Shared by the home and the original creatine product page.
(() => {
    const drawer = document.getElementById("cart-drawer");
    const overlay = document.getElementById("cart-overlay");
    const trigger = document.getElementById("cart-trigger");
    const closeButton = document.getElementById("cart-close");
    const count = document.getElementById("cart-count");
    const items = document.getElementById("cart-items");
    const empty = document.getElementById("cart-empty");
    const subtotal = document.getElementById("cart-subtotal");
    const checkout = document.getElementById("cart-checkout");
    const cart = [];
    const productName = "Dinavit CORE";
    const productImage = document.body.dataset.productImage || "/images/product/dinavit-core/1.png";
    const variant = document.body.dataset.landingVariant;
    let returnFocus;

    const formatPrice = (value) => `${value.toFixed(2).replace(".", ",")} €`;
    const cartValue = () => Math.round(cart.reduce((sum, item) => sum + item.price * item.qty, 0) * 100) / 100;
    const analyticsItems = (rows) => rows.map((item) => ({
        item_id: item.packId,
        item_name: productName,
        item_variant: item.label,
        price: item.price,
        quantity: item.qty,
    }));
    function eventParams(rows, value) {
        return {
            currency: "EUR",
            value,
            items: analyticsItems(rows),
            ...(variant ? { landing_variant: variant } : {}),
        };
    }

    function renderCart() {
        items.replaceChildren();
        const isEmpty = cart.length === 0;
        empty.hidden = !isEmpty;
        checkout.disabled = isEmpty;
        count.hidden = isEmpty;
        count.textContent = String(cart.reduce((sum, item) => sum + item.qty, 0));
        subtotal.textContent = formatPrice(cartValue());
        if (isEmpty) {
            items.appendChild(empty);
            return;
        }

        cart.forEach((item, index) => {
            const row = document.createElement("div");
            row.className = "cart-item";
            row.innerHTML = `
                <img src="${productImage}" alt="" width="64" height="64" />
                <div>
                    <p class="cart-item-name">${productName}</p>
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
                </div>`;
            row.querySelectorAll("[data-action]").forEach((button) => {
                button.addEventListener("click", () => {
                    const action = button.dataset.action;
                    if (action === "increase") item.qty += 1;
                    if (action === "decrease") item.qty -= 1;
                    if (action === "remove" || item.qty === 0) cart.splice(index, 1);
                    renderCart();
                    const replacement = items.children[index]?.querySelector(`[data-action="${action}"]`);
                    (replacement || closeButton).focus();
                });
            });
            items.appendChild(row);
        });
    }

    function openCart() {
        if (!drawer.classList.contains("is-open")) returnFocus = document.activeElement;
        overlay.hidden = false;
        drawer.inert = false;
        drawer.classList.add("is-open");
        drawer.setAttribute("aria-hidden", "false");
        document.body.classList.add("has-open-cart");
        closeButton.focus();
    }

    function closeCart() {
        overlay.hidden = true;
        drawer.classList.remove("is-open");
        drawer.setAttribute("aria-hidden", "true");
        drawer.inert = true;
        document.body.classList.remove("has-open-cart");
        returnFocus?.focus();
    }

    function addPack({ packId, price, label }) {
        const existing = cart.find((item) => item.packId === packId);
        if (existing) existing.qty += 1;
        else cart.push({ packId, price, label, qty: 1 });
        renderCart();
        openCart();
        window.trackEvent?.("add_to_cart", eventParams([{ packId, price, label, qty: 1 }], price));
    }

    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-label", "Tu carrito");
    drawer.inert = true;
    subtotal.setAttribute("aria-live", "polite");
    trigger.addEventListener("click", openCart);
    closeButton.addEventListener("click", closeCart);
    overlay.addEventListener("click", closeCart);
    document.addEventListener("keydown", (event) => {
        if (!drawer.classList.contains("is-open")) return;
        if (event.key === "Escape") {
            event.preventDefault();
            closeCart();
        } else if (event.key === "Tab") {
            const controls = Array.from(drawer.querySelectorAll("button:not(:disabled), a[href]"));
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
    checkout.addEventListener("click", () => {
        if (!cart.length) return;
        if (window.trackEventAndNavigate) {
            window.trackEventAndNavigate("purchase_intent", eventParams(cart, cartValue()), "/out-of-stock");
        } else {
            window.location.href = "/out-of-stock";
        }
    });
    window.DinavitCart = { addPack, open: openCart, close: closeCart };
    renderCart();
})();
