const state = {
  restaurants: [],
  selectedRestaurantId: '',
  cart: [],
};

const restaurantList = document.getElementById('restaurantList');
const restaurantSearch = document.getElementById('restaurantSearch');
const selectedRestaurantTitle = document.getElementById('selectedRestaurantTitle');
const menuTitle = document.getElementById('menuTitle');
const menuItems = document.getElementById('menuItems');
const cartItems = document.getElementById('cartItems');
const subtotalValue = document.getElementById('subtotalValue');
const deliveryValue = document.getElementById('deliveryValue');
const totalValue = document.getElementById('totalValue');
const checkoutForm = document.getElementById('checkoutForm');
const orderMessage = document.getElementById('orderMessage');

async function fetchRestaurants() {
  const response = await fetch('/api/restaurants');
  const data = await response.json();
  state.restaurants = data;
  state.selectedRestaurantId = data[0]?.id || '';
  renderRestaurants();
  renderMenu();
  renderCart();
}

function getSelectedRestaurant() {
  return state.restaurants.find((restaurant) => restaurant.id === state.selectedRestaurantId) || null;
}

function getCartItems() {
  const restaurant = getSelectedRestaurant();
  if (!restaurant) return [];

  return state.cart.filter((item) => item.restaurantId === restaurant.id);
}

function renderRestaurants() {
  const query = (restaurantSearch.value || '').trim().toLowerCase();
  const filtered = state.restaurants.filter((restaurant) => {
    const combined = `${restaurant.name} ${restaurant.cuisine} ${restaurant.location}`.toLowerCase();
    return combined.includes(query);
  });

  restaurantList.innerHTML = filtered.map((restaurant) => {
    const activeClass = restaurant.id === state.selectedRestaurantId ? 'active' : '';
    return `
      <article class="restaurant-card ${activeClass}" data-restaurant-id="${restaurant.id}">
        <div class="restaurant-summary">
          <div class="restaurant-badges">
            <span class="badge">${restaurant.cuisine}</span>
          </div>
          <h3>${restaurant.name}</h3>
          <div class="meta-row">
            <span>📍 ${restaurant.location}</span>
            <span>⏱ ${restaurant.deliveryTime}</span>
          </div>
          <p class="restaurant-banner">${restaurant.banner}</p>
        </div>
        <div class="restaurant-details">
          <span class="rating">★ ${restaurant.rating}</span>
          <span>Delivery: $${restaurant.deliveryFee.toFixed(2)}</span>
          <span>Pickup ready</span>
        </div>
      </article>
    `;
  }).join('');

  restaurantList.querySelectorAll('.restaurant-card').forEach((card) => {
    card.addEventListener('click', () => {
      state.selectedRestaurantId = card.dataset.restaurantId;
      renderRestaurants();
      renderMenu();
      renderCart();
    });
  });
}

function renderMenu() {
  const restaurant = getSelectedRestaurant();
  if (!restaurant) {
    menuItems.innerHTML = '<p class="empty-state">Choose a restaurant to view its menu.</p>';
    menuTitle.textContent = 'Select a restaurant';
    selectedRestaurantTitle.textContent = 'Choose a restaurant';
    return;
  }

  selectedRestaurantTitle.textContent = restaurant.name;
  menuTitle.textContent = `${restaurant.name} menu`;

  menuItems.innerHTML = restaurant.menu.map((item) => `
    <article class="menu-item">
      <div class="menu-item-top">
        <div>
          <h3>${item.name}</h3>
        </div>
        <span class="price-tag">$${item.price.toFixed(2)}</span>
      </div>
      <div class="item-tags">
        <span class="item-tag">${item.tag}</span>
      </div>
      <p class="item-description">${item.description}</p>
      <div class="item-footer">
        <span class="meta-row">Popular</span>
        <button class="add-btn" data-item-id="${item.id}">Add</button>
      </div>
    </article>
  `).join('');

  menuItems.querySelectorAll('.add-btn').forEach((button) => {
    button.addEventListener('click', () => addToCart(button.dataset.itemId));
  });
}

function addToCart(itemId) {
  const restaurant = getSelectedRestaurant();
  if (!restaurant) return;

  const menuItem = restaurant.menu.find((item) => item.id === itemId);
  if (!menuItem) return;

  const existing = state.cart.find((entry) => entry.restaurantId === restaurant.id && entry.itemId === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ restaurantId: restaurant.id, itemId, quantity: 1 });
  }

  renderCart();
}

