(() => {
    // Keep the existing MailerLite list and confirmation flow; adapt only the
    // old early-access button label to the newsletter section on this home.
    const newsletter = document.querySelector(".news .ml-embedded");
    if (newsletter) {
        const updateNewsletterLabel = () => {
            const submit = newsletter.querySelector('button.primary[type="submit"]');
            if (submit && submit.textContent.trim() !== "Apuntarme") submit.textContent = "Apuntarme";
        };
        new MutationObserver(updateNewsletterLabel).observe(newsletter, { childList: true, subtree: true });
        updateNewsletterLabel();
    }
    const carousel = document.getElementById("carousel");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll(".car-nav .icon-btn").forEach((button) => {
        button.addEventListener("click", () => {
            const slide = carousel.querySelector(".slide");
            const step = slide ? slide.getBoundingClientRect().width + 20 : 400;
            carousel.scrollBy({
                left: step * Number(button.dataset.dir),
                behavior: reducedMotion ? "instant" : "smooth",
            });
        });
    });

    const buttons = document.querySelectorAll("[data-add-pack]");
    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            window.DinavitCart.addPack({
                packId: button.dataset.packId,
                label: button.dataset.label,
                price: Number(button.dataset.price),
            });
        });
    });

    // Same product and pack ID as the original PDP's default view.
    const firstPack = buttons[0];
    if (firstPack) {
        window.trackEvent?.("view_item", {
            currency: "EUR",
            value: Number(firstPack.dataset.price),
            landing_variant: "home",
            items: [{
                item_id: firstPack.dataset.packId,
                item_name: "Dinavit CORE",
                item_variant: firstPack.dataset.label,
            }],
        });
    }
})();
