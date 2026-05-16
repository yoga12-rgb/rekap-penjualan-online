-- OPSIONAL: koreksi tanggal transaksi lama yang ter-simpan dengan TZ salah.
--
-- KONTEKS:
--   Sebelum patch timezone, input "datetime-local" disimpan apa adanya.
--   Akibatnya kasir yang input "15 Jan 14:00" (WIB) tersimpan sebagai 14:00 UTC
--   (= 21:00 WIB). Setelah patch, semua input sudah benar pakai offset +07:00.
--
-- Migration ini menggeser data LAMA mundur 7 jam supaya jam ditampilkan benar.
--
-- ⚠️  HANYA jalankan SEKALI dan HANYA jika sebelumnya Anda sudah meng-input transaksi.
-- Jika belum ada transaksi, skip.

-- Backup dulu (rekomendasi):
-- create table public.transactions_backup as select * from public.transactions;

update public.transactions
   set transaction_date = transaction_date - interval '7 hours',
       updated_at = now()
 where created_at < now();
