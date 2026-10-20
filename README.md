# KitaTabung

Aplikasi web pencatat tabungan bersama untuk pasangan yang terintegrasi dengan **Google Spreadsheet** sebagai database. Dibuat mobile-first, ringan, dan tanpa build tools — cukup satu file HTML dan satu file Google Apps Script.

![Tema](https://img.shields.io/badge/tema-terang%20%2F%20gelap-0D9488)
![Platform](https://img.shields.io/badge/platform-Google%20Apps%20Script-4285F4)

## Fitur

- **Mobile-first & responsif** — nyaman digunakan dari layar handphone hingga desktop.
- **Tema terang sebagai default**, dengan opsi mode gelap.
- **Google Spreadsheet sebagai database** — tidak ada data pribadi di dalam kode sumber.
- Catat setoran & penarikan per kontributor dengan riwayat dan filter.
- Target tabungan, tenggat waktu, sisa target, dan rekomendasi nominal bulanan.
- Porsi kontribusi fleksibel atau rasio kustom (mis. 50:50).
- Sembunyikan saldo (privacy mode) untuk tampilan di tempat umum.
- Sinkronisasi otomatis + tombol tarik data paksa dari Spreadsheet.
- Ekspor / impor cadangan JSON.

## Struktur Proyek

```
kitatabung/
├── index.html   # Seluruh UI, CSS, dan logika aplikasi
├── Kode.gs      # Backend Google Apps Script (REST-like endpoint)
└── README.md
```

## Cara Memasang

### 1. Siapkan database Spreadsheet

1. Buat Google Spreadsheet baru.
2. Buka menu **Ekstensi → Apps Script**.
3. Hapus kode bawaan, tempel isi `Kode.gs`, lalu simpan.
4. Klik **Deploy → Deployment baru → Aplikasi Web**.
5. Atur:
   - **Jalankan sebagai:** Saya (Me)
   - **Akses:** Siapa saja (Anyone)
6. Salin URL yang berakhiran `/exec`.

Lembar `Config` dan `Transactions` akan dibuat otomatis saat pertama kali diakses. Semua data dinamis (nama kontributor, target, transaksi) dapat diedit langsung dari Spreadsheet.

### 2. Jalankan aplikasi

Buka `index.html` di browser, lalu:

1. Klik badge status di kanan atas (**Cache Lokal**).
2. Tempel URL Web App `/exec`.
3. Isi kode ruang (default `tabungan-bersama`).
4. Klik **Simpan & Hubungkan**.

Aplikasi akan memakai `localStorage` sebagai cache ketika offline atau sebelum terhubung ke Spreadsheet.

## Konfigurasi (`Config`)

| Kunci | Keterangan |
| --- | --- |
| `roomId` | Kode ruang sinkronisasi |
| `brandTitle` | Nama aplikasi di header |
| `brandInitials` | Inisial logo (maks. 3 huruf) |
| `goalTitle` | Judul target tabungan |
| `targetAmount` | Target nominal (0 = fleksibel) |
| `targetDate` | Tenggat waktu (`YYYY-MM-DD`) |
| `splitMode` | `flexible` atau `custom` |
| `splitRatio` | Persentase porsi Kontributor 1 (0–100) |
| `member1Name` | Nama Kontributor 1 |
| `member2Name` | Nama Kontributor 2 |
| `quickAmounts` | 5 nominal tombol cepat, dipisah koma |
| `updatedAt` | Waktu pembaruan terakhir (ISO) |

## Struktur Transaksi (`Transactions`)

`ID Transaksi | Tanggal | ID Kontributor | Nama Kontributor | Tipe | Nominal | Catatan`

## Catatan Privasi

Repositori ini sengaja **tidak menyimpan nama, target, maupun transaksi pribadi** di dalam kode. Semua data tersebut hanya hidup di Google Spreadsheet milik pengguna dan cache lokal browser masing-masing.

## Lisensi

Bebas digunakan dan dimodifikasi untuk keperluan pribadi maupun portofolio.
