"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function NotepadApp() {
  const [notes, setNotes] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [columns] = useState(["💡 Ide & Referensi", "⚙️ Sedang Dikerjakan", "✅ Final Video"]);
  const [theme, setTheme] = useState("light");
  const router = useRouter();
  
  // States Modals & Toast
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  
  // States Data
  const [modalTarget, setModalTarget] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("Low");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [noteToDelete, setNoteToDelete] = useState(null);

  // --- CEK APAKAH USER SUDAH LOGIN ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login"); 
      } else {
        setUser(session.user);
        ambilDataCatatan();
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const ambilDataCatatan = async () => {
    const { data } = await supabase.from("notes").select("*").order('position', { ascending: true });
    if (data) setNotes(data);
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const isVideo = (url) => {
    if (!url) return false;
    const videoExtensions = ['mp4', 'webm', 'mov'];
    const extension = url.split('.').pop().split('?')[0].toLowerCase();
    return videoExtensions.includes(extension);
  };

  const handleDownload = async (e, mediaUrl) => {
    e.stopPropagation();
    try {
      showToast("Mendownload...");
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const ext = mediaUrl.split('.').pop().split('?')[0];
      link.download = `PeanutBolu-${Math.random().toString(36).substring(7)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("Berhasil diunduh! 📥");
    } catch (error) { showToast("Gagal download", "error"); }
  };

  const handleFileUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;
      const fileName = `${Math.random()}-${file.name}`;
      await supabase.storage.from('note-images').upload(fileName, file);
      const { data } = supabase.storage.from('note-images').getPublicUrl(fileName);
      setImageUrl(data.publicUrl);
      showToast("Media terunggah!");
    } catch (error) { showToast("Gagal upload", "error"); } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!content) return showToast("Isi deskripsi!", "error");
    const nextPos = notes.length > 0 ? Math.max(...notes.map(n => n.position)) + 1 : 0;
    const payload = { content, priority, image_url: imageUrl, column_title: modalTarget };
    if (editingId) { await supabase.from("notes").update(payload).eq("id", editingId); } 
    else { await supabase.from("notes").insert([{ ...payload, position: nextPos }]); }
    setIsModalOpen(false);
    ambilDataCatatan();
    showToast("Berhasil disimpan!");
  };

  const confirmDelete = async () => {
    if (noteToDelete) {
      await supabase.from("notes").delete().eq("id", noteToDelete);
      setIsDeleteModalOpen(false);
      ambilDataCatatan();
      showToast("Terhapus.", "error");
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white font-black uppercase tracking-widest text-[10px]">Loading Workspace...</div>;

  return (
    <div className={`min-h-screen p-8 transition-all duration-500 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <h1 className="text-4xl font-black tracking-tighter uppercase italic">Notepad <span className="text-blue-600">Visual</span></h1>
        <div className="flex gap-2">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="px-5 py-2 rounded-full bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest shadow-lg">
            {theme === 'light' ? "🌙 Dark" : "☀️ Light"}
          </button>
          <button onClick={handleLogout} className="px-5 py-2 rounded-full bg-red-600 text-white font-black text-[9px] uppercase tracking-widest shadow-lg">
            🚪 Logout
          </button>
        </div>
      </div>

      {/* Grid Kolom */}
      <div className="max-w-6xl mx-auto flex gap-8 overflow-x-auto pb-10">
        {columns.map((kolomTitle, idx) => (
          <div key={idx} className={`w-85 flex-shrink-0 flex flex-col gap-4 rounded-3xl p-2 ${theme === 'dark' ? 'bg-slate-800/30' : 'bg-slate-200/50'}`}>
            <h2 className="px-4 py-2 font-black text-[9px] uppercase opacity-40 tracking-[0.2em]">{kolomTitle}</h2>
            <div className="flex flex-col gap-4 min-h-[200px]">
              {notes.filter(n => n.column_title === kolomTitle).map(catatan => (
                <motion.div key={catatan.id} layout className={`group p-0 rounded-[2rem] overflow-hidden border shadow-sm transition-all cursor-pointer relative ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} onClick={() => { setEditingId(catatan.id); setContent(catatan.content); setPriority(catatan.priority); setImageUrl(catatan.image_url || ""); setModalTarget(kolomTitle); setIsModalOpen(true); }}>
                  {catatan.image_url && (
                    isVideo(catatan.image_url) ? 
                    <video src={catatan.image_url} className="w-full h-auto block border-b border-slate-200/10" muted loop onMouseOver={e => e.target.play()} onMouseOut={e => e.target.pause()} /> :
                    <img src={catatan.image_url} className="w-full h-auto block border-b border-slate-200/10" />
                  )}
                  <div className="p-6">
                    <p className={`text-[10px] font-black uppercase mb-3 tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                      {new Date(catatan.created_at).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}
                    </p>
                    <p className="text-sm font-semibold leading-relaxed mb-6">{catatan.content}</p>
                    <div className="flex justify-between items-center">
                      <span className={`text-[8px] font-black px-3 py-1 rounded-full ${catatan.priority === 'High' ? 'bg-red-500 text-white' : 'bg-slate-500/20 opacity-60'}`}>{catatan.priority}</span>
                      <div className="flex gap-4 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleDownload(e, catatan.image_url)} className="text-[10px] font-black text-green-600 uppercase">Save</button>
                        <button onClick={(e) => { e.stopPropagation(); setNoteToDelete(catatan.id); setIsDeleteModalOpen(true); }} className="text-[10px] font-black text-red-500 uppercase">Hapus</button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <button onClick={() => { setEditingId(null); setContent(""); setPriority("Low"); setImageUrl(""); setModalTarget(kolomTitle); setIsModalOpen(true); }} className="m-2 py-4 rounded-2xl border-2 border-dashed border-slate-400/20 text-[9px] font-black opacity-30 hover:opacity-100 transition uppercase tracking-widest">+ Tambah</button>
          </div>
        ))}
      </div>

      {/* MODAL EDIT */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className={`w-full max-w-lg p-8 rounded-[32px] shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
              <div className={`w-full min-h-[150px] rounded-2xl mb-4 border-2 border-dashed flex flex-col items-center justify-center overflow-hidden relative ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
                {imageUrl ? (
                  <>
                    {isVideo(imageUrl) ? <video src={imageUrl} controls className="w-full h-auto" /> : <img src={imageUrl} className="w-full h-auto" />}
                    <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full text-[10px] font-bold">Hapus</button>
                  </>
                ) : (
                  <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="text-[10px] file:bg-blue-600 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-full file:font-black" />
                )}
              </div>
              <textarea className={`w-full p-4 rounded-2xl mb-4 h-24 text-sm outline-none ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'}`} value={content} onChange={(e) => setContent(e.target.value)} />
              <div className="flex gap-3">
                <button onClick={handleSave} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase">Simpan</button>
                <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-500/20 py-4 rounded-2xl font-black text-xs uppercase">Batal</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL HAPUS */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60]">
            <div className={`p-8 rounded-[2.5rem] text-center shadow-2xl ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
              <h3 className="text-lg font-black mb-6 uppercase">Hapus Media?</h3>
              <div className="flex flex-col gap-2">
                <button onClick={confirmDelete} className="bg-red-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase">Ya, Hapus</button>
                <button onClick={() => setIsDeleteModalOpen(false)} className="py-4 font-black text-xs opacity-50 uppercase">Batal</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOAST */}
      <AnimatePresence>
        {toast.show && (
          <motion.div initial={{ y: 50 }} animate={{ y: 0 }} exit={{ y: 50 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest shadow-2xl">
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}