'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { LogOut, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  searchPlaceholder?: string
}

export function Header({ searchPlaceholder }: HeaderProps) {
  const { user, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <header className="h-14 border-b border-tracebox-border bg-tracebox-bg flex items-center justify-between px-6 sticky top-0 z-40">
      {/* Left: Logo */}
      <div
        className="flex items-center gap-2.5 cursor-pointer flex-shrink-0"
        onClick={() => router.push('/workspace')}
      >
        <Image src="/tracebox-logo.png" alt="tracebox" width={28} height={28} className="w-7 h-7 object-contain" />
        <span className="font-bold text-white text-lg tracking-tight">tracebox</span>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-sm mx-8">
        {searchPlaceholder && (
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={searchPlaceholder}
              className="w-full bg-tracebox-dark border border-tracebox-border rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-tracebox-primary/40 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Right: User */}
      {user && (
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-white/40 leading-none">Logged in as</p>
            <p className="text-xs text-white font-medium mt-0.5 leading-none">{user.email}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 outline-none">
              <div className="w-8 h-8 rounded-full bg-tracebox-primary/20 border border-tracebox-primary/30 flex items-center justify-center text-xs font-bold text-tracebox-primary">
                {user.email?.[0]?.toUpperCase()}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-white/40" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-tracebox-dark border-tracebox-border w-44">
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-500/10 cursor-pointer text-xs"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  )
}
