// Load SweetAlert2 dari CDN
const loadSweetAlert = () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css';
  document.head.appendChild(link);

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js';
  document.head.appendChild(script);
};

loadSweetAlert();

// Helper notifikasi functions
const notify = {
  success: (message, title = 'Berhasil') => {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'success', title, text: message, timer: 2000, showConfirmButton: false });
    } else {
      alert(title + '\n' + message);
    }
  },
  error: (message, title = 'Gagal') => {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'error', title, text: message });
    } else {
      alert(title + '\n' + message);
    }
  },
  warning: (message, title = 'Peringatan') => {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'warning', title, text: message });
    } else {
      alert(title + '\n' + message);
    }
  },
  info: (message, title = 'Informasi') => {
    if (typeof Swal !== 'undefined') {
      Swal.fire({ icon: 'info', title, text: message, timer: 2000, showConfirmButton: false });
    } else {
      alert(title + '\n' + message);
    }
  },
  confirm: (message, title = 'Konfirmasi') => {
    if (typeof Swal !== 'undefined') {
      return Swal.fire({ icon: 'question', title, text: message, showCancelButton: true, confirmButtonText: 'Ya', cancelButtonText: 'Batal', confirmButtonColor: '#7c4521', cancelButtonColor: '#94a3b8' }).then(r => r.isConfirmed);
    } else {
      return Promise.resolve(confirm(title + '\n' + message));
    }
  }
};

const APP_CONFIG = window.APP_CONFIG || {};
const ICONS = APP_CONFIG.icons || {};

const NAV_GROUPS = [
  {
    title: 'Utama',
    items: [
      { id: 'dashboard', label: 'Dashboard', subtitle: 'Ringkasan operasional hari ini' }
    ]
  },
  {
    title: 'Master Data',
    items: [
      { id: 'produk', label: 'Produk', subtitle: 'Kelola data produk (CRUD)' },
      { id: 'kategori', label: 'Kategori', subtitle: 'Kelola kategori produk (CRUD)' },
      { id: 'kasir', label: 'Kasir', subtitle: 'Transaksi cepat + cetak struk' }
    ]
  },
  {
    title: 'Aktivitas',
    items: [
      { id: 'transaksi', label: 'Transaksi', subtitle: 'Riwayat seluruh transaksi' },
      { id: 'laporan', label: 'Laporan', subtitle: 'Analisis penjualan dan ringkasan' }
    ]
  }
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const state = {
  currentView: 'dashboard',
  sidebarCollapsed: false,
  products: [],
  categories: [],
  transactions: [],
  cart: [],
  loading: false
};

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

let db = null;

function uidCode(prefix = 'TRX') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function dateOnlyLocal(dateValue = new Date()) {
  const d = new Date(dateValue);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTime(value) {
  const d = new Date(value);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function transactionStatusMeta(status) {
  const normalized = String(status || 'completed').toLowerCase();

  if (normalized === 'pending') {
    return { label: 'Menunggu', className: 'bg-amber-100 text-amber-800' };
  }

  if (normalized === 'processing') {
    return { label: 'Diproses', className: 'bg-sky-100 text-sky-700' };
  }

  if (normalized === 'cancelled') {
    return { label: 'Dibatalkan', className: 'bg-rose-100 text-rose-700' };
  }

  return { label: 'Selesai', className: 'bg-emerald-100 text-emerald-700' };
}

function transactionStatusBadge(status) {
  const meta = transactionStatusMeta(status);
  return `<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}">${meta.label}</span>`;
}

function completedTransactions() {
  return state.transactions.filter((trx) => String(trx.status || 'completed').toLowerCase() === 'completed');
}

function setDbAlert(message, danger = false) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      icon: danger ? 'error' : 'warning',
      title: danger ? 'Error Database' : 'Peringatan',
      text: message,
      showConfirmButton: true
    });
  } else {
    const el = document.getElementById('dbAlert');
    el.classList.remove('hidden');
    el.className = `mb-4 px-4 py-3 rounded-xl border text-sm ${danger ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`;
    el.textContent = message;
  }
}

function clearDbAlert() {
  const el = document.getElementById('dbAlert');
  el.classList.add('hidden');
  el.textContent = '';
}

function ensureDb() {
  if (!window.supabase || !window.supabase.createClient) {
    setDbAlert('Supabase library gagal dimuat. Cek internet/CDN.', true);
    return false;
  }

  if (!APP_CONFIG.supabaseUrl || !APP_CONFIG.supabaseAnonKey) {
    setDbAlert('Isi dulu file config.js (supabaseUrl dan supabaseAnonKey), lalu refresh.', true);
    return false;
  }

  db = window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
  clearDbAlert();
  return true;
}

async function loadAllData() {
  state.loading = true;

  const [catRes, prodRes, trxRes] = await Promise.all([
    db.from('categories').select('id, name, description').order('name', { ascending: true }),
    db.from('products').select('id, name, category_id, price, stock, image_url').order('name', { ascending: true }),
    db
      .from('transactions')
      .select('id, code, total, payment, change, status, customer_name, notes, processed_at, created_at, transaction_items(product_id, name, price, qty, subtotal)')
      .order('created_at', { ascending: false })
  ]);

  if (catRes.error) throw catRes.error;
  if (prodRes.error) throw prodRes.error;
  if (trxRes.error) throw trxRes.error;

  state.categories = (catRes.data || []).map((c) => ({
    id: String(c.id),
    name: c.name,
    description: c.description || ''
  }));

  state.products = (prodRes.data || []).map((p) => ({
    id: String(p.id),
    name: p.name,
    categoryId: String(p.category_id),
    price: Number(p.price || 0),
    stock: Number(p.stock || 0),
    image: p.image_url || ''
  }));

  state.transactions = (trxRes.data || []).map((t) => ({
    id: String(t.id),
    code: t.code,
    total: Number(t.total || 0),
    payment: Number(t.payment || 0),
    change: Number(t.change || 0),
    status: String(t.status || 'completed').toLowerCase(),
    customerName: t.customer_name || '',
    notes: t.notes || '',
    processedAt: t.processed_at || null,
    createdAt: t.created_at,
    items: (t.transaction_items || []).map((i) => ({
      productId: String(i.product_id),
      name: i.name,
      price: Number(i.price || 0),
      qty: Number(i.qty || 0),
      subtotal: Number(i.subtotal || 0)
    }))
  }));

  state.loading = false;
}

