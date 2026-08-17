# Instruksi untuk AI Agent

## CodeGraph (Code Intelligence)

Project ini menggunakan **CodeGraph** untuk code intelligence & knowledge graph.

- Database lokal tersimpan di `.codegraph/` (SQLite: `codegraph.db`). Direktori ini **di-ignore oleh git** (hanya `.codegraph/.gitignore` yang di-track) — jangan commit isinya.
- Sebelum mengeksplorasi kode yang besar/kompleks, gunakan CodeGraph sebagai sumber konteks utama:
  - `codegraph query <search>` — cari simbol/definisi
  - `codegraph explore <query...>` — eksplorasi area: source simbol relevan + call paths
  - `codegraph node <name>` — source satu simbol + caller/callee trail (atau baca file dengan nomor baris)
  - `codegraph files` — struktur file dari index
  - `codegraph status` — cek status & statistik index
- Setelah melakukan perubahan kode yang signifikan, jalankan `codegraph sync` agar index tetap mutakhir.
- Gunakan `codegraph index` untuk rebuild penuh dari nol jika index tidak sinkron.
- Bila tersedia, gunakan MCP tools `codegraph_explore` / `codegraph_node` untuk mendapatkan hasil yang sama tanpa CLI.

## Panduan Umum

- Stack: **Next.js 16 (App Router)** + **Supabase** (PostgreSQL + Auth + RLS) + **Tailwind CSS**.
- Aplikasi ini sudah **PWA**: `public/manifest.json`, `public/sw.js`, dan ikon di `public/icons/`.
- Baca `README.md` dan `DOCUMENTATION.md` untuk konteks fitur, skema database, dan panduan deploy.