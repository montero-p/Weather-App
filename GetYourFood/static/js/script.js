const state = {
  restaurants: [],
  selectedRestaurantId: '',
  cart: [],
  user: null,
  pendingVerification: null,
  pendingVerificationCode: null,
  map: null,
  restaurantMarkers: [],
  driverMarker: null,
  driverRoute: [],
  driverIndex: 0,
  trackingTimer: null,
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
const trackingStatus = document.getElementById('trackingStatus');
const authStatus = document.getElementById('authStatus');
const showLoginBtn = document.getElementById('showLoginBtn');
const showSignupBtn = document.getElementById('showSignupBtn');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const signupPasswordInput = document.getElementById('signupPassword');
const passwordStrengthWrapper = document.getElementById('passwordStrengthWrapper');
const passwordStrengthFill = document.getElementById('passwordStrengthFill');
const passwordStrengthLabel = document.getElementById('passwordStrengthLabel');
const verificationForm = document.getElementById('verificationForm');
const resendCodeBtn = document.getElementById('resendCodeBtn');
const verificationMeta = document.getElementById('verificationMeta');
const logoutBtn = document.getElementById('logoutBtn');
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const tabPanels = document.querySelectorAll('.tab-panel');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const cartItemsCart = document.getElementById('cartItemsCart');
const subtotalValueCart = document.getElementById('subtotalValueCart');
const deliveryValueCart = document.getElementById('deliveryValueCart');
const totalValueCart = document.getElementById('totalValueCart');
const selectedRestaurantTitleCart = document.getElementById('selectedRestaurantTitleCart');
const checkoutFormCart = document.getElementById('checkoutFormCart');

function formatCurrency(value) {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

async function fetchRestaurants() {
  const response = await fetch('/api/restaurants');
  const data = await response.json();
  state.restaurants = data;
  state.selectedRestaurantId = data[0]?.id || '';
  renderMapRestaurants();
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
          <span>Delivery: ${formatCurrency(restaurant.deliveryFee)}</span>
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
        <span class="price-tag">${formatCurrency(item.price)}</span>
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
    subtotalValue.textContent = formatCurrency(0);
    deliveryValue.textContent = formatCurrency(0);
    totalValue.textContent = formatCurrency(0);
    syncCartTab();
    return;
  }

  const items = getCartItems();
  if (!items.length) {
    cartItems.innerHTML = '<p class="empty-state">No items selected yet.</p>';
    subtotalValue.textContent = formatCurrency(0);
    deliveryValue.textContent = formatCurrency(0);
    totalValue.textContent = formatCurrency(0);
    syncCartTab();
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
            <small>${formatCurrency(totalLine)}</small>
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

  subtotalValue.textContent = formatCurrency(subtotal);
  deliveryValue.textContent = formatCurrency(deliveryFee);
  totalValue.textContent = formatCurrency(total);
  syncCartTab();
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
    paymentMethod: document.getElementById('paymentMethod').value,
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
    updateTrackingStatus(result.orderId, 'Order confirmed');
    if (state.map && state.driverMarker) {
      state.driverRoute = [
        [51.5104, -0.1348],
        [51.5088, -0.1306],
        [51.5094, -0.1291],
        [51.5074, -0.1278],
      ];
      animateDriverRoute();
    }
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

function updateTrackingStatus(orderId, statusText = 'Order confirmed') {
  trackingStatus.textContent = orderId ? `${statusText} · ${orderId}` : statusText;
}

function initMap() {
  if (!window.L || !document.getElementById('deliveryMap')) {
    return;
  }

  const townCenter = [51.5074, -0.1278];
  state.map = L.map('deliveryMap', { zoomControl: true }).setView(townCenter, 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(state.map);

  const startPoint = [51.5104, -0.1348];
  const endPoint = [51.5074, -0.1278];
  state.driverRoute = [startPoint, [51.5088, -0.1306], [51.5078, -0.129], endPoint];
  state.driverMarker = L.circleMarker(startPoint, { radius: 10, color: '#ff7a3d', fillColor: '#ff7a3d', fillOpacity: 1 }).addTo(state.map);

  renderMapRestaurants();
}

function renderMapRestaurants() {
  if (!state.map) return;

  state.restaurantMarkers.forEach((marker) => state.map.removeLayer(marker));
  state.restaurantMarkers = [];

  const restaurantLocations = {
    'harbor-bite': [51.5104, -0.1348],
    'copper-kitchen': [51.5018, -0.1162],
    'green-bowl': [51.5159, -0.1115],
    'sunset-spice': [51.5143, -0.1091],
  };

  Object.entries(restaurantLocations).forEach(([restaurantId, coords]) => {
    const restaurant = state.restaurants.find((item) => item.id === restaurantId);
    if (!restaurant) return;

    const marker = L.marker(coords).addTo(state.map);
    marker.bindPopup(restaurant.name);
    state.restaurantMarkers.push(marker);
  });
}

function animateDriverRoute() {
  if (!state.map || !state.driverMarker || !state.driverRoute.length) {
    return;
  }

  if (state.trackingTimer) {
    clearInterval(state.trackingTimer);
  }

  const route = state.driverRoute;
  state.driverIndex = 0;

  state.trackingTimer = setInterval(() => {
    if (state.driverIndex >= route.length) {
      clearInterval(state.trackingTimer);
      updateTrackingStatus('GF-0001', 'Delivered');
      const steps = document.querySelectorAll('.tracking-steps li');
      steps.forEach((step, index) => step.classList.toggle('active', index === 3));
      return;
    }

    const currentPoint = route[state.driverIndex];
    state.driverMarker.setLatLng(currentPoint);
    const stepIndex = state.driverIndex < 1 ? 0 : state.driverIndex < route.length - 1 ? 1 : 3;
    const steps = document.querySelectorAll('.tracking-steps li');
    steps.forEach((step, index) => step.classList.toggle('active', index === stepIndex));

    if (state.driverIndex < 2) {
      updateTrackingStatus('GF-0001', 'Courier en route');
    } else {
      updateTrackingStatus('GF-0001', 'Restaurant preparing');
    }

    state.driverIndex += 1;
  }, 1800);
}

async function fetchCurrentUser() {
  try {
    const response = await fetch('/api/user');
    const result = await response.json();
    state.user = result.user || null;
    renderAuthStatus();
  } catch (error) {
    state.user = null;
    renderAuthStatus();
  }
}

function renderAuthStatus() {
  if (!loginScreen || !dashboardScreen || !authStatus) {
    return;
  }

  const isLoggedIn = Boolean(state.user);

  loginScreen.classList.toggle('hidden', isLoggedIn);
  dashboardScreen.classList.toggle('hidden', !isLoggedIn);

  if (state.user) {
    authStatus.textContent = `Signed in as ${state.user.name}`;
    if (profileName) profileName.textContent = state.user.name;
    if (profileEmail) profileEmail.textContent = state.user.phone || state.user.email || 'No phone or email saved';
  } else {
    authStatus.textContent = 'Not signed in';
    if (profileName) profileName.textContent = 'Guest';
    if (profileEmail) profileEmail.textContent = 'Not signed in';
  }
}

function showDashboardTab(tabName) {
  if (!tabPanels.length) {
    return;
  }

  tabPanels.forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.tab !== tabName);
  });
}

function updateVerificationMeta(message) {
  if (verificationMeta) {
    verificationMeta.textContent = message;
  }
}

function showVerificationNotice(result) {
  const code = result?.verificationCode || state.pendingVerificationCode;
  state.pendingVerificationCode = code || null;

  if (result?.demoMode && code) {
    updateVerificationMeta(`Demo mode is active. Use this code to verify your account: ${code}`);
    authStatus.textContent = `Demo mode: your verification code is ${code}`;
    return;
  }

  updateVerificationMeta('Check your inbox or SMS. The code is only valid for 10 minutes.');
}

function clearAuthErrorState() {
  authStatus.classList.remove('error');
  if (!state.user) {
    authStatus.textContent = 'Not signed in';
  }
}

function updatePasswordRules() {
  if (!signupPasswordInput) return;

  const password = signupPasswordInput.value || '';
  const rules = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  if (!password) {
    if (passwordStrengthWrapper) {
      passwordStrengthWrapper.classList.add('hidden');
    }
    if (passwordStrengthFill) {
      passwordStrengthFill.style.width = '0%';
    }
    return false;
  }

  if (passwordStrengthWrapper) {
    passwordStrengthWrapper.classList.remove('hidden');
  }

  const matchedRules = Object.values(rules).filter(Boolean).length;
  const percent = (matchedRules / Object.keys(rules).length) * 100;

  if (passwordStrengthFill) {
    passwordStrengthFill.style.width = `${percent}%`;
    passwordStrengthFill.classList.remove('level-weak', 'level-fair', 'level-good', 'level-strong');

    if (matchedRules <= 2) {
      passwordStrengthFill.classList.add('level-weak');
    } else if (matchedRules === 3) {
      passwordStrengthFill.classList.add('level-good');
    } else {
      passwordStrengthFill.classList.add('level-strong');
    }
  }

  if (passwordStrengthLabel) {
    if (matchedRules <= 2) {
      passwordStrengthLabel.textContent = 'Weak';
    } else if (matchedRules === 3) {
      passwordStrengthLabel.textContent = 'Strong';
    } else {
      passwordStrengthLabel.textContent = 'Very strong';
    }
  }

  return Object.values(rules).every(Boolean);
}

function validateSignupPassword() {
  const valid = updatePasswordRules();
  if (!valid) {
    authStatus.textContent = 'Password must be at least 6 characters, include 1 uppercase letter, 1 number, and 1 special character.';
    authStatus.classList.add('error');
    return false;
  }

  authStatus.classList.remove('error');
  return true;
}

function toggleAuthForm(type) {
  const showLogin = type === 'login';
  const showSignup = type === 'signup';
  const showVerify = type === 'verify';

  loginForm.classList.toggle('hidden', !showLogin);
  signupForm.classList.toggle('hidden', !showSignup);
  verificationForm.classList.toggle('hidden', !showVerify);

  showLoginBtn.classList.toggle('active', showLogin);
  showSignupBtn.classList.toggle('active', showSignup);

  if (showLogin) {
    clearAuthErrorState();
  }
}

if (showLoginBtn) {
  showLoginBtn.addEventListener('click', () => toggleAuthForm('login'));
}

if (showSignupBtn) {
  showSignupBtn.addEventListener('click', () => toggleAuthForm('signup'));
}

if (loginForm) {
  loginForm.addEventListener('input', () => {
    if (authStatus && authStatus.classList.contains('error')) {
      clearAuthErrorState();
    }
  });
}

if (signupPasswordInput) {
  signupPasswordInput.addEventListener('input', updatePasswordRules);
}

const eyeOpenSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const eyeClosedSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6A2.5 2.5 0 0 0 13.4 13.4"/><path d="M9.1 5.5A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a15.9 15.9 0 0 1-4.1 5.3"/><path d="M6.2 6.2A15.7 15.7 0 0 0 2 12s3.5 7 10 7a10.8 10.8 0 0 0 5.9-1.8"/></svg>';

document.querySelectorAll('.password-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const input = button.parentElement.querySelector('input');
    if (!input) return;

    const nextType = input.type === 'password' ? 'text' : 'password';
    input.type = nextType;

    const isVisible = nextType === 'text';
    button.innerHTML = isVisible ? eyeOpenSvg : eyeClosedSvg;
    button.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
    button.setAttribute('title', isVisible ? 'Hide password' : 'Show password');
  });
});