function categoryName(categoryId) {
  return state.categories.find((c) => c.id === String(categoryId))?.name || '-';
}

function getNavIcon(id) {
  const src = ICONS[id] || '';
  if (!src) {
    return '<span class="nav-fallback"></span>';
  }

  return `<img src="${src}" alt="${id}" class="nav-icon" onerror="this.remove()" />`;
}

function renderNav() {
  const content = NAV_GROUPS
    .map((group, index) => {
      const itemsHtml = group.items
        .map((item) => `
          <button class="nav-item ${state.currentView === item.id ? 'active' : ''}" data-nav="${item.id}">
            ${getNavIcon(item.id)}
            <span class="nav-text">${item.label}</span>
          </button>
        `)
        .join('');

      return `
        <section style="margin-bottom:1.1rem;">
          <p class="nav-group-title">${group.title}</p>
          <div class="space-y-1">${itemsHtml}</div>
        </section>
      `;
    })
    .join('');

  document.getElementById('sidebarNav').innerHTML = content;
  document.getElementById('mobileNav').innerHTML = content;

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.nav);
      closeMobileMenu();
    });
  });
}

function switchView(viewId) {
  state.currentView = viewId;
  document.querySelectorAll('.view-section').forEach((section) => section.classList.add('hidden'));
  document.getElementById(`view-${viewId}`).classList.remove('hidden');

  const active = NAV_ITEMS.find((item) => item.id === viewId);
  document.getElementById('pageTitle').textContent = active?.label || 'Kopi Searah';
  document.getElementById('pageSubtitle').textContent = active?.subtitle || '';

  renderNav();
  renderCurrentView();
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('sidebarToggleBtn');

  sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
  if (btn) {
    btn.setAttribute('aria-label', state.sidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar');
  }
}

function openMobileMenu() {
  document.getElementById('mobileMenu').classList.remove('hidden');
}

function closeMobileMenu() {
  document.getElementById('mobileMenu').classList.add('hidden');
}

function metricCard(title, value, color = 'text-primary-700') {
  return `
    <article class="card p-5">
      <p class="text-sm text-slate-500">${title}</p>
      <h3 class="text-2xl font-black ${color}">${value}</h3>
    </article>
  `;
}

function dashboardStats() {
  const today = dateOnlyLocal();
  const totalStock = state.products.reduce((sum, p) => sum + Number(p.stock || 0), 0);
  const salesTransactions = completedTransactions();
  const trxToday = salesTransactions.filter((t) => dateOnlyLocal(t.createdAt) === today);
  const revenueToday = trxToday.reduce((sum, t) => sum + Number(t.total || 0), 0);

  const soldMap = {};
  salesTransactions.forEach((trx) => {
    trx.items.forEach((item) => {
      soldMap[item.productId] = (soldMap[item.productId] || 0) + item.qty;
    });
  });

  const topProducts = Object.entries(soldMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([productId, qty]) => {
      const p = state.products.find((pr) => pr.id === String(productId));
      return { id: productId, name: p ? p.name : 'Produk dihapus', qty };
    });

  const bestId = topProducts.length ? Object.keys(soldMap).sort((a, b) => soldMap[b] - soldMap[a])[0] : null;
  const bestProduct = bestId ? state.products.find((p) => p.id === String(bestId)) : null;

  return {
    totalStock,
    totalCategory: state.categories.length,
    trxToday: trxToday.length,
    revenueToday,
    topProducts,
    bestProduct: bestProduct ? bestProduct.name : 'Belum ada data'
  };
}

function renderDashboard() {
  const root = document.getElementById('view-dashboard');
  const stats = dashboardStats();
  const recent = [...state.transactions].slice(0, 6);

  root.innerHTML = `
    <div class="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
      ${metricCard('Total Stock', stats.totalStock, 'text-amber-700')}
      ${metricCard('Total Kategori', stats.totalCategory)}
      ${metricCard('TRX Hari Ini', stats.trxToday)}
      ${metricCard('Pendapatan Hari Ini', formatter.format(stats.revenueToday), 'text-amber-800')}
      ${metricCard('Produk Terlaris', stats.bestProduct, 'text-amber-900')}
    </div>

    <div class="grid lg:grid-cols-2 gap-5">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg text-primary-700">Transaksi Terbaru</h3>
          <button class="btn btn-soft" data-nav-link="transaksi">Lihat Semua</button>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Waktu</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${recent.length ? recent.map((trx) => `
                <tr>
                  <td>${trx.code}</td>
                  <td>${formatDateTime(trx.createdAt)}</td>
                  <td>${transactionStatusBadge(trx.status)}</td>
                  <td>${trx.items.reduce((sum, i) => sum + i.qty, 0)} item</td>
                  <td>${formatter.format(trx.total)}</td>
                </tr>
              `).join('') : '<tr><td colspan="5" style="text-align:center;padding:2.5rem 0;color:#94a3b8;font-size:0.9rem;">Belum ada transaksi.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg text-primary-700">Produk Terlaris</h3>
          <button class="btn btn-soft" data-nav-link="laporan">Lihat Laporan</button>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Produk</th>
                <th>Terjual</th>
              </tr>
            </thead>
            <tbody>
              ${stats.topProducts.length ? stats.topProducts.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${p.name}</td>
                  <td><span class="badge badge-blue">${p.qty} pcs</span></td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align:center;padding:2.5rem 0;color:#94a3b8;font-size:0.9rem;">Belum ada data penjualan.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-nav-link]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.navLink));
  });
}

function addToCart(productId) {
  const product = state.products.find((p) => p.id === String(productId));
  if (!product) return;

  const inCart = state.cart.find((item) => item.productId === String(productId));
  const currentQty = inCart ? inCart.qty : 0;

  if (currentQty + 1 > Number(product.stock || 0)) {
    notify.warning('Stock tidak mencukupi untuk produk ini.');
    return;
  }

  if (inCart) {
    inCart.qty += 1;
  } else {
    state.cart.push({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      qty: 1
    });
  }

  renderKasir();
}

function changeCartQty(productId, delta) {
  const item = state.cart.find((i) => i.productId === String(productId));
  const product = state.products.find((p) => p.id === String(productId));
  if (!item || !product) return;

  const nextQty = item.qty + delta;
  if (nextQty <= 0) {
    state.cart = state.cart.filter((i) => i.productId !== String(productId));
  } else if (nextQty <= Number(product.stock || 0)) {
    item.qty = nextQty;
  }

  renderKasir();
}

function removeCartItem(productId) {
  state.cart = state.cart.filter((i) => i.productId !== String(productId));
  renderKasir();
}

async function checkout(payment) {
  if (!state.cart.length) {
    notify.warning('Keranjang masih kosong.');
    return;
  }

  const total = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (payment < total) {
    notify.error('Uang bayar kurang.');
    return;
  }

  for (const item of state.cart) {
    const product = state.products.find((p) => p.id === item.productId);
    if (!product || Number(product.stock) < item.qty) {
      notify.error(`Stock ${item.name} tidak cukup.`);
      return;
    }
  }

  const code = uidCode('TRX');
  const nowIso = new Date().toISOString();
  const change = payment - total;

  const trxInsert = await db
    .from('transactions')
    .insert({ code, total, payment, change, status: 'completed', customer_name: 'Kasir', notes: '', processed_at: nowIso, created_at: nowIso })
    .select('id')
    .single();

  if (trxInsert.error) {
    notify.error(`Gagal menyimpan transaksi: ${trxInsert.error.message}`);
    return;
  }

  const transactionId = trxInsert.data.id;

  for (const item of state.cart) {
    const product = state.products.find((p) => p.id === item.productId);
    const nextStock = Number(product.stock) - item.qty;

    const updateStockRes = await db
      .from('products')
      .update({ stock: nextStock })
      .eq('id', item.productId);

    if (updateStockRes.error) {
      notify.error(`Gagal update stock ${item.name}: ${updateStockRes.error.message}`);
      return;
    }
  }

  const trxItems = state.cart.map((item) => ({
    transaction_id: transactionId,
    product_id: item.productId,
    name: item.name,
    price: item.price,
    qty: item.qty,
    subtotal: item.price * item.qty
  }));

  const itemRes = await db.from('transaction_items').insert(trxItems);
  if (itemRes.error) {
    notify.error(`Gagal menyimpan item transaksi: ${itemRes.error.message}`);
    return;
  }

  state.cart = [];
  await refreshDataAndView();
  notify.success(`Kembalian: ${formatter.format(change)}`, 'Transaksi Berhasil');
  switchView('dashboard');
}

function renderKasir() {
  const root = document.getElementById('view-kasir');
  const cartTotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  root.innerHTML = `
    <div class="grid lg:grid-cols-3 gap-5">
      <div class="lg:col-span-2 space-y-4">
        <div class="card p-4">
          <div class="flex flex-wrap items-center gap-3 justify-between mb-4">
            <h3 class="font-bold text-lg text-primary-700">Menu Kasir</h3>
            <div class="flex flex-wrap gap-2">
              <input id="cashierSearch" class="input w-56" placeholder="Cari menu..." />
              <button class="btn btn-soft" id="goProduk">Tambah Barang</button>
            </div>
          </div>
          <div id="kasirMenu" class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3"></div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="card p-4">
          <h3 class="font-bold text-lg text-primary-700 mb-3">Keranjang</h3>
          <div id="cartWrap" class="space-y-2 max-h-[360px] overflow-auto"></div>

          <div class="mt-4 border-t border-amber-100 pt-3 space-y-2">
            <p class="flex justify-between font-semibold"><span>Total</span><span id="cartTotalDisplay">${formatter.format(cartTotal)}</span></p>

            <div id="manualPaymentDiv">
              <label class="text-xs text-slate-500">Uang Bayar (Rp)</label>
              <input id="paymentInput" class="input" type="number" min="1" placeholder="Masukkan uang bayar" />
              <p id="err-payment" class="hidden mt-1 text-xs text-red-500 font-medium"></p>
            </div>

            <div id="changeDisplay" class="hidden rounded-xl px-3 py-2 text-sm font-semibold flex justify-between items-center"></div>

            <div class="grid grid-cols-2 gap-2">
              <button id="checkoutBtn" class="btn btn-primary">Bayar Tunai</button>
              <button id="printLastBtn" class="btn btn-soft">Cetak Struk</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const menuBox = root.querySelector('#kasirMenu');
  const searchInput = root.querySelector('#cashierSearch');
  const cartWrap = root.querySelector('#cartWrap');
  const paymentInput = root.querySelector('#paymentInput');

  function renderMenuCards(keyword = '') {
    let filtered = state.products
      .filter((p) => p.name.toLowerCase().includes(keyword.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));

    menuBox.innerHTML = filtered.length
      ? filtered.map((p) => `
        <article class="border border-amber-100 rounded-xl p-3 bg-white">
          <img src="${p.image || 'https://placehold.co/400x260?text=No+Image'}" alt="${p.name}" class="w-full h-28 object-cover rounded-lg mb-3" />
          <p class="font-semibold text-slate-800 text-sm">${p.name}</p>
          <p class="text-xs text-slate-500 mb-1">${categoryName(p.categoryId)}</p>
          <p class="font-bold text-primary-700 mb-2">${formatter.format(p.price)}</p>
          <p class="text-xs text-slate-500 mb-2">Stock: ${p.stock}</p>
          <button class="btn btn-primary w-full text-sm" data-add-cart="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>Masuk Keranjang</button>
        </article>
      `).join('')
      : '<p class="text-slate-500">Produk tidak ditemukan.</p>';

    menuBox.querySelectorAll('[data-add-cart]').forEach((btn) => {
      btn.addEventListener('click', () => addToCart(btn.dataset.addCart));
    });
  }

  function renderCart() {
    cartWrap.innerHTML = state.cart.length
      ? state.cart.map((item) => {
        const product = state.products.find(p => p.id === item.productId);
        return `
        <div class="p-2 rounded-lg bg-amber-50 border border-amber-100 flex gap-2">
          <img src="${product?.image || 'https://placehold.co/60x40?text=No+Image'}" alt="${item.name}" class="w-12 h-10 rounded object-cover flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm truncate">${item.name}</p>
            <p class="text-xs text-slate-500">${formatter.format(item.price)} x ${item.qty}</p>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="btn btn-soft text-xs py-1 px-2" data-cart-minus="${item.productId}">-</button>
            <button class="btn btn-soft text-xs py-1 px-2" data-cart-plus="${item.productId}">+</button>
            <button class="btn btn-danger text-xs py-1 px-2" data-cart-remove="${item.productId}">✕</button>
          </div>
        </div>
      `;
      }).join('')
      : '<p class="text-slate-500 text-sm">Keranjang masih kosong.</p>';

    cartWrap.querySelectorAll('[data-cart-minus]').forEach((btn) => {
      btn.addEventListener('click', () => changeCartQty(btn.dataset.cartMinus, -1));
    });

    cartWrap.querySelectorAll('[data-cart-plus]').forEach((btn) => {
      btn.addEventListener('click', () => changeCartQty(btn.dataset.cartPlus, 1));
    });

    cartWrap.querySelectorAll('[data-cart-remove]').forEach((btn) => {
      btn.addEventListener('click', () => removeCartItem(btn.dataset.cartRemove));
    });
  }

  searchInput.addEventListener('input', () => renderMenuCards(searchInput.value));
  root.querySelector('#goProduk').addEventListener('click', () => switchView('produk'));

  // Live kembalian preview
  const changeDisplay = root.querySelector('#changeDisplay');
  const errPayment = root.querySelector('#err-payment');

  function updateChangePreview() {
    const payment = Number(paymentInput.value || 0);
    const total = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    errPayment.classList.add('hidden');
    paymentInput.classList.remove('border-red-400', 'ring-1', 'ring-red-300');

    if (!paymentInput.value || payment <= 0) {
      changeDisplay.classList.add('hidden');
      return;
    }

    const change = payment - total;
    changeDisplay.classList.remove('hidden');

    if (change < 0) {
      changeDisplay.className = 'rounded-xl px-3 py-2 text-sm font-semibold flex justify-between items-center bg-red-50 border border-red-200 text-red-700';
      changeDisplay.innerHTML = `<span>Uang kurang</span><span>${formatter.format(Math.abs(change))}</span>`;
    } else if (change === 0) {
      changeDisplay.className = 'rounded-xl px-3 py-2 text-sm font-semibold flex justify-between items-center bg-emerald-50 border border-emerald-200 text-emerald-700';
      changeDisplay.innerHTML = `<span>✓ Pas</span><span>${formatter.format(0)}</span>`;
    } else {
      changeDisplay.className = 'rounded-xl px-3 py-2 text-sm font-semibold flex justify-between items-center bg-amber-50 border border-amber-200 text-amber-700';
      changeDisplay.innerHTML = `<span>Kembalian</span><span>${formatter.format(change)}</span>`;
    }
  }

  paymentInput.addEventListener('input', updateChangePreview);

  root.querySelector('#checkoutBtn').addEventListener('click', async () => {
    const payment = Number(paymentInput.value || 0);
    const total = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    errPayment.classList.add('hidden');
    paymentInput.classList.remove('border-red-400', 'ring-1', 'ring-red-300');

    if (!paymentInput.value || payment <= 0) {
      errPayment.textContent = 'Uang bayar tidak boleh kosong atau 0.';
      errPayment.classList.remove('hidden');
      paymentInput.classList.add('border-red-400', 'ring-1', 'ring-red-300');
      paymentInput.focus();
      return;
    }

    if (payment < total) {
      errPayment.textContent = `Uang kurang ${formatter.format(total - payment)}.`;
      errPayment.classList.remove('hidden');
      paymentInput.classList.add('border-red-400', 'ring-1', 'ring-red-300');
      paymentInput.focus();
      return;
    }

    await checkout(payment);
  });

  root.querySelector('#printLastBtn').addEventListener('click', () => {
    const trx = state.transactions[0];
    if (!trx) {
      notify.info('Belum ada transaksi untuk dicetak.');
      return;
    }
    printReceipt(trx.id);
  });

  renderMenuCards();
  renderCart();
}

function renderProduk() {
  const root = document.getElementById('view-produk');

  root.innerHTML = `
    <div class="card p-5">
      <div class="flex flex-wrap items-center justify-between mb-4 gap-2">
        <h3 class="font-bold text-lg text-primary-700">Data Produk</h3>
        <button id="addProductBtn" class="btn btn-primary">Tambah Produk</button>
      </div>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nama</th>
              <th>Kategori</th>
              <th>Harga</th>
              <th>Stock</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${state.products.length ? state.products.map((p) => `
              <tr>
                <td><img src="${p.image || 'https://placehold.co/120x80?text=No+Image'}" class="w-16 h-11 rounded object-cover cursor-pointer hover:opacity-75 transition" alt="${p.name}" data-view-image="${p.image || 'https://placehold.co/120x80?text=No+Image'}" data-image-name="${p.name}" /></td>
                <td>${p.name}</td>
                <td>${categoryName(p.categoryId)}</td>
                <td>${formatter.format(p.price)}</td>
                <td>${p.stock}</td>
                <td class="space-x-1">
                  <button class="btn btn-soft" data-edit-product="${p.id}">Edit</button>
                  <button class="btn btn-danger" data-delete-product="${p.id}">Hapus</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="6" style="text-align:center;padding:2.5rem 0;color:#94a3b8;font-size:0.9rem;">Belum ada produk di database.</td></tr>'}
          </tbody>
        </table>
      </div>
      <dialog id="imageViewModal" class="backdrop:bg-black/50">
        <div class="bg-white rounded-xl p-4 max-w-2xl">
          <div class="flex justify-between items-center mb-3">
            <h3 class="font-bold text-lg" id="imageViewTitle"></h3>
            <button class="text-slate-500" id="closeImageView">✕</button>
          </div>
          <img id="imageViewImg" src="" alt="preview" class="w-full max-h-96 object-cover rounded-lg" />
        </div>
      </dialog>
    </div>
  `;

  root.querySelector('#addProductBtn').addEventListener('click', () => openProductDialog());

  root.querySelectorAll('[data-view-image]').forEach((img) => {
    img.addEventListener('click', () => {
      const modal = root.querySelector('#imageViewModal');
      root.querySelector('#imageViewImg').src = img.dataset.viewImage;
      root.querySelector('#imageViewTitle').textContent = img.dataset.imageName;
      modal.showModal();
    });
  });

  root.querySelector('#closeImageView').addEventListener('click', () => {
    root.querySelector('#imageViewModal').close();
  });

  root.querySelectorAll('[data-edit-product]').forEach((btn) => {
    btn.addEventListener('click', () => openProductDialog(btn.dataset.editProduct));
  });

  root.querySelectorAll('[data-delete-product]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteProduct(btn.dataset.deleteProduct);
    });
  });
}

function openProductDialog(productId = null) {
  const dialog = document.getElementById('productDialog');
  const product = productId ? state.products.find((p) => p.id === String(productId)) : null;

  dialog.innerHTML = `
    <form id="productForm" class="p-5 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg text-primary-700">${product ? 'Edit Produk' : 'Tambah Produk'}</h3>
        <button type="button" id="closeProductDialog" class="text-slate-500">Tutup</button>
      </div>

      <div>
        <label class="text-sm text-slate-600">Nama Produk <span class="text-red-500">*</span></label>
        <input name="name" class="input" placeholder="Contoh: Kopi Susu Gula Aren" value="${product?.name || ''}" />
        <p id="err-name" class="hidden mt-1 text-xs text-red-500 font-medium"></p>
      </div>

      <div class="grid sm:grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-slate-600">Kategori <span class="text-red-500">*</span></label>
          <select name="categoryId" class="select">
            <option value="">Pilih kategori</option>
            ${state.categories.map((c) => `<option value="${c.id}" ${product?.categoryId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
          <p id="err-category" class="hidden mt-1 text-xs text-red-500 font-medium"></p>
        </div>
        <div>
          <label class="text-sm text-slate-600">Harga (Rp) <span class="text-red-500">*</span></label>
          <input name="price" type="number" min="1" class="input" placeholder="Minimal Rp 1" value="${product?.price || ''}" />
          <p id="err-price" class="hidden mt-1 text-xs text-red-500 font-medium"></p>
        </div>
      </div>

      <div>
        <label class="text-sm text-slate-600">Stock <span class="text-red-500">*</span></label>
        <input name="stock" type="number" min="1" class="input" placeholder="Minimal 1" value="${product?.stock || ''}" />
        <p id="err-stock" class="hidden mt-1 text-xs text-red-500 font-medium"></p>
      </div>

      <div>
        <label class="text-sm text-slate-600">Foto Produk</label>
        <div class="mt-1 flex flex-col gap-2">
          <img id="imagePreview" src="${product?.image || ''}" alt="preview"
            class="w-full h-36 object-cover rounded-xl border border-amber-100 bg-stone-50 ${product?.image ? '' : 'hidden'}" />
          <label class="btn btn-soft cursor-pointer text-center">
            Pilih Foto
            <input id="imageFileInput" type="file" accept="image/*" class="hidden" />
          </label>
          <p id="uploadStatus" class="text-xs text-slate-400"></p>
          <input type="hidden" name="image" id="imageUrlHidden" value="${product?.image || ''}" />
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-soft" id="cancelProductDialog">Batal</button>
        <button type="submit" class="btn btn-primary" id="saveProductBtn">Simpan</button>
      </div>
    </form>
  `;

  dialog.showModal();

  const fileInput = dialog.querySelector('#imageFileInput');
  const preview = dialog.querySelector('#imagePreview');
  const uploadStatus = dialog.querySelector('#uploadStatus');
  const imageUrlHidden = dialog.querySelector('#imageUrlHidden');

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.classList.remove('hidden');
    uploadStatus.textContent = 'Mengupload...';
    const ext = file.name.split('.').pop();
    const fileName = `product-${Date.now()}.${ext}`;
    const { data: upData, error: upErr } = await db.storage
      .from('products')
      .upload(fileName, file, { upsert: true });
    if (upErr) {
      uploadStatus.textContent = `Gagal upload: ${upErr.message}`;
      notify.error(`Gagal upload foto: ${upErr.message}`);
      return;
    }
    const { data: urlData } = db.storage.from('products').getPublicUrl(upData.path);
    imageUrlHidden.value = urlData.publicUrl;
    uploadStatus.textContent = '✓ Foto berhasil diupload';
    notify.success('Foto berhasil diupload!', 'Sukses');
  });

  function close() {
    dialog.close();
  }

  dialog.querySelector('#closeProductDialog').addEventListener('click', close);
  dialog.querySelector('#cancelProductDialog').addEventListener('click', close);

  // Helper: show/clear inline field errors
  function showFieldError(id, message) {
    const el = dialog.querySelector(`#${id}`);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
    // Highlight the associated input
    const input = el.previousElementSibling;
    if (input && (input.tagName === 'INPUT' || input.tagName === 'SELECT')) {
      input.classList.add('border-red-400', 'ring-1', 'ring-red-300');
    }
  }

  function clearFieldError(id) {
    const el = dialog.querySelector(`#${id}`);
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
    const input = el.previousElementSibling;
    if (input && (input.tagName === 'INPUT' || input.tagName === 'SELECT')) {
      input.classList.remove('border-red-400', 'ring-1', 'ring-red-300');
    }
  }

  function clearAllErrors() {
    ['err-name', 'err-category', 'err-price', 'err-stock'].forEach(clearFieldError);
  }

  // Clear error on input change
  ['name', 'categoryId', 'price', 'stock'].forEach((field) => {
    const errId = field === 'categoryId' ? 'err-category' : `err-${field}`;
    const el = dialog.querySelector(`[name="${field}"]`);
    if (el) el.addEventListener('input', () => clearFieldError(errId));
    if (el) el.addEventListener('change', () => clearFieldError(errId));
  });

  dialog.querySelector('#productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const fd = new FormData(e.target);
    const name = String(fd.get('name') || '').trim();
    const categoryId = String(fd.get('categoryId') || '');
    const price = Number(fd.get('price') || 0);
    const stock = Number(fd.get('stock') || 0);

    // --- Validation ---
    let hasError = false;

    if (!name) {
      showFieldError('err-name', 'Nama produk wajib diisi.');
      hasError = true;
    } else if (name.length < 2) {
      showFieldError('err-name', 'Nama produk minimal 2 karakter.');
      hasError = true;
    } else {
      // Cek nama duplikat (case-insensitive), kecuali produk yang sedang diedit
      const nameLower = name.toLowerCase();
      const duplicate = state.products.find(
        (p) => p.name.toLowerCase() === nameLower && p.id !== (product?.id || null)
      );
      if (duplicate) {
        showFieldError('err-name', `Nama "${name}" sudah digunakan produk lain.`);
        hasError = true;
      }
    }

    if (!categoryId) {
      showFieldError('err-category', 'Pilih kategori terlebih dahulu.');
      hasError = true;
    }

    if (!fd.get('price') && fd.get('price') !== '0') {
      showFieldError('err-price', 'Harga wajib diisi.');
      hasError = true;
    } else if (price <= 0) {
      showFieldError('err-price', 'Harga harus lebih dari Rp 0.');
      hasError = true;
    }

    if (!fd.get('stock') && fd.get('stock') !== '0') {
      showFieldError('err-stock', 'Stock wajib diisi.');
      hasError = true;
    } else if (!Number.isInteger(stock) || stock < 1) {
      showFieldError('err-stock', 'Stock minimal 1 dan harus angka bulat.');
      hasError = true;
    }

    if (hasError) return;

    // --- Save ---
    const saveBtn = dialog.querySelector('#saveProductBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';

    const payload = {
      name,
      category_id: categoryId,
      price,
      stock,
      image_url: imageUrlHidden ? imageUrlHidden.value.trim() : ''
    };

    if (product) {
      const res = await db.from('products').update(payload).eq('id', product.id);
      if (res.error) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Simpan';
        notify.error(`Gagal update produk: ${res.error.message}`);
        return;
      }
    } else {
      const res = await db.from('products').insert(payload);
      if (res.error) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Simpan';
        notify.error(`Gagal tambah produk: ${res.error.message}`);
        return;
      }
    }

    close();
    notify.success('Produk berhasil disimpan');
    await refreshDataAndView();
  });
}

