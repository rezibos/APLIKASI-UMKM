# Warong Searah

Warong Searah adalah aplikasi website untuk pemesanan menu, booking meja, kasir, dan pengelolaan operasional warung/kafe. Aplikasi ini dibuat dengan HTML, CSS, JavaScript, Tailwind CDN, SweetAlert2, dan Supabase sebagai database.

Website terdiri dari dua halaman utama:

- `landing-page.html` untuk pelanggan.
- `index.html` untuk dashboard admin.

## Pemberitahuan Aplikasi

Aplikasi ini digunakan untuk menghubungkan pemesanan pelanggan dari landing page ke dashboard admin. Pelanggan bisa melihat menu, memasukkan produk ke keranjang, memilih metode Pickup atau Dine-In, memilih nomor meja yang tersedia, mengisi nama dan nomor telepon, lalu mengirim pesanan.

Pesanan yang masuk akan tampil di dashboard admin pada menu Pesanan Masuk. Admin dapat memproses pesanan, membatalkan pesanan, melihat detail pesanan, dan menyelesaikan pembayaran cash lewat dashboard. Stok produk akan berkurang saat pesanan berhasil dibuat.

Dashboard juga menyediakan fitur kasir, produk, kategori, transaksi, laporan, meja QR, dan kelola akun admin.

## Fitur Landing Page

- Tampilan landing Warong Searah.
- Video suasana warung dari folder `assets/video`.
- Menu unggulan dengan keranjang.
- Checkout menggunakan metode pembayaran cash.
- Pilihan metode pesanan Pickup atau Dine-In.
- Pilihan nomor meja 1 sampai 20 untuk Dine-In.
- Booking meja lewat bagian Pesan Meja Sekarang.
- Validasi meja yang sudah dipakai atau sudah dibooking.
- Notifikasi berhasil/gagal saat mengirim pesanan.
- Animasi scroll dan tampilan interaktif.

## Fitur Dashboard Admin

- Login admin.
- Dashboard ringkasan penjualan dan stok.
- Pesanan Masuk dari landing page.
- Kasir untuk transaksi langsung.
- Produk untuk tambah, edit, hapus, dan kelola stok menu.
- Kategori menu.
- Transaksi dan detail pembayaran.
- Laporan penjualan.
- Menu Meja dengan QR per meja.
- Status meja: kosong, booking, atau dipakai.
- Kelola akun admin.
- Role admin: Super Admin, Kasir, dan Koki.

## Alur Pemesanan

1. Pelanggan membuka `landing-page.html`.
2. Pelanggan memilih menu dan memasukkannya ke keranjang.
3. Pelanggan memilih Pickup atau Dine-In.
4. Jika memilih Dine-In, pelanggan memilih nomor meja yang masih tersedia.
5. Pelanggan mengisi nama dan nomor telepon.
6. Pesanan masuk ke dashboard admin.
7. Admin memproses pesanan di menu Pesanan Masuk.
8. Pembayaran dilakukan cash lewat dashboard.
9. Setelah pembayaran selesai, transaksi masuk ke riwayat transaksi.

## Alur Meja QR

Setiap meja memiliki QR di menu Meja pada dashboard. QR tersebut mengarah ke landing page dengan nomor meja terkait.

- Jika meja kosong, pelanggan bisa memesan dari QR meja tersebut.
- Jika meja dibooking, status meja tampil sebagai Booking.
- Jika meja sedang dipakai untuk pesanan, status meja tampil sebagai Dipakai.
- Admin dapat menekan tombol Meja Selesai untuk mengosongkan meja kembali.

## Struktur Folder

```text
assets/
  foto/
  icons/
  video/

css/
  dashboard/
  landing-page/

js/
  config.js
  dashboard/
  landing-page/

databases/
  database.sql
  create_admin_table.sql

index.html
landing-page.html
README.md
```

## File Penting

- `index.html`: halaman dashboard admin.
- `landing-page.html`: halaman pelanggan.
- `js/config.js`: konfigurasi Supabase dan icon dashboard.
- `js/dashboard/app.js`: logic dashboard admin.
- `js/landing-page/app.js`: logic landing page pelanggan.
- `css/dashboard/styles.css`: style dashboard.
- `css/landing-page/styles.css`: style landing page.
- `databases/database.sql`: struktur database utama.
- `databases/create_admin_table.sql`: struktur tabel akun admin.

## Setup Supabase

1. Buat project di Supabase.
2. Buka SQL Editor di Supabase.
3. Jalankan file `databases/database.sql`.
4. Jalankan file `databases/create_admin_table.sql`.
5. Buka file `js/config.js`.
6. Isi `supabaseUrl` dan `supabaseAnonKey` sesuai project Supabase.

## Aset Yang Digunakan

- Logo: `assets/logo.jpg`
- Background hero: `assets/hero-bg.jpg`
- Foto cerita: `assets/story-photo.jpg`
- Foto booking: `assets/foto/booking-photo-1.jpeg`, `booking-photo-2.jpeg`, `booking-photo-3.jpeg`
- Video suasana: `assets/video/suasana-warong-searah.mp4`
- Icon dashboard: `assets/icons/`

## Cara Menjalankan

Buka file berikut di browser:

- `landing-page.html` untuk halaman pelanggan.
- `index.html` untuk dashboard admin.

Jika browser membatasi fitur tertentu saat dibuka langsung, jalankan server lokal:

```bash
python3 -m http.server 8000
```

Lalu buka:

- `http://localhost:8000/landing-page.html`
- `http://localhost:8000/index.html`

## Catatan

Aplikasi ini memakai Supabase sebagai sumber data utama. Jika data tidak muncul, cek kembali koneksi internet, isi `js/config.js`, dan pastikan tabel database sudah dibuat dari file SQL yang tersedia.
