"use client";

import React, { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, Timestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { QRCodeSVG } from "qrcode.react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { 
  Copy, Trash2, FileText, Image as ImageIcon, 
  File as FileIcon, FileType2, Mic, Square, Download, 
  Play, Pause, Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNowStrict } from "date-fns";

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
  progress: number;
  status: "uploading" | "error";
  file: File | Blob;
  extension: string;
};

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const uploadPendingItem = (tempId: string, file: File | Blob, type: "pdf" | "doc" | "voice", extension: string, originalFileName: string) => {
    setPendingItems((prev) =>
      prev.map((item) => (item.id === tempId ? { ...item, status: "uploading", progress: 0 } : item))
    );

    const storageFileName = `${code}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    const storageRef = ref(storage, storageFileName);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setPendingItems((prev) =>
          prev.map((item) =>
            item.id === tempId ? { ...item, progress: Math.round(progress) } : item
          )
        );
      },
      (error) => {
        console.error(error);
        setPendingItems((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, status: "error" } : item))
        );
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const newItem: ShareItem = {
            id: crypto.randomUUID(),
            type,
            storageUrl: downloadURL,
            addedAt: Date.now(),
          };
          if (type !== "voice") {
            newItem.fileName = originalFileName;
          }
          await updateDoc(doc(db, "shares", code), {
            items: arrayUnion(newItem)
          });
          setPendingItems((prev) => prev.filter((item) => item.id !== tempId));
        } catch (err) {
          console.error(err);
          setPendingItems((prev) =>
            prev.map((item) => (item.id === tempId ? { ...item, status: "error" } : item))
          );
        }
      }
    );
  };

  const uploadToStorage = async (file: File | Blob, type: string, extension: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fileName = `${code}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
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
      if (item.storageUrl) {
        try {
          const storageRef = ref(storage, item.storageUrl);
          await deleteObject(storageRef);
        } catch (e) {
          console.error("Failed to delete from storage", e);
        }
      }
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
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("⚠ File too large! Max 10MB allowed");
      return;
    }
    setIsUploading(true);
    
    // 900KB limit for base64
    if (selectedFile.size < 900 * 1024) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleAddItem({ type: "image", content: reader.result as string, fileName: selectedFile.name });
      };
      reader.readAsDataURL(selectedFile);
    } else {
      try {
        const url = await uploadToStorage(selectedFile, "image", selectedFile.name.split('.').pop() || 'png');
        handleAddItem({ type: "image", storageUrl: url, fileName: selectedFile.name });
      } catch (err) {
        setIsUploading(false);
        toast.error("Upload failed");
      }
    }
  };

  const handleAddDocument = async (type: "pdf" | "doc") => {
    if (!selectedFile) return;
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("⚠ File too large! Max 10MB allowed");
      return;
    }
    
    const file = selectedFile;
    const extension = file.name.split('.').pop() || 'file';
    const tempId = crypto.randomUUID();
    
    setPendingItems((prev) => [
      { id: tempId, type, fileName: file.name, progress: 0, status: "uploading", file, extension },
      ...prev
    ]);
    setSelectedFile(null);

    uploadPendingItem(tempId, file, type, extension, file.name);
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
        
        const tempId = crypto.randomUUID();
        setPendingItems((prev) => [
          { id: tempId, type: "voice", fileName: "Voice Note", progress: 0, status: "uploading", file: audioBlob, extension: "webm" },
          ...prev
        ]);
        setRecordingTime(0);

        uploadPendingItem(tempId, audioBlob, "voice", "webm", "Voice Note");
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
    <div className="flex-1 flex flex-col min-h-screen p-4 lg:p-8 bg-background relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Section */}
        <Card className="border-primary/20 shadow-md backdrop-blur-sm bg-card/50">
          <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="bg-white p-2 rounded-xl">
                <QRCodeSVG value={typeof window !== 'undefined' ? window.location.href : ''} size={100} />
              </div>
              <div className="space-y-2 text-center md:text-left">
                <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Your Share Code</p>
                <div className="flex items-center gap-3">
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-mono text-primary">{code}</h1>
                  <Button variant="outline" size="icon" onClick={() => copyToClipboard(typeof window !== 'undefined' ? window.location.href : '')}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="text-center md:text-right space-y-1">
              <p className="text-sm text-muted-foreground">Expires in</p>
              <p className="text-2xl font-semibold font-mono">{timeLeft}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Panel - Add Items */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              Add Content
            </h2>
            <Card className="shadow-lg border-border/50">
              <CardContent className="p-4 md:p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-5 mb-6 h-auto p-1">
                    <TabsTrigger value="text" className="py-3 flex flex-col gap-1"><FileText className="w-4 h-4" /><span className="text-xs">Text</span></TabsTrigger>
                    <TabsTrigger value="image" className="py-3 flex flex-col gap-1"><ImageIcon className="w-4 h-4" /><span className="text-xs">Image</span></TabsTrigger>
                    <TabsTrigger value="pdf" className="py-3 flex flex-col gap-1"><FileIcon className="w-4 h-4" /><span className="text-xs">PDF</span></TabsTrigger>
                    <TabsTrigger value="doc" className="py-3 flex flex-col gap-1"><FileType2 className="w-4 h-4" /><span className="text-xs">Doc</span></TabsTrigger>
                    <TabsTrigger value="voice" className="py-3 flex flex-col gap-1"><Mic className="w-4 h-4" /><span className="text-xs">Voice</span></TabsTrigger>
                  </TabsList>
                  
                  <div className="min-h-[200px]">
                    <TabsContent value="text" className="space-y-4 mt-0">
                      <Textarea 
                        placeholder="Type or paste your text here..." 
                        className="min-h-[150px] resize-none text-base"
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                      />
                      <Button className="w-full" onClick={handleAddText} disabled={!textContent.trim() || isUploading}>
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                        Add Text
                      </Button>
                    </TabsContent>

                    <TabsContent value="image" className="space-y-4 mt-0">
                      <div className="border-2 border-dashed rounded-xl p-8 text-center hover:bg-muted/50 transition-colors">
                        <input type="file" id="image-upload" accept="image/*" className="hidden" onChange={handleFileSelect} />
                        <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center gap-2">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          <span className="text-sm font-medium">Click to select an image</span>
                          {selectedFile && <span className="text-xs text-primary">{selectedFile.name}</span>}
                        </label>
                      </div>
                      {previewUrl && (
                        <div className="relative w-full aspect-video rounded-lg overflow-hidden border">
                          <img src={previewUrl} alt="Preview" className="object-cover w-full h-full" />
                        </div>
                      )}
                      {isUploading && <Progress value={uploadProgress} className="h-2" />}
                      <Button className="w-full" onClick={handleAddImage} disabled={!selectedFile || isUploading}>
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                        Upload Image
                      </Button>
                    </TabsContent>

                    <TabsContent value="pdf" className="space-y-4 mt-0">
                      <div className="border-2 border-dashed rounded-xl p-8 text-center hover:bg-muted/50 transition-colors">
                        <input type="file" id="pdf-upload" accept=".pdf" className="hidden" onChange={handleFileSelect} />
                        <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center gap-2">
                          <FileIcon className="w-8 h-8 text-muted-foreground" />
                          <span className="text-sm font-medium">Click to select a PDF</span>
                          {selectedFile && <span className="text-xs text-primary">{selectedFile.name}</span>}
                        </label>
                      </div>
                      {isUploading && <Progress value={uploadProgress} className="h-2" />}
                      <Button className="w-full" onClick={() => handleAddDocument("pdf")} disabled={!selectedFile || isUploading}>
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileIcon className="w-4 h-4 mr-2" />}
                        Upload PDF
                      </Button>
                    </TabsContent>

                    <TabsContent value="doc" className="space-y-4 mt-0">
                      <div className="border-2 border-dashed rounded-xl p-8 text-center hover:bg-muted/50 transition-colors">
                        <input type="file" id="doc-upload" accept=".doc,.docx,.txt" className="hidden" onChange={handleFileSelect} />
                        <label htmlFor="doc-upload" className="cursor-pointer flex flex-col items-center gap-2">
                          <FileType2 className="w-8 h-8 text-muted-foreground" />
                          <span className="text-sm font-medium">Click to select a Document</span>
                          {selectedFile && <span className="text-xs text-primary">{selectedFile.name}</span>}
                        </label>
                      </div>
                      {isUploading && <Progress value={uploadProgress} className="h-2" />}
                      <Button className="w-full" onClick={() => handleAddDocument("doc")} disabled={!selectedFile || isUploading}>
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileType2 className="w-4 h-4 mr-2" />}
                        Upload Document
                      </Button>
                    </TabsContent>

                    <TabsContent value="voice" className="space-y-6 mt-0 flex flex-col items-center justify-center min-h-[200px]">
                      <div className="text-4xl font-mono font-light tracking-wider">
                        {formatTime(recordingTime)}
                      </div>
                      <div className="flex items-center gap-4">
                        {!isRecording ? (
                          <Button size="lg" className="rounded-full w-16 h-16 bg-red-500 hover:bg-red-600 animate-pulse-slow" onClick={startRecording} disabled={isUploading}>
                            <Mic className="w-6 h-6 text-white" />
                          </Button>
                        ) : (
                          <Button size="lg" className="rounded-full w-16 h-16 bg-zinc-800 hover:bg-zinc-700" onClick={stopRecording}>
                            <Square className="w-6 h-6 fill-current" />
                          </Button>
                        )}
                      </div>
                      {isUploading && <div className="w-full space-y-2"><p className="text-xs text-center text-muted-foreground">Uploading voice note...</p><Progress value={uploadProgress} className="h-2" /></div>}
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Shared Items Feed */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              Shared Items <span className="bg-primary/10 text-primary text-sm py-0.5 px-2 rounded-full">{items.length + pendingItems.length}</span>
            </h2>
            
            <div className="space-y-4">
              {pendingItems.map((pending) => (
                <Card key={pending.id} className="group relative overflow-hidden shadow-sm border-primary/50">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                          {pending.type === "pdf" && <FileIcon className="w-4 h-4" />}
                          {pending.type === "doc" && <FileType2 className="w-4 h-4" />}
                          {pending.type === "voice" && <Mic className="w-4 h-4" />}
                          {pending.type === "voice" ? "Voice Note" : `${pending.type.toUpperCase()} Document`}
                          {pending.status === "uploading" && <Loader2 className="w-3 h-3 animate-spin ml-2" />}
                        </div>
                        <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                          <div className="p-3 bg-background rounded-lg shadow-sm">
                            {pending.type === "pdf" && <FileIcon className="w-6 h-6 text-red-500 opacity-50" />}
                            {pending.type === "doc" && <FileType2 className="w-6 h-6 text-blue-500 opacity-50" />}
                            {pending.type === "voice" && <Mic className="w-6 h-6 text-green-500 opacity-50" />}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <span className="font-medium truncate block">{pending.fileName}</span>
                            <div className="flex items-center gap-3">
                              <Progress value={pending.progress} className="h-2 flex-1" />
                              <span className="text-xs text-muted-foreground min-w-[3ch]">{Math.round(pending.progress)}%</span>
                            </div>
                            <span className="text-xs font-medium text-muted-foreground">
                              {pending.status === "uploading" ? "uploading..." : "Upload failed"}
                            </span>
                          </div>
                        </div>
                        {pending.status === "error" && (
                          <div className="flex gap-2 mt-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => uploadPendingItem(pending.id, pending.file, pending.type, pending.extension, pending.fileName)}
                            >
                              Retry
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {items.length === 0 && pendingItems.length === 0 ? (
                <Card className="border-dashed bg-muted/20">
                  <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-3 text-muted-foreground">
                    <div className="p-4 bg-muted rounded-full">
                      <FileText className="w-8 h-8 opacity-50" />
                    </div>
                    <p>Nothing shared yet. Add something from the left panel.</p>
                  </CardContent>
                </Card>
              ) : (
                items.map((item) => (
                  <Card key={item.id} className="group relative overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Item specific render */}
                          {item.type === "text" && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                <FileText className="w-4 h-4" /> Text Snippet
                              </div>
                              <p className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg font-mono">{item.content}</p>
                              <div className="flex gap-2">
                                <Button variant="secondary" size="sm" onClick={() => copyToClipboard(item.content || "")}>
                                  <Copy className="w-3 h-3 mr-2" /> Copy
                                </Button>
                              </div>
                            </div>
                          )}

                          {item.type === "image" && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                <ImageIcon className="w-4 h-4" /> Image {item.fileName && `- ${item.fileName}`}
                              </div>
                              <div className="rounded-lg overflow-hidden border bg-muted/20">
                                <img src={item.content || item.storageUrl} alt="Shared image" className="max-h-[300px] w-auto object-contain mx-auto" />
                              </div>
                              <div className="flex gap-2">
                                <Button variant="secondary" size="sm" asChild>
                                  <a href={item.content || item.storageUrl} download={item.fileName || "image.png"} target="_blank" rel="noreferrer">
                                    <Download className="w-3 h-3 mr-2" /> Download
                                  </a>
                                </Button>
                              </div>
                            </div>
                          )}

                          {(item.type === "pdf" || item.type === "doc") && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                {item.type === "pdf" ? <FileIcon className="w-4 h-4" /> : <FileType2 className="w-4 h-4" />} 
                                {item.type.toUpperCase()} Document
                              </div>
                              <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-lg">
                                <div className="p-3 bg-background rounded-lg shadow-sm">
                                  {item.type === "pdf" ? <FileIcon className="w-6 h-6 text-red-500" /> : <FileType2 className="w-6 h-6 text-blue-500" />}
                                </div>
                                <span className="font-medium truncate">{item.fileName}</span>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="secondary" size="sm" asChild>
                                  <a href={item.storageUrl} target="_blank" rel="noreferrer">
                                    <Download className="w-3 h-3 mr-2" /> Download
                                  </a>
                                </Button>
                              </div>
                            </div>
                          )}

                          {item.type === "voice" && (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                <Mic className="w-4 h-4" /> Voice Note
                              </div>
                              <div className="bg-muted/30 p-4 rounded-lg">
                                <audio controls className="w-full h-10" src={item.storageUrl}>
                                  Your browser does not support the audio element.
                                </audio>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {isOwner && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteItem(item)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