async function deleteProduct(productId) {
  const used = state.transactions.some((trx) => trx.items.some((item) => item.productId === String(productId)));
  if (used) {
    const confirmed = await notify.confirm('Produk pernah dipakai di transaksi. Tetap hapus?', 'Konfirmasi Hapus');
    if (!confirmed) return;
  }

  const confirmed = await notify.confirm('Hapus produk ini?');
  if (!confirmed) return;

  const res = await db.from('products').delete().eq('id', productId);
  if (res.error) {
    notify.error(`Gagal hapus produk: ${res.error.message}`);
    return;
  }

  notify.success('Produk berhasil dihapus');
  await refreshDataAndView();
}

function renderKategori() {
  const root = document.getElementById('view-kategori');

  root.innerHTML = `
    <div class="card p-5">
      <div class="flex flex-wrap items-center justify-between mb-4 gap-2">
        <h3 class="font-bold text-lg text-primary-700">Data Kategori</h3>
        <button id="addCategoryBtn" class="btn btn-primary">Tambah Kategori</button>
      </div>

      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Deskripsi</th>
              <th>Jumlah Produk</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${state.categories.length ? state.categories.map((c) => `
              <tr>
                <td>${c.name}</td>
                <td>${c.description || '-'}</td>
                <td>${state.products.filter((p) => p.categoryId === c.id).length}</td>
                <td class="space-x-1">
                  <button class="btn btn-soft" data-edit-category="${c.id}">Edit</button>
                  <button class="btn btn-danger" data-delete-category="${c.id}">Hapus</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="4" style="text-align:center;padding:2.5rem 0;color:#94a3b8;font-size:0.9rem;">Belum ada kategori di database.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  root.querySelector('#addCategoryBtn').addEventListener('click', () => openCategoryDialog());

  root.querySelectorAll('[data-edit-category]').forEach((btn) => {
    btn.addEventListener('click', () => openCategoryDialog(btn.dataset.editCategory));
  });

  root.querySelectorAll('[data-delete-category]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await deleteCategory(btn.dataset.deleteCategory);
    });
  });
}

