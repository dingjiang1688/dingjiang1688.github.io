// ============================================================
//  Lume Home — Page logic (home / shop / product / cart)
//  Each page sets <body data-page="..."> to pick its behaviour.
// ============================================================

(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const S = window.Store;
  const fmt = S.formatPrice;

  function media(p, cls) {
    return `<div class="${cls}" style="background:linear-gradient(135deg, ${p.color}, ${shade(p.color, -18)})">
      ${p.name}
    </div>`;
  }

  // darken/lighten a hex color by percent (-100..100)
  function shade(hex, pct) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = pct / 100;
    r = Math.round(r + (f < 0 ? r : 255 - r) * f);
    g = Math.round(g + (f < 0 ? g : 255 - g) * f);
    b = Math.round(b + (f < 0 ? b : 255 - b) * f);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function card(p) {
    return `<article class="product-card">
      <div class="product-media" style="background:linear-gradient(135deg, ${p.color}, ${shade(p.color, -18)})">
        ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ""}
        ${p.name}
      </div>
      <div class="product-body">
        <span class="product-cat">${p.category}</span>
        <span class="product-name">${p.name}</span>
        <span class="product-price">${fmt(p.price)}</span>
      </div>
      <div class="product-foot">
        <a class="btn" href="product.html?id=${p.id}">View</a>
        <button class="btn btn--ghost" data-add="${p.id}">Add</button>
      </div>
    </article>`;
  }

  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      S.addToCart(add.getAttribute("data-add"), 1);
      flash(add, "Added ✓");
    }
  });

  function flash(btn, text) {
    const old = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 900);
  }

  // ---------------- HOME ----------------
  function initHome() {
    const grid = $("#featured-grid");
    if (!grid) return;
    const featured = window.PRODUCTS.slice(0, 4);
    grid.innerHTML = featured.map(card).join("");
  }

  // ---------------- SHOP ----------------
  function initShop() {
    const grid = $("#shop-grid");
    const bar = $("#cat-bar");
    if (!grid) return;
    const cats = window.CATEGORIES;
    bar.innerHTML = cats
      .map((c, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-cat="${c}">${c}</button>`)
      .join("");

    function render(cat) {
      const list = cat === "All" ? window.PRODUCTS : window.PRODUCTS.filter((p) => p.category === cat);
      grid.innerHTML = list.length ? list.map(card).join("") : `<p class="empty">No products in this category yet.</p>`;
    }
    render("All");
    bar.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-cat]");
      if (!chip) return;
      $$(".chip", bar).forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      render(chip.getAttribute("data-cat"));
    });
  }

  // ---------------- PRODUCT ----------------
  function initProduct() {
    const root = $("#pd-root");
    if (!root) return;
    const id = new URLSearchParams(location.search).get("id");
    const p = S.productById(id) || window.PRODUCTS[0];
    root.innerHTML = `
      <div class="pd-grid">
        <div>
          ${media(p, "pd-media")}
        </div>
        <div>
          <div class="pd-cat">${p.category}</div>
          <h1 class="pd-name">${p.name}</h1>
          <div class="pd-price">${fmt(p.price)}</div>
          <p class="pd-desc">${p.description}</p>
          <ul class="pd-details">${p.details.map((d) => `<li>${d}</li>`).join("")}</ul>
          <div class="qty-row">
            <div class="qty">
              <button type="button" data-step="-1">−</button>
              <input id="qty" value="1" inputmode="numeric">
              <button type="button" data-step="1">+</button>
            </div>
            <button class="btn btn--lg" id="add-cart">Add to Cart</button>
          </div>
          <div class="pd-meta">
            <span>🚚 Free shipping over $75</span>
            <span>↩ 30-day returns</span>
            <span>🤝 Secure checkout</span>
          </div>
        </div>
      </div>`;

    const qty = $("#qty");
    root.querySelectorAll("[data-step]").forEach((b) =>
      b.addEventListener("click", () => {
        qty.value = Math.max(1, (parseInt(qty.value, 10) || 1) + parseInt(b.getAttribute("data-step"), 10));
      })
    );
    $("#add-cart").addEventListener("click", () => {
      S.addToCart(p.id, parseInt(qty.value, 10) || 1);
      location.href = "cart.html";
    });

    // related
    const rel = $("#related-grid");
    if (rel) {
      rel.innerHTML = window.PRODUCTS.filter((x) => x.id !== p.id && x.category === p.category)
        .concat(window.PRODUCTS.filter((x) => x.id !== p.id && x.category !== p.category))
        .slice(0, 4).map(card).join("");
    }
  }

  // ---------------- CART ----------------
  function initCart() {
    const list = $("#cart-items");
    const summary = $("#cart-summary");
    if (!list) return;

    const confirmed = new URLSearchParams(location.search).get("placed");
    if (confirmed) {
      $("#cart-view").innerHTML = `
        <div class="confirm">
          <div class="check">✓</div>
          <h1>Thank you!</h1>
          <p class="lead">Your order has been received. A confirmation has been sent to your email.</p>
          <p class="note">This is a demo store — no real payment was processed.</p>
          <a class="btn btn--lg" href="shop.html" style="margin-top:18px">Continue shopping</a>
        </div>`;
      return;
    }

    render();

    function render() {
      const items = S.detailed();
      if (!items.length) {
        list.innerHTML = `<div class="empty"><h2>Your cart is empty</h2><p>Looks like you haven't added anything yet.</p><a class="btn btn--lg" href="shop.html" style="margin-top:14px">Browse the shop</a></div>`;
        summary.innerHTML = "";
        return;
      }
      list.innerHTML = items.map((it) => `
        <div class="cart-item" data-id="${it.id}">
          <div class="cart-thumb" style="background:linear-gradient(135deg, ${it.color}, ${shade(it.color, -18)})">${it.name.split(" ")[0]}</div>
          <div>
            <h4>${it.name}</h4>
            <div class="muted">${fmt(it.price)} each</div>
            <div class="qty" style="margin-top:8px">
              <button type="button" data-step="-1">−</button>
              <input class="ci-qty" value="${it.qty}" inputmode="numeric" style="width:42px;height:36px;border:none;text-align:center">
              <button type="button" data-step="1">+</button>
            </div>
          </div>
          <div class="right">
            <div class="line-price">${fmt(it.price * it.qty)}</div>
            <button class="link-btn" data-remove>Remove</button>
          </div>
        </div>`).join("");

      list.querySelectorAll(".cart-item").forEach((row) => {
        const id = row.getAttribute("data-id");
        const input = row.querySelector(".ci-qty");
        row.querySelectorAll("[data-step]").forEach((b) =>
          b.addEventListener("click", () => {
            const v = Math.max(1, (parseInt(input.value, 10) || 1) + parseInt(b.getAttribute("data-step"), 10));
            S.setQty(id, v); render();
          })
        );
        input.addEventListener("change", () => { S.setQty(id, parseInt(input.value, 10) || 1); render(); });
        row.querySelector("[data-remove]").addEventListener("click", () => { S.removeFromCart(id); render(); });
      });

      const sub = S.subtotal();
      const shipping = sub >= 75 || sub === 0 ? 0 : 7.5;
      summary.innerHTML = `
        <h3>Order Summary</h3>
        <div class="summary-row"><span>Subtotal</span><span>${fmt(sub)}</span></div>
        <div class="summary-row"><span>Shipping</span><span>${shipping === 0 ? "Free" : fmt(shipping)}</span></div>
        <div class="summary-row total"><span>Total</span><span>${fmt(sub + shipping)}</span></div>
        <button class="btn btn--block btn--lg" id="checkout-btn" style="margin-top:18px">Checkout</button>
        <p class="note">Demo checkout — wire up Stripe / PayPal in production.</p>`;
      $("#checkout-btn").addEventListener("click", () => $("#checkout").scrollIntoView({ behavior: "smooth" }));
    }
  }

  // ---------------- CHECKOUT FORM ----------------
  function initCheckout() {
    const form = $("#checkout-form");
    if (!form) return;
    const opts = $$(".pay-opt");
    opts.forEach((o) => o.addEventListener("click", () => {
      opts.forEach((x) => x.classList.remove("active"));
      o.classList.add("active");
      $("#pay-method").value = o.getAttribute("data-pay");
    }));
    opts[0].classList.add("active");
    $("#pay-method").value = opts[0].getAttribute("data-pay");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      // Basic validation
      const required = ["name", "email", "address", "city", "zip", "country"];
      for (const f of required) {
        const el = form.querySelector(`[name="${f}"]`);
        if (!el.value.trim()) { el.focus(); el.style.borderColor = "#c0392b"; return; }
      }
      // In production: send to backend / Stripe here.
      S.clearCart();
      location.href = "cart.html?placed=1";
    });
  }

  // ---------------- NEWSLETTER ----------------
  function initNewsletter() {
    const form = $("#news-form");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = form.querySelector("input").value.trim();
      if (!email) return;
      $("#news-msg").textContent = "Thanks! Check your inbox for 10% off.";
      form.reset();
    });
  }

  // ---------------- NAV TOGGLE ----------------
  function initNav() {
    const t = $(".nav-toggle");
    const n = $(".nav");
    if (t && n) t.addEventListener("click", () => n.classList.toggle("open"));
  }

  // route
  const page = document.body.getAttribute("data-page");
  document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initNewsletter();
    if (page === "home") initHome();
    if (page === "shop") initShop();
    if (page === "product") initProduct();
    if (page === "cart") { initCart(); initCheckout(); }
  });
})();
