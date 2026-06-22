// Load SweetAlert2 dari CDN
// Memuat library SweetAlert2 agar aplikasi dapat menampilkan notifikasi dan dialog konfirmasi.
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

// Mengubah path aset lokal menjadi URL absolut, terutama untuk halaman cetak yang dibuka di tab baru.
const assetUrl = (path) => new URL(path, window.location.href).href;

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-password-toggle]');
  if (!toggle) return;

  const field = toggle.closest('.password-field');
  const input = field?.querySelector('[data-password-input]');
  if (!input) return;

  const showPassword = input.type === 'password';
  input.type = showPassword ? 'text' : 'password';
  toggle.classList.toggle('is-visible', showPassword);
  toggle.setAttribute('aria-pressed', String(showPassword));
  toggle.setAttribute('aria-label', showPassword ? 'Sembunyikan password' : 'Tampilkan password');
});

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

// Auth Functions
// Memeriksa sesi login di localStorage dan menghapusnya jika sudah kedaluwarsa.
async function checkSession() {
  const sessionData = localStorage.getItem('kopisearah_session');
  if (!sessionData) return null;

  try {
    const session = JSON.parse(sessionData);
    const expiry = session.expiry;
    const now = new Date().getTime();

    if (now > expiry) {
      localStorage.removeItem('kopisearah_session');
      return null;
    }

    return session;
  } catch (e) {
    localStorage.removeItem('kopisearah_session');
    return null;
  }
}

// Memvalidasi akun admin ke database, lalu menyimpan sesi login selama 24 jam.
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    notify.error('Email dan password harus diisi.');
    return;
  }

  try {
    const { data, error } = await db
      .from('admin_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('password', password)
      .single();

    if (error || !data) {
      notify.error('Email atau password salah.');
      return;
    }

    const session = {
      userId: data.id,
      name: data.name,
      email: data.email,
      role: data.role || 'kasir',
      expiry: new Date().getTime() + (24 * 60 * 60 * 1000) // 24 jam
    };

    localStorage.setItem('kopisearah_session', JSON.stringify(session));
    state.currentUser = session;
    await startAdminApp();
    const roleLabel = session.role === 'super_admin' ? 'Super Admin' : (session.role === 'koki' ? 'Koki' : 'Kasir');
    notify.success(`Selamat datang, ${data.name}! (${roleLabel})`, 'Login Berhasil');
  } catch (err) {
    notify.error('Terjadi kesalahan saat login.');
  }
}

// Cek apakah user adalah Super Admin
// Mengecek apakah pengguna yang sedang login memiliki role super admin.
function isSuperAdmin() {
  return state.currentUser?.role === 'super_admin';
}

// Meminta konfirmasi logout, menghapus sesi, dan mengembalikan pengguna ke halaman login.
async function handleLogout() {
  const confirmed = await notify.confirm('Apakah Anda yakin ingin keluar?', 'Logout');
  if (!confirmed) return;

  localStorage.removeItem('kopisearah_session');
  state.currentUser = null;
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
  showLoginPage();
  notify.success('Berhasil logout.');
}

// Menampilkan halaman login dan menyembunyikan seluruh layout dashboard.
function showLoginPage() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('layoutRoot').classList.add('hidden');
}

// Menampilkan dashboard setelah login serta mengisi nama pengguna dan menu sesuai role.
function showDashboard() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('layoutRoot').classList.remove('hidden');
  document.getElementById('userName').textContent = state.currentUser?.name || 'Admin';

  // Render nav setelah user login supaya role sudah ter-set
  renderNav();
}

const APP_CONFIG = window.APP_CONFIG || {};
const ICONS = APP_CONFIG.icons || {};

// Menyusun daftar menu navigasi yang boleh diakses berdasarkan role pengguna.
function getNavGroups() {
  const role = state.currentUser?.role || 'kasir';

  // Common menu untuk semua role
  const commonItems = [
    { id: 'dashboard', label: 'Dashboard', subtitle: 'Ringkasan operasional hari ini' }
  ];

  // Menu per role
  const roleMenus = {
    super_admin: [
      { id: 'produk', label: 'Produk', subtitle: 'Kelola data produk (CRUD)' },
      { id: 'kategori', label: 'Kategori', subtitle: 'Kelola kategori produk (CRUD)' },
      { id: 'meja', label: 'Meja', subtitle: 'Status meja dan QR menu' },
      { id: 'kasir', label: 'Kasir', subtitle: 'Transaksi cepat + cetak struk' },
      { id: 'pesanan', label: 'Pesanan Masuk', subtitle: 'Order pelanggan dari landing page' },
      { id: 'transaksi', label: 'Transaksi', subtitle: 'Riwayat seluruh transaksi' },
      { id: 'laporan', label: 'Laporan', subtitle: 'Analisis penjualan dan ringkasan' },
      { id: 'register', label: 'Kelola Akun', subtitle: 'Tambah/hapus admin' }
    ],
    kasir: [
      { id: 'kasir', label: 'Kasir', subtitle: 'Transaksi cepat + cetak struk' },
      { id: 'pesanan', label: 'Pesanan Masuk', subtitle: 'Order pelanggan dari landing page' },
      { id: 'transaksi', label: 'Transaksi', subtitle: 'Riwayat transaksi hari ini' }
    ],
    koki: [
      { id: 'pesanan', label: 'Pesanan Masuk', subtitle: 'Order pelanggan dari landing page' }
    ]
  };

  return [
    {
      title: 'Utama',
      items: commonItems
    },
    {
      title: role === 'super_admin' ? 'Menu Super Admin' : (role === 'koki' ? 'Menu Koki' : 'Menu Kasir'),
      items: roleMenus[role] || roleMenus.kasir
    }
  ];
}

// NAV_GROUPS akan di-set saat login melalui getNavGroups()
let NAV_GROUPS = [];

const state = {
  currentView: 'dashboard',
  sidebarCollapsed: false,
  products: [],
  categories: [],
  transactions: [],
  cart: [],
  loading: false,
  currentUser: null,
  transactionPage: 1
};

const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

let db = null;
let globalEventsAttached = false;
let autoRefreshTimer = null;

