"use client";

import { useState, useEffect, useRef } from "react";
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
  const containerRefs = useRef({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });
  
  const [modalTarget, setModalTarget] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);

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

  const ambilDataCatatan = async () => {
    const { data } = await supabase.from("notes").select("*").order('created_at', { ascending: true });
    if (data) setNotes(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

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
      showToast(`Pindah ke ${newColumn}`);
    }
  };

  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: "" }), 2000);
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
      const fileName = `${Math.random()}-${file.name}`;
      await supabase.storage.from('note-images').upload(fileName, file);
      const { data } = supabase.storage.from('note-images').getPublicUrl(fileName);
      setImageUrl(data.publicUrl);
      showToast("Media terunggah!");
    } catch (e) { showToast("Gagal upload"); } finally { setUploading(false); }
  };

  const handleSave = async () => {
    const payload = { content, image_url: imageUrl, column_title: modalTarget };
    if (editingId) { await supabase.from("notes").update(payload).eq("id", editingId); } 
    else { await supabase.from("notes").insert([payload]); }
    setIsModalOpen(false);
    ambilDataCatatan();
    showToast("Tersimpan!");
  };

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white font-black text-[10px] tracking-[0.5em]">LOADING...</div>;

  return (
    <div className={`min-h-screen p-8 transition-all duration-500 ${theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Header */}
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <h1 className="text-4xl font-black tracking-tighter uppercase italic">Notepad <span className="text-blue-600">Visual</span></h1>
        <div className="flex gap-3">
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="w-12 h-12 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg">
            {theme === 'light' ? "🌙" : "☀️"}
          </button>
          <button onClick={handleLogout} className="px-6 py-2 rounded-full bg-red-600 text-white font-black text-[10px] uppercase tracking-widest">Logout</button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="max-w-7xl mx-auto flex gap-6 overflow-x-auto pb-10">
        {columns.map((col) => (
          <div key={col} ref={el => containerRefs.current[col] = el} className={`w-96 flex-shrink-0 flex flex-col gap-4 rounded-[2.5rem] p-3 ${theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-200/40'}`}>
            <h2 className="px-6 py-4 font-black text-[10px] uppercase opacity-40 tracking-[0.3em]">{col}</h2>
            
            <div className="flex flex-col gap-4 min-h-[400px]">
              {notes.filter(n => n.column_title === col).map(note => (
                <motion.div
                  key={note.id}
                  layout
                  drag
                  dragSnapToOrigin
                  onDragEnd={(e, info) => handleDragEnd(note.id, info, col)}
                  whileDrag={{ scale: 1.05, zIndex: 50 }}
                  className={`group rounded-[2.2rem] overflow-hidden border shadow-xl cursor-grab active:cursor-grabbing ${theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                  {note.image_url && (
                    isVideo(note.image_url) ? 
                    <video src={note.image_url} className="w-full h-48 object-cover pointer-events-none" muted loop /> :
                    <img src={note.image_url} className="w-full h-48 object-cover pointer-events-none" />
                  )}
                  <div className="p-6">
                    <p className="text-sm font-medium mb-4">{note.content}</p>
                    <button onClick={() => { setEditingId(note.id); setContent(note.content); setImageUrl(note.image_url); setModalTarget(col); setIsModalOpen(true); }} className="text-[9px] font-black uppercase text-blue-600">Edit</button>
                  </div>
                </motion.div>
              ))}
              <button onClick={() => { setEditingId(null); setContent(""); setImageUrl(""); setModalTarget(col); setIsModalOpen(true); }} className="py-6 rounded-[2rem] border-2 border-dashed border-slate-400/20 text-[10px] font-black opacity-20 hover:opacity-100 transition uppercase tracking-widest">+ Tambah Item</button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50 p-4">
             <motion.div initial={{ y: 50 }} animate={{ y: 0 }} className={`w-full max-w-xl p-10 rounded-[3rem] ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
                <div className="flex flex-col gap-6">
                   <div className="h-48 rounded-3xl bg-slate-800/50 border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden">
                      {imageUrl ? (
                        isVideo(imageUrl) ? <video src={imageUrl} controls className="w-full h-full object-cover" /> : <img src={imageUrl} className="w-full h-full object-cover" />
                      ) : (
                        <input type="file" onChange={handleFileUpload} className="text-[10px] uppercase font-black" />
                      )}
                   </div>
                   <textarea placeholder="Tulis ide..." className={`w-full h-32 p-6 rounded-3xl outline-none ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-100'}`} value={content} onChange={e => setContent(e.target.value)} />
                   <div className="flex gap-4">
                      <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase">Simpan</button>
                      <button onClick={() => setIsModalOpen(false)} className="px-8 bg-slate-500/10 py-5 rounded-[1.5rem] font-black text-xs uppercase">Batal</button>
                   </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast.show && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-10 py-5 rounded-full bg-blue-600 text-white font-black text-[10px] uppercase shadow-2xl">
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}