"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Supabase handles the token from the URL automatically
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // User arrived from reset link — ready to set new password
      }
    });
  }, []);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      return setError("Password minimal 6 karakter!");
    }
    if (password !== confirmPassword) {
      return setError("Password tidak cocok!");
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("Gagal update password: " + error.message);
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-[#141825]/80 backdrop-blur-xl border border-white/[0.08] p-10 rounded-[2.5rem] shadow-2xl text-center relative z-10"
      >
        <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-1">
          Notepad{" "}
          <span className="bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">
            Visual
          </span>
        </h1>
        <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.4em] mb-10">
          🔐 Buat Password Baru
        </p>

        {success ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="text-5xl mb-4">✅</div>
            <p className="text-emerald-400 text-sm font-bold mb-2">Password berhasil diubah!</p>
            <p className="text-slate-500 text-[10px]">Redirect ke halaman login...</p>
          </motion.div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔑</span>
              <input
                type="password"
                placeholder="Password Baru"
                className="w-full p-4 pl-10 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-600"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔒</span>
              <input
                type="password"
                placeholder="Konfirmasi Password"
                className="w-full p-4 pl-10 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-600"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-[10px] font-bold uppercase bg-red-500/10 py-2 rounded-xl">
                ⚠️ {error}
              </motion.p>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 mt-2 disabled:opacity-50 hover:shadow-xl active:scale-[0.98]">
              {loading ? "⏳ Menyimpan..." : "💾 Simpan Password Baru"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
