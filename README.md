# Admin POS (HTML, CSS, JS)

Aplikasi admin panel + kasir frontend dengan desain putih-biru berbasis Tailwind CDN.

Mode saat ini:

- Database wajib (Supabase)
- Tidak ada data dummy
- Sidebar kiri bisa buka/tutup
- Sidebar dipisah garis antar grup menu
- Mendukung icon custom dari pengguna

## Fitur

- Dashboard: total stock, total kategori, transaksi hari ini, pendapatan hari ini, produk terlaris, transaksi terbaru
- Belanja: halaman user untuk pilih menu, keranjang, dan buat pesanan
- Pesanan Masuk: antrian pesanan user untuk diproses admin
- Kasir: pilih menu, keranjang, bayar tunai, update stock, cetak struk
- Produk: CRUD tabel + foto produk
- Kategori: CRUD tabel
- Transaksi: riwayat, detail, cetak ulang struk, proses pesanan pending
- Laporan: filter tanggal, ringkasan, omzet, top produk

## Setup Database

1. Buat project Supabase
2. Buka SQL Editor, jalankan file `databases/database.sql`
3. Buka file `js/config.js`, isi:
	- `supabaseUrl`
	- `supabaseAnonKey`
4. Simpan logo di:
	- `assets/logo.png`
5. Simpan icon milik Anda di:
	- `assets/icons/dashboard.png`
	- `assets/icons/produk.png`
	- `assets/icons/kategori.png`
	- `assets/icons/kasir.png`
	- `assets/icons/transaksi.png`
	- `assets/icons/laporan.png`

## Jalankan

Buka file `index.html` di browser.

Alur kerja:

1. User buka menu Belanja, pilih produk, isi nama pemesan, lalu klik Buat Pesanan.
2. Pesanan masuk ke menu Pesanan Masuk sebagai status pending.
3. Admin membuka Pesanan Masuk untuk memproses, atau cek Transaksi untuk riwayat lengkap.