// Membuat kode unik transaksi dari prefix, waktu saat ini, dan angka acak.
function uidCode(prefix = 'TRX') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Mengubah tanggal menjadi format lokal YYYY-MM-DD tanpa informasi jam.
function dateOnlyLocal(dateValue = new Date()) {
  const d = new Date(dateValue);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Memformat tanggal dan waktu agar mudah dibaca dalam format Indonesia.
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

// Mengubah status transaksi menjadi label dan kelas warna yang digunakan pada tampilan.
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

// Membuat HTML badge berwarna untuk menunjukkan status transaksi.
function transactionStatusBadge(status) {
  const meta = transactionStatusMeta(status);
  return `<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}">${meta.label}</span>`;
}

// Membuat pilihan status yang dapat digunakan admin untuk memperbarui pesanan masuk.
function transactionStatusSelect(trx) {
  const statuses = [
    ['pending', 'Menunggu'],
    ['processing', 'Diproses'],
    ['cancelled', 'Dibatalkan']
  ];

  return `
    <select class="select min-w-[135px] text-sm" data-status-trx="${trx.id}">
      ${statuses.map(([value, label]) => `
        <option value="${value}" ${trx.status === value ? 'selected' : ''}>${label}</option>
      `).join('')}
    </select>
  `;
}

// Mengambil hanya transaksi yang sudah selesai dari seluruh data transaksi.
function completedTransactions() {
  return state.transactions.filter((trx) => String(trx.status || 'completed').toLowerCase() === 'completed');
}

// Mengambil pesanan landing page yang masih menunggu atau sedang diproses.
function incomingOrders() {
  return state.transactions.filter((trx) => (
    String(trx.code || '').startsWith('ORD-') &&
    ['pending', 'processing'].includes(String(trx.status || '').toLowerCase())
  ));
}

// Mengecek apakah transaksi berasal dari pesanan pelanggan di landing page.
function isLandingOrder(trx) {
  return String(trx?.code || '').startsWith('ORD-');
}

// Mengecek apakah transaksi sudah dibayar dan berstatus selesai.
function transactionIsPaid(trx) {
  return Number(trx?.payment || 0) > 0 && String(trx?.status || '').toLowerCase() === 'completed';
}

// Membuat ringkasan nama dan jumlah item dalam sebuah transaksi.
function orderItemsSummary(trx) {
  return trx.items.length
    ? trx.items.map((item) => `${item.name} x${item.qty}`).join(', ')
    : '-';
}

// Mengambil nomor meja dari teks catatan transaksi dan memastikan nomornya valid.
function tableNumberFromNotes(notes) {
  const match = String(notes || '').match(/Meja:\s*(\d+)/i);
  if (!match) return '';

  const table = Number(match[1]);
  return Number.isInteger(table) && table >= 1 && table <= 20 ? String(table) : '';
}

// Mengambil nomor telepon pelanggan yang tersimpan di catatan transaksi.
function phoneNumberFromNotes(notes) {
  const match = String(notes || '').match(/Telepon:\s*([^|]+)/i);
  return match ? match[1].trim() : '';
}

// Mengubah nomor Indonesia seperti 08xx atau +62xx menjadi format 62xx untuk wa.me.
function normalizeWhatsappNumber(phone) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits.startsWith('8')) digits = `62${digits}`;
  return /^62\d{8,13}$/.test(digits) ? digits : '';
}

// Membuka chat WhatsApp pelanggan dengan pesan pembatalan yang sudah terisi.
function openCancellationWhatsapp(trx) {
  const whatsappNumber = normalizeWhatsappNumber(phoneNumberFromNotes(trx.notes));
  if (!whatsappNumber) return false;

  const orderType = String(trx.code || '').startsWith('RSV-') ? 'reservasi' : 'pesanan';
  const customerName = trx.customerName || 'Pelanggan';
  const message = [
    `Halo ${customerName},`,
    '',
    `Mohon maaf, ${orderType} Anda dengan kode ${trx.code} di Waroeng Searah telah dibatalkan.`,
    'Silakan hubungi kami kembali apabila membutuhkan informasi lebih lanjut.',
    '',
    'Terima kasih.'
  ].join('\n');

  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  const whatsappWindow = window.open(whatsappUrl, '_blank');
  if (whatsappWindow) whatsappWindow.opener = null;
  return Boolean(whatsappWindow);
}

// Mengambil semua transaksi aktif yang menggunakan nomor meja tertentu.
function activeTableTransactions(tableNumber) {
  return state.transactions.filter((trx) => (
    ['pending', 'processing'].includes(String(trx.status || '').toLowerCase()) &&
    tableNumberFromNotes(trx.notes) === String(tableNumber)
  ));
}

// Menentukan teks ringkas yang menjelaskan isi pesanan atau reservasi meja.
function tableOrderLabel(trx) {
  if (String(trx.code || '').startsWith('RSV-')) return 'Reservasi meja';
  if (trx.items.length) return orderItemsSummary(trx);
  return 'Pesanan meja';
}

// Membuat URL landing page menu yang sudah membawa nomor meja melalui parameter URL.
function tableMenuUrl(tableNumber) {
  const url = new URL('landing-page.html', window.location.href);
  url.searchParams.set('table', tableNumber);
  url.hash = 'menu';
  return url.toString();
}

// Menampilkan pesan peringatan atau error ketika terjadi masalah pada database.
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

// Menyembunyikan dan mengosongkan pesan peringatan database.
function clearDbAlert() {
  const el = document.getElementById('dbAlert');
  el.classList.add('hidden');
  el.textContent = '';
}

// Memastikan library dan konfigurasi Supabase tersedia, lalu membuat koneksi database.
function ensureDb() {
  if (!window.supabase || !window.supabase.createClient) {
    setDbAlert('Supabase library gagal dimuat. Cek internet/CDN.', true);
    return false;
  }

  if (!APP_CONFIG.supabaseUrl || !APP_CONFIG.supabaseAnonKey) {
    setDbAlert('Isi dulu file js/config.js (supabaseUrl dan supabaseAnonKey), lalu refresh.', true);
    return false;
  }

  db = window.supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
  clearDbAlert();
  return true;
}

// Mengambil kategori, produk, dan transaksi dari Supabase lalu menyimpannya ke state aplikasi.
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

// Mencari nama kategori berdasarkan ID kategori.
function categoryName(categoryId) {
  return state.categories.find((c) => c.id === String(categoryId))?.name || '-';
}

// Membuat HTML ikon navigasi berdasarkan ID menu.
function getNavIcon(id) {
  const src = ICONS[id] || '';
  if (!src) {
    return '<span class="nav-fallback"></span>';
  }

  return `<img src="${src}" alt="${id}" class="nav-icon" onerror="this.remove()" />`;
}

// Merender menu sidebar desktop dan mobile sesuai role dan halaman aktif.
function renderNav() {
  const groups = getNavGroups();
  const content = groups
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

// Berpindah halaman dashboard, memperbarui judul, lalu merender isi halaman tujuan.
function switchView(viewId) {
  state.currentView = viewId;
  document.querySelectorAll('.view-section').forEach((section) => section.classList.add('hidden'));
  const targetSection = document.getElementById(`view-${viewId}`);
  if (targetSection) {
    targetSection.classList.remove('hidden');
  }

  const groups = getNavGroups();
  const allItems = groups.flatMap((g) => g.items);
  const active = allItems.find((item) => item.id === viewId);
  document.getElementById('pageTitle').textContent = active?.label || 'Kopi Searah';
  document.getElementById('pageSubtitle').textContent = active?.subtitle || '';

  renderNav();
  renderCurrentView();
}

// Membuka atau mengecilkan sidebar pada tampilan desktop.
function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('sidebarToggleBtn');

  sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
  if (btn) {
    btn.setAttribute('aria-label', state.sidebarCollapsed ? 'Buka sidebar' : 'Tutup sidebar');
  }
}

// Menampilkan panel navigasi pada perangkat mobile.
function openMobileMenu() {
  document.getElementById('mobileMenu').classList.remove('hidden');
}

// Menutup panel navigasi pada perangkat mobile.
function closeMobileMenu() {
  document.getElementById('mobileMenu').classList.add('hidden');
}

// Membuat HTML kartu statistik ringkas untuk dashboard.
function metricCard(title, value, color = 'text-primary-700') {
  return `
    <article class="card p-5">
      <p class="text-sm text-slate-500">${title}</p>
      <h3 class="text-2xl font-black ${color}">${value}</h3>
    </article>
  `;
}