function openCategoryDialog(categoryId = null) {
  const dialog = document.getElementById('categoryDialog');
  const category = categoryId ? state.categories.find((c) => c.id === String(categoryId)) : null;

  dialog.innerHTML = `
    <form id="categoryForm" class="p-5 space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg text-primary-700">${category ? 'Edit Kategori' : 'Tambah Kategori'}</h3>
        <button type="button" id="closeCategoryDialog" class="text-slate-500">Tutup</button>
      </div>

      <div>
        <label class="text-sm text-slate-600">Nama Kategori</label>
        <input name="name" class="input" required value="${category?.name || ''}" />
      </div>

      <div>
        <label class="text-sm text-slate-600">Deskripsi</label>
        <textarea name="description" class="textarea" rows="3">${category?.description || ''}</textarea>
      </div>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn btn-soft" id="cancelCategoryDialog">Batal</button>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </div>
    </form>
  `;

  dialog.showModal();

  function close() {
    dialog.close();
  }

  dialog.querySelector('#closeCategoryDialog').addEventListener('click', close);
  dialog.querySelector('#cancelCategoryDialog').addEventListener('click', close);

  dialog.querySelector('#categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);

    const payload = {
      name: String(fd.get('name') || '').trim(),
      description: String(fd.get('description') || '').trim()
    };

    if (!payload.name) {
      notify.warning('Nama kategori wajib diisi.');
      return;
    }

    if (category) {
      const res = await db.from('categories').update(payload).eq('id', category.id);
      if (res.error) {
        notify.error(`Gagal update kategori: ${res.error.message}`);
        return;
      }
    } else {
      const res = await db.from('categories').insert(payload);
      if (res.error) {
        notify.error(`Gagal tambah kategori: ${res.error.message}`);
        return;
      }
    }

    close();
    notify.success('Kategori berhasil disimpan');
    await refreshDataAndView();
  });
}

