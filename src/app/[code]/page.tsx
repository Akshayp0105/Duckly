"use client";

import React, { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { QRCodeSVG } from "qrcode.react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  Copy, Trash2, FileText, Image as ImageIcon, 
  File as FileIcon, FileType2, Mic, Square, Download, 
  Play, Pause, Loader2, X, Layers
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";

type ShareItem = {
  id: string;
  type: "text" | "image" | "pdf" | "doc" | "voice";
  content?: string;
  storageUrl?: string;
  fileName?: string;
  addedAt: number;
};

type ShareDoc = {
  code: string;
  ownerId: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  items: ShareItem[];
};

type PendingItem = {
  id: string;
  type: "pdf" | "doc" | "voice";
  fileName: string;
  status: "converting" | "error";
  file: File | Blob;
};

const TextCardContent = ({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-3">
      <p className={cn("text-white font-normal leading-relaxed text-sm whitespace-pre-wrap", !expanded && "line-clamp-6")}>
        {content}
      </p>
      {content && content.length > 300 && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-zinc-400 hover:text-white transition-colors">
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  )
}

export default function SharePage({ params }: { params: { code: string } }) {
  const { code } = params;
  const sessionId = typeof window !== "undefined" ? localStorage.getItem("anyshare_session_id") : null;
  
  const [shareDoc, setShareDoc] = useState<ShareDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  
  // Tabs State
  const [activeTab, setActiveTab] = useState("text");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);

  // Text State
  const [textContent, setTextContent] = useState("");

  // File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Upload Progress Polling Refs (Removed)


  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "shares", code),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ShareDoc;
          if (data.expiresAt.toMillis() < Date.now()) {
            toast.error("⚠ Share expired");
            setError(true);
          } else {
            setShareDoc(data);
            setError(false);
          }
        } else {
          setError(true);
        }
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error("⚠ Something went wrong");
        setError(true);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [code]);

  useEffect(() => {
    if (!shareDoc?.expiresAt) return;
    
    const updateTimer = () => {
      const now = new Date();
      const expires = shareDoc.expiresAt.toDate();
      if (now > expires) {
        setTimeLeft("Expired");
      } else {
        // Calculate manually to show hours/mins/secs
        const diff = expires.getTime() - now.getTime();
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${h}h ${m}m ${s}s`);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [shareDoc?.expiresAt]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const toBase64 = (file: File | Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });

  const uploadPendingItem = async (tempId: string, file: File | Blob, type: "pdf" | "doc" | "voice", originalFileName: string) => {
    setPendingItems((prev) =>
      prev.map((item) => (item.id === tempId ? { ...item, status: "converting" } : item))
    );

    try {
      const base64 = await toBase64(file);
      const newItem: ShareItem = {
        id: tempId,
        type,
        content: base64,
        addedAt: Date.now(),
      };
      if (type !== "voice") {
        newItem.fileName = originalFileName;
      } else {
        newItem.fileName = originalFileName;
      }

      await updateDoc(doc(db, "shares", code), {
        items: arrayUnion(newItem)
      });

      setPendingItems((prev) => prev.filter((item) => item.id !== tempId));
      toast.success("✓ Item added!");
    } catch (err) {
      console.error(err);
      setPendingItems((prev) =>
        prev.map((item) => (item.id === tempId ? { ...item, status: "error" } : item))
      );
      toast.error("⚠ Failed to add item");
    }
  };

  const handleAddItem = async (itemData: Omit<ShareItem, "id" | "addedAt">) => {
    if (!shareDoc) return;
    try {
      const newItem: ShareItem = {
        ...itemData,
        id: crypto.randomUUID(),
        addedAt: Date.now(),
      };
      await updateDoc(doc(db, "shares", code), {
        items: arrayUnion(newItem)
      });
      toast.success("Item added successfully");
      
      // Reset states
      setTextContent("");
      setSelectedFile(null);
      setPreviewUrl(null);
      setUploadProgress(0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add item");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteItem = async (item: ShareItem) => {
    if (!shareDoc) return;
    try {
      await updateDoc(doc(db, "shares", code), {
        items: arrayRemove(item)
      });
      toast.success("Item deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete item");
    }
  };

  const handleAddText = () => {
    if (!textContent.trim()) return;
    setIsUploading(true);
    handleAddItem({ type: "text", content: textContent });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      }
    }
  };

  const handleAddImage = async () => {
    if (!selectedFile) return;
    if (selectedFile.size > 900 * 1024) {
      toast.error("⚠ File too large. Max size is 900KB");
      return;
    }
    setIsUploading(true);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      handleAddItem({ type: "image", content: reader.result as string, fileName: selectedFile.name });
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleAddDocument = async (type: "pdf" | "doc") => {
    if (!selectedFile) return;
    if (selectedFile.size > 900 * 1024) {
      toast.error("⚠ File too large. Max size is 900KB");
      return;
    }
    
    const file = selectedFile;
    const tempId = crypto.randomUUID();
    
    setPendingItems((prev) => [
      { id: tempId, type, fileName: file.name, status: "converting", file },
      ...prev
    ]);
    setSelectedFile(null);

    uploadPendingItem(tempId, file, type, file.name);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        if (audioBlob.size > 900 * 1024) {
          toast.error("⚠ File too large. Max size is 900KB");
          return;
        }

        setVoiceBlob(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleAddVoiceNote = () => {
    if (!voiceBlob) return;
    const tempId = crypto.randomUUID();
    setPendingItems((prev) => [
      { id: tempId, type: "voice", fileName: "Voice Note", status: "converting", file: voiceBlob },
      ...prev
    ]);
    setRecordingTime(0);
    setVoiceBlob(null);
    audioChunksRef.current = [];
    uploadPendingItem(tempId, voiceBlob, "voice", "Voice Note");
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) return <div className="flex-1 flex items-center justify-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (error || !shareDoc) return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen space-y-4">
      <p className="text-xl text-muted-foreground font-medium">Share not found or expired.</p>
      <Button asChild>
        <a href="/">Create New Share</a>
      </Button>
    </div>
  );

  const isOwner = sessionId === shareDoc.ownerId;
  const items = [...shareDoc.items].sort((a, b) => b.addedAt - a.addedAt);

  return (
    <div className="flex-1 flex flex-col min-h-screen p-4 lg:p-8 bg-black text-white relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-black to-black pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Section */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-sm mb-8 mt-2">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="bg-white p-2 rounded-xl w-[96px] h-[96px] flex items-center justify-center shrink-0">
                <QRCodeSVG value={typeof window !== 'undefined' ? window.location.href : ''} size={80} />
              </div>
              <div className="space-y-1 text-center md:text-left">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mb-1">Your Share Code</p>
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl font-bold tracking-wider font-mono text-white">{code}</h1>
                  <button 
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" 
                    onClick={() => copyToClipboard(typeof window !== 'undefined' ? window.location.href : '')}
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="text-center md:text-right space-y-1">
              <p className="text-sm text-zinc-500">Expires in</p>
              <p className="text-2xl font-mono font-bold text-white">{timeLeft}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel - Add Items */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-lg font-semibold text-white mb-3">
              Add Content
            </h2>
            <div className="bg-transparent">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex w-full border-b border-zinc-800 mb-6 bg-transparent h-auto p-0">
                  <TabsTrigger value="text" className="flex-1 py-3 flex flex-col gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:shadow-none text-zinc-500 hover:text-zinc-300 transition-colors">
                    <FileText className="w-5 h-5" />
                    <span className="text-xs font-medium">Text</span>
                  </TabsTrigger>
                  <TabsTrigger value="image" className="flex-1 py-3 flex flex-col gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:shadow-none text-zinc-500 hover:text-zinc-300 transition-colors">
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-xs font-medium">Image</span>
                  </TabsTrigger>
                  <TabsTrigger value="pdf" className="flex-1 py-3 flex flex-col gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:shadow-none text-zinc-500 hover:text-zinc-300 transition-colors">
                    <FileIcon className="w-5 h-5" />
                    <span className="text-xs font-medium">PDF</span>
                  </TabsTrigger>
                  <TabsTrigger value="doc" className="flex-1 py-3 flex flex-col gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:shadow-none text-zinc-500 hover:text-zinc-300 transition-colors">
                    <FileType2 className="w-5 h-5" />
                    <span className="text-xs font-medium">Doc</span>
                  </TabsTrigger>
                  <TabsTrigger value="voice" className="flex-1 py-3 flex flex-col gap-2 rounded-none data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-white data-[state=active]:text-white data-[state=active]:shadow-none text-zinc-500 hover:text-zinc-300 transition-colors">
                    <Mic className="w-5 h-5" />
                    <span className="text-xs font-medium">Voice</span>
                  </TabsTrigger>
                </TabsList>
                
                <div className="min-h-[200px]">
                  <TabsContent value="text" className="space-y-4 mt-0">
                    <div className="relative">
                      <textarea 
                        placeholder="Type or paste anything here..." 
                        className="w-full min-h-[160px] resize-none text-base rounded-xl border border-zinc-700 bg-zinc-900 p-4 pb-8 text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-zinc-600"
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                      />
                      <div className="absolute bottom-3 right-4 text-xs text-zinc-500">
                        {textContent.length} chars
                      </div>
                    </div>
                    <button 
                      className="w-full bg-white text-black font-semibold rounded-xl py-3 hover:bg-zinc-200 shadow-sm transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" 
                      onClick={handleAddText} 
                      disabled={!textContent.trim() || isUploading}
                    >
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Add Text"}
                    </button>
                  </TabsContent>

                  <TabsContent value="image" className="space-y-4 mt-0">
                    <div className="relative border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:bg-zinc-800/50 transition-colors bg-zinc-900">
                      <input type="file" id="image-upload" accept="image/*" className="hidden" onChange={handleFileSelect} />
                      <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-3">
                        <ImageIcon className="w-12 h-12 text-zinc-600" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white">Drag & drop image here</p>
                          <p className="text-xs text-zinc-500">or click to browse</p>
                        </div>
                      </label>
                      {previewUrl && (
                        <div className="absolute inset-0 bg-zinc-900 rounded-xl overflow-hidden p-1 flex flex-col">
                          <img src={previewUrl} alt="Preview" className="object-cover w-full h-full rounded-lg" />
                          <button 
                            onClick={() => { setPreviewUrl(null); setSelectedFile(null); }}
                            className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 backdrop-blur-sm transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    {isUploading && <Progress value={uploadProgress} className="h-2" />}
                    <button 
                      className="w-full bg-white text-black font-semibold rounded-xl py-3 hover:bg-zinc-200 shadow-sm transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" 
                      onClick={handleAddImage} 
                      disabled={!selectedFile || isUploading}
                    >
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Add Image"}
                    </button>
                  </TabsContent>

                  <TabsContent value="pdf" className="space-y-4 mt-0">
                    <div className="relative border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:bg-zinc-800/50 transition-colors bg-zinc-900">
                      <input type="file" id="pdf-upload" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                      <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center gap-3">
                        <FileIcon className="w-12 h-12 text-red-500/80" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white">Drop PDF here</p>
                          <p className="text-xs text-zinc-500">Max 900KB</p>
                        </div>
                      </label>
                      {selectedFile && selectedFile.type.includes("pdf") && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/95 rounded-xl backdrop-blur-sm">
                          <div className="bg-zinc-800 px-4 py-2 rounded-full flex items-center gap-3 max-w-[90%] border border-zinc-700">
                            <FileIcon className="w-4 h-4 text-red-400 shrink-0" />
                            <span className="text-sm font-medium text-white truncate">{selectedFile.name}</span>
                            <span className="text-xs text-zinc-400 shrink-0">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                            <button 
                              onClick={() => setSelectedFile(null)}
                              className="ml-2 text-zinc-400 hover:text-white transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {isUploading && <Progress value={uploadProgress} className="h-2" />}
                    <button 
                      className="w-full bg-white text-black font-semibold rounded-xl py-3 hover:bg-zinc-200 shadow-sm transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" 
                      onClick={() => handleAddDocument("pdf")} 
                      disabled={!selectedFile || isUploading}
                    >
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Upload PDF"}
                    </button>
                  </TabsContent>

                  <TabsContent value="doc" className="space-y-4 mt-0">
                    <div className="relative border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center hover:bg-zinc-800/50 transition-colors bg-zinc-900">
                      <input type="file" id="doc-upload" accept=".doc,.docx,.txt" className="hidden" onChange={handleFileSelect} />
                      <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center gap-3">
                        <FileType2 className="w-12 h-12 text-blue-500/80" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-white">Drop Document here</p>
                          <p className="text-xs text-zinc-500">Max 900KB (.doc, .docx, .txt)</p>
                        </div>
                      </label>
                      {selectedFile && !selectedFile.type.includes("pdf") && !selectedFile.type.startsWith("image/") && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/95 rounded-xl backdrop-blur-sm">
                          <div className="bg-zinc-800 px-4 py-2 rounded-full flex items-center gap-3 max-w-[90%] border border-zinc-700">
                            <FileType2 className="w-4 h-4 text-blue-400 shrink-0" />
                            <span className="text-sm font-medium text-white truncate">{selectedFile.name}</span>
                            <span className="text-xs text-zinc-400 shrink-0">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                            <button 
                              onClick={() => setSelectedFile(null)}
                              className="ml-2 text-zinc-400 hover:text-white transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {isUploading && <Progress value={uploadProgress} className="h-2" />}
                    <button 
                      className="w-full bg-white text-black font-semibold rounded-xl py-3 hover:bg-zinc-200 shadow-sm transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" 
                      onClick={() => handleAddDocument("doc")} 
                      disabled={!selectedFile || isUploading}
                    >
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Upload Document"}
                    </button>
                  </TabsContent>

                  <TabsContent value="voice" className="space-y-6 mt-0">
                    <div className="border border-zinc-700 bg-zinc-900 rounded-xl p-8 flex flex-col items-center justify-center min-h-[200px] relative">
                      
                      {voiceBlob && !isRecording ? (
                        <div className="w-full space-y-4 flex flex-col items-center">
                          <audio controls className="w-full accent-white" src={URL.createObjectURL(voiceBlob)} />
                          <button 
                            onClick={() => {
                              setVoiceBlob(null);
                              setRecordingTime(0);
                            }}
                            className="text-xs text-zinc-500 hover:text-white transition-colors"
                          >
                            Clear recording
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-6">
                          {isRecording ? (
                            <div className="flex flex-col items-center space-y-4">
                              <div className="flex items-center gap-2 text-red-500 font-medium text-sm">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                Recording... {formatTime(recordingTime)}
                              </div>
                              <button 
                                className="rounded-full w-16 h-16 bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center transition-colors shadow-lg" 
                                onClick={stopRecording}
                              >
                                <Square className="w-6 h-6 text-white fill-current" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center space-y-4">
                              <Mic className="w-12 h-12 text-zinc-600 mb-2" />
                              <button 
                                className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600 flex items-center justify-center relative group shadow-lg transition-colors" 
                                onClick={startRecording} 
                                disabled={isUploading}
                              >
                                <Mic className="w-6 h-6 text-white relative z-10" />
                                <div className="absolute inset-0 rounded-full bg-red-500 opacity-0 group-hover:animate-ping" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {isUploading && <div className="absolute bottom-4 left-4 right-4"><Progress value={uploadProgress} className="h-2" /></div>}
                    </div>
                    
                    <button 
                      className="w-full bg-white text-black font-semibold rounded-xl py-3 hover:bg-zinc-200 shadow-sm transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed" 
                      onClick={handleAddVoiceNote} 
                      disabled={!voiceBlob || isUploading}
                    >
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Add Voice Note"}
                    </button>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>

          {/* Right Panel - Shared Items Feed */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center">
              Shared Items <span className="bg-zinc-700 px-2 py-0.5 text-xs ml-2 rounded-full">{items.length + pendingItems.length}</span>
            </h2>
            
            <div className="space-y-4">
              {pendingItems.map((pending) => (
                <div key={pending.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm p-4 relative group hover:border-zinc-700 transition-all duration-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-2">
                        {pending.type === "pdf" && <FileIcon className="w-3.5 h-3.5" />}
                        {pending.type === "doc" && <FileType2 className="w-3.5 h-3.5" />}
                        {pending.type === "voice" && <Mic className="w-3.5 h-3.5" />}
                        {pending.type === "voice" ? "Voice Note" : `${pending.type} Document`}
                        {pending.status === "converting" && <Loader2 className="w-3 h-3 animate-spin ml-2" />}
                      </div>
                      <div className="flex items-center gap-4 bg-zinc-800/50 p-4 rounded-xl">
                        <div className="p-3 bg-zinc-900 rounded-lg shadow-sm">
                          {pending.type === "pdf" && <FileIcon className="w-6 h-6 text-red-500 opacity-50" />}
                          {pending.type === "doc" && <FileType2 className="w-6 h-6 text-blue-500 opacity-50" />}
                          {pending.type === "voice" && <Mic className="w-6 h-6 text-green-500 opacity-50" />}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <span className="font-medium text-white truncate block">{pending.fileName}</span>
                          <span className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                            {pending.status === "converting" ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                              </>
                            ) : "Failed"}
                          </span>
                        </div>
                      </div>
                      {pending.status === "error" && (
                        <div className="flex gap-2 mt-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-zinc-800 text-white hover:bg-zinc-700 hover:text-white border-zinc-700"
                            onClick={() => uploadPendingItem(pending.id, pending.file, pending.type, pending.fileName)}
                          >
                            Retry
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {items.length === 0 && pendingItems.length === 0 ? (
                <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center mt-4">
                  <div className="mb-4">
                    <Layers className="w-12 h-12 text-zinc-700" />
                  </div>
                  <p className="text-zinc-500 font-medium mb-1">Nothing here yet</p>
                  <p className="text-zinc-600 text-sm">Add text, images, files or voice from the left panel</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-sm p-4 relative group hover:border-zinc-700 transition-all duration-200 animate-in fade-in slide-in-from-bottom-4">
                    
                    {isOwner && (
                      <button 
                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-full w-7 h-7 z-10"
                        onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Item specific render */}
                        {item.type === "text" && (
                          <div className="space-y-3 relative pb-8">
                            <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-2">
                              <FileText className="w-3.5 h-3.5" /> Text
                            </div>
                            <TextCardContent content={item.content || ""} />
                            <div className="absolute bottom-0 left-0">
                              <button 
                                onClick={() => copyToClipboard(item.content || "")}
                                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white bg-transparent hover:bg-zinc-800 px-2 py-1.5 rounded-md transition-colors"
                              >
                                <Copy className="w-3 h-3" /> Copy
                              </button>
                            </div>
                          </div>
                        )}

                        {item.type === "image" && (
                          <div className="space-y-3 relative pb-10">
                            <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-2">
                              <ImageIcon className="w-3.5 h-3.5" /> Image
                            </div>
                            <div className="rounded-xl overflow-hidden bg-zinc-900">
                              <img src={item.content} alt="Shared image" className="max-h-[280px] w-full object-cover" />
                            </div>
                            <div className="text-zinc-500 text-sm mt-2">{item.fileName || "image.png"}</div>
                            <div className="absolute bottom-0 right-0">
                              <a 
                                href={item.content} 
                                download={item.fileName || "image.png"} 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}

                        {(item.type === "pdf" || item.type === "doc") && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-2">
                              {item.type === "pdf" ? <FileIcon className="w-3.5 h-3.5" /> : <FileType2 className="w-3.5 h-3.5" />} 
                              {item.type}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", item.type === "pdf" ? "bg-red-500/10" : "bg-blue-500/10")}>
                                {item.type === "pdf" ? <FileIcon className="w-6 h-6 text-red-500" /> : <FileType2 className="w-6 h-6 text-blue-500" />}
                              </div>
                              <div className="flex-1 min-w-0 pr-8">
                                <div className="font-medium text-white truncate text-base">{item.fileName}</div>
                                <div className="text-zinc-500 text-sm mt-0.5">Document</div>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <a 
                                href={item.content} 
                                download={item.fileName}
                                className="flex-1 flex items-center justify-center gap-2 text-sm font-medium border border-zinc-700 hover:bg-zinc-800 text-white py-2 rounded-xl transition-colors"
                              >
                                <Download className="w-4 h-4" /> Download
                              </a>
                              {item.type === "pdf" && (
                                <a 
                                  href={item.content} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="flex-1 flex items-center justify-center gap-2 text-sm font-medium bg-white hover:bg-zinc-200 text-black py-2 rounded-xl transition-colors"
                                >
                                  <Play className="w-4 h-4" /> Preview
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {item.type === "voice" && (
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-wider font-semibold mb-2">
                              <Mic className="w-3.5 h-3.5" /> Voice
                            </div>
                            
                            <div className="flex items-center gap-1 h-8 mb-4 overflow-hidden px-2">
                              {Array.from({ length: 40 }).map((_, i) => (
                                <div 
                                  key={i} 
                                  className="w-1 bg-zinc-600 rounded-full animate-pulse flex-1" 
                                  style={{ height: `${Math.max(10, Math.random() * 100)}%`, animationDelay: `${(i % 10) * 0.1}s`, animationDuration: '1.5s' }} 
                                />
                              ))}
                            </div>
                            
                            <audio controls className="w-full accent-white h-10" src={item.content}>
                              Your browser does not support the audio element.
                            </audio>
                            <div className="text-zinc-500 text-sm mt-2">{item.fileName}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