if (loginForm) {
  loginForm.addEventListener('input', () => {
    if (authStatus && authStatus.classList.contains('error')) {
      clearAuthErrorState();
    }
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      identifier: loginForm.elements.identifier.value.trim(),
      password: loginForm.elements.password.value.trim(),
    };

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      authStatus.textContent = result.message || 'Login failed';
      authStatus.classList.add('error');
      return;
    }

    authStatus.classList.remove('error');
    authStatus.textContent = result.message || 'Verification sent';
    state.pendingVerification = payload.identifier;
    state.pendingVerificationCode = result.verificationCode || null;
    loginForm.reset();
    showVerificationNotice(result);
    toggleAuthForm('verify');

    if (result.requiresVerification && !result.demoMode) {
      authStatus.textContent = `Verification sent to your ${result.deliveryTarget || 'selected contact'}.`;
    }
  });
}

if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!validateSignupPassword()) {
      return;
    }

    const payload = {
      name: signupForm.elements.name.value.trim(),
      email: signupForm.elements.email.value.trim(),
      phone: signupForm.elements.phone.value.trim(),
      password: signupForm.elements.password.value.trim(),
    };

    const response = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      authStatus.textContent = result.message || 'Sign up failed';
      authStatus.classList.add('error');
      return;
    }

    authStatus.classList.remove('error');
    authStatus.textContent = result.message || `Welcome ${result.user.name}`;
    state.pendingVerification = payload.phone || payload.email;
    state.pendingVerificationCode = result.verificationCode || null;
    signupForm.reset();
    showVerificationNotice(result);
    toggleAuthForm('verify');
  });
}

