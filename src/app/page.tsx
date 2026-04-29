"use client";

import Link from "next/link";
import { ArrowRight, Share2, Shield, Zap, Loader2, History } from "lucide-react";
import { useEffect, useState } from "react";
import { useCreateShare } from "@/hooks/useCreateShare";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function Home() {
  const [lastShareCode, setLastShareCode] = useState<string | null>(null);
  const { createShare, isCreating } = useCreateShare();

  useEffect(() => {
    const code = localStorage.getItem("lastShareCode");
    if (code) {
      const checkCode = async () => {
        try {
          const docRef = doc(db, "shares", code);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const expiresAt = data.expiresAt?.toMillis() || 0;
            if (expiresAt > Date.now()) {
              setLastShareCode(code);
            } else {
              localStorage.removeItem("lastShareCode");
            }
          } else {
            localStorage.removeItem("lastShareCode");
          }
        } catch (err) {
          console.error(err);
        }
      };
      checkCode();
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-background to-background pointer-events-none" />
      
      <div className="relative z-10 max-w-3xl w-full mx-auto text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium border shadow-sm">
          <Zap className="w-4 h-4 text-primary" />
          <span>Powered by K Factory</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-balance bg-clip-text text-transparent bg-gradient-to-r from-foreground via-muted-foreground to-foreground animate-text-gradient pb-2">
          Share anything, <br className="hidden sm:block" /> instantly
        </h1>
        
        <p className="text-xl text-muted-foreground text-balance max-w-xl mx-auto">
          A seamless, temporary clipboard for your text, images, and files. No sign-up required. Access anywhere via a unique 6-character code.
        </p>

        <div className="pt-8 flex flex-col items-center justify-center gap-4">
          <button
            onClick={createShare}
            disabled={isCreating}
            className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 w-full sm:w-auto overflow-hidden disabled:opacity-80 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          >
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
            <span className="relative z-10 flex items-center gap-2">
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Start Sharing
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </span>
          </button>

          {lastShareCode && (
            <Link 
              href={`/${lastShareCode}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              <History className="w-4 h-4" />
              Continue last share
            </Link>
          )}
        </div>

        <div className="pt-24 grid grid-cols-1 md:grid-cols-2 gap-8 text-left max-w-2xl mx-auto">
          <div className="bg-card text-card-foreground p-6 rounded-2xl border shadow-sm flex gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 bg-primary/5 border rounded-xl h-fit">
              <Share2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Universal Support</h3>
              <p className="text-muted-foreground mt-1">Share text snippets, images, PDFs, or voice notes flawlessly.</p>
            </div>
          </div>
          <div className="bg-card text-card-foreground p-6 rounded-2xl border shadow-sm flex gap-4 hover:shadow-md transition-shadow">
            <div className="p-3 bg-primary/5 border rounded-xl h-fit">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Auto Expire</h3>
              <p className="text-muted-foreground mt-1">Files are securely wiped from our servers after 24 hours.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
