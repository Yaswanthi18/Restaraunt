(() => {
  "use strict";

  const CART_KEY = "dineeaseCart";
  const ORDER_KEY = "dineeaseLastOrder";
  const TAX_RATE = 0.05;
  const menu = window.DINEEASE_MENU || {};
  const allFoods = Object.values(menu).flatMap((cuisine) => cuisine.foods);
  const foodById = Object.fromEntries(allFoods.map((food) => [food.id, food]));
  const money = (amount) => `₹${Number(amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const getCart = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) { return {}; }
  };
  const saveCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartBadges();
  };
  const cartRows = (cart = getCart()) => Object.entries(cart)
    .filter(([id, quantity]) => foodById[id] && Number.isInteger(Number(quantity)) && Number(quantity) > 0)
    .map(([id, quantity]) => ({ ...foodById[id], quantity: Number(quantity) }));
  const totals = (rows) => {
    const subtotal = rows.reduce((sum, row) => sum + row.price * row.quantity, 0);
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    return { subtotal, tax, total: subtotal + tax };
  };

  function updateCartBadges() {
    const count = Object.values(getCart()).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0);
    document.querySelectorAll("[data-cart-count]").forEach((el) => { el.textContent = String(count); });
  }

  function setupNavigation() {
    const toggle = document.getElementById("menuToggle");
    const nav = document.getElementById("navLinks");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("active");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "✕" : "☰";
    });
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
      nav.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
      toggle.textContent = "☰";
    }));
  }

  function setupMenuPage() {
    const grid = document.getElementById("menuGrid");
    if (!grid) return;
    const params = new URLSearchParams(window.location.search);
    const key = params.get("cuisine")?.toLowerCase();
    const cuisine = menu[key] ? key : "indian";
    const selected = menu[cuisine];
    document.title = `${selected.name} Menu | DineEase`;
    document.getElementById("cuisineTitle").textContent = `${selected.name} Cuisine`;
    document.getElementById("cuisineDescription").textContent = selected.description;
    document.querySelectorAll("[data-cuisine]").forEach((link) => {
      const active = link.dataset.cuisine === cuisine;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    grid.innerHTML = selected.foods.map((food) => `
      <article class="dish-card menu-card">
        <img src="${food.image}" alt="${food.name}" loading="lazy">
        <div class="dish-info"><p class="eyebrow">${selected.name.toUpperCase()}</p><h2>${food.name}</h2>
          <p>${food.description}</p><div class="menu-card-bottom"><strong class="food-price">${money(food.price)}</strong>
          <button type="button" class="btn btn-primary add-to-cart" data-food-id="${food.id}">Add to Cart</button></div>
        </div>
      </article>`).join("");
    grid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-food-id]");
      if (!button) return;
      const cart = getCart();
      const id = button.dataset.foodId;
      cart[id] = (Number(cart[id]) || 0) + 1;
      saveCart(cart);
      const message = document.getElementById("menuMessage");
      message.textContent = `${foodById[id].name} added to your cart.`;
      button.textContent = "Added ✓";
      window.setTimeout(() => { button.textContent = "Add to Cart"; }, 1100);
    });
  }

  function setupCartPage() {
    const container = document.getElementById("cartItems");
    if (!container) return;
    const summary = document.getElementById("cartSummary");
    const empty = document.getElementById("emptyCart");
    function render() {
      const rows = cartRows();
      const isEmpty = rows.length === 0;
      container.hidden = isEmpty;
      summary.hidden = isEmpty;
      empty.hidden = !isEmpty;
      if (isEmpty) { container.innerHTML = ""; return; }
      container.innerHTML = rows.map((row) => `
        <article class="cart-row">
          <img src="${row.image}" alt="${row.name}" loading="lazy">
          <div class="cart-row-info"><h3>${row.name}</h3><p>${money(row.price)} each</p>
            <div class="quantity-control" aria-label="Quantity for ${row.name}">
              <button type="button" data-action="decrease" data-food-id="${row.id}" aria-label="Decrease ${row.name} quantity">−</button>
              <span>${row.quantity}</span>
              <button type="button" data-action="increase" data-food-id="${row.id}" aria-label="Increase ${row.name} quantity">+</button>
            </div>
          </div>
          <strong class="cart-row-total">${money(row.price * row.quantity)}</strong>
          <button type="button" class="remove-item" data-action="remove" data-food-id="${row.id}">Remove</button>
        </article>`).join("");
      const bill = totals(rows);
      document.getElementById("cartSubtotal").textContent = money(bill.subtotal);
      document.getElementById("cartTax").textContent = money(bill.tax);
      document.getElementById("cartTotal").textContent = money(bill.total);
    }
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const cart = getCart();
      const id = button.dataset.foodId;
      if (button.dataset.action === "remove" || (button.dataset.action === "decrease" && Number(cart[id]) <= 1)) delete cart[id];
      else if (button.dataset.action === "increase") cart[id] = (Number(cart[id]) || 0) + 1;
      else cart[id] = Number(cart[id]) - 1;
      saveCart(cart);
      render();
    });
    render();
  }

  function setupCheckoutPage() {
    const form = document.getElementById("checkoutForm");
    if (!form) return;
    const rows = cartRows();
    const message = document.getElementById("checkoutMessage");
    const button = document.getElementById("confirmOrderButton");
    if (!rows.length) {
      form.hidden = true;
      message.textContent = "Your cart is empty. Add food from the menu before checkout.";
      message.classList.add("error-message");
      document.getElementById("checkoutItems").innerHTML = '<a class="text-link" href="index.html#cuisines">Explore our cuisines →</a>';
      return;
    }
    document.getElementById("checkoutItems").innerHTML = rows.map((row) => `
      <div class="checkout-item"><span>${row.name} <small>× ${row.quantity}</small></span><strong>${money(row.price * row.quantity)}</strong></div>`).join("");
    const bill = totals(rows);
    document.getElementById("checkoutSubtotal").textContent = money(bill.subtotal);
    document.getElementById("checkoutTax").textContent = money(bill.tax);
    document.getElementById("checkoutTotal").textContent = money(bill.total);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const order = {
        orderNumber: `DE-${Date.now().toString(36).toUpperCase()}`,
        name: document.getElementById("customerName").value.trim(),
        phone: document.getElementById("customerPhone").value.trim(),
        table: document.getElementById("tableNumber").value,
        items: rows,
        ...bill,
        confirmedAt: new Date().toISOString()
      };
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
      saveCart({});
      button.disabled = true;
      window.location.href = "confirmation.html";
    });
  }

  function setupConfirmationPage() {
    const card = document.getElementById("confirmationCard");
    if (!card) return;
    let order;
    try { order = JSON.parse(localStorage.getItem(ORDER_KEY) || "null"); } catch (_) { order = null; }
    if (!order || !Array.isArray(order.items)) {
      card.innerHTML = '<p class="eyebrow">NO RECENT ORDER</p><h1>Ready when you are.</h1><p>Your confirmed dine-in order will appear here.</p><a href="index.html#cuisines" class="btn btn-primary">Explore Cuisines</a>';
      return;
    }
    const bill = totals(order.items);
    card.innerHTML = `
      <div class="confirmation-mark" aria-hidden="true">✓</div>
      <p class="eyebrow">YOUR TABLE IS SET</p><h1>Order confirmed, ${escapeHtml(order.name)}.</h1>
      <p class="confirmation-lead">Thank you for dining with DineEase. We look forward to welcoming you.</p>
      <div class="order-meta"><div><span>Order number</span><strong>${escapeHtml(order.orderNumber)}</strong></div><div><span>Your table</span><strong>${escapeHtml(order.table)}</strong></div></div>
      <div class="confirmed-items"><h2>Order Details</h2>${order.items.map((row) => `<div class="checkout-item"><span>${escapeHtml(row.name)} <small>× ${Number(row.quantity)}</small></span><strong>${money(Number(row.price) * Number(row.quantity))}</strong></div>`).join("")}</div>
      <div class="bill-line"><span>Subtotal</span><strong>${money(bill.subtotal)}</strong></div><div class="bill-line"><span>GST (5%)</span><strong>${money(bill.tax)}</strong></div><div class="bill-line bill-total"><span>Final Bill</span><strong>${money(bill.total)}</strong></div>
      <a href="index.html" class="btn btn-primary">Back to Home</a>`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function setupReservationForm() {
    const form = document.getElementById("reservationForm");
    if (!form) return;
    const dateInput = document.getElementById("bookingDate");
    const message = document.getElementById("formMessage");
    if (dateInput) {
      const now = new Date();
      dateInput.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = document.getElementById("guestName").value.trim();
      message.textContent = `Thank you, ${name}! Your reservation enquiry has been recorded in this demo.`;
      form.reset();
      if (dateInput) {
        const now = new Date();
        dateInput.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      }
    });
  }

  function setupFooterYear() {
    const copyright = document.querySelector(".copyright p");
    if (copyright && copyright.textContent.includes("2026")) copyright.textContent = copyright.textContent.replace("2026", String(new Date().getFullYear()));
  }

  setupNavigation();
  updateCartBadges();
  setupMenuPage();
  setupCartPage();
  setupCheckoutPage();
  setupConfirmationPage();
  setupReservationForm();
  setupFooterYear();
})();