async function deleteCategory(categoryId) {
  const hasProduct = state.products.some((p) => p.categoryId === String(categoryId));
  if (hasProduct) {
    notify.error('Kategori ini masih dipakai produk. Pindahkan/hapus produk dulu.');
    return;
  }

  const confirmed = await notify.confirm('Hapus kategori ini?');
  if (!confirmed) return;

  const res = await db.from('categories').delete().eq('id', categoryId);
  if (res.error) {
    notify.error(`Gagal hapus kategori: ${res.error.message}`);
    return;
  }

  notify.success('Kategori berhasil dihapus');
  await refreshDataAndView();
}

function renderTransaksi() {
  const root = document.getElementById('view-transaksi');
  const rows = [...state.transactions];

  root.innerHTML = `
    <div class="card p-5">
      <h3 class="font-bold text-lg text-primary-700 mb-4">Riwayat Transaksi</h3>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Tanggal</th>
              <th>Status</th>
              <th>Total Item</th>
              <th>Total Bayar</th>
              <th>Uang Bayar</th>
              <th>Kembalian</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((trx) => `
              <tr>
                <td>${trx.code}</td>
                <td>${formatDateTime(trx.createdAt)}</td>
                <td>${transactionStatusBadge(trx.status)}</td>
                <td>${trx.items.reduce((sum, i) => sum + i.qty, 0)}</td>
                <td>${formatter.format(trx.total)}</td>
                <td>${formatter.format(trx.payment)}</td>
                <td>${formatter.format(trx.change)}</td>
                <td class="space-x-1">
                  <button class="btn btn-soft" data-detail-trx="${trx.id}">Detail</button>
                  <button class="btn btn-primary" data-print-trx="${trx.id}">Cetak</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="8" style="text-align:center;padding:2.5rem 0;color:#94a3b8;font-size:0.9rem;">Belum ada transaksi di database.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  root.querySelectorAll('[data-detail-trx]').forEach((btn) => {
    btn.addEventListener('click', () => openTrxDetail(btn.dataset.detailTrx));
  });

  root.querySelectorAll('[data-print-trx]').forEach((btn) => {
    btn.addEventListener('click', () => printReceipt(btn.dataset.printTrx));
  });
}

function openTrxDetail(trxId) {
  const trx = state.transactions.find((t) => t.id === String(trxId));
  if (!trx) return;

  const dialog = document.getElementById('trxDetailDialog');
  dialog.innerHTML = `
    <div class="p-5 space-y-3">
      <div class="flex justify-between items-center">
        <h3 class="font-bold text-lg text-primary-700">Detail ${trx.code}</h3>
        <button id="closeTrxDetail" class="text-slate-500">Tutup</button>
      </div>

      <p class="text-sm text-slate-500">${formatDateTime(trx.createdAt)}</p>
      <p>${transactionStatusBadge(trx.status)}</p>
      <p class="text-sm text-slate-600">Pemesan: <strong>${trx.customerName || 'Kasir'}</strong></p>
      ${trx.notes ? `<p class="text-sm text-slate-600">Catatan: ${trx.notes}</p>` : ''}

      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Qty</th>
              <th>Harga</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${trx.items.map((item) => `
              <tr>
                <td>${item.name}</td>
                <td>${item.qty}</td>
                <td>${formatter.format(item.price)}</td>
                <td>${formatter.format(item.price * item.qty)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="pt-3 border-t border-amber-100 text-sm space-y-1">
        <p class="flex justify-between"><span>Total</span><span>${formatter.format(trx.total)}</span></p>
        <p class="flex justify-between"><span>Bayar</span><span>${formatter.format(trx.payment)}</span></p>
        <p class="flex justify-between font-bold text-emerald-700"><span>Kembalian</span><span>${formatter.format(trx.change)}</span></p>
      </div>
    </div>
  `;

  dialog.showModal();
  dialog.querySelector('#closeTrxDetail').addEventListener('click', () => dialog.close());
}

function reportRangeData(startDate, endDate) {
  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  const list = completedTransactions().filter((trx) => {
    const d = new Date(trx.createdAt);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  const omzet = list.reduce((sum, trx) => sum + trx.total, 0);
  const itemSold = list.reduce((sum, trx) => sum + trx.items.reduce((n, i) => n + i.qty, 0), 0);

  const bestMap = {};
  list.forEach((trx) => {
    trx.items.forEach((item) => {
      bestMap[item.name] = (bestMap[item.name] || 0) + item.qty;
    });
  });

  const top = Object.entries(bestMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return { list, omzet, itemSold, top };
}

function renderLaporan() {
  const root = document.getElementById('view-laporan');

  root.innerHTML = `
    <div class="card p-5 space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <div>
          <label class="text-sm text-slate-600">Tanggal Awal</label>
          <input id="reportStart" class="input" type="date" />
        </div>
        <div>
          <label class="text-sm text-slate-600">Tanggal Akhir</label>
          <input id="reportEnd" class="input" type="date" />
        </div>
        <div class="mt-5">
          <button id="applyReport" class="btn btn-primary">Terapkan</button>
        </div>
        <div class="flex gap-2 ml-auto mt-5">
          <button id="exportExcel" title="Export Excel" style="display:inline-flex;align-items:center;gap:6px;background:#f3e7d8;color:#7c4521;border:none;border-radius:0.75rem;padding:0.55rem 0.95rem;font-weight:700;cursor:pointer;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="10" y1="9" x2="14" y2="9"/></svg> Excel
          </button>
          <button id="exportPdf" title="Export PDF" style="display:inline-flex;align-items:center;gap:6px;background:#f8f1e8;color:#7c4521;border:1px solid #e6cbb2;border-radius:0.75rem;padding:0.55rem 0.95rem;font-weight:700;cursor:pointer;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15v-4h2a2 2 0 0 1 0 4H9z"/><path d="M13 15v-4"/><path d="M16 11v4"/><path d="M13 13h3"/></svg> PDF
          </button>
        </div>
      </div>

      <div id="reportResult"></div>
    </div>
  `;

  const resultEl = root.querySelector('#reportResult');

  function draw(data) {
    resultEl.innerHTML = `
      <div class="grid sm:grid-cols-3 gap-3 mb-4">
        <article class="card p-4">
          <p class="text-sm text-slate-500">Jumlah Transaksi</p>
          <p class="text-2xl font-black text-primary-700">${data.list.length}</p>
        </article>
        <article class="card p-4">
          <p class="text-sm text-slate-500">Total Item Terjual</p>
          <p class="text-2xl font-black text-amber-700">${data.itemSold}</p>
        </article>
        <article class="card p-4">
          <p class="text-sm text-slate-500">Total Omzet</p>
          <p class="text-2xl font-black text-amber-800">${formatter.format(data.omzet)}</p>
        </article>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="card p-4">
          <h4 class="font-bold text-primary-700 mb-2">Top Produk</h4>
          ${data.top.length ? `
            <ul class="space-y-2">
              ${data.top.map((row, idx) => `
                <li class="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-white px-4 py-3 shadow-sm">
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-800">${idx + 1}</span>
                    <div class="min-w-0">
                      <p class="truncate font-semibold text-slate-800">${row[0]}</p>
                      <p class="text-xs text-slate-500">Produk terlaris periode terpilih</p>
                    </div>
                  </div>
                  <span class="badge badge-blue whitespace-nowrap">${row[1]} pcs</span>
                </li>
              `).join('')}
            </ul>
          ` : '<p class="text-sm text-slate-500">Belum ada penjualan.</p>'}
        </div>

        <div class="card p-4">
          <h4 class="font-bold text-primary-700 mb-2">Ringkasan Data</h4>
          <div class="table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Tanggal</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${data.list.length ? data.list.slice(-5).reverse().map((trx) => `
                  <tr>
                    <td>${trx.code}</td>
                    <td>${formatDateTime(trx.createdAt)}</td>
                    <td>${formatter.format(trx.total)}</td>
                  </tr>
                `).join('') : '<tr><td colspan="3" class="text-slate-500">Tidak ada data.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  let currentData = reportRangeData();
  draw(currentData);

  root.querySelector('#applyReport').addEventListener('click', () => {
    const startDate = root.querySelector('#reportStart').value;
    const endDate = root.querySelector('#reportEnd').value;
    currentData = reportRangeData(startDate, endDate);
    draw(currentData);
  });

  root.querySelector('#exportExcel').addEventListener('click', () => {
    const startVal = root.querySelector('#reportStart').value;
    const endVal = root.querySelector('#reportEnd').value;
    const label = startVal && endVal ? `${startVal}_sd_${endVal}` : 'semua';
    const rows = [
      ['LAPORAN PENJUALAN'],
      ['Periode', startVal || '-', 'sd', endVal || '-'],
      [],
      ['Jumlah Transaksi', currentData.list.length],
      ['Total Item Terjual', currentData.itemSold],
      ['Total Omzet', currentData.omzet],
      [],
      ['TOP PRODUK'],
      ['No', 'Nama Produk', 'Terjual'],
      ...currentData.top.map((row, i) => [i + 1, row[0], row[1]]),
      [],
      ['DAFTAR TRANSAKSI'],
      ['Kode', 'Tanggal', 'Total'],
      ...currentData.list.map((trx) => [trx.code, formatDateTime(trx.createdAt), trx.total])
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `laporan_${label}.csv`; a.click();
    URL.revokeObjectURL(url);
  });

  root.querySelector('#exportPdf').addEventListener('click', () => {
    const startVal = root.querySelector('#reportStart').value;
    const endVal = root.querySelector('#reportEnd').value;
    const label = startVal && endVal ? `${startVal} s/d ${endVal}` : 'Semua Periode';
    const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"/><title>Laporan Penjualan</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;font-size:13px}h1{font-size:18px;margin-bottom:4px}p.sub{color:#64748b;margin-bottom:16px}.stats{display:flex;gap:16px;margin-bottom:20px}.stat{flex:1;border:1px solid #e6cbb2;border-radius:8px;padding:10px 14px}.stat-label{font-size:11px;color:#64748b}.stat-value{font-size:20px;font-weight:900;color:#7c4521}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#f8f1e8;color:#7c4521;font-size:11px;text-transform:uppercase;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:12px}h2{font-size:14px;margin:16px 0 8px;border-bottom:2px solid #e6cbb2;padding-bottom:4px;color:#7c4521}</style>
</head><body>
<h1>Laporan Penjualan</h1><p class="sub">Periode: ${label}</p>
<div class="stats">
  <div class="stat"><div class="stat-label">Jumlah Transaksi</div><div class="stat-value">${currentData.list.length}</div></div>
  <div class="stat"><div class="stat-label">Total Item Terjual</div><div class="stat-value">${currentData.itemSold}</div></div>
  <div class="stat"><div class="stat-label">Total Omzet</div><div class="stat-value">${formatter.format(currentData.omzet)}</div></div>
</div>
<h2>Top Produk</h2>
<table><thead><tr><th>#</th><th>Nama Produk</th><th>Terjual</th></tr></thead><tbody>
${currentData.top.length ? currentData.top.map((row,i)=>`<tr><td>${i+1}</td><td>${row[0]}</td><td>${row[1]} pcs</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center;color:#94a3b8">Belum ada data</td></tr>'}</tbody></table>
<h2>Daftar Transaksi</h2>
<table><thead><tr><th>Kode</th><th>Tanggal</th><th>Total</th></tr></thead><tbody>
${currentData.list.length ? currentData.list.map((trx)=>`<tr><td>${trx.code}</td><td>${formatDateTime(trx.createdAt)}</td><td>${formatter.format(trx.total)}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center;color:#94a3b8">Tidak ada transaksi</td></tr>'}</tbody></table>
</body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  });
}

function printReceipt(trxId) {
  const trx = state.transactions.find((t) => t.id === String(trxId));
  if (!trx) return;

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>Struk ${trx.code}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        .title { text-align: center; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { font-size: 12px; border-bottom: 1px dashed #999; padding: 6px 2px; }
        .right { text-align: right; }
      </style>
    </head>
    <body>
      <div class="title">
        <h2 style="margin:0;">Kopi Searah</h2>
        <p style="margin:4px 0;">${trx.code} - ${formatDateTime(trx.createdAt)}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th class="right">Harga</th>
            <th class="right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${trx.items.map((item) => `
            <tr>
              <td>${item.name}</td>
              <td>${item.qty}</td>
              <td class="right">${formatter.format(item.price)}</td>
              <td class="right">${formatter.format(item.price * item.qty)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="margin-top:10px;" class="right"><strong>Total: ${formatter.format(trx.total)}</strong></p>
      <p class="right">Bayar: ${formatter.format(trx.payment)}</p>
      <p class="right">Kembalian: ${formatter.format(trx.change)}</p>
      <p style="text-align:center; margin-top:14px;">Terima kasih telah berbelanja</p>

      <script>window.print();</script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=420,height=700');
  if (!printWindow) {
    notify.error('Popup diblokir browser. Izinkan popup untuk cetak struk.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
}
function renderCurrentView() {
  if (state.currentView === 'dashboard') renderDashboard();
  if (state.currentView === 'kasir') renderKasir();
  if (state.currentView === 'produk') renderProduk();
  if (state.currentView === 'kategori') renderKategori();
  if (state.currentView === 'transaksi') renderTransaksi();
  if (state.currentView === 'laporan') renderLaporan();
}

async function refreshDataAndView() {
  try {
    await loadAllData();
    renderCurrentView();
  } catch (error) {
    notify.error(`Gagal ambil data database: ${error.message}`, 'Error Database');
  }
}

function attachGlobalEvents() {
  document.getElementById('sidebarToggleBtn').addEventListener('click', () => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      toggleSidebar();
      return;
    }

    openMobileMenu();
  });

  document.querySelectorAll('[data-close-mobile]').forEach((el) => {
    el.addEventListener('click', closeMobileMenu);
  });
}

async function init() {
  renderNav();
  renderCurrentView();
  attachGlobalEvents();

  if (!ensureDb()) return;

  await refreshDataAndView();
}

init();