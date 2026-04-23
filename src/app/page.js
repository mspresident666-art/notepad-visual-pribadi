"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function NotepadApp() {
  const [notes, setNotes] = useState([]);
  const [columns] = useState(["💡 Ide & Referensi", "⚙️ Sedang Dikerjakan", "✅ Final Video"]);
  const [theme, setTheme] = useState("light");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  
  const [modalTarget, setModalTarget] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("Low");
  const [imageUrl, setImageUrl] = useState(""); // Ini akan berfungsi sebagai Media URL
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [noteToDelete, setNoteToDelete] = useState(null);

  useEffect(() => { ambilDataCatatan(); }, []);

  const ambilDataCatatan = async () => {
    const { data } = await supabase.from("notes").select("*").order('position', { ascending: true });
    if (data) setNotes(data);
  };

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000);
  };

  const handleCopy = (e, text) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    showToast("Teks disalin! 📋");
  };

  // --- DOWNLOAD MEDIA (VIDEO/IMAGE) ---
  const handleDownload = async (e, mediaUrl) => {
    e.stopPropagation();
    try {
      showToast("Mendownload file aslinya...");
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      // Deteksi ekstensi asli
      const ext = mediaUrl.split('.').pop().split('?')[0];
      link.download = `PeanutBolu-Media-${Math.random().toString(36).substring(7)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast("Download selesai! 📥");
    } catch (error) {
      showToast("Gagal download", "error");
    }
  };

  // --- HELPER: CEK APAKAH FILE ITU VIDEO ---
  const isVideo = (url) => {
    if (!url) return false;
    const videoExtensions = ['mp4', 'webm', 'ogg', 'mov'];
    const extension = url.split('.').pop().split('?')[0].toLowerCase();
    return videoExtensions.includes(extension);
  };

  const handleFileUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      // Batasi ukuran file jika perlu (misal max 50MB untuk video)
      if (file.size > 52428800) {
        showToast("File terlalu besar! Max 50MB", "error");
        setUploading(false);
        return;
      }

      const fileName = `${Math.random()}-${file.name}`;
      await supabase.storage.from('note-images').upload(fileName, file);
      const { data } = supabase.storage.from('note-images').getPublicUrl(fileName);
      setImageUrl(data.publicUrl);
      showToast(isVideo(data.publicUrl) ? "Video siap!" : "Gambar siap!");
    } catch (error) {
      showToast("Gagal upload", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleOpenModal = (kolom, catatan = null) => {
    if (catatan) {
      setEditingId(catatan.id);
      setContent(catatan.content);
      setPriority(catatan.priority);
      setImageUrl(catatan.image_url || "");
    } else {
      setEditingId(null);
      setContent("");
      setPriority("Low");
      setImageUrl("");
    }
    setModalTarget(kolom);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!content) return showToast("Isi deskripsi dulu!", "error");
    const nextPos = notes.length > 0 ? Math.max(...notes.map(n => n.position)) + 1 : 0;
    const payload = { content, priority, image_url: imageUrl, column_title: modalTarget };
    if (editingId) {
      await supabase.from("notes").update(payload).eq("id", editingId);
    } else {
      await supabase.from("notes").insert([{ ...payload, position: nextPos }]);
    }
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

  return (
    <div className={`min-h-screen p-8 transition-all duration-500 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <h1 className="text-4xl font-black tracking-tighter uppercase italic">Notepad <span className="text-blue-600">Visual</span></h1>
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="px-6 py-2 rounded-full bg-blue-600 text-white font-black text-[10px] shadow-lg uppercase tracking-widest uppercase">
          {theme === 'light' ? "🌙 Dark" : "☀️ Light"}
        </button>
      </div>

      {/* Grid Kolom */}
      <div className="max-w-6xl mx-auto flex gap-8 overflow-x-auto pb-10">
        {columns.map((kolomTitle, idx) => (
          <div key={idx} className={`w-85 flex-shrink-0 flex flex-col gap-4 rounded-3xl p-2 ${theme === 'dark' ? 'bg-slate-800/30' : 'bg-slate-200/50'}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleDrop(e, kolomTitle)}>
            <h2 className="px-4 py-2 font-black text-[9px] uppercase opacity-40 tracking-[0.2em]">{kolomTitle}</h2>
            <div className="flex flex-col gap-4 min-h-[200px]">
              {notes.filter(n => n.column_title === kolomTitle).map(catatan => (
                <motion.div key={catatan.id} layout draggable onDragStart={(e) => handleDragStart(e, catatan.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); handleDrop(e, kolomTitle, catatan.id); }} className={`group p-0 rounded-[2rem] overflow-hidden border shadow-sm hover:shadow-xl transition-all cursor-move relative ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} onClick={() => handleOpenModal(kolomTitle, catatan)}>
                  
                  {/* MEDIA DISPLAY (GAMBAR ATAU VIDEO) */}
                  {catatan.image_url && (
                    isVideo(catatan.image_url) ? (
                      <video src={catatan.image_url} className="w-full h-auto block border-b border-slate-200/10" muted loop onMouseOver={e => e.target.play()} onMouseOut={e => e.target.pause()} />
                    ) : (
                      <img src={catatan.image_url} className="w-full h-auto block border-b border-slate-200/10" />
                    )
                  )}
                  
                  <div className="p-6">
                    <p className={`text-[10px] font-black uppercase mb-3 tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{new Date(catatan.created_at).toLocaleDateString('id-ID', {day:'numeric', month:'short'})}</p>
                    <p className="text-sm font-semibold leading-relaxed mb-6">{catatan.content}</p>
                    <div className="flex justify-between items-center">
                      <span className={`text-[8px] font-black px-3 py-1 rounded-full ${catatan.priority === 'High' ? 'bg-red-500 text-white' : 'bg-slate-500/20 opacity-60'}`}>{catatan.priority}</span>
                      <div className="flex gap-4 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleDownload(e, catatan.image_url)} className="text-[10px] font-black text-green-600 uppercase">Save</button>
                        <button onClick={(e) => handleCopy(e, catatan.content)} className="text-[10px] font-black text-blue-500 uppercase">Copy</button>
                        <button onClick={(e) => { e.stopPropagation(); setNoteToDelete(catatan.id); setIsDeleteModalOpen(true); }} className="text-[10px] font-black text-red-500 uppercase">Hapus</button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            <button onClick={() => handleOpenModal(kolomTitle)} className="m-2 py-4 rounded-2xl border-2 border-dashed border-slate-400/20 text-[9px] font-black opacity-30 hover:opacity-100 transition uppercase tracking-widest">+ Tambah</button>
          </div>
        ))}
      </div>

      {/* TOAST */}
      <AnimatePresence>
        {toast.show && (
          <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100]">
            <div className={`px-8 py-4 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest text-white ${toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>{toast.message}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL EDIT & DETAIL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className={`w-full max-w-lg p-8 rounded-[32px] shadow-2xl overflow-y-auto max-h-[90vh] ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
              <h3 className="text-xl font-black mb-6 uppercase italic">Detail Catatan</h3>
              
              {/* MEDIA PREVIEW DI MODAL */}
              <div className={`w-full min-h-[150px] rounded-2xl mb-4 border-2 border-dashed flex flex-col items-center justify-center overflow-hidden relative ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'}`}>
                {imageUrl ? (
                  <>
                    {isVideo(imageUrl) ? (
                      <video src={imageUrl} controls className="w-full h-auto max-h-[400px]" />
                    ) : (
                      <img src={imageUrl} className="w-full h-auto max-h-[400px] object-contain" />
                    )}
                    <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full text-[10px] font-bold shadow-lg">Hapus Media</button>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-xs font-bold opacity-50 mb-2 uppercase">{uploading ? "Mengunggah..." : "Lampirkan Foto/Video"}</p>
                    <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="text-[10px] block w-full text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-blue-600 file:text-white" />
                  </div>
                )}
              </div>

              <textarea className={`w-full p-4 rounded-2xl mb-4 h-24 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-800'}`} placeholder="Tulis deskripsi..." value={content} onChange={(e) => setContent(e.target.value)} />
              <div className="mb-8 flex gap-2">
                {['Low', 'Medium', 'High'].map(p => (
                  <button key={p} onClick={() => setPriority(p)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${priority === p ? 'bg-blue-600 text-white scale-105 shadow-md' : 'bg-slate-400/10 opacity-50 hover:opacity-100'}`}>{p}</button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={handleSave} disabled={uploading} className="flex-[2] bg-blue-600 text-white py-4 rounded-2xl font-black text-xs hover:bg-blue-700 transition shadow-lg disabled:opacity-50 uppercase tracking-widest">Simpan</button>
                <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-500/20 py-4 rounded-2xl font-black text-xs uppercase">Batal</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL HAPUS */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className={`w-full max-w-xs p-8 rounded-[2.5rem] text-center shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">⚠️</div>
              <h3 className="text-lg font-black mb-2 uppercase">Hapus Media?</h3>
              <div className="flex flex-col gap-2">
                <button onClick={confirmDelete} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest">Ya, Hapus</button>
                <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-4 rounded-2xl font-black text-xs opacity-50 uppercase tracking-widest">Batal</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}