// Menghitung stok, transaksi hari ini, omzet, dan produk terlaris untuk dashboard.
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

// Menampilkan statistik, transaksi terbaru, dan produk terlaris pada halaman dashboard.
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

// Menambahkan satu produk ke keranjang kasir selama stok masih mencukupi.
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

// Menambah atau mengurangi jumlah produk tertentu di keranjang kasir.
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

// Menghapus sebuah produk dari keranjang kasir.
function removeCartItem(productId) {
  state.cart = state.cart.filter((i) => i.productId !== String(productId));
  renderKasir();
}

// Memvalidasi pembayaran, menyimpan transaksi, mengurangi stok, dan mencetak struk.
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

// Merender halaman kasir beserta daftar produk, keranjang, dan form pembayaran.
function renderKasir() {
  const root = document.getElementById('view-kasir');
  const cartTotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  root.innerHTML = `
    <div class="kasir-layout grid lg:grid-cols-3 gap-5">
      <div class="kasir-menu-column lg:col-span-2">
        <div class="kasir-menu-card card p-4">
          <div class="kasir-menu-head flex flex-wrap items-center gap-3 justify-between mb-4">
            <h3 class="font-bold text-lg text-primary-700">Menu Kasir</h3>
            <div class="flex flex-wrap gap-2">
              <input id="cashierSearch" class="input w-56" placeholder="Cari menu..." />
              <button class="btn btn-soft" id="goProduk">Tambah Barang</button>
            </div>
          </div>
          <div id="kasirMenu" class="kasir-menu-scroll grid sm:grid-cols-2 xl:grid-cols-3 gap-3"></div>
        </div>
      </div>

      <div class="kasir-cart-column space-y-4">
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

  // Menampilkan kartu produk kasir yang sesuai dengan kata pencarian.
  function renderMenuCards(keyword = '') {
    let filtered = state.products
      .filter((p) => p.name.toLowerCase().includes(keyword.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));

    menuBox.innerHTML = filtered.length
      ? filtered.map((p) => `
        <article class="border border-amber-100 rounded-xl p-3 bg-white">
          <button
            type="button"
            class="kasir-product-image-btn"
            data-preview-product="${p.id}"
            aria-label="Perbesar gambar ${p.name}"
            title="Klik untuk melihat gambar ${p.name}"
          >
            <img src="${p.image || 'https://placehold.co/400x260?text=No+Image'}" alt="${p.name}" class="w-full h-28 object-cover rounded-lg" />
            ${p.stock <= 0 ? '<span class="kasir-product-sold-out">Stok Habis</span>' : ''}
          </button>
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

    menuBox.querySelectorAll('[data-preview-product]').forEach((btn) => {
      btn.addEventListener('click', () => openProductImagePreview(btn.dataset.previewProduct));
    });
  }

  // Memperbarui tampilan isi keranjang dan total belanja pada halaman kasir.
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

  // Menghitung dan menampilkan perkiraan uang kembalian dari nominal pembayaran.
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

// Membuka gambar produk dalam dialog berukuran besar agar detailnya mudah dilihat.
function openProductImagePreview(productId) {
  const product = state.products.find((p) => p.id === String(productId));
  const dialog = document.getElementById('productImageDialog');
  if (!product || !dialog) return;

  const imageSrc = product.image || 'https://placehold.co/900x600?text=No+Image';
  dialog.innerHTML = `
    <div class="product-image-preview">
      <div class="product-image-preview-head">
        <div>
          <p class="text-xs font-bold uppercase tracking-widest text-amber-700">Preview Produk</p>
          <h3 class="text-lg font-black text-primary-700">${product.name}</h3>
        </div>
        <button type="button" class="product-image-preview-close" aria-label="Tutup preview gambar">✕</button>
      </div>
      <div class="product-image-preview-frame">
        <img src="${imageSrc}" alt="${product.name}" />
      </div>
      <div class="product-image-preview-info">
        <span>${categoryName(product.categoryId)}</span>
        <strong>${formatter.format(product.price)}</strong>
      </div>
    </div>
  `;

  dialog.showModal();
  dialog.querySelector('.product-image-preview-close').addEventListener('click', () => dialog.close());
  dialog.onclick = (event) => {
    if (event.target === dialog) dialog.close();
  };
}

