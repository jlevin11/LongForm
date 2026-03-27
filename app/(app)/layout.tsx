import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { GitBranch, LogOut, Plus } from 'lucide-react'
import type { Profile } from '@/types'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  return (
    <div className="min-h-full flex flex-col bg-slate-50">
      <header className="bg-[#1e3a5f] text-white sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <GitBranch className="h-5 w-5" />
            <span className="font-bold text-base">Contract Git</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/negotiations/new"
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white text-sm font-medium px-3.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Negotiation
            </Link>
            <div className="flex items-center gap-2 pl-3 border-l border-white/20">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium leading-tight">{profile?.full_name ?? user.email}</p>
                {profile?.firm_name && (
                  <p className="text-xs text-white/60 leading-tight">{profile.firm_name}</p>
                )}
              </div>
              <form action="/api/auth/signout" method="post">
                <button
                  type="submit"
                  title="Sign out"
                  className="p-1.5 hover:bg-white/15 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