if (verificationForm) {
  verificationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const code = verificationForm.elements.code.value.trim();
    const identifier = state.pendingVerification || (loginForm ? loginForm.elements.identifier.value.trim() : '') || (signupForm ? signupForm.elements.phone.value.trim() : '') || (signupForm ? signupForm.elements.email.value.trim() : '');

    const payload = {
      ...(identifier.includes('@') ? { email: identifier } : { phone: identifier }),
      code,
    };

    const response = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      authStatus.textContent = result.message || 'Verification failed';
      authStatus.classList.add('error');
      return;
    }

    authStatus.classList.remove('error');
    authStatus.textContent = result.message || `Verified as ${result.user.name}`;
    state.user = result.user;
    state.pendingVerification = null;
    verificationForm.reset();
    updateVerificationMeta('Check your inbox or SMS. The code is only valid for 10 minutes.');
    renderAuthStatus();
    toggleAuthForm('login');
    showDashboardTab('home');
  });
}

if (resendCodeBtn) {
  resendCodeBtn.addEventListener('click', async () => {
    const identifier = state.pendingVerification || (loginForm ? loginForm.elements.identifier.value.trim() : '') || (signupForm ? signupForm.elements.phone.value.trim() : '') || (signupForm ? signupForm.elements.email.value.trim() : '');
    if (!identifier) {
      authStatus.textContent = 'No phone number is available for the resend request.';
      authStatus.classList.add('error');
      return;
    }

    const payload = {
      identifier,
    };

    const response = await fetch('/api/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      authStatus.textContent = result.message || 'Could not resend the code';
      authStatus.classList.add('error');
      return;
    }

    authStatus.classList.remove('error');
    authStatus.textContent = result.message || `A new code has been sent to your ${result.deliveryTarget}.`;
    state.pendingVerificationCode = result.verificationCode || null;
    showVerificationNotice(result);
    verificationForm.elements.code.value = '';
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    state.user = null;
    state.pendingVerification = null;
    state.pendingVerificationCode = null;
    updateVerificationMeta('Check your inbox or SMS. The code is only valid for 10 minutes.');
    renderAuthStatus();
    if (loginForm) loginForm.reset();
    if (signupForm) signupForm.reset();
    if (verificationForm) verificationForm.reset();
    toggleAuthForm('login');
    showDashboardTab('home');
  });
}

