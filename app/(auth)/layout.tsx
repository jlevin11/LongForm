import Link from 'next/link'
import { GitBranch } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      <header className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2 text-[#1e3a5f] hover:opacity-80 transition-opacity">
          <GitBranch className="h-5 w-5" />
          <span className="font-bold text-lg">Contract Git</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        {children}
      </main>
      <footer className="px-6 py-4 text-center text-xs text-slate-400">
        Your data is end-to-end encrypted. We cannot read your contracts.
      </footer>
    </div>
  )
}
