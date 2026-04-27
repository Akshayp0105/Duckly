import { useState } from "react"
import { useRouter } from "next/navigation"
import { doc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/AuthContext"

export function useCreateShare() {
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  const createShare = async () => {
    if (!user) return
    if (isCreating) return
    
    setIsCreating(true)
    try {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
      let code = ""
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      // 24 hours from now
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)

      await setDoc(doc(db, "shares", code), {
        code,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        items: []
      })

      localStorage.setItem("lastShareCode", code)
      router.push(`/${code}`)
    } catch (error) {
      console.error("Error creating share:", error)
      setIsCreating(false)
    }
  }

  return { createShare, isCreating }
}