function updateCartItem(itemId, delta) {
  const restaurant = getSelectedRestaurant();
  if (!restaurant) return;

  const key = state.cart.find((entry) => entry.restaurantId === restaurant.id && entry.itemId === itemId);
  if (!key) return;

  key.quantity += delta;
  if (key.quantity <= 0) {
    state.cart = state.cart.filter((entry) => !(entry.restaurantId === restaurant.id && entry.itemId === itemId));
  }

  renderCart();
}

function renderCart() {
  const restaurant = getSelectedRestaurant();
  if (!restaurant) {
    cartItems.innerHTML = '<p class="empty-state">No items selected yet.</p>';
    subtotalValue.textContent = '$0.00';
    deliveryValue.textContent = '$0.00';
    totalValue.textContent = '$0.00';
    return;
  }

  const items = getCartItems();
  if (!items.length) {
    cartItems.innerHTML = '<p class="empty-state">No items selected yet.</p>';
    subtotalValue.textContent = '$0.00';
    deliveryValue.textContent = '$0.00';
    totalValue.textContent = '$0.00';
    return;
  }

  const cartDetails = items.map((entry) => {
    const menuItem = restaurant.menu.find((item) => item.id === entry.itemId);
    if (!menuItem) return '';

    const totalLine = menuItem.price * entry.quantity;
    return `
      <div class="cart-item">
        <div class="cart-item-main">
          <span class="quantity-pill">${entry.quantity}x</span>
          <div>
            <strong>${menuItem.name}</strong><br />
            <small>$${totalLine.toFixed(2)}</small>
          </div>
        </div>
        <div class="item-controls">
          <button class="qty-btn" data-action="decrease" data-item-id="${menuItem.id}" type="button">−</button>
          <button class="qty-btn" data-action="increase" data-item-id="${menuItem.id}" type="button">+</button>
        </div>
      </div>
    `;
  }).join('');

  cartItems.innerHTML = cartDetails;

  cartItems.querySelectorAll('.qty-btn').forEach((button) => {
    const action = button.dataset.action;
    const itemId = button.dataset.itemId;
    button.addEventListener('click', () => {
      updateCartItem(itemId, action === 'increase' ? 1 : -1);
    });
  });

  const subtotal = items.reduce((sum, entry) => {
    const menuItem = restaurant.menu.find((item) => item.id === entry.itemId);
    return sum + (menuItem ? menuItem.price * entry.quantity : 0);
  }, 0);

  const deliveryFee = restaurant.deliveryFee;
  const total = subtotal + deliveryFee;

  subtotalValue.textContent = `$${subtotal.toFixed(2)}`;
  deliveryValue.textContent = `$${deliveryFee.toFixed(2)}`;
  totalValue.textContent = `$${total.toFixed(2)}`;
}

checkoutForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const restaurant = getSelectedRestaurant();
  if (!restaurant) {
    setOrderMessage('Choose a restaurant before placing an order.', true);
    return;
  }

  const cart = getCartItems();
  if (!cart.length) {
    setOrderMessage('Add at least one item to your cart.', true);
    return;
  }

  const subtotal = cart.reduce((sum, entry) => {
    const menuItem = restaurant.menu.find((item) => item.id === entry.itemId);
    return sum + (menuItem ? menuItem.price * entry.quantity : 0);
  }, 0);

  const payload = {
    customerName: document.getElementById('customerName').value.trim(),
    address: document.getElementById('address').value.trim(),
    notes: document.getElementById('notes').value.trim(),
    restaurantId: restaurant.id,
    items: cart.map((entry) => ({ id: entry.itemId, quantity: entry.quantity })),
    total: subtotal + restaurant.deliveryFee,
  };

  if (!payload.customerName || !payload.address) {
    setOrderMessage('Please enter your name and delivery address.', true);
    return;
  }

  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Unable to place order.');
    }

    setOrderMessage(`${result.message} Order ID: ${result.orderId}`, false);
    state.cart = [];
    checkoutForm.reset();
    renderCart();
  } catch (error) {
    setOrderMessage(error.message, true);
  }
});

function setOrderMessage(message, isError) {
  orderMessage.textContent = message;
  orderMessage.classList.toggle('error', isError);
}

restaurantSearch.addEventListener('input', renderRestaurants);

fetchRestaurants();
