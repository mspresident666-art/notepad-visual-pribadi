"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [mode, setMode] = useState("login"); // "login" or "reset"
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email atau Password salah!");
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email) return setError("Masukkan email terlebih dahulu!");
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError("Gagal mengirim email reset: " + error.message);
    } else {
      setMessage("✅ Link reset password sudah dikirim ke email kamu!");
    }
    setLoading(false);
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError(null);
    setMessage(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-6 text-white font-sans relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md bg-[#141825]/80 backdrop-blur-xl border border-white/[0.08] p-10 rounded-[2.5rem] shadow-2xl text-center relative z-10"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
        >
          <div className="inline-block">
            <h1 className="text-5xl tracking-tight" style={{ fontFamily: "var(--font-graffiti)" }}>
              NOTEPAD
            </h1>
            <p className="text-base bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent mb-10 text-right" style={{ fontFamily: "var(--font-graffiti)" }}>
              by PeanutBolu
            </p>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {mode === "login" ? (
            <motion.form
              key="login"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleLogin}
              className="flex flex-col gap-4"
            >
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">📧</span>
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full p-4 pl-10 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-600"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔑</span>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  className="w-full p-4 pl-10 pr-12 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-600"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition text-sm"
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-[10px] font-bold uppercase bg-red-500/10 py-2 rounded-xl">
                  ⚠️ {error}
                </motion.p>
              )}

              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-violet-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 mt-2 disabled:opacity-50 hover:shadow-xl hover:shadow-blue-600/30 active:scale-[0.98]">
                {loading ? "⏳ Checking..." : "🚀 Login Sekarang"}
              </button>

              <button type="button" onClick={() => switchMode("reset")}
                className="text-[10px] text-slate-500 hover:text-blue-400 font-bold uppercase tracking-wider transition mt-1">
                Lupa Password?
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="reset"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleResetPassword}
              className="flex flex-col gap-4"
            >
              <p className="text-slate-400 text-xs mb-2">
                Masukkan email kamu, kami akan kirim link untuk reset password.
              </p>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">📧</span>
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full p-4 pl-10 rounded-2xl bg-white/[0.05] border border-white/[0.08] text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition placeholder-slate-600"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {error && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  className="text-red-400 text-[10px] font-bold uppercase bg-red-500/10 py-2 rounded-xl">
                  ⚠️ {error}
                </motion.p>
              )}

              {message && (
                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  className="text-emerald-400 text-[10px] font-bold bg-emerald-500/10 py-3 rounded-xl">
                  {message}
                </motion.p>
              )}

              <button type="submit" disabled={loading}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-600/20 mt-2 disabled:opacity-50 hover:shadow-xl active:scale-[0.98]">
                {loading ? "⏳ Mengirim..." : "📩 Kirim Link Reset"}
              </button>

              <button type="button" onClick={() => switchMode("login")}
                className="text-[10px] text-slate-500 hover:text-blue-400 font-bold uppercase tracking-wider transition mt-1">
                ← Kembali ke Login
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}