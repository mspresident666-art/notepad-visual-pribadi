"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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
      router.push("/"); // Jika sukses, masuk ke halaman utama
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 text-white font-sans">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-slate-900 border border-slate-800 p-10 rounded-[2.5rem] shadow-2xl text-center">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Notepad <span className="text-blue-600">Visual</span></h1>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-10">Private Access Only</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input type="email" placeholder="Email" className="w-full p-4 rounded-2xl bg-slate-800 border-none text-white text-sm outline-none focus:ring-2 focus:ring-blue-600 transition" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" className="w-full p-4 rounded-2xl bg-slate-800 border-none text-white text-sm outline-none focus:ring-2 focus:ring-blue-600 transition" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-red-500 text-[10px] font-black uppercase">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-blue-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-lg shadow-blue-600/20 mt-4 disabled:opacity-50">
            {loading ? "Checking..." : "Login Sekarang"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}