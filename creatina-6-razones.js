(() => {
    const variant = "creatina-6-razones";
    const productName = "Dinavit CORE";
    const packButtons = Array.from(document.querySelectorAll(".dv-q"));
    const dialog = document.getElementById("dv-cart");
    const itemsContainer = document.getElementById("dv-cart-items");
    const checkout = document.getElementById("dv-cart-checkout");
    const cart = [];
    let selectedPack = packButtons.find((button) =>
        button.classList.contains("on"),
    );

    const formatPrice = (value) => `${value.toFixed(2).replace(".", ",")} €`;
    // Packs use the same IDs and total prices as /productos/creatina.
    function packDetails(button) {
        const units = Number(button.dataset.n);
        return {
            id: button.dataset.n,
            label: button.dataset.l,
            price: Math.round(units * Number(button.dataset.unit) * 100) / 100,
        };
    }

    function selectPack(button) {
        selectedPack = button;
        packButtons.forEach((pack) => {
            const active = pack === button;
            pack.classList.toggle("on", active);
            pack.setAttribute("aria-checked", String(active));
            pack.tabIndex = active ? 0 : -1;
        });
        document.getElementById("dv-total").textContent = formatPrice(
            packDetails(button).price,
        );
        const comparePrice = document.getElementById("dv-was");
        comparePrice.textContent = formatPrice(Number(button.dataset.compare));
        comparePrice.hidden = button.dataset.n === "1";
        document.querySelector(".dv-lbl span").textContent = button.dataset.l;
    }

    packButtons.forEach((button, index) => {
        button.addEventListener("click", () => selectPack(button));
        button.addEventListener("keydown", (event) => {
            let next;
            if (["ArrowRight", "ArrowDown"].includes(event.key))
                next = (index + 1) % packButtons.length;
            if (["ArrowLeft", "ArrowUp"].includes(event.key))
                next = (index - 1 + packButtons.length) % packButtons.length;
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = packButtons.length - 1;
            if (next === undefined) return;
            event.preventDefault();
            selectPack(packButtons[next]);
            packButtons[next].focus();
        });
    });
    selectPack(selectedPack);

    document.querySelectorAll(".dv-th button").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".dv-th button").forEach((thumb) => {
                thumb.classList.toggle("on", thumb === button);
                thumb.setAttribute("aria-pressed", String(thumb === button));
            });
            const image = document.getElementById("dv-mainimg");
            const thumbImage = button.querySelector("img");
            image.width = Number(thumbImage.getAttribute("width"));
            image.height = Number(thumbImage.getAttribute("height"));
            image.src = button.dataset.src;
            image.alt = button.dataset.alt;
        });
    });

    function analyticsItems(items) {
        return items.map((item) => ({
            item_id: item.id,
            item_name: productName,
            item_variant: item.label,
            price: item.price,
            quantity: item.qty,
        }));
    }

    function eventParams(items) {
        return {
            currency: "EUR",
            value:
                Math.round(
                    items.reduce(
                        (sum, item) => sum + item.price * item.qty,
                        0,
                    ) * 100,
                ) / 100,
            landing_variant: variant,
            items: analyticsItems(items),
        };
    }

    function renderCart() {
        itemsContainer.replaceChildren();
        cart.forEach((item) => {
            const row = document.createElement("div");
            row.className = "dv-cart-item";
            row.innerHTML = `
                <img src="/images/product/creatina-6-razones/producto.jpg" alt="" width="64" height="72">
                <div><p><strong>${productName}</strong></p><p>${item.label} · ${formatPrice(item.price * item.qty)}</p>
                <div class="dv-cart-item-controls">
                    <button type="button" data-action="decrease" aria-label="Restar un pack de ${item.label}">−</button>
                    <span>${item.qty}</span>
                    <button type="button" data-action="increase" aria-label="Sumar un pack de ${item.label}">+</button>
                    <button type="button" data-action="remove" aria-label="Eliminar pack de ${item.label}">Eliminar</button>
                </div></div>`;
            row.querySelectorAll("[data-action]").forEach((button) => {
                button.addEventListener("click", () => {
                    const action = button.dataset.action;
                    if (action === "increase") item.qty += 1;
                    if (action === "decrease") item.qty -= 1;
                    if (action === "remove" || item.qty === 0)
                        cart.splice(cart.indexOf(item), 1);
                    renderCart();
                    // Re-rendering removes the clicked button; retain keyboard focus.
                    document.getElementById("dv-cart-close").focus();
                });
            });
            itemsContainer.appendChild(row);
        });
        document.getElementById("dv-cart-empty").hidden = cart.length > 0;
        document.getElementById("dv-cart-subtotal").textContent = formatPrice(
            eventParams(cart).value,
        );
        checkout.disabled = cart.length === 0;
        const count = document.getElementById("dv-cart-count");
        count.textContent = String(
            cart.reduce((sum, item) => sum + item.qty, 0),
        );
        count.hidden = cart.length === 0;
    }

    document.getElementById("dv-add-to-cart").addEventListener("click", () => {
        const pack = packDetails(selectedPack);
        const existing = cart.find((item) => item.id === pack.id);
        if (existing) existing.qty += 1;
        else cart.push({ ...pack, qty: 1 });
        renderCart();
        dialog.showModal();
        window.trackEvent?.("add_to_cart", eventParams([{ ...pack, qty: 1 }]));
    });
    document
        .getElementById("dv-cart-trigger")
        .addEventListener("click", () => dialog.showModal());
    document
        .getElementById("dv-cart-close")
        .addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
        const bounds = dialog.getBoundingClientRect();
        if (
            event.target === dialog &&
            (event.clientX < bounds.left ||
                event.clientX > bounds.right ||
                event.clientY < bounds.top ||
                event.clientY > bounds.bottom)
        )
            dialog.close();
    });
    checkout.addEventListener("click", () => {
        if (!cart.length) return;
        if (window.trackEventAndNavigate) {
            window.trackEventAndNavigate(
                "purchase_intent",
                eventParams(cart),
                "/out-of-stock",
            );
        } else {
            window.location.href = "/out-of-stock";
        }
    });
    renderCart();
    window.trackEvent?.(
        "view_item",
        eventParams([{ ...packDetails(selectedPack), qty: 1 }]),
    );
})();
