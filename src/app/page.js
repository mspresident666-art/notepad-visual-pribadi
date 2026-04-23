"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function NotepadApp() 
  const [notes, setNotes] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [columns] = useState(["💡 Ide & Referensi", "⚙️ Sedang Dikerjakan", "✅ Final Video"]);
  const [theme, setTheme] = useState("light");
  const router = useRouter();
  const containerRefs = useRef({});

  // States Modals & UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  
  // States Data Form
  const [modalTarget, setModalTarget] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("Low");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [noteToDelete, setNoteToDelete] = useState(null);

  // 1. AUTH CHECK
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
  }, [router]);

  // 2. DATA HANDLERS
  const ambilDataCatatan = async () => {
    const { data } = await supabase.from("notes").select("*").order('position', { ascending: true });
    if (data) setNotes(data);
  };

  const handleSave = async () => {
    if (!content) return showToast("Isi deskripsi dulu!");
    const nextPos = notes.length > 0 ? Math.max(...notes.map(n => n.position || 0)) + 1 : 0;
    const payload = { content, priority, image_url: imageUrl, column_title: modalTarget };
    
    if (editingId) { 
      await supabase.from("notes").update(payload).eq("id", editingId); 
    } else { 
      await supabase.from("notes").insert([{ ...payload, position: nextPos }]); 
    }
    
    setIsModalOpen(false);
    ambilDataCatatan();
    showToast("Berhasil disimpan! ✅");
  };

  const confirmDelete = async () => {
    if (noteToDelete) {
      await supabase.from("notes").delete().eq("id", noteToDelete);
      setIsDeleteModalOpen(false);
      setNoteToDelete(null);
      ambilDataCatatan();
      showToast("Catatan dihapus.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // 3. DRAG & DROP LOGIC
  const handleDragEnd = async (noteId, info, currentColumn) => {
    const xPos = info.point.x;
    let newColumn = currentColumn;

    columns.forEach((col) => {
      const rect = containerRefs.current[col]?.getBoundingClientRect();
      if (rect && xPos > rect.left && xPos < rect.right) {
        newColumn = col;
      }
    });

    if (newColumn !== currentColumn) {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, column_title: newColumn } : n));
      await supabase.from("notes").update({ column_title: newColumn }).eq("id", noteId);
      showToast(`Pindah ke ${newColumn} 🚀`);
    }
  };

  // 4. UTILS (Download, Upload, Video Check)
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 2500);
  };

  const isVideo = (url) => {
    if (!url) return false;
    const ext = url.split('.').pop().split('?')[0].toLowerCase();
    return ['mp4', 'webm', 'mov'].includes(ext);
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
    } catch (e) { showToast("Gagal upload"); } finally { setUploading(false); }
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
      link.download = `PeanutBolu-${Math.random().toString(36).substring(7)}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) { showToast("Gagal download"); }
  };

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white font-black text-[10px] tracking-[0.5em]">PREPARING WORKSPACE...</div>;

  return (
    <div className={`min-h-screen p-8 transition-all duration-500 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <h1 className="text-4xl font-black tracking-tighter uppercase italic">Notepad <span className="text-blue-600">Visual</span></h1>
        <div className="flex gap-3">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/20">
            {theme === 'light' ? "🌙" : "☀️"}
          </button>
          <button onClick={handleLogout} className="px-6 py-2 rounded-full bg-red-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg">Logout</button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto pb-10">
        {columns.map((col) => (
          <div key={col} ref={el => containerRefs.current[col] = el} className={`w-96 flex-shrink-0 flex flex-col gap-4 rounded-[2.5rem] p-3 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-200/40'}`}>
            <h2 className="px-6 py-4 font-black text-[10px] uppercase opacity-40 tracking-[0.3em]">{col}</h2>
            
            <div className="flex flex-col gap-4 min-h-[500px]">
              {notes.filter(n => n.column_title === col).map(note => (
                <motion.div
                  key={note.id}
                  layout
                  drag
                  dragSnapToOrigin
                  onDragEnd={(e, info) => handleDragEnd(note.id, info, col)}
                  whileDrag={{ scale: 1.05, zIndex: 50, rotate: 2 }}
                  className={`group rounded-[2.2rem] overflow-hidden border shadow-xl cursor-grab active:cursor-grabbing transition-colors ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                  {note.image_url && (
                    isVideo(note.image_url) ? 
                    <video src={note.image_url} className="w-full h-48 object-cover pointer-events-none" muted loop onMouseOver={e => e.target.play()} /> :
                    <img src={note.image_url} className="w-full h-48 object-cover pointer-events-none" />
                  )}
                  <div className="p-6">
                    <p className="text-sm font-medium leading-relaxed mb-6">{note.content}</p>
                    <div className="flex justify-between items-center">
                      <span className={`text-[9px] font-black px-3 py-1 rounded-full ${note.priority === 'High' ? 'bg-red-500 text-white' : 'bg-blue-600/10 text-blue-600'}`}>{note.priority}</span>
                      <div className="flex gap-4 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handleDownload(e, note.image_url)} className="text-[10px] font-black text-green-600 uppercase">Save</button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(note.id); setContent(note.content); setPriority(note.priority); setImageUrl(note.image_url || ""); setModalTarget(col); setIsModalOpen(true); }} className="text-[10px] font-black text-blue-600 uppercase">Edit</button>
                        <button onClick={(e) => { e.stopPropagation(); setNoteToDelete(note.id); setIsDeleteModalOpen(true); }} className="text-[10px] font-black text-red-500 uppercase">Hapus</button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              <button onClick={() => { setEditingId(null); setContent(""); setPriority("Low"); setImageUrl(""); setModalTarget(col); setIsModalOpen(true); }} className="py-6 rounded-[2rem] border-2 border-dashed border-slate-400/20 text-[10px] font-black opacity-20 hover:opacity-100 transition uppercase tracking-[0.3em]">+ Tambah Item</button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL EDIT/TAMBAH */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4">
             <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className={`w-full max-w-xl p-10 rounded-[3rem] shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                <div className="flex flex-col gap-6">
                   <div className="h-60 rounded-3xl bg-slate-800/50 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden relative">
                      {imageUrl ? (
                        <>
                          {isVideo(imageUrl) ? <video src={imageUrl} controls className="w-full h-full object-cover" /> : <img src={imageUrl} className="w-full h-full object-cover" />}
                          <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full text-[10px] font-bold">X</button>
                        </>
                      ) : (
                        <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="text-xs font-black uppercase text-slate-500" />
                      )}
                      {uploading && <div className="absolute inset-0 bg-blue-600/80 flex items-center justify-center font-black text-xs text-white">UPLOADING...</div>}
                   </div>
                   
                   <div className="flex gap-2">
                     {["Low", "Medium", "High"].map(p => (
                       <button key={p} onClick={() => setPriority(p)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition ${priority === p ? 'bg-blue-600 text-white' : 'bg-slate-500/10 opacity-50'}`}>{p}</button>
                     ))}
                   </div>

                   <textarea placeholder="Tulis deskripsi ide di sini..." className={`w-full h-32 p-6 rounded-3xl outline-none text-sm font-medium ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`} value={content} onChange={e => setContent(e.target.value)} />
                   
                   <div className="flex gap-4">
                      <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/20">Simpan</button>
                      <button onClick={() => setIsModalOpen(false)} className="px-8 bg-slate-500/10 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest">Batal</button>
                   </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI HAPUS */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[60]">
            <div className={`p-10 rounded-[2.5rem] text-center shadow-2xl ${theme === 'dark' ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
              <h3 className="text-lg font-black mb-6 uppercase tracking-tighter italic">Hapus Media Permanen?</h3>
              <div className="flex flex-col gap-3">
                <button onClick={confirmDelete} className="bg-red-600 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-600/20">Ya, Hapus Sekarang</button>
                <button onClick={() => setIsDeleteModalOpen(false)} className="py-4 font-black text-[10px] opacity-40 uppercase tracking-widest">Batalkan</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast.show && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-10 py-5 rounded-full bg-blue-600 text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-600/40">
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}