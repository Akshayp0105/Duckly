"use client"

import { useEffect, useRef } from "react"
import { useCreateShare } from "@/hooks/useCreateShare"
import { useAuth } from "@/contexts/AuthContext"

export default function NewShare() {
  const { createShare } = useCreateShare()
  const { user, loading } = useAuth()
  const hasCreated = useRef(false)

  useEffect(() => {
    if (!loading && user && !hasCreated.current) {
      hasCreated.current = true
      createShare()
    }
  }, [loading, user, createShare])

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground animate-pulse text-lg font-medium">Creating your secure share...</p>
      </div>
    </div>
  )
}
