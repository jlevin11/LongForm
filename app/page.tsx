import Link from 'next/link'
import { Lock, GitBranch, FileText, History, Download, Shield } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-full bg-white">
      {/* Nav */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-[#1e3a5f]" />
            <span className="font-bold text-xl text-[#1e3a5f]">LongForm</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-[#1e3a5f] transition-colors px-4 py-2"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-[#1e3a5f] text-white px-4 py-2 rounded-lg hover:bg-[#2d5282] transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-900 to-[#1e3a5f] text-white py-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm mb-8 border border-white/20">
            <Lock className="h-3.5 w-3.5" />
            End-to-end encrypted — invisible to everyone but you
          </div>
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Negotiate Contracts.
            <br />
            <span className="text-blue-300">Track Every Change. Trust the Record.</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10">
            LongForm brings version control to legal negotiations. Draft in private, commit when
            ready, and share a cryptographically secure, immutable history with opposing counsel.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="bg-white text-[#1e3a5f] font-semibold px-8 py-3.5 rounded-lg hover:bg-blue-50 transition-colors text-base"
            >
              Start Negotiating Free
            </Link>
            <Link
              href="/login"
              className="border border-white/30 text-white font-medium px-8 py-3.5 rounded-lg hover:bg-white/10 transition-colors text-base"
            >
              Log In
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-4">How it works</h2>
          <p className="text-center text-slate-500 mb-14 max-w-xl mx-auto">
            Like git for code — but for legal contracts between two parties.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Draft in Private',
                desc: 'Edit your contract changes on your side. Until you commit, your draft is fully encrypted and invisible to the other party.',
              },
              {
                step: '02',
                title: 'Commit & Share',
                desc: "When you're satisfied with your edits, commit the version. It's instantly shared with opposing counsel in encrypted form.",
              },
              {
                step: '03',
                title: 'Compare & Respond',
                desc: 'Both sides can view the full negotiation timeline, compare any two versions with track-change highlighting, and respond with new drafts.',
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-xl p-8 border border-slate-200">
                <div className="text-4xl font-black text-blue-100 mb-4">{item.step}</div>
                <h3 className="font-semibold text-lg text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-slate-900 mb-14">
            Built for legal professionals
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Lock,
                title: 'Zero-knowledge encryption',
                desc: 'Your contract content is encrypted client-side with your keys. Even LongForm administrators cannot read your documents.',
              },
              {
                icon: History,
                title: 'Immutable negotiation history',
                desc: 'Every committed version is permanently recorded with timestamps, authorship, and cryptographic integrity — a tamper-proof audit trail.',
              },
              {
                icon: FileText,
                title: 'Visual track changes',
                desc: 'Compare any two versions side-by-side with highlighted additions and deletions — just like redlining in Word, but more powerful.',
              },
              {
                icon: Download,
                title: 'Export anywhere',
                desc: 'Download any version as a Word (.docx) or PDF. Export the full negotiation history as a dated PDF for your records.',
              },
              {
                icon: Shield,
                title: 'Rich text editor',
                desc: 'A familiar document editor with headings, lists, bold, italic, underline — everything you need to draft contract language.',
              },
              {
                icon: GitBranch,
                title: 'Git-style workflow',
                desc: 'Draft freely, commit when ready. The counterparty only sees committed versions, never your works-in-progress.',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex gap-4 p-6 rounded-xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-colors"
              >
                <div className="mt-0.5 flex-shrink-0">
                  <f.icon className="h-5 w-5 text-[#1e3a5f]" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-[#1e3a5f]">
        <div className="max-w-2xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to modernize your contract workflow?</h2>
          <p className="text-slate-300 mb-8">Free to get started. No credit card required.</p>
          <Link
            href="/signup"
            className="inline-block bg-white text-[#1e3a5f] font-semibold px-10 py-4 rounded-lg hover:bg-blue-50 transition-colors text-base"
          >
            Create Your Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6 text-center text-sm text-slate-400 bg-white">
        <div className="flex items-center justify-center gap-2 mb-2">
          <GitBranch className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-600">LongForm</span>
        </div>
        <p>Secure contract negotiation with end-to-end encryption</p>
      </footer>
    </div>
  )
}