// Merender halaman pengelolaan produk dan tabel daftar produk.
function renderProduk() {
  const root = document.getElementById('view-produk');

  root.innerHTML = `
    <div class="product-card card p-5">
      <div class="product-head flex flex-wrap items-center justify-between mb-4 gap-2">
        <h3 class="font-bold text-lg text-primary-700">Data Produk</h3>
        <div class="flex flex-wrap gap-2">
          <input id="productSearch" class="input w-56" placeholder="Cari produk..." />
          <button id="addProductBtn" class="btn btn-primary">Tambah Produk</button>
        </div>
      </div>
      <div class="table-wrap product-table-scroll">
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
          <tbody id="productTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const productSearch = root.querySelector('#productSearch');
  const productTableBody = root.querySelector('#productTableBody');

  root.querySelector('#addProductBtn').addEventListener('click', () => openProductDialog());

  // Memfilter dan menampilkan baris produk berdasarkan kata pencarian.
  function renderProductRows(keyword = '') {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const filtered = state.products
      .filter((p) => {
        const name = String(p.name || '').toLowerCase();
        const category = String(categoryName(p.categoryId) || '').toLowerCase();
        return name.includes(normalizedKeyword) || category.includes(normalizedKeyword);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));

    productTableBody.innerHTML = filtered.length ? filtered.map((p) => `
      <tr>
        <td>
          <button
            type="button"
            class="product-table-image-btn"
            data-preview-product="${p.id}"
            aria-label="Perbesar gambar ${p.name}"
            title="Klik untuk melihat gambar ${p.name}"
          >
            <img src="${p.image || 'https://placehold.co/120x80?text=No+Image'}" class="w-16 h-11 rounded object-cover" alt="${p.name}" />
          </button>
        </td>
        <td>${p.name}</td>
        <td>${categoryName(p.categoryId)}</td>
        <td>${formatter.format(p.price)}</td>
        <td>${p.stock}</td>
        <td class="space-x-1">
          <button class="btn btn-soft" data-edit-product="${p.id}">Edit</button>
          <button class="btn btn-danger" data-delete-product="${p.id}">Hapus</button>
        </td>
      </tr>
    `).join('') : `<tr><td colspan="6" style="text-align:center;padding:2.5rem 0;color:#94a3b8;font-size:0.9rem;">${normalizedKeyword ? 'Produk tidak ditemukan.' : 'Belum ada produk di database.'}</td></tr>`;

    productTableBody.querySelectorAll('[data-preview-product]').forEach((btn) => {
      btn.addEventListener('click', () => openProductImagePreview(btn.dataset.previewProduct));
    });

    productTableBody.querySelectorAll('[data-edit-product]').forEach((btn) => {
      btn.addEventListener('click', () => openProductDialog(btn.dataset.editProduct));
    });

    productTableBody.querySelectorAll('[data-delete-product]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await deleteProduct(btn.dataset.deleteProduct);
      });
    });
  }

  productSearch.addEventListener('input', () => renderProductRows(productSearch.value));
  renderProductRows();
}

// Membuka dialog untuk menambah produk baru atau mengedit produk yang sudah ada.
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

  // Menutup dialog produk serta membersihkan pratinjau gambar sementara.
  function close() {
    dialog.close();
  }

  dialog.querySelector('#closeProductDialog').addEventListener('click', close);
  dialog.querySelector('#cancelProductDialog').addEventListener('click', close);

  // Helper: show/clear inline field errors
  // Menampilkan pesan validasi pada field produk tertentu.
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

  // Menghapus pesan validasi dari satu field produk.
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

  // Menghapus seluruh pesan validasi pada form produk.
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

// Meminta konfirmasi lalu menghapus produk terpilih dari database.
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

// Merender halaman pengelolaan kategori beserta jumlah produk setiap kategori.
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

// Membuka dialog untuk menambah kategori baru atau mengedit kategori lama.
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

  // Menutup dialog kategori.
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

// Memastikan kategori tidak digunakan lalu menghapusnya dari database.
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

// Memperbarui status pesanan dan menangani pengembalian stok jika pesanan dibatalkan.
async function updateTransactionStatus(trxId, nextStatus) {
  const trx = state.transactions.find((t) => t.id === String(trxId));
  if (!trx) return;

  const currentStatus = String(trx.status || 'completed').toLowerCase();
  if (currentStatus === nextStatus) return;

  if (nextStatus === 'completed' && isLandingOrder(trx) && !transactionIsPaid(trx)) {
    notify.info('Isi pembayaran cash terlebih dahulu dari detail pesanan.', 'Pembayaran Diperlukan');
    renderCurrentView();
    openTrxDetail(trx.id);
    return;
  }

  if (nextStatus === 'cancelled' && currentStatus !== 'cancelled') {
    const confirmed = await notify.confirm('Batalkan pesanan ini? Stok item akan dikembalikan.');
    if (!confirmed) {
      renderCurrentView();
      return;
    }

    for (const item of trx.items) {
      const product = state.products.find((p) => p.id === item.productId);
      if (!product) continue;

      const stockRes = await db
        .from('products')
        .update({ stock: Number(product.stock || 0) + Number(item.qty || 0) })
        .eq('id', item.productId);

      if (stockRes.error) {
        notify.error(`Gagal mengembalikan stok ${item.name}: ${stockRes.error.message}`);
        await refreshDataAndView();
        return;
      }
    }
  }

  if (currentStatus === 'cancelled' && nextStatus !== 'cancelled') {
    const confirmed = await notify.confirm('Aktifkan lagi pesanan ini? Stok item akan dikurangi kembali.');
    if (!confirmed) {
      renderCurrentView();
      return;
    }

    for (const item of trx.items) {
      const product = state.products.find((p) => p.id === item.productId);
      if (!product || Number(product.stock || 0) < Number(item.qty || 0)) {
        notify.error(`Stock ${item.name} tidak cukup untuk mengaktifkan pesanan ini.`);
        await refreshDataAndView();
        return;
      }

      const stockRes = await db
        .from('products')
        .update({ stock: Number(product.stock || 0) - Number(item.qty || 0) })
        .eq('id', item.productId);

      if (stockRes.error) {
        notify.error(`Gagal mengurangi stok ${item.name}: ${stockRes.error.message}`);
        await refreshDataAndView();
        return;
      }
    }
  }

  const payload = {
    status: nextStatus,
    processed_at: nextStatus === 'completed' ? new Date().toISOString() : trx.processedAt
  };

  if (nextStatus !== 'completed') {
    payload.processed_at = null;
  }

  const res = await db.from('transactions').update(payload).eq('id', trx.id);
  if (res.error) {
    notify.error(`Gagal mengubah status: ${res.error.message}`);
    return;
  }

  let whatsappOpened = null;
  if (nextStatus === 'cancelled' && currentStatus !== 'cancelled') {
    whatsappOpened = openCancellationWhatsapp(trx);
  }

  notify.success(`Status pesanan ${trx.code} diperbarui.`);

  if (whatsappOpened === false) {
    setTimeout(() => {
      if (!whatsappOpened) {
        notify.warning(
          'Status sudah dibatalkan, tetapi WhatsApp tidak dapat dibuka. Pastikan nomor pelanggan valid dan popup browser diizinkan.',
          'WhatsApp Tidak Terbuka'
        );
      }
    }, 2100);
  }

  await refreshDataAndView();
}

// Menyelesaikan pembayaran pesanan dari landing page dan menyimpan uang kembalian.
async function payLandingOrder(trxId, payment) {
  const trx = state.transactions.find((t) => t.id === String(trxId));
  if (!trx) return;

  const paidAmount = Number(payment || 0);
  if (!paidAmount || paidAmount <= 0) {
    notify.warning('Uang bayar tidak boleh kosong atau 0.');
    return;
  }

  if (paidAmount < Number(trx.total || 0)) {
    notify.error(`Uang kurang ${formatter.format(Number(trx.total || 0) - paidAmount)}.`);
    return;
  }

  const res = await db
    .from('transactions')
    .update({
      payment: paidAmount,
      change: paidAmount - Number(trx.total || 0),
      status: 'completed',
      processed_at: new Date().toISOString()
    })
    .eq('id', trx.id);

  if (res.error) {
    notify.error(`Gagal menyimpan pembayaran: ${res.error.message}`);
    return;
  }

  notify.success(`Kembalian: ${formatter.format(paidAmount - Number(trx.total || 0))}`, 'Pembayaran Berhasil');
  document.getElementById('trxDetailDialog').close();
  await refreshDataAndView();
}

// Menyelesaikan seluruh transaksi aktif pada sebuah meja setelah pembayaran dikonfirmasi.
async function finishTable(tableNumber) {
  const active = activeTableTransactions(tableNumber);
  if (!active.length) {
    notify.info(`Meja ${tableNumber} sudah kosong.`);
    return;
  }

  const unpaidOrder = active.find((trx) => isLandingOrder(trx) && Number(trx.total || 0) > 0 && !transactionIsPaid(trx));
  if (unpaidOrder) {
    notify.warning(`Meja ${tableNumber} masih punya pesanan belum dibayar. Selesaikan pembayaran dulu.`);
    openTrxDetail(unpaidOrder.id);
    return;
  }

  const confirmed = await notify.confirm(`Selesaikan meja ${tableNumber}? Meja akan bisa dibooking lagi.`);
  if (!confirmed) return;

  for (const trx of active) {
    const res = await db
      .from('transactions')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', trx.id);

    if (res.error) {
      notify.error(`Gagal menyelesaikan ${trx.code}: ${res.error.message}`);
      return;
    }
  }

  notify.success(`Meja ${tableNumber} sudah selesai dan tersedia lagi.`);
  await refreshDataAndView();
}

// Membuka dialog pratinjau QR menu meja serta menyediakan kontrol unduh dan zoom.
function openQrPreview(qrSrc, menuUrl, tableNumber) {
  const dialog = document.getElementById('qrDialog');
  let zoom = 1;

  dialog.innerHTML = `
    <div class="p-5 space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-400 font-bold">QR Menu</p>
          <h3 class="font-black text-xl text-primary-700">Meja ${tableNumber}</h3>
        </div>
        <button id="closeQrDialog" class="text-slate-500">Tutup</button>
      </div>

      <div class="rounded-2xl bg-white border border-amber-100 p-4 overflow-auto max-h-[62vh] flex justify-center">
        <img id="qrPreviewImg" src="${qrSrc}" alt="QR menu meja ${tableNumber}" class="object-contain transition-transform duration-150" style="width:260px;height:260px;transform:scale(1);" />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex gap-2">
          <button class="btn btn-soft" id="qrZoomOut" type="button">-</button>
          <button class="btn btn-soft" id="qrZoomReset" type="button">Reset</button>
          <button class="btn btn-soft" id="qrZoomIn" type="button">+</button>
        </div>
        <button class="btn btn-primary" id="openQrMenu" type="button">Buka Menu</button>
      </div>
    </div>
  `;

  // Menerapkan tingkat zoom yang dipilih pada gambar QR.
  function applyZoom() {
    dialog.querySelector('#qrPreviewImg').style.transform = `scale(${zoom})`;
  }

  dialog.showModal();
  dialog.querySelector('#closeQrDialog').addEventListener('click', () => dialog.close());
  dialog.querySelector('#qrZoomOut').addEventListener('click', () => {
    zoom = Math.max(0.7, Number((zoom - 0.2).toFixed(1)));
    applyZoom();
  });
  dialog.querySelector('#qrZoomReset').addEventListener('click', () => {
    zoom = 1;
    applyZoom();
  });
  dialog.querySelector('#qrZoomIn').addEventListener('click', () => {
    zoom = Math.min(2.4, Number((zoom + 0.2).toFixed(1)));
    applyZoom();
  });
  dialog.querySelector('#openQrMenu').addEventListener('click', () => {
    window.open(menuUrl, '_blank', 'noopener');
  });
}

// Menampilkan rincian seluruh pesanan aktif untuk sebuah meja.
function showTableOrdersDetail(tableNumber, orders) {
  const dialog = document.getElementById('trxDetailDialog');
  const totalAmount = orders.reduce((sum, order) => sum + order.total, 0);
  const totalItems = orders.reduce((sum, order) => sum + order.items.reduce((s, i) => s + i.qty, 0), 0);
  const allItems = orders.flatMap(order => order.items.map(item => ({
    ...item,
    orderCode: order.code,
    orderTime: order.createdAt
  })));

  dialog.innerHTML = `
    <div class="p-5 space-y-4">
      <div class="flex justify-between items-center">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-400 font-bold">Detail Pesanan Meja</p>
          <h3 class="font-black text-2xl text-primary-700">Meja ${tableNumber}</h3>
        </div>
        <button id="closeTableOrders" class="text-slate-500 hover:text-slate-700">Tutup</button>
      </div>

      <div class="grid sm:grid-cols-3 gap-3">
        <div class="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <p class="text-xs text-slate-500 mb-1">Total Pesanan</p>
          <p class="text-lg font-bold text-amber-700">${orders.length} order</p>
        </div>
        <div class="bg-sky-50 rounded-xl p-3 border border-sky-100">
          <p class="text-xs text-slate-500 mb-1">Total Item</p>
          <p class="text-lg font-bold text-sky-700">${totalItems} item</p>
        </div>
        <div class="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <p class="text-xs text-slate-500 mb-1">Total Harga</p>
          <p class="text-lg font-bold text-emerald-700">${formatter.format(totalAmount)}</p>
        </div>
      </div>

      <div class="max-h-[400px] overflow-auto space-y-4 pr-1">
        ${orders.map(order => {
          const orderTotal = order.items.reduce((s, i) => s + (i.price * i.qty), 0);
          return `
            <div class="border border-amber-100 rounded-xl bg-white">
              <div class="flex items-center justify-between gap-2 px-4 py-3 bg-amber-50 border-b border-amber-100">
                <div>
                  <p class="font-bold text-sm text-primary-700">${order.code}</p>
                  <p class="text-xs text-slate-500">${formatDateTime(order.createdAt)}</p>
                </div>
                <div class="flex items-center gap-2">
                  ${transactionStatusBadge(order.status)}
                </div>
              </div>
              <div class="p-3 space-y-2">
                ${order.items.map(item => {
                  const product = state.products.find(p => p.id === String(item.productId));
                  const imgSrc = product?.image || 'https://placehold.co/80x60?text=No+Image';
                  return `
                    <div class="flex items-center gap-3 rounded-lg bg-stone-50 border border-amber-50 p-2">
                      <img src="${imgSrc}" alt="${item.name}" class="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-amber-100" />
                      <div class="flex-1 min-w-0">
                        <p class="font-semibold text-sm text-slate-800 truncate">${item.name}</p>
                        <p class="text-xs text-slate-500">${formatter.format(item.price)} x ${item.qty}</p>
                      </div>
                      <p class="font-bold text-sm text-primary-700 flex-shrink-0">${formatter.format(item.price * item.qty)}</p>
                    </div>
                  `;
                }).join('')}
              </div>
              <div class="px-4 py-2 border-t border-amber-100 flex justify-end">
                <p class="text-sm text-slate-600">Subtotal: <strong class="text-primary-700">${formatter.format(orderTotal)}</strong></p>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="pt-3 border-t border-amber-100">
        <div class="flex justify-between gap-4">
          <button class="btn btn-soft" id="refreshTableOrders">Refresh</button>
          <a href="landing-page.html?table=${tableNumber}#menu" target="_blank" class="btn btn-primary text-center">Tambah Pesanan</a>
        </div>
      </div>
    </div>
  `;

  dialog.showModal();
  dialog.querySelector('#closeTableOrders').addEventListener('click', () => dialog.close());
  dialog.querySelector('#refreshTableOrders').addEventListener('click', () => {
    dialog.close();
    refreshDataAndView().then(() => {
      const active = activeTableTransactions(tableNumber);
      const orderTransactions = active.filter((trx) => String(trx.code || '').startsWith('ORD-'));
      if (orderTransactions.length > 0) {
        showTableOrdersDetail(tableNumber, orderTransactions);
      }
    });
  });
}

// Merender status meja, pesanan aktif, dan QR menu untuk setiap meja.
function renderMeja() {
  const root = document.getElementById('view-meja');
  const tables = Array.from({ length: 20 }, (_, index) => String(index + 1));

  root.innerHTML = `
    <div class="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      ${metricCard('Total Meja', 20, 'text-primary-700')}
      ${metricCard('Meja Dipakai', tables.filter((table) => activeTableTransactions(table).length).length, 'text-amber-700')}
      ${metricCard('Meja Kosong', tables.filter((table) => !activeTableTransactions(table).length).length, 'text-emerald-700')}
      ${metricCard('QR Menu', 'Aktif', 'text-sky-700')}
    </div>

    <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      ${tables.map((table) => {
        const active = activeTableTransactions(table);
        const occupied = active.length > 0;
        const orderTransactions = active.filter((trx) => String(trx.code || '').startsWith('ORD-'));
        const hasOrder = orderTransactions.length > 0;
        const hasBooking = active.some((trx) => String(trx.code || '').startsWith('RSV-'));
        const statusLabel = hasOrder ? 'Dipakai' : (hasBooking ? 'Booking' : 'Kosong');
        const statusClass = hasOrder
          ? 'bg-amber-100 text-amber-800'
          : (hasBooking ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700');
        const url = tableMenuUrl(table);
        const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
        return `
          <article class="card p-4 space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-wide text-slate-400 font-bold">Meja</p>
                <h3 class="text-3xl font-black text-primary-700">${table}</h3>
              </div>
              <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}">
                ${statusLabel}
              </span>
            </div>

            <button
              type="button"
              class="rounded-xl border border-amber-100 bg-white p-3 flex justify-center w-full hover:bg-amber-50 transition cursor-zoom-in"
              data-qr-preview="${qrSrc}"
              data-qr-url="${url}"
              data-qr-table="${table}"
              title="Klik untuk preview QR. Ctrl+Click untuk buka menu meja."
            >
              <img src="${qrSrc}" alt="QR menu meja ${table}" class="w-36 h-36 object-contain pointer-events-none" />
            </button>

            <button class="btn ${occupied ? 'btn-primary' : 'btn-soft'} w-full" data-finish-table="${table}" ${occupied ? '' : 'disabled'}>
              Meja Selesai
            </button>
          </article>
        `;
      }).join('')}
    </div>
  `;

  root.querySelectorAll('[data-finish-table]').forEach((button) => {
    button.addEventListener('click', () => finishTable(button.dataset.finishTable));
  });

  root.querySelectorAll('[data-qr-preview]').forEach((button) => {
    button.addEventListener('click', (event) => {
      if (event.ctrlKey || event.metaKey) {
        const table = button.dataset.qrTable;
        const active = activeTableTransactions(table);
        const orderTransactions = active.filter((trx) => String(trx.code || '').startsWith('ORD-'));
        const hasOrder = orderTransactions.length > 0;
        const hasBooking = active.some((trx) => String(trx.code || '').startsWith('RSV-'));

        // Jika ada pesanan (ORDER-), tampilkan dialog detail pesanan
        if (hasOrder) {
          showTableOrdersDetail(table, orderTransactions);
          return;
        }

        // Untuk booking atau meja kosong, buka landing page pemesanan
        window.open(button.dataset.qrUrl, '_blank', 'noopener');
        return;
      }

      openQrPreview(button.dataset.qrPreview, button.dataset.qrUrl, button.dataset.qrTable);
    });
  });
}

// Merender riwayat transaksi lengkap beserta filter dan navigasi halaman.
function renderTransaksi() {
  const root = document.getElementById('view-transaksi');
  const rows = [...state.transactions];
  const perPage = 15;
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));

  if (state.transactionPage > totalPages) state.transactionPage = totalPages;
  if (state.transactionPage < 1) state.transactionPage = 1;

  const startIndex = (state.transactionPage - 1) * perPage;
  const pageRows = rows.slice(startIndex, startIndex + perPage);
  const pageButtons = Array.from({ length: totalPages }, (_, index) => index + 1)
    .map((page) => `
      <button
        type="button"
        class="pagination-btn ${page === state.transactionPage ? 'active' : ''}"
        data-transaksi-page="${page}"
        aria-label="Halaman ${page}"
      >${page}</button>
    `)
    .join('');

  root.innerHTML = `
    <div class="card p-5">
      <h3 class="font-bold text-lg text-primary-700 mb-4">Riwayat Transaksi</h3>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Tanggal</th>
              <th>Pemesan</th>
              <th>Status</th>
              <th>Total Item</th>
              <th>Total Bayar</th>
              <th>Uang Bayar</th>
              <th>Kembalian</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${pageRows.length ? pageRows.map((trx) => `
              <tr>
                <td>${trx.code}</td>
                <td>${formatDateTime(trx.createdAt)}</td>
                <td>${trx.customerName || 'Kasir'}</td>
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
            `).join('') : '<tr><td colspan="9" style="text-align:center;padding:2.5rem 0;color:#94a3b8;font-size:0.9rem;">Belum ada transaksi di database.</td></tr>'}
          </tbody>
        </table>
      </div>
      ${rows.length > perPage ? `
        <div class="pagination-bar">
          <button
            type="button"
            class="pagination-btn"
            data-transaksi-page="${state.transactionPage - 1}"
            ${state.transactionPage === 1 ? 'disabled' : ''}
            aria-label="Halaman sebelumnya"
          >‹</button>
          <div class="pagination-pages">${pageButtons}</div>
          <button
            type="button"
            class="pagination-btn"
            data-transaksi-page="${state.transactionPage + 1}"
            ${state.transactionPage === totalPages ? 'disabled' : ''}
            aria-label="Halaman berikutnya"
          >›</button>
        </div>
      ` : ''}
    </div>
  `;

  root.querySelectorAll('[data-detail-trx]').forEach((btn) => {
    btn.addEventListener('click', () => openTrxDetail(btn.dataset.detailTrx));
  });

  root.querySelectorAll('[data-print-trx]').forEach((btn) => {
    btn.addEventListener('click', () => printReceipt(btn.dataset.printTrx));
  });

  root.querySelectorAll('[data-transaksi-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextPage = Number(btn.dataset.transaksiPage || 1);
      if (!nextPage || nextPage === state.transactionPage) return;
      state.transactionPage = Math.min(Math.max(nextPage, 1), totalPages);
      renderTransaksi();
    });
  });

}

// Merender pesanan pelanggan yang masih menunggu atau sedang diproses.
function renderPesananMasuk() {
  const root = document.getElementById('view-pesanan');
  const orders = incomingOrders();

  root.innerHTML = `
    <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      ${metricCard('Pesanan Aktif', orders.length, 'text-sky-700')}
      ${metricCard('Menunggu', orders.filter((trx) => trx.status === 'pending').length, 'text-amber-700')}
      ${metricCard('Diproses', orders.filter((trx) => trx.status === 'processing').length, 'text-sky-700')}
    </div>

    <div class="card p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 class="font-bold text-lg text-primary-700">Pesanan Masuk dari Landing Page</h3>
          <p class="text-sm text-slate-500">Order pelanggan dari website, termasuk pickup, dine-in, nomor meja, dan nomor telepon.</p>
        </div>
        <button class="btn btn-soft" id="refreshOrdersBtn">Refresh</button>
      </div>

      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Pemesan</th>
              <th>Pesanan</th>
              <th>Info</th>
              <th>Total</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${orders.length ? orders.map((trx) => `
              <tr>
                <td>${formatDateTime(trx.createdAt)}</td>
                <td>${trx.customerName || '-'}</td>
                <td style="white-space:normal;min-width:240px;">${orderItemsSummary(trx)}</td>
                <td style="white-space:normal;min-width:230px;">${trx.notes || '-'}</td>
                <td>${formatter.format(trx.total)}</td>
                <td>${transactionStatusSelect(trx)}</td>
                <td class="space-x-1">
                  <button class="btn btn-soft" data-detail-trx="${trx.id}">Detail</button>
                  <button class="btn btn-primary" data-print-trx="${trx.id}">Cetak</button>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="7" style="text-align:center;padding:2.5rem 0;color:#94a3b8;font-size:0.9rem;">Belum ada pesanan dari landing page.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  root.querySelector('#refreshOrdersBtn').addEventListener('click', refreshDataAndView);

  root.querySelectorAll('[data-detail-trx]').forEach((btn) => {
    btn.addEventListener('click', () => openTrxDetail(btn.dataset.detailTrx));
  });

  root.querySelectorAll('[data-print-trx]').forEach((btn) => {
    btn.addEventListener('click', () => printReceipt(btn.dataset.printTrx));
  });

  root.querySelectorAll('[data-status-trx]').forEach((select) => {
    select.addEventListener('change', () => updateTransactionStatus(select.dataset.statusTrx, select.value));
  });
}

// Membuka dialog yang menampilkan rincian lengkap sebuah transaksi.
function openTrxDetail(trxId) {
  const trx = state.transactions.find((t) => t.id === String(trxId));
  if (!trx) return;

  const dialog = document.getElementById('trxDetailDialog');
  const paid = transactionIsPaid(trx);
  const canPay = isLandingOrder(trx) && !paid && trx.status !== 'cancelled';
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
        ${paid ? `
          <p class="flex justify-between"><span>Bayar</span><span>${formatter.format(trx.payment)}</span></p>
          <p class="flex justify-between font-bold text-emerald-700"><span>Kembalian</span><span>${formatter.format(trx.change)}</span></p>
        ` : `
          <div class="rounded-xl bg-amber-50 border border-amber-100 p-3 text-amber-800 font-semibold">
            Pesanan ini belum dibayar.
          </div>
          ${canPay ? `
            <button class="btn btn-primary w-full" id="openPaymentBtn">Pembayaran Cash</button>
            <form id="detailPaymentForm" class="hidden space-y-2 pt-2">
              <label class="text-sm text-slate-600">Uang Bayar (Rp)</label>
              <input id="detailPaymentInput" class="input" type="number" min="${trx.total}" placeholder="Masukkan uang bayar" />
              <div id="detailChangePreview" class="hidden rounded-xl px-3 py-2 text-sm font-semibold"></div>
              <div class="flex justify-end gap-2">
                <button class="btn btn-soft" type="button" id="cancelPaymentBtn">Batal</button>
                <button class="btn btn-primary" type="submit">Simpan Pembayaran</button>
              </div>
            </form>
          ` : ''}
        `}
      </div>
    </div>
  `;

  dialog.showModal();
  dialog.querySelector('#closeTrxDetail').addEventListener('click', () => dialog.close());

  const openPaymentBtn = dialog.querySelector('#openPaymentBtn');
  const paymentForm = dialog.querySelector('#detailPaymentForm');
  const paymentInput = dialog.querySelector('#detailPaymentInput');
  const changePreview = dialog.querySelector('#detailChangePreview');

  if (openPaymentBtn && paymentForm && paymentInput && changePreview) {
    openPaymentBtn.addEventListener('click', () => {
      openPaymentBtn.classList.add('hidden');
      paymentForm.classList.remove('hidden');
      paymentInput.focus();
    });

    dialog.querySelector('#cancelPaymentBtn').addEventListener('click', () => {
      paymentForm.classList.add('hidden');
      openPaymentBtn.classList.remove('hidden');
    });

    paymentInput.addEventListener('input', () => {
      const payment = Number(paymentInput.value || 0);
      if (!payment) {
        changePreview.classList.add('hidden');
        return;
      }

      const change = payment - Number(trx.total || 0);
      changePreview.classList.remove('hidden');
      if (change < 0) {
        changePreview.className = 'rounded-xl px-3 py-2 text-sm font-semibold bg-red-50 border border-red-200 text-red-700';
        changePreview.textContent = `Uang kurang ${formatter.format(Math.abs(change))}`;
      } else {
        changePreview.className = 'rounded-xl px-3 py-2 text-sm font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700';
        changePreview.textContent = `Kembalian ${formatter.format(change)}`;
      }
    });

    paymentForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await payLandingOrder(trx.id, Number(paymentInput.value || 0));
    });
  }
}

// Merender halaman pengelolaan akun admin khusus untuk super admin.
function renderRegister() {
  const root = document.getElementById('view-register');

  if (!isSuperAdmin()) {
    root.innerHTML = `
      <div class="card p-8 text-center">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7c4521" stroke-width="1.5" class="mx-auto mb-4">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <h3 class="font-bold text-lg text-primary-700 mb-2">Akses Terbatas</h3>
        <p class="text-slate-500">Hanya Super Admin yang dapat mengelola akun.</p>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="card p-5">
      <div class="flex flex-wrap items-center justify-between mb-4 gap-2">
        <div>
          <h3 class="font-bold text-lg text-primary-700">Kelola Akun Admin</h3>
          <p class="text-sm text-slate-500">Tambah atau hapus akses admin</p>
        </div>
        <button id="addAdminBtn" class="btn btn-primary">+ Tambah Admin</button>
      </div>

      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Role</th>
              <th>Email</th>
              <th>Dibuat</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="adminList">
            <tr><td colspan="5" class="text-center text-slate-500 py-8">Memuat...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  loadAdminList();

  root.querySelector('#addAdminBtn').addEventListener('click', openRegisterDialog);
}

