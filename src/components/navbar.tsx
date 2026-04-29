"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Moon, Sun, CircleDashed, ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export default function Navbar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <nav className="border-b bg-card text-card-foreground">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          {pathname !== "/" && (
            <Link 
              href="/" 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors mr-4"
            >
              <ArrowLeft className="w-4 h-4" /> Home
            </Link>
          )}
          <Link href="/" className="font-bold text-xl tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-black">
              A
            </div>
            Any Share
          </Link>
        </div>
        
        {mounted && (
          <div className="flex items-center gap-1 bg-background/50 p-1 rounded-full border">
            <button
              onClick={() => setTheme("white")}
              className={cn(
                "p-2 rounded-full transition-colors",
                theme === "white" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
              )}
              title="White Mode"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme("gray")}
              className={cn(
                "p-2 rounded-full transition-colors",
                theme === "gray" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
              )}
              title="Gray Mode"
            >
              <CircleDashed className="w-4 h-4" />
            </button>
            <button
              onClick={() => setTheme("dark")}
              className={cn(
                "p-2 rounded-full transition-colors",
                theme === "dark" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground"
              )}
              title="Dark Mode"
            >
              <Moon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