if (restaurantSearch) {
  restaurantSearch.addEventListener('input', renderRestaurants);
}

if (checkoutFormCart) {
  checkoutFormCart.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.cart.length) {
      showDashboardTab('home');
      if (checkoutForm) checkoutForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setOrderMessage('Add some food before checking out.', true);
    showDashboardTab('home');
  });
}

function syncCartTab() {
  const restaurant = getSelectedRestaurant();
  if (restaurant) {
    selectedRestaurantTitleCart.textContent = restaurant.name;
  } else {
    selectedRestaurantTitleCart.textContent = 'Choose a restaurant';
  }

  const items = getCartItems();
  if (!items.length) {
    cartItemsCart.innerHTML = '<p class="empty-state">Your cart is empty.</p>';
    subtotalValueCart.textContent = formatCurrency(0);
    deliveryValueCart.textContent = formatCurrency(0);
    totalValueCart.textContent = formatCurrency(0);
    return;
  }

  const cartDetails = items.map((entry) => {
    const menuItem = restaurant.menu.find((item) => item.id === entry.itemId);
    if (!menuItem) return '';
    return `
      <div class="cart-item">
        <div class="cart-item-main">
          <span class="quantity-pill">${entry.quantity}x</span>
          <div>
            <strong>${menuItem.name}</strong><br />
            <small>${formatCurrency(menuItem.price * entry.quantity)}</small>
          </div>
        </div>
      </div>
    `;
  }).join('');

  cartItemsCart.innerHTML = cartDetails;

  const subtotal = items.reduce((sum, entry) => {
    const menuItem = restaurant.menu.find((item) => item.id === entry.itemId);
    return sum + (menuItem ? menuItem.price * entry.quantity : 0);
  }, 0);
  const deliveryFee = restaurant.deliveryFee;
  const total = subtotal + deliveryFee;

  subtotalValueCart.textContent = formatCurrency(subtotal);
  deliveryValueCart.textContent = formatCurrency(deliveryFee);
  totalValueCart.textContent = formatCurrency(total);
}

if (document.getElementById('deliveryMap') || document.getElementById('restaurantList') || document.getElementById('dashboardScreen')) {
  initMap();
  fetchCurrentUser();
  fetchRestaurants();
  showDashboardTab('home');
}
