// ============================================================
//  Lume Home — Store / Cart logic (shared across pages)
//  Cart persists in localStorage so it survives page reloads.
// ============================================================

window.Store = (function () {
  const KEY = "lume_cart_v1";

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(KEY, JSON.stringify(cart));
    updateBadge();
  }

  function productById(id) {
    return (window.PRODUCTS || []).find((p) => p.id === id);
  }

  function addToCart(id, qty) {
    qty = parseInt(qty, 10) || 1;
    const cart = getCart();
    const line = cart.find((i) => i.id === id);
    if (line) line.qty += qty;
    else cart.push({ id, qty });
    saveCart(cart);
  }

  function setQty(id, qty) {
    const cart = getCart();
    const line = cart.find((i) => i.id === id);
    if (!line) return;
    line.qty = parseInt(qty, 10);
    if (line.qty <= 0) removeFromCart(id);
    else saveCart(cart);
  }

  function removeFromCart(id) {
    saveCart(getCart().filter((i) => i.id !== id));
  }

  function clearCart() {
    saveCart([]);
  }

  function count() {
    return getCart().reduce((s, i) => s + i.qty, 0);
  }

  function subtotal() {
    return getCart().reduce((s, i) => {
      const p = productById(i.id);
      return s + (p ? p.price * i.qty : 0);
    }, 0);
  }

  function detailed() {
    return getCart()
      .map((i) => {
        const p = productById(i.id);
        return p ? { ...p, qty: i.qty } : null;
      })
      .filter(Boolean);
  }

  function formatPrice(n) {
    return "$" + (n || 0).toFixed(2);
  }

  function updateBadge() {
    const badge = document.querySelector("[data-cart-count]");
    if (badge) badge.textContent = count();
  }

  // initialise badge on every page load
  document.addEventListener("DOMContentLoaded", updateBadge);

  return {
    getCart,
    addToCart,
    setQty,
    removeFromCart,
    clearCart,
    count,
    subtotal,
    detailed,
    productById,
    formatPrice,
    updateBadge
  };
})();
