import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import toast from "react-hot-toast"

export function useCreateShare() {
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  const createShare = useCallback(async () => {
    if (isCreating) return
    
    setIsCreating(true)
    console.log("Creating share...");
    try {
      let sessionId = localStorage.getItem("anyshare_session_id")
      if (!sessionId) {
        sessionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem("anyshare_session_id", sessionId)
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      console.log("Generated code:", code);

      // 24 hours from now
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)

      console.log("Saving to Firestore...");
      await setDoc(doc(db, "shares", code), {
        code,
        ownerId: sessionId,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        items: []
      })
      console.log("Saved to Firestore successfully");

      localStorage.setItem("lastShareCode", code)
      router.push(`/${code}`)
    } catch (error) {
      console.error("Error creating share:", error)
      const errorMessage = error instanceof Error ? error.message : "Something went wrong"
      toast.error(`⚠ Error: ${errorMessage}`)
    } finally {
      setIsCreating(false)
    }
  }, [isCreating, router])

  return { createShare, isCreating }
}
