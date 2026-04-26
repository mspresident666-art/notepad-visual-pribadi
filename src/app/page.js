"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { motion, AnimatePresence } from "framer-motion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function isVideo(url) {
  if (!url) return false;
  return /\.(mp4|webm|mov|avi|mkv)$/i.test(url) || url.includes("video");
}

// Konversi URL R2 lama (r2.dev) ke proxy lokal /api/media/
function toProxyUrl(url) {
  if (!url) return url;
  // Jika sudah pakai proxy, biarkan
  if (url.startsWith("/api/media/")) return url;
  // Jika URL dari r2.dev, ekstrak filename dan convert ke proxy
  const r2Match = url.match(/r2\.dev\/(.+)$/);
  if (r2Match) return `/api/media/${r2Match[1]}`;
  // Jika URL dari Supabase storage, biarkan (gambar lama)
  return url;
}

function MediaPreview({ url, small = false }) {
  if (!url) return null;
  const proxiedUrl = toProxyUrl(url);
  if (isVideo(url)) {
    return (
      <video
        src={proxiedUrl}
        controls={!small}
        muted
        loop
        autoPlay={small}
        playsInline
        className={small ? "w-full h-48 object-cover" : "w-full max-h-[400px] rounded-xl"}
      />
    );
  }
  return (
    <img
      src={proxiedUrl}
      alt="media"
      className={small ? "w-full h-48 object-cover" : "w-full max-h-[400px] object-contain rounded-xl"}
    />
  );
}

function formatTanggal(dateStr) {
  if (!dateStr) return "";
  const now = new Date();
  const date = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const noteDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (noteDay.getTime() === today.getTime()) return "Hari ini";
  if (noteDay.getTime() === yesterday.getTime()) return "Kemarin";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}