// Mengambil daftar akun admin dari database dan menampilkannya pada tabel.
async function loadAdminList() {
  try {
    const { data, error } = await db
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const tbody = document.getElementById('adminList');
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-500 py-8">Belum ada admin terdaftar</td></tr>';
      return;
    }

    const roleLabels = {
      'super_admin': 'Super Admin',
      'kasir': 'Kasir',
      'koki': 'Koki'
    };

    const roleBadges = {
      'super_admin': 'bg-amber-100 text-amber-800',
      'kasir': 'bg-sky-100 text-sky-700',
      'koki': 'bg-emerald-100 text-emerald-700'
    };

    tbody.innerHTML = data.map(admin => `
      <tr>
        <td>
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">
              ${admin.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p class="font-semibold text-sm">${admin.name}</p>
              ${state.currentUser?.userId === String(admin.id) ? '<span class="text-xs text-primary-600">Anda</span>' : ''}
            </div>
          </div>
        </td>
        <td>
          <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${roleBadges[admin.role] || 'bg-slate-100 text-slate-700'}">
            ${roleLabels[admin.role] || admin.role}
          </span>
        </td>
        <td>${admin.email}</td>
        <td>${formatDateTime(admin.created_at)}</td>
        <td>
          ${state.currentUser?.userId !== String(admin.id) ? `
            <button class="btn btn-danger text-sm" onclick="deleteAdmin('${admin.id}', '${admin.name}')">Hapus</button>
          ` : '<span class="text-xs text-slate-400">Akun aktif</span>'}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    notify.error('Gagal memuat daftar admin');
  }
}

// Membuka form pendaftaran akun admin baru dan menangani penyimpanannya.
function openRegisterDialog() {
  const dialog = document.getElementById('registerDialog');

  dialog.innerHTML = `
    <form id="registerFormDialog" class="p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-lg text-primary-700">Tambah Admin Baru</h3>
        <button type="button" id="closeRegisterDialog" class="text-slate-500">Tutup</button>
      </div>

      <div>
        <label class="text-sm text-slate-600">Nama Lengkap <span class="text-red-500">*</span></label>
        <input name="name" class="input" placeholder="Nama admin" required />
      </div>

      <div>
        <label class="text-sm text-slate-600">Email <span class="text-red-500">*</span></label>
        <input name="email" type="email" class="input" placeholder="admin@contoh.com" required />
      </div>

      <div>
        <label class="text-sm text-slate-600">Password <span class="text-red-500">*</span></label>
        <div class="password-field">
          <input name="password" type="password" class="input" placeholder="Minimal 6 karakter" required data-password-input />
          <button type="button" class="password-toggle" data-password-toggle aria-label="Tampilkan password" aria-pressed="false">
            <svg class="icon-eye" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/>
            </svg>
            <svg class="icon-eye-off" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 3l18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M10.6 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a18.7 18.7 0 0 1-2.4 3.2M6.4 6.4C3.7 8.2 2 12 2 12s3.5 7 10 7c1.5 0 2.8-.3 4-.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9.9 9.9A3 3 0 0 0 14.1 14.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <p class="text-xs text-slate-400 mt-1">Password minimal 6 karakter</p>
      </div>

      <div>
        <label class="text-sm text-slate-600">Role <span class="text-red-500">*</span></label>
        <select name="role" class="select" required>
          <option value="kasir">Kasir</option>
          <option value="koki">Koki</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <p class="text-xs text-slate-400 mt-1">
          <strong>Kasir</strong>: Kasir, Pesanan Masuk, Transaksi |
          <strong>Koki</strong>: Pesanan Masuk |
          <strong>Super Admin</strong>: Semua menu
        </p>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <button type="button" id="cancelRegisterDialog" class="btn btn-soft">Batal</button>
        <button type="submit" class="btn btn-primary">Buat Akun</button>
      </div>
    </form>
  `;

  dialog.showModal();

  // Menutup dialog pendaftaran akun admin.
  const close = () => dialog.close();
  dialog.querySelector('#closeRegisterDialog').addEventListener('click', close);
  dialog.querySelector('#cancelRegisterDialog').addEventListener('click', close);

  dialog.querySelector('#registerFormDialog').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '');
    const role = String(fd.get('role') || 'kasir');

    if (!name || !email || !password || !role) {
      notify.error('Semua field harus diisi');
      return;
    }

    if (password.length < 6) {
      notify.error('Password minimal 6 karakter');
      return;
    }

    try {
      const { data: existing } = await db
        .from('admin_users')
        .select('id')
        .eq('email', email)
        .single();

      if (existing) {
        notify.error('Email sudah terdaftar');
        return;
      }

      const { error } = await db
        .from('admin_users')
        .insert({
          name,
          email,
          password,
          role,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      const roleLabel = role === 'super_admin' ? 'Super Admin' : (role === 'koki' ? 'Koki' : 'Kasir');
      notify.success(`Admin ${roleLabel} berhasil ditambahkan`);
      close();
      loadAdminList();
    } catch (err) {
      notify.error('Gagal menambahkan admin');
    }
  });
}

// Meminta konfirmasi lalu menghapus akun admin yang dipilih.
async function deleteAdmin(adminId, adminName) {
  const confirmed = await notify.confirm(`Hapus admin "${adminName}"?`);
  if (!confirmed) return;

  try {
    const { error } = await db
      .from('admin_users')
      .delete()
      .eq('id', adminId);

    if (error) throw error;

    notify.success('Admin berhasil dihapus');
    loadAdminList();
  } catch (err) {
    notify.error('Gagal menghapus admin');
  }
}

// Menghitung data laporan penjualan berdasarkan rentang tanggal yang dipilih.
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

// Merender laporan penjualan serta tombol ekspor CSV dan cetak PDF.
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

  // Memperbarui isi laporan berdasarkan hasil perhitungan periode terpilih.
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
<link rel="stylesheet" href="${assetUrl('css/dashboard/print-report.css')}" />
</head><body>
<h1>Laporan Penjualan</h1><p class="sub">Periode: ${label}</p>
<div class="stats">
  <div class="stat"><div class="stat-label">Jumlah Transaksi</div><div class="stat-value">${currentData.list.length}</div></div>
  <div class="stat"><div class="stat-label">Total Item Terjual</div><div class="stat-value">${currentData.itemSold}</div></div>
  <div class="stat"><div class="stat-label">Total Omzet</div><div class="stat-value">${formatter.format(currentData.omzet)}</div></div>
</div>
<h2>Top Produk</h2>
<table><thead><tr><th>#</th><th>Nama Produk</th><th>Terjual</th></tr></thead><tbody>
${currentData.top.length ? currentData.top.map((row,i)=>`<tr><td>${i+1}</td><td>${row[0]}</td><td>${row[1]} pcs</td></tr>`).join('') : '<tr><td colspan="3" class="no-data">Belum ada data</td></tr>'}</tbody></table>
<h2>Daftar Transaksi</h2>
<table><thead><tr><th>Kode</th><th>Tanggal</th><th>Total</th></tr></thead><tbody>
${currentData.list.length ? currentData.list.map((trx)=>`<tr><td>${trx.code}</td><td>${formatDateTime(trx.createdAt)}</td><td>${formatter.format(trx.total)}</td></tr>`).join('') : '<tr><td colspan="3" class="no-data">Tidak ada transaksi</td></tr>'}</tbody></table>
</body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  });
}

// Membuka jendela cetak berisi struk untuk transaksi tertentu.
function printReceipt(trxId) {
  const trx = state.transactions.find((t) => t.id === String(trxId));
  if (!trx) return;

  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>Struk ${trx.code}</title>
      <link rel="stylesheet" href="${assetUrl('css/dashboard/print-receipt.css')}" />
    </head>
    <body>
      <div class="title">
        <h2>Kopi Searah</h2>
        <p>${trx.code} - ${formatDateTime(trx.createdAt)}</p>
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

      <p class="right total-row"><strong>Total: ${formatter.format(trx.total)}</strong></p>
      <p class="right">Bayar: ${formatter.format(trx.payment)}</p>
      <p class="right">Kembalian: ${formatter.format(trx.change)}</p>
      <p class="thanks">Terima kasih telah berbelanja</p>

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
// Memanggil fungsi render yang sesuai dengan halaman dashboard yang sedang aktif.
function renderCurrentView() {
  if (state.currentView === 'dashboard') renderDashboard();
  if (state.currentView === 'kasir') renderKasir();
  if (state.currentView === 'produk') renderProduk();
  if (state.currentView === 'kategori') renderKategori();
  if (state.currentView === 'meja') renderMeja();
  if (state.currentView === 'pesanan') renderPesananMasuk();
  if (state.currentView === 'transaksi') renderTransaksi();
  if (state.currentView === 'laporan') renderLaporan();
  if (state.currentView === 'register') renderRegister();
}

// Memuat ulang data dari database kemudian memperbarui halaman aktif.
async function refreshDataAndView() {
  try {
    await loadAllData();
    renderCurrentView();
  } catch (error) {
    notify.error(`Gagal ambil data database: ${error.message}`, 'Error Database');
  }
}

// Memasang event global untuk tombol sidebar dan menu mobile satu kali saja.
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

// Menjalankan dashboard setelah login dan mengaktifkan pembaruan data otomatis.
async function startAdminApp() {
  renderNav();
  renderCurrentView();
  if (!globalEventsAttached) {
    attachGlobalEvents();
    globalEventsAttached = true;
  }
  showDashboard();

  await refreshDataAndView();

  if (!autoRefreshTimer) {
    autoRefreshTimer = setInterval(async () => {
      if (!['dashboard', 'meja', 'pesanan', 'transaksi'].includes(state.currentView)) return;
      await refreshDataAndView();
    }, 15000);
  }
}

// Menyiapkan koneksi database, memeriksa sesi, lalu menentukan halaman awal aplikasi.
async function init() {
  if (!ensureDb()) return;

  const session = await checkSession();
  if (!session) {
    showLoginPage();
    return;
  }

  state.currentUser = session;
  await startAdminApp();
}

init();
