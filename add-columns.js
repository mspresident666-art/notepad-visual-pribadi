// Script untuk menambah kolom is_pinned dan label ke tabel notes
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function addColumns() {
  // Test: tambah field is_pinned dan label ke catatan pertama
  const { data: notes } = await supabase.from("notes").select("*").limit(1);
  console.log("Current note columns:", notes?.[0] ? Object.keys(notes[0]) : "no notes");
  
  // Coba update semua notes yang belum punya field ini
  // Supabase secara otomatis menerima kolom baru jika sudah ditambah di dashboard
  // Kita perlu tambahkan via SQL di Supabase dashboard
  
  console.log("\n⚠️  Kamu perlu menambahkan kolom secara manual di Supabase Dashboard:");
  console.log("1. Buka https://supabase.com/dashboard → pilih project");
  console.log("2. Klik Table Editor → pilih tabel 'notes'");
  console.log("3. Klik 'Insert Column' dan tambahkan:");
  console.log("   - Nama: is_pinned | Type: bool | Default: false");
  console.log("   - Nama: label    | Type: text | Default: (kosong/null)");
  console.log("\nATAU jalankan SQL ini di SQL Editor:");
  console.log(`
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS label TEXT DEFAULT NULL;
  `);
}

addColumns();
