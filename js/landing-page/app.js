  /* ── LOADING ─────────────────────────────────────────────── */
  window.addEventListener('load', () => {
    setTimeout(() => {
      const loader = document.getElementById('loader');
      loader.classList.add('slide-out');
      setTimeout(() => loader.style.display = 'none', 920);
    }, 2600);
  });

  /* ── NAVBAR: hilang saat scroll ke bawah, muncul saat ke atas ── */
  const navbar  = document.getElementById('navbar');
  let lastScrollY = window.scrollY;
  let ticking   = false;

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const currentY = window.scrollY;
      const diff     = currentY - lastScrollY;

      if (diff > 5 && currentY > 80) {
        navbar.classList.add('nav-hidden');
      } else if (diff < -2) {
        navbar.classList.remove('nav-hidden');
      }

      navbar.classList.toggle('scrolled', currentY > 40);
      lastScrollY = currentY;
      ticking = false;
    });
  }, { passive: true });

  /* ── MOBILE NAV ───────────────────────────────────────────── */
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('mobileNav').classList.add('open');
  });
  document.getElementById('mobileClose').addEventListener('click', closeMobileNav);
  // Menutup menu navigasi mobile pada landing page.
  function closeMobileNav() {
    document.getElementById('mobileNav').classList.remove('open');
  }

  /* ── SCROLL REVEAL ────────────────────────────────────────── */
  // Memecah judul menjadi span per kata agar animasi kemunculannya dapat dibuat bertahap.
  function splitTitleWords(title) {
    if (!title || title.dataset.wordsReady) return;

    let wordIndex = 0;
    // Memproses setiap node teks di dalam judul tanpa merusak elemen HTML yang sudah ada.
    const splitNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            fragment.appendChild(document.createTextNode(part));
            return;
          }

          const span = document.createElement('span');
          span.className = 'text-word';
          span.style.setProperty('--word-delay', `${0.1 + wordIndex * 0.055}s`);
          span.textContent = part;
          wordIndex += 1;
          fragment.appendChild(span);
        });
        node.replaceWith(fragment);
        return;
      }

      Array.from(node.childNodes).forEach(splitNode);
    };

    splitNode(title);
    title.dataset.wordsReady = 'true';
  }

  document.querySelectorAll('.section-head, .story-copy, #pesan .reveal').forEach((block) => {
    const title = block.querySelector('.section-title');
    if (!title) return;
    block.classList.add('text-reveal');
    splitTitleWords(title);
  });

  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal, .text-reveal').forEach(el => revealObs.observe(el));

  /* ── VISITOR COUNTER ─────────────────────────────────────── */
  const counterFormatter = new Intl.NumberFormat('id-ID');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Menghitung angka statistik dari nol saat pertama kali terlihat.
  function animateCounter(counter) {
    if (counter.dataset.counterDone) return;
    counter.dataset.counterDone = 'true';

    const target = Number(counter.dataset.counterTarget || 0);
    const suffix = counter.dataset.counterSuffix || '';
    const duration = reduceMotion ? 0 : 1800;
    const startTime = performance.now();

    const renderFrame = (now) => {
      const progress = duration ? Math.min((now - startTime) / duration, 1) : 1;
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      counter.textContent = `${counterFormatter.format(Math.round(target * easedProgress))}${suffix}`;

      if (progress < 1) requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);
  }

  const counterObs = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      animateCounter(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-counter-target]').forEach(counter => counterObs.observe(counter));

  /* ── BOOKING PHOTO STACK ────────────────────────────────── */
  const bookingStack = document.getElementById('bookingPhotoStack');
  const bookingCards = bookingStack ? Array.from(bookingStack.querySelectorAll('.booking-stack-card')) : [];
  let bookingFrontIndex = 0;

  // Mengatur posisi depan, tengah, dan belakang pada tumpukan foto booking.
  function renderBookingStack() {
    const positions = ['is-front', 'is-middle', 'is-back'];
    bookingCards.forEach((card, index) => {
      card.classList.remove(...positions);
      const positionIndex = (index - bookingFrontIndex + bookingCards.length) % bookingCards.length;
      card.classList.add(positions[positionIndex]);
    });
  }

  if (bookingCards.length) {
    bookingCards.forEach((card) => {
      card.addEventListener('click', () => {
        bookingFrontIndex = (bookingFrontIndex + 1) % bookingCards.length;
        renderBookingStack();
      });
    });
  }

  /* ── TESTIMONIAL DRAG ───────────────────────────────────── */
  const testiWrap = document.querySelector('.testi-track-wrap');
  const testiTrack = document.getElementById('testiTrack');
  let testiDragging = false;
  let testiStartX = 0;
  let testiOffset = 0;
  let testiStartOffset = 0;
  let testiLastFrameTime = 0;
  let testiPaused = false;
  const testiSpeed = 42;

  // Mengatur posisi horizontal testimonial dan membuat pergerakannya berulang tanpa putus.
  function setTestiOffset(value) {
    const halfWidth = testiTrack ? testiTrack.scrollWidth / 2 : 0;
    if (!halfWidth) return;

    testiOffset = ((value % halfWidth) + halfWidth) % halfWidth;
    testiTrack.style.transform = `translateX(${-testiOffset}px)`;
  }

  // Menjalankan animasi otomatis testimonial selama tidak dijeda atau sedang diseret.
  function animateTestimonials(time) {
    if (!testiLastFrameTime) {
      testiLastFrameTime = time;
    }

    const elapsed = time - testiLastFrameTime;
    testiLastFrameTime = time;

    if (!testiDragging && !testiPaused) {
      setTestiOffset(testiOffset + (testiSpeed * elapsed / 1000));
    }

    requestAnimationFrame(animateTestimonials);
  }

  if (testiWrap && testiTrack) {
    const testiCanHover = window.matchMedia('(hover: hover)').matches;

    requestAnimationFrame(animateTestimonials);

    if (testiCanHover) {
      testiWrap.addEventListener('mouseenter', () => {
        testiPaused = true;
      });

      testiWrap.addEventListener('mouseleave', () => {
        testiPaused = false;
      });
    }

    testiWrap.addEventListener('pointerdown', (event) => {
      testiDragging = true;
      testiStartX = event.clientX;
      testiStartOffset = testiOffset;
      testiWrap.classList.add('is-dragging');
      testiWrap.setPointerCapture(event.pointerId);
    });

    testiWrap.addEventListener('pointermove', (event) => {
      if (!testiDragging) return;
      const dragDistance = testiStartX - event.clientX;
      setTestiOffset(testiStartOffset + dragDistance);
    });

    testiWrap.addEventListener('pointerup', (event) => {
      testiDragging = false;
      testiWrap.classList.remove('is-dragging');
      testiWrap.releasePointerCapture(event.pointerId);
    });

    testiWrap.addEventListener('pointercancel', () => {
      testiDragging = false;
      testiWrap.classList.remove('is-dragging');
    });
  }

  /* ── MENU DARI DATABASE ADMIN ───────────────────────────── */
  const menuState = {
    items: [],
    activeCategory: 'minuman',
    page: 1,
    perPage: 6,
    cart: [],
    occupiedTables: new Set()
  };
  let landingDb = null;
  const urlTableNumber = new URLSearchParams(window.location.search).get('table');

  const menuCategories = [
    { id: 'minuman', label: 'Minuman' },
    { id: 'makanan', label: 'Makanan' },
    { id: 'other', label: 'Other' }
  ];

  const menuFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  });

  // Mengamankan teks sebelum dimasukkan ke HTML agar karakter khusus tidak dibaca sebagai kode.
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  // Menyamakan berbagai nama kategori database ke grup menu utama landing page.
  function normalizeCategoryName(name) {
    const normalized = String(name || '').trim().toLowerCase();
    if (normalized.includes('minuman')) return 'minuman';
    if (normalized.includes('makanan')) return 'makanan';
    return 'other';
  }

  // Membuat ikon SVG pengganti ketika produk tidak memiliki gambar.
  function placeholderIcon(category) {
    if (category === 'makanan') {
      return '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#a15f34" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M7 12h10"/><path d="M12 7v10"/></svg>';
    }

    if (category === 'other') {
      return '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#a15f34" stroke-width="1.5"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>';
    }

    return '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#a15f34" stroke-width="1.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>';
  }

  // Membuat kode unik untuk pesanan pelanggan dari landing page.
  function orderCode() {
    return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  // Membuat kode unik untuk reservasi meja.
  function reservationCode() {
    return `RSV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  // Memvalidasi nomor meja agar hanya menerima angka 1 sampai 20.
  function validTableNumber(value) {
    const table = Number(value);
    return Number.isInteger(table) && table >= 1 && table <= 20 ? String(table) : '';
  }

  // Mengambil nomor meja yang tersimpan di dalam catatan transaksi.
  function tableFromNotes(notes) {
    const match = String(notes || '').match(/Meja:\s*(\d+)/i);
    return match ? validTableNumber(match[1]) : '';
  }

  // Membuat daftar pilihan meja yang masih tersedia untuk elemen select.
  function availableTableOptions(selectedTable = '') {
    const selected = validTableNumber(selectedTable);
    return Array.from({ length: 20 }, (_, index) => {
      const table = String(index + 1);
      const occupied = menuState.occupiedTables.has(table);
      const keepSelected = selected === table;
      if (occupied && !keepSelected) return '';
      return `<option value="${table}" ${keepSelected ? 'selected' : ''}>Meja ${table}${occupied ? ' (dipakai)' : ''}</option>`;
    }).join('');
  }

  // Mengisi pilihan meja pada form pesanan dan booking berdasarkan status meja terbaru.
  function populateTableSelects() {
    const qrTable = validTableNumber(urlTableNumber);
    const orderTable = document.getElementById('orderTable');
    const bookingTable = document.getElementById('fTable');

    if (orderTable) {
      orderTable.innerHTML = '<option value="">Pilih meja</option>' + availableTableOptions(qrTable);
    }

    if (bookingTable) {
      bookingTable.innerHTML = '<option value="">Pilih meja</option>' + availableTableOptions();
    }

    if (qrTable && orderTable) {
      document.querySelector('input[name="fulfillment"][value="Dine-In"]').checked = true;
      document.getElementById('orderTableWrap').style.display = 'block';
      orderTable.value = qrTable;
    }
  }

  // Mengambil transaksi aktif untuk mengetahui meja mana yang sedang digunakan.
  async function loadActiveTables() {
    if (!landingDb) return;

    const { data, error } = await landingDb
      .from('transactions')
      .select('notes, status')
      .in('status', ['pending', 'processing']);

    if (error) {
      showToast('error', 'Gagal Memuat Meja', error.message);
      return;
    }

    menuState.occupiedTables = new Set((data || []).map((trx) => tableFromNotes(trx.notes)).filter(Boolean));
    populateTableSelects();
  }

  // Menampilkan notifikasi toast singkat kepada pelanggan.
  function showToast(type, title, message) {
    const stack = document.getElementById('toastStack');
    if (!stack) return;

    const icons = {
      success: '✓',
      error: '!',
      warning: '!',
      info: 'i'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type || 'info'}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div>
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
    `;

    stack.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 260);
    }, 3600);
  }

  // Menghitung total harga seluruh produk di keranjang pelanggan.
  function cartTotal() {
    return menuState.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  // Menghitung total jumlah item di keranjang pelanggan.
  function cartCount() {
    return menuState.cart.reduce((sum, item) => sum + item.qty, 0);
  }

  // Membuka panel keranjang pesanan pada landing page.
  function openOrderDrawer() {
    document.getElementById('orderOverlay').classList.add('open');
    document.getElementById('orderDrawer').classList.add('open');
  }

  // Menutup panel keranjang pesanan pada landing page.
  function closeOrderDrawer() {
    document.getElementById('orderOverlay').classList.remove('open');
    document.getElementById('orderDrawer').classList.remove('open');
  }

  // Menambahkan menu ke keranjang dengan tetap memeriksa batas stok.
  function addMenuToCart(productId) {
    const product = menuState.items.find((item) => item.id === String(productId));
    if (!product) return;

    const existing = menuState.cart.find((item) => item.productId === product.id);
    const currentQty = existing ? existing.qty : 0;

    if (currentQty + 1 > Number(product.stock || 0)) {
      showToast('warning', 'Stok Tidak Cukup', 'Jumlah pesanan sudah mencapai stok menu ini.');
      return;
    }

    if (existing) {
      existing.qty += 1;
    } else {
      menuState.cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: 1
      });
    }

    renderOrderCart();
    renderMenu();
    showToast('success', 'Masuk Keranjang', `${product.name} ditambahkan ke keranjang.`);
    openOrderDrawer();
  }

  // Menambah atau mengurangi jumlah menu di keranjang pelanggan.
  function changeOrderQty(productId, delta) {
    const item = menuState.cart.find((cartItem) => cartItem.productId === String(productId));
    const product = menuState.items.find((menuItem) => menuItem.id === String(productId));
    if (!item || !product) return;

    const nextQty = item.qty + delta;
    if (nextQty <= 0) {
      menuState.cart = menuState.cart.filter((cartItem) => cartItem.productId !== String(productId));
    } else if (nextQty <= Number(product.stock || 0)) {
      item.qty = nextQty;
    } else {
      showToast('warning', 'Stok Tidak Cukup', 'Jumlah pesanan sudah mencapai stok menu ini.');
    }

    renderOrderCart();
    renderMenu();
  }

  // Memperbarui daftar item, jumlah, total harga, dan tombol kirim pada keranjang.
  function renderOrderCart() {
    const list = document.getElementById('orderList');
    const total = document.getElementById('orderTotal');
    const count = document.getElementById('orderFabCount');
    const submit = document.getElementById('orderSubmit');

    count.textContent = cartCount();
    total.textContent = menuFormatter.format(cartTotal());
    submit.disabled = !menuState.cart.length;

    list.innerHTML = menuState.cart.length ? menuState.cart.map((item) => `
      <div class="order-item">
        <div>
          <div class="order-item-name">${escapeHtml(item.name)}</div>
          <div class="order-item-meta">${menuFormatter.format(item.price)} x ${item.qty}</div>
        </div>
        <div class="order-qty">
          <button type="button" data-order-minus="${item.productId}">-</button>
          <strong>${item.qty}</strong>
          <button type="button" data-order-plus="${item.productId}">+</button>
        </div>
      </div>
    `).join('') : '<div class="order-empty">Keranjang masih kosong. Pilih menu dulu ya.</div>';

    list.querySelectorAll('[data-order-minus]').forEach((button) => {
      button.addEventListener('click', () => changeOrderQty(button.dataset.orderMinus, -1));
    });

    list.querySelectorAll('[data-order-plus]').forEach((button) => {
      button.addEventListener('click', () => changeOrderQty(button.dataset.orderPlus, 1));
    });
  }

  // Memvalidasi dan menyimpan pesanan pelanggan, kemudian mengurangi stok produk.
  // Memastikan nomor telepon berupa 8-15 digit dan diawali 08.
  function isValidPhoneNumber(phone) {
    return /^08\d{6,13}$/.test(phone);
  }

  async function submitOrder(event) {
    event.preventDefault();

    if (!landingDb) {
      showToast('error', 'Database Belum Siap', 'Coba refresh halaman lalu kirim ulang pesanan.');
      return;
    }

    if (!menuState.cart.length) {
      showToast('warning', 'Keranjang Kosong', 'Pilih menu terlebih dahulu sebelum mengirim pesanan.');
      return;
    }

    const form = event.currentTarget;
    const submit = document.getElementById('orderSubmit');
    const name = form.elements.name.value.trim();
    const phone = form.elements.phone.value.trim();
    const fulfillment = form.elements.fulfillment.value;
    const tableNumber = form.elements.table.value;

    if (!name || !phone) {
      showToast('warning', 'Data Belum Lengkap', 'Nama dan nomor telepon wajib diisi.');
      return;
    }

    if (!isValidPhoneNumber(phone)) {
      showToast('warning', 'Nomor Tidak Valid', 'Nomor telepon harus diawali 08 dan hanya berisi 8-15 digit angka.');
      return;
    }

    if (fulfillment === 'Dine-In' && !tableNumber) {
      showToast('warning', 'Pilih Nomor Meja', 'Nomor meja wajib dipilih untuk pesanan Dine-In.');
      return;
    }

    if (fulfillment === 'Dine-In') {
      await loadActiveTables();
      const qrTable = validTableNumber(urlTableNumber);
      if (menuState.occupiedTables.has(String(tableNumber)) && String(tableNumber) !== qrTable) {
        showToast('warning', 'Meja Sudah Dipakai', `Meja ${tableNumber} sedang dipakai. Pilih meja lain.`);
        return;
      }
    }

    submit.disabled = true;
    submit.textContent = 'Mengirim...';

    const ids = menuState.cart.map((item) => item.productId);
    const freshRes = await landingDb
      .from('products')
      .select('id, name, price, stock')
      .in('id', ids);

    if (freshRes.error) {
      showToast('error', 'Gagal Cek Stok', freshRes.error.message);
      submit.disabled = false;
      submit.textContent = 'Kirim Pesanan';
      return;
    }

    const freshProducts = freshRes.data || [];
    for (const cartItem of menuState.cart) {
      const product = freshProducts.find((item) => String(item.id) === cartItem.productId);
      if (!product || Number(product.stock || 0) < cartItem.qty) {
        showToast('warning', 'Stok Berubah', `Stok ${cartItem.name} tidak cukup. Silakan cek ulang keranjang.`);
        await loadLandingMenu();
        renderOrderCart();
        submit.disabled = false;
        submit.textContent = 'Kirim Pesanan';
        return;
      }

      cartItem.name = product.name;
      cartItem.price = Number(product.price || 0);
    }

    const total = cartTotal();
    const nowIso = new Date().toISOString();
    const notes = [
      `Metode: ${fulfillment}`,
      fulfillment === 'Dine-In' ? `Meja: ${tableNumber}` : 'Meja: -',
      'Pembayaran: Cash',
      `Telepon: ${phone}`
    ].join(' | ');

    const trxRes = await landingDb
      .from('transactions')
      .insert({
        code: orderCode(),
        status: 'pending',
        customer_name: name,
        notes,
        total,
        payment: 0,
        change: 0,
        processed_at: null,
        created_at: nowIso
      })
      .select('id')
      .single();

    if (trxRes.error) {
      showToast('error', 'Gagal Menyimpan Pesanan', trxRes.error.message);
      submit.disabled = false;
      submit.textContent = 'Kirim Pesanan';
      return;
    }

    const transactionId = trxRes.data.id;
    for (const cartItem of menuState.cart) {
      const product = freshProducts.find((item) => String(item.id) === cartItem.productId);
      const updateRes = await landingDb
        .from('products')
        .update({ stock: Number(product.stock || 0) - cartItem.qty })
        .eq('id', cartItem.productId);

      if (updateRes.error) {
        showToast('error', 'Stok Gagal Dikurangi', `Pesanan masuk, tapi stok ${cartItem.name} gagal dikurangi.`);
        submit.disabled = false;
        submit.textContent = 'Kirim Pesanan';
        return;
      }
    }

    const itemRes = await landingDb.from('transaction_items').insert(menuState.cart.map((item) => ({
      transaction_id: transactionId,
      product_id: item.productId,
      name: item.name,
      price: item.price,
      qty: item.qty,
      subtotal: item.price * item.qty
    })));

    if (itemRes.error) {
      showToast('error', 'Item Gagal Disimpan', itemRes.error.message);
      submit.disabled = false;
      submit.textContent = 'Kirim Pesanan';
      return;
    }

    menuState.cart = [];
    form.reset();
    document.getElementById('orderTableWrap').style.display = 'none';
    await loadLandingMenu();
    renderOrderCart();
    closeOrderDrawer();
    showToast('success', 'Pesanan Berhasil Dikirim', 'Silakan bayar cash saat pickup atau dine-in.');
    submit.disabled = false;
    submit.textContent = 'Kirim Pesanan';
  }

  // Merender tombol kategori menu dan menangani perpindahan kategori.
  function renderMenuTabs() {
    const tabs = document.getElementById('menuTabs');
    tabs.innerHTML = menuCategories.map((category) => `
      <button class="menu-tab ${menuState.activeCategory === category.id ? 'active' : ''}" type="button" data-menu-category="${category.id}">
        ${category.label}
      </button>
    `).join('');

    tabs.querySelectorAll('[data-menu-category]').forEach((button) => {
      button.addEventListener('click', () => {
        menuState.activeCategory = button.dataset.menuCategory;
        menuState.page = 1;
        renderMenu();
      });
    });
  }

  // Membuat HTML kartu menu lengkap dengan gambar, stok, harga, dan tombol keranjang.
  function menuCard(product, index) {
    const delayClass = index % 4 ? ` reveal-delay-${index % 4}` : '';
    const cartItem = menuState.cart.find((item) => item.productId === product.id);
    const cartQty = cartItem ? cartItem.qty : 0;
    const canAdd = Number(product.stock || 0) > cartQty;
    const image = product.image ? `
      <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
      <div class="menu-img-placeholder" style="display:none">${placeholderIcon(product.group)}</div>
    ` : `<div class="menu-img-placeholder">${placeholderIcon(product.group)}</div>`;

    return `
      <article class="menu-card reveal${delayClass}">
        <div class="menu-img-wrap">
          ${image}
          ${product.stock <= 0 ? '<span class="menu-tag">Habis</span>' : ''}
        </div>
        <div class="menu-body">
          <div class="menu-name">${escapeHtml(product.name)}</div>
          <p class="menu-desc">${escapeHtml(product.categoryName)}</p>
          <div class="menu-price">${menuFormatter.format(product.price)}</div>
          <div class="menu-detail">
            <span>${product.stock > 0 ? 'Tersedia hari ini' : 'Belum tersedia'}</span>
            <span class="menu-stock">Stok ${product.stock}</span>
          </div>
          <button class="menu-cart-btn" type="button" data-menu-add="${product.id}" ${canAdd ? '' : 'disabled'}>
            ${product.stock <= 0 ? 'Stok Habis' : cartQty ? `Tambah Lagi (${cartQty})` : 'Masuk Keranjang'}
          </button>
        </div>
      </article>
    `;
  }

  // Menampilkan produk berdasarkan kategori dan halaman yang sedang dipilih.
  function renderMenu() {
    renderMenuTabs();

    const grid = document.getElementById('menuGrid');
    const status = document.getElementById('menuStatus');
    const pager = document.getElementById('menuPager');
    const filtered = menuState.items.filter((item) => item.group === menuState.activeCategory);
    const hasMultiplePages = filtered.length > menuState.perPage;
    const totalPages = Math.max(1, Math.ceil(filtered.length / menuState.perPage));
    menuState.page = Math.min(menuState.page, totalPages);

    const start = (menuState.page - 1) * menuState.perPage;
    const pageItems = filtered.slice(start, start + menuState.perPage);

    grid.innerHTML = pageItems.map(menuCard).join('');
    status.textContent = filtered.length ? '' : `Belum ada menu untuk kategori ${menuCategories.find((c) => c.id === menuState.activeCategory)?.label || 'ini'}.`;
    status.style.display = filtered.length ? 'none' : 'block';
    pager.classList.toggle('is-hidden', !hasMultiplePages);

    pager.innerHTML = hasMultiplePages ? `
      <button class="menu-page-btn" type="button" data-menu-page="prev" ${menuState.page === 1 ? 'disabled' : ''} aria-label="Halaman sebelumnya">‹</button>
      <div class="menu-page-dots" aria-label="Pilih halaman">
        ${Array.from({ length: totalPages }, (_, i) => `
          <button class="menu-page-dot ${menuState.page === i + 1 ? 'active' : ''}" type="button" data-menu-page-number="${i + 1}" aria-label="Halaman ${i + 1}"></button>
        `).join('')}
      </div>
      <button class="menu-page-btn" type="button" data-menu-page="next" ${menuState.page === totalPages ? 'disabled' : ''} aria-label="Halaman berikutnya">›</button>
    ` : '';

    pager.querySelectorAll('[data-menu-page]').forEach((button) => {
      button.addEventListener('click', () => {
        menuState.page += button.dataset.menuPage === 'next' ? 1 : -1;
        renderMenu();
        document.getElementById('menu').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    pager.querySelectorAll('[data-menu-page-number]').forEach((button) => {
      button.addEventListener('click', () => {
        menuState.page = Number(button.dataset.menuPageNumber);
        renderMenu();
      });
    });

    grid.querySelectorAll('[data-menu-add]').forEach((button) => {
      button.addEventListener('click', () => addMenuToCart(button.dataset.menuAdd));
    });

    grid.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));
  }

  // Mengambil daftar produk dari Supabase lalu menampilkannya pada landing page.
  async function loadLandingMenu() {
    const status = document.getElementById('menuStatus');

    if (!window.supabase || !window.APP_CONFIG?.supabaseUrl || !window.APP_CONFIG?.supabaseAnonKey) {
      status.textContent = 'Menu belum bisa dimuat. Cek koneksi Supabase dan js/config.js.';
      return;
    }

    landingDb = landingDb || window.supabase.createClient(window.APP_CONFIG.supabaseUrl, window.APP_CONFIG.supabaseAnonKey);
    const { data, error } = await landingDb
      .from('products')
      .select('id, name, price, stock, image_url, categories(name)')
      .order('name', { ascending: true });

    if (error) {
      status.textContent = `Gagal memuat menu: ${error.message}`;
      return;
    }

    menuState.items = (data || []).map((item) => {
      const categoryName = item.categories?.name || 'Other';
      return {
        id: String(item.id),
        name: item.name,
        price: Number(item.price || 0),
        stock: Number(item.stock || 0),
        image: item.image_url || '',
        categoryName,
        group: normalizeCategoryName(categoryName)
      };
    });

    renderMenu();
    await loadActiveTables();
  }

  document.getElementById('orderFab').addEventListener('click', openOrderDrawer);
  document.getElementById('orderClose').addEventListener('click', closeOrderDrawer);
  document.getElementById('orderOverlay').addEventListener('click', closeOrderDrawer);
  document.getElementById('orderForm').addEventListener('submit', submitOrder);
  document.querySelectorAll('input[name="fulfillment"]').forEach((input) => {
    input.addEventListener('change', () => {
      document.getElementById('orderTableWrap').style.display = input.value === 'Dine-In' && input.checked ? 'block' : 'none';
    });
  });

  populateTableSelects();
  renderOrderCart();
  renderMenuTabs();
  loadLandingMenu();

  /* ── LOCAL VIDEO ───────────────────────────────────────── */
  // Menyiapkan video lokal dan menandai tampilan jika file video gagal dimuat.
  function prepareLocalVideo() {
    const frame = document.getElementById('socialVideoFrame');
    const video = frame?.querySelector('.social-video-player');
    if (!frame || !video) return;

    video.addEventListener('loadedmetadata', () => frame.classList.remove('is-missing'));
    video.addEventListener('error', () => frame.classList.add('is-missing'));

    if (video.readyState === 0) {
      frame.classList.add('is-missing');
    }
  }

  prepareLocalVideo();

  /* ── BOOKING ──────────────────────────────────────────────── */
  // Memvalidasi dan menyimpan reservasi meja pelanggan ke database.
  async function submitBooking() {
    const name   = document.getElementById('fName').value.trim();
    const phone  = document.getElementById('fPhone').value.trim();
    const date   = document.getElementById('fDate').value;
    const people = document.getElementById('fPeople').value;
    const table  = document.getElementById('fTable').value;
    const note   = document.getElementById('fNote').value.trim();
    if (!name || !phone || !date || !people || !table) {
      showToast('warning', 'Data Belum Lengkap', 'Mohon lengkapi semua data wajib terlebih dahulu.');
      return;
    }

    if (!isValidPhoneNumber(phone)) {
      showToast('warning', 'Nomor Tidak Valid', 'Nomor telepon harus diawali 08 dan hanya berisi 8-15 digit angka.');
      return;
    }

    if (!landingDb) {
      showToast('error', 'Database Belum Siap', 'Coba refresh halaman lalu booking ulang.');
      return;
    }

    await loadActiveTables();
    if (menuState.occupiedTables.has(String(table))) {
      showToast('warning', 'Meja Sudah Dipakai', `Meja ${table} baru saja dipakai. Pilih meja lain.`);
      return;
    }

    const notes = [
      'Metode: Reservasi Meja',
      `Meja: ${table}`,
      `Tanggal: ${date}`,
      `Orang: ${people}`,
      `Telepon: ${phone}`,
      note ? `Catatan: ${note}` : ''
    ].filter(Boolean).join(' | ');

    const res = await landingDb.from('transactions').insert({
      code: reservationCode(),
      status: 'pending',
      customer_name: name,
      notes,
      total: 0,
      payment: 0,
      change: 0,
      processed_at: null,
      created_at: new Date().toISOString()
    });

    if (res.error) {
      showToast('error', 'Booking Gagal', res.error.message);
      return;
    }

    showToast('success', 'Meja Berhasil Dibooking', `Meja ${table} sudah diamankan untuk ${name}.`);

    const successMessage = document.getElementById('formSuccess');
    if (successMessage) successMessage.style.display = 'block';

    ['fName', 'fPhone', 'fDate', 'fPeople', 'fTable', 'fNote'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.value = '';
    });

    await loadActiveTables();
  }
