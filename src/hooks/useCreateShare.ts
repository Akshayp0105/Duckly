import { useState } from "react"
import { useRouter } from "next/navigation"
import { doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import toast from "react-hot-toast"

export function useCreateShare() {
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  const createShare = async () => {
    if (isCreating) return
    
    setIsCreating(true)
    try {
      let sessionId = localStorage.getItem("anyshare_session_id")
      if (!sessionId) {
        sessionId = crypto.randomUUID()
        localStorage.setItem("anyshare_session_id", sessionId)
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase()

      // 24 hours from now
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)

      await setDoc(doc(db, "shares", code), {
        code,
        ownerId: sessionId,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        items: []
      })

      localStorage.setItem("lastShareCode", code)
      router.push(`/${code}`)
    } catch (error) {
      console.error("Error creating share:", error)
      toast.error("⚠ Something went wrong")
      setIsCreating(false)
    }
  }

  return { createShare, isCreating }
}
