import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FileText, Clock, Users, CheckCircle2, GitBranch } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Negotiation, Profile } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch all negotiations where user is creator or counterparty
  const { data: negotiations } = await supabase
    .from('negotiations')
    .select(`
      *,
      creator:profiles!negotiations_created_by_fkey(id, full_name, firm_name, email),
      counterparty:profiles!negotiations_counterparty_id_fkey(id, full_name, firm_name, email)
    `)
    .or(`created_by.eq.${user!.id},counterparty_id.eq.${user!.id}`)
    .order('updated_at', { ascending: false })

  const typedNegotiations = (negotiations ?? []) as (Negotiation & {
    creator: Profile
    counterparty: Profile | null
  })[]

  const active = typedNegotiations.filter((n) => n.status === 'active')
  const pending = typedNegotiations.filter((n) => n.status === 'pending_invite')
  const completed = typedNegotiations.filter((n) => n.status === 'completed')

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Negotiations</h1>
          <p className="text-slate-500 text-sm mt-1">
            {typedNegotiations.length === 0
              ? 'No negotiations yet'
              : `${typedNegotiations.length} negotiation${typedNegotiations.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/negotiations/new"
          className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white font-medium px-4 py-2.5 rounded-lg hover:bg-[#2d5282] transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          New Negotiation
        </Link>
      </div>

      {typedNegotiations.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-xl border border-slate-200">
          <GitBranch className="h-10 w-10 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">No negotiations yet</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            Start a new contract negotiation and invite the other party to collaborate.
          </p>
          <Link
            href="/negotiations/new"
            className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white font-medium px-5 py-2.5 rounded-lg hover:bg-[#2d5282] transition-colors text-sm"
          >
            <Plus className="h-4 w-4" />
            Start First Negotiation
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {active.length > 0 && (
            <Section title="Active" icon={<GitBranch className="h-4 w-4" />}>
              {active.map((n) => (
                <NegotiationCard key={n.id} negotiation={n} userId={user!.id} />
              ))}
            </Section>
          )}
          {pending.length > 0 && (
            <Section title="Pending Invite" icon={<Clock className="h-4 w-4" />}>
              {pending.map((n) => (
                <NegotiationCard key={n.id} negotiation={n} userId={user!.id} />
              ))}
            </Section>
          )}
          {completed.length > 0 && (
            <Section title="Completed" icon={<CheckCircle2 className="h-4 w-4" />}>
              {completed.map((n) => (
                <NegotiationCard key={n.id} negotiation={n} userId={user!.id} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-slate-500 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  )
}

function NegotiationCard({
  negotiation,
  userId,
}: {
  negotiation: Negotiation & { creator: Profile; counterparty: Profile | null }
  userId: string
}) {
  const isCreator = negotiation.created_by === userId
  const otherParty = isCreator ? negotiation.counterparty : negotiation.creator
  const statusColors = {
    active: 'bg-emerald-100 text-emerald-700',
    pending_invite: 'bg-amber-100 text-amber-700',
    completed: 'bg-slate-100 text-slate-600',
  }

  return (
    <Link
      href={`/negotiations/${negotiation.id}`}
      className="block bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <FileText className="h-5 w-5 text-slate-400 group-hover:text-[#1e3a5f] transition-colors mt-0.5" />
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[negotiation.status]}`}
        >
          {negotiation.status === 'pending_invite' ? 'Pending' : negotiation.status.charAt(0).toUpperCase() + negotiation.status.slice(1)}
        </span>
      </div>
      <h3 className="font-semibold text-slate-900 text-sm mb-1 group-hover:text-[#1e3a5f] transition-colors line-clamp-2">
        {negotiation.title}
      </h3>
      {negotiation.description && (
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{negotiation.description}</p>
      )}
      <div className="flex items-center gap-1 text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">
        <Users className="h-3.5 w-3.5" />
        {otherParty ? (
          <span>
            {otherParty.full_name}
            {otherParty.firm_name ? ` · ${otherParty.firm_name}` : ''}
          </span>
        ) : negotiation.counterparty_email ? (
          <span className="italic">{negotiation.counterparty_email} (invite pending)</span>
        ) : (
          <span className="italic">No counterparty yet</span>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-1">{formatDate(negotiation.updated_at)}</p>
    </Link>
  )
}