export default function NotepadApp() {
  const [notes, setNotes] = useState([]);
  const [columns] = useState(["💡 Ide & Referensi", "⚙️ Sedang Dikerjakan", "✅ Final Video"]);
  const [sortBy, setSortBy] = useState("position"); // "position" or "date"
  const [theme, setTheme] = useState("dark");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("Low");
  const [mediaUrl, setMediaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [label, setLabel] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);
  const router = useRouter();

  const fetchNotes = async () => {
    const { data } = await supabase.from("notes").select("*").order("position", { ascending: true });
    if (data) setNotes(data);
  };

  // Cek login — pakai onAuthStateChange agar lebih reliable di production
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setUser(session.user);
        setAuthLoading(false);
        fetchNotes();
      } else {
        setAuthLoading(false);
        router.push("/login");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const handleDragStart = (e, noteId) => {
    e.dataTransfer.setData("noteId", noteId);
  };

  const handleCopy = (e, text, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDrop = async (e, targetColumn, targetNoteId = null) => {
    e.preventDefault();
    const draggedNoteId = e.dataTransfer.getData("noteId");
    if (targetNoteId && draggedNoteId !== targetNoteId.toString()) {
      const { error } = await supabase.rpc("swap_notes", {
        dragged_id: parseInt(draggedNoteId),
        target_id: parseInt(targetNoteId),
        target_column: targetColumn,
      });
      if (!error) fetchNotes();
    } else if (!targetNoteId) {
      const notesInCol = notes.filter((n) => n.column_title === targetColumn);
      const newPos = notesInCol.length > 0 ? Math.max(...notesInCol.map((n) => n.position)) + 1 : 0;
      await supabase.from("notes").update({ column_title: targetColumn, position: newPos }).eq("id", draggedNoteId);
      fetchNotes();
    }
  };

  const handleFileUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        alert("File terlalu besar! Maksimal 100MB.");
        return;
      }

      setUploadProgress(file.type.startsWith("video/") ? "Mengunggah video..." : "Mengunggah gambar...");

      // 1. Minta Pre-signed URL dari API
      const res = await fetch("/api/upload", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }) 
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal mendapatkan izin upload");

      // 2. Upload file langsung ke Cloudflare R2 menggunakan Pre-signed URL
      const uploadRes = await fetch(data.signedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type }
      });

      if (!uploadRes.ok) throw new Error("Gagal mengunggah file ke server");

      setMediaUrl(data.url);
      setUploadProgress("");
    } catch (error) {
      alert("Gagal upload: " + error.message);
      setUploadProgress("");
    } finally {
      setUploading(false);
    }
  };

  const handleOpenModal = (kolom, catatan = null) => {
    if (catatan) {
      setEditingId(catatan.id);
      setContent(catatan.content);
      setPriority(catatan.priority);
      setMediaUrl(catatan.image_url || "");
      setLabel(catatan.label || null);
    } else {
      setEditingId(null);
      setContent("");
      setPriority("Low");
      setMediaUrl("");
      setLabel(null);
    }
    setModalTarget(kolom);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!content && !mediaUrl) return alert("Isi deskripsi atau lampirkan media!");
    const nextPos = notes.length > 0 ? Math.max(...notes.map((n) => n.position)) + 1 : 0;
    const payload = { content, priority, image_url: mediaUrl, column_title: modalTarget, label };
    if (editingId) {
      await supabase.from("notes").update(payload).eq("id", editingId);
    } else {
      await supabase.from("notes").insert([{ ...payload, position: nextPos }]);
    }
    setIsModalOpen(false);
    fetchNotes();
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    await supabase.from("notes").delete().eq("id", deleteTargetId);
    setDeleteTargetId(null);
    setSelectedNotes((prev) => { const next = new Set(prev); next.delete(deleteTargetId); return next; });
    fetchNotes();
  };

  // Toggle tandai catatan
  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Hapus semua yang ditandai
  const handleBulkDelete = async () => {
    if (selectedNotes.size === 0) return;
    const ids = Array.from(selectedNotes);
    for (const id of ids) {
      await supabase.from("notes").delete().eq("id", id);
    }
    setSelectedNotes(new Set());
    fetchNotes();
  };

  // Toggle pin catatan
  const togglePin = async (id, currentPinned, e) => {
    e.stopPropagation();
    await supabase.from("notes").update({ is_pinned: !currentPinned }).eq("id", id);
    fetchNotes();
  };

  const isDark = theme === "dark";

  // Download file asli 1:1 dengan nama otomatis
  const handleDownload = async (url, e) => {
    if (e) e.stopPropagation();
    try {
      const proxied = toProxyUrl(url);
      const res = await fetch(proxied);
      const blob = await res.blob();

      // Tentukan ekstensi: video selalu .mp4, gambar sesuai tipe
      let ext = "mp4";
      const contentType = res.headers.get("content-type") || "";
      if (contentType.startsWith("image/")) {
        const imgExt = contentType.split("/")[1]?.replace("jpeg", "jpg");
        ext = imgExt || "jpg";
      }

      // Buat nama file: Notepad_Video_20260426_143052.mp4
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, "0");
      const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const type = isVideo(url) ? "Video" : "Gambar";
      const fileName = `byPeanutBolu_${type}_${dateStr}_${timeStr}.${ext}`;

      // Auto download ke folder Downloads
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Gagal download: " + err.message);
    }
  };

  return (
    <div className={`min-h-screen p-3 sm:p-6 md:p-8 transition-all duration-500 ${isDark ? "bg-[#0a0e1a]" : "bg-[#f0f2f5]"}`}>
      {/* HEADER */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 sm:mb-8">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className={`text-2xl sm:text-3xl md:text-4xl tracking-tight ${isDark ? "text-white" : "text-slate-800"}`} style={{ fontFamily: "var(--font-graffiti)" }}>
            NOTEPAD <span className="text-sm sm:text-base md:text-lg bg-gradient-to-r from-blue-500 to-violet-500 bg-clip-text text-transparent">by PeanutBolu</span>
          </h1>
        </motion.div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="px-4 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold text-[10px] shadow-lg shadow-blue-600/25 transition-transform active:scale-95 uppercase tracking-wider"
          >
            {isDark ? "☀️ Light" : "🌙 Dark"}
          </button>
          <button
            onClick={handleLogout}
            className={`px-4 py-2.5 rounded-full font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 ${isDark ? "bg-white/[0.06] text-slate-400 hover:bg-red-500/20 hover:text-red-400" : "bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500"}`}
          >
            🚪 Logout
          </button>
        </div>
      </div>

      {/* KANBAN COLUMNS */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 md:gap-6 overflow-x-auto pb-10 md:snap-x">
        {columns.map((kolomTitle, idx) => (
          <div
            key={idx}
            className={`w-full md:w-80 lg:w-[340px] flex-shrink-0 flex flex-col gap-3 rounded-3xl p-3 md:snap-center transition-colors ${isDark ? "bg-white/[0.03] border border-white/[0.06]" : "bg-white/60 border border-slate-200/80 backdrop-blur-sm"}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, kolomTitle)}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <h2 className={`font-bold text-[10px] uppercase tracking-[0.2em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{kolomTitle}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortBy(sortBy === "position" ? "date" : "position")}
                  title={sortBy === "date" ? "Urut: Tanggal" : "Urut: Manual"}
                  className={`text-[8px] font-bold px-2 py-0.5 rounded-full transition-all ${sortBy === "date" ? (isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600") : (isDark ? "bg-white/5 text-slate-500 hover:bg-white/10" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}`}
                >
                  {sortBy === "date" ? "📅 Tanggal" : "📌 Manual"}
                </button>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isDark ? "bg-white/10 text-slate-400" : "bg-slate-200 text-slate-500"}`}>
                  {notes.filter((n) => n.column_title === kolomTitle).length}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-h-[200px]">
              {notes.filter((n) => n.column_title === kolomTitle).sort((a, b) => { if (a.is_pinned && !b.is_pinned) return -1; if (!a.is_pinned && b.is_pinned) return 1; return sortBy === "date" ? new Date(b.created_at) - new Date(a.created_at) : a.position - b.position; }).map((catatan) => (
                <motion.div
                  key={catatan.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, catatan.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.stopPropagation(); handleDrop(e, kolomTitle, catatan.id); }}
                  className={`group relative rounded-2xl overflow-hidden border cursor-move transition-all duration-200 hover:shadow-2xl hover:-translate-y-0.5 ${selectedNotes.has(catatan.id) ? "ring-2 ring-blue-500 border-blue-500/50" : ""} ${isDark ? "bg-[#141825] border-white/[0.08] hover:border-blue-500/30" : "bg-white border-slate-200 hover:border-blue-300 shadow-sm"}`}
                  onClick={() => handleOpenModal(kolomTitle, catatan)}
                >

                  {/* Media Preview */}
                  {catatan.image_url && (
                    <div className="relative overflow-hidden">
                      <MediaPreview url={catatan.image_url} small />
                      <div className="absolute top-2 right-2 flex items-center gap-1">
                        {catatan.is_pinned && (
                          <span className="text-[8px] font-black px-2 py-1 rounded-full backdrop-blur-md bg-amber-500/80 text-white">📌</span>
                        )}
                        <span className={`text-[8px] font-black px-2 py-1 rounded-full backdrop-blur-md ${isVideo(catatan.image_url) ? "bg-violet-600/80 text-white" : "bg-blue-600/80 text-white"}`}>
                          {isVideo(catatan.image_url) ? "🎬 VIDEO" : "📷 IMG"}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    {/* Pin indicator for text-only cards */}
                    {catatan.is_pinned && !catatan.image_url && (
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 mb-2 inline-block">📌 Disematkan</span>
                    )}
                    <p className={`text-sm font-medium leading-relaxed line-clamp-3 ${isDark ? "text-slate-200" : "text-slate-700"}`}>{catatan.content}</p>
                    <div className="mt-3 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => toggleSelect(catatan.id, e)}
                          className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center text-[8px] flex-shrink-0 transition-all ${selectedNotes.has(catatan.id) ? "bg-blue-500 border-blue-500 text-white" : isDark ? "border-white/20 text-transparent hover:border-blue-400" : "border-slate-300 text-transparent hover:border-blue-400"}`}
                        >
                          ✓
                        </button>

                        <span className={`text-[7px] font-semibold ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                          {formatTanggal(catatan.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => togglePin(catatan.id, catatan.is_pinned, e)}
                          className={`text-[9px] font-bold uppercase tracking-wider ${catatan.is_pinned ? "text-amber-400 hover:text-amber-300" : "text-slate-500 hover:text-amber-400"}`}
                        >
                          {catatan.is_pinned ? "📌" : "📍"} Pin
                        </button>
                        <button
                          onClick={(e) => handleCopy(e, catatan.content, catatan.id)}
                          className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${copiedId === catatan.id ? "text-emerald-400" : "text-slate-500 hover:text-emerald-400"}`}
                        >
                          {copiedId === catatan.id ? "✅ Copied" : "📋 Copy"}
                        </button>
                        {catatan.image_url && (
                          <button
                            onClick={(e) => handleDownload(catatan.image_url, e)}
                            className="text-[9px] text-blue-400 font-bold uppercase tracking-wider hover:text-blue-300"
                          >
                            ⬇ Download
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTargetId(catatan.id); }}
                          className="text-[9px] text-red-400 font-bold uppercase tracking-wider hover:text-red-300"
                        >
                          ✕ Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <button
              onClick={() => handleOpenModal(kolomTitle)}
              className={`m-1 p-4 sm:p-3.5 rounded-2xl border-2 border-dashed text-xs sm:text-[10px] font-black uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95 ${isDark ? "border-white/10 text-white/30 hover:border-blue-500/40 hover:text-blue-400" : "border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500"}`}
            >
              + Tambah Kartu
            </button>
          </div>
        ))}
      </div>

      {/* MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 25 }}
              className={`w-full max-w-lg rounded-2xl sm:rounded-[2rem] shadow-2xl overflow-hidden max-h-[95vh] sm:max-h-none ${isDark ? "bg-[#141825] border border-white/10" : "bg-white"}`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className={`px-5 sm:px-8 pt-6 sm:pt-8 pb-3 sm:pb-4 ${isDark ? "" : ""}`}>
                <div className="flex justify-between items-center">
                  <h3 className={`text-lg font-black uppercase italic tracking-tight ${isDark ? "text-white" : "text-slate-800"}`}>
                    {editingId ? "✏️ Edit Catatan" : "✨ Catatan Baru"}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white transition text-lg">✕</button>
                </div>
              </div>

              <div className="px-5 sm:px-8 pb-6 sm:pb-8 max-h-[70vh] overflow-y-auto">
                {/* Media Upload Area */}
                <div className={`w-full rounded-2xl mb-5 border-2 border-dashed overflow-hidden transition-colors ${isDark ? "bg-white/[0.03] border-white/10 hover:border-blue-500/30" : "bg-slate-50 border-slate-300 hover:border-blue-400"}`}>
                  {mediaUrl ? (
                    <div className="relative">
                      <MediaPreview url={mediaUrl} />
                      <div className="absolute top-3 right-3 flex gap-2">
                        {editingId && (
                          <button
                            onClick={() => handleDownload(mediaUrl)}
                            className="bg-blue-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[9px] font-black shadow-lg hover:bg-blue-500 transition uppercase"
                          >
                            ⬇ Download
                          </button>
                        )}
                        <button
                          onClick={() => setMediaUrl("")}
                          className="bg-red-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-[9px] font-black shadow-lg hover:bg-red-500 transition uppercase"
                        >
                          ✕ Hapus Media
                        </button>
                      </div>
                      <span className={`absolute bottom-3 left-3 text-[8px] font-black px-2.5 py-1 rounded-full backdrop-blur-md ${isVideo(mediaUrl) ? "bg-violet-600/80 text-white" : "bg-blue-600/80 text-white"}`}>
                        {isVideo(mediaUrl) ? "🎬 VIDEO" : "📷 GAMBAR"}
                      </span>
                    </div>
                  ) : (
                    <div
                      className="text-center p-8 cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="text-4xl mb-3">{uploading ? "⏳" : "📎"}</div>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        {uploadProgress || "Klik untuk upload"}
                      </p>
                      <p className={`text-[9px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                        Gambar (JPG, PNG, GIF) atau Video (MP4, WebM) • Maks 100MB
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="relative mb-4">
                  {content && (
                    <button
                      onClick={(e) => handleCopy(e, content, 'modal')}
                      className={`absolute right-3 top-3 z-10 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md backdrop-blur-sm transition-all ${copiedId === 'modal' ? "bg-emerald-500 text-white" : "bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white"}`}
                    >
                      {copiedId === 'modal' ? "✅ Copied" : "📋 Copy"}
                    </button>
                  )}
                  <textarea
                    className={`w-full p-4 rounded-2xl h-28 text-sm outline-none resize-none transition focus:ring-2 focus:ring-blue-500 ${isDark ? "bg-white/[0.05] text-white placeholder-slate-600" : "bg-slate-100 text-slate-800 placeholder-slate-400"}`}
                    placeholder="Tulis deskripsi catatan..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>



                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={uploading}
                    className="flex-[2] bg-gradient-to-r from-blue-600 to-violet-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-wider hover:shadow-lg hover:shadow-blue-600/25 transition-all disabled:opacity-50"
                  >
                    {uploading ? "⏳ Mengunggah..." : "💾 Simpan"}
                  </button>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className={`flex-1 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition ${isDark ? "bg-white/[0.05] text-slate-400 hover:bg-white/10" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRM DELETE MODAL */}
      <AnimatePresence>
        {deleteTargetId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
            onClick={() => setDeleteTargetId(null)}
          >
            <motion.div
              initial={{ scale: 0.85, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.85, y: 20 }}
              transition={{ type: "spring", damping: 25 }}
              className={`w-full max-w-sm p-8 rounded-3xl shadow-2xl text-center ${isDark ? "bg-[#141825] border border-white/10" : "bg-white"}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-5xl mb-4">🗑️</div>
              <h3 className={`text-lg font-black mb-2 ${isDark ? "text-white" : "text-slate-800"}`}>Hapus Catatan?</h3>
              <p className={`text-xs mb-6 ${isDark ? "text-slate-400" : "text-slate-500"}`}>Catatan yang dihapus tidak bisa dikembalikan.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTargetId(null)}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition ${isDark ? "bg-white/[0.05] text-slate-400 hover:bg-white/10" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-lg shadow-red-600/20 hover:shadow-xl transition-all active:scale-[0.98]"
                >
                  🗑️ Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING BAR — Hapus yang ditandai */}
      <AnimatePresence>
        {selectedNotes.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-6 z-50 flex items-center gap-3"
          >
            <button
              onClick={handleBulkDelete}
              className="bg-gradient-to-r from-red-500 to-rose-600 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 hover:shadow-xl transition-all active:scale-95 flex items-center gap-2"
            >
              🗑️ Hapus {selectedNotes.size} Ditandai
            </button>
            <button
              onClick={() => setSelectedNotes(new Set())}
              className={`px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all active:scale-95 ${isDark ? "bg-white/10 text-slate-300 hover:bg-white/20" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
            >
              ✕ Batal
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}