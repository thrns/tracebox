'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { FolderOpen, BarChart3, LogOut } from 'lucide-react'

const navItems = [
  { label: 'Workspaces', href: '/dashboard', icon: FolderOpen },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <aside className="w-52 flex-shrink-0 bg-tracebox-dark border-r border-tracebox-border flex flex-col h-full">
      {/* Logo */}
      <button
        type="button"
        className="h-14 flex items-center gap-3 px-4 border-b border-tracebox-border cursor-pointer w-full text-left hover:bg-white/[0.03] transition-colors rounded-none"
        onClick={() => router.push('/dashboard')}
      >
        <Image src="/tracebox-logo.png" alt="tracebox" width={28} height={28} className="rounded-lg object-contain flex-shrink-0" />
        <span className="font-instrument font-normal text-white text-[15px] tracking-tight">tracebox</span>
      </button>

      {/* Nav — only active tab uses green; inactive have no colour */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isWorkspaces = item.href === '/dashboard'
          const isActive = isWorkspaces
            ? pathname === '/dashboard' || pathname.startsWith('/workspace')
            : pathname === item.href
          return (
            <button
              key={item.label}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                isActive
                  ? 'bg-tracebox-primary/10 text-tracebox-primary font-medium'
                  : 'text-white/50 hover:text-white/90 hover:bg-white/[0.04]'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0 opacity-80" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="px-3 py-4 border-t border-tracebox-border space-y-2">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-tracebox-primary/15 border border-tracebox-primary/25 flex items-center justify-center text-xs font-semibold text-tracebox-primary flex-shrink-0">
              {user.email?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white font-medium truncate">{user.email?.split('@')[0]}</p>
              <p className="text-[11px] text-white/35">Pro Account</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/45 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      )}
    </aside>
  )
}
