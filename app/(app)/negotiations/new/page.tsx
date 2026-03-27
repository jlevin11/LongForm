'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export default function NewNegotiationPage() {
  const router = useRouter()
  const [form, setForm] = useState({ title: '', description: '', counterpartyEmail: '' })
  const [loading, setLoading] = useState(false)

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Look up counterparty by email (if provided)
      let counterpartyId: string | null = null
      if (form.counterpartyEmail) {
        const { data: counterparty } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', form.counterpartyEmail)
          .single<Pick<Profile, 'id'>>()

        if (!counterparty) {
          toast.warning(
            `${form.counterpartyEmail} doesn't have a Contract Git account yet. The negotiation will be created and you can link them later.`
          )
        } else {
          counterpartyId = counterparty.id
        }
      }

      const { data: negotiation, error } = await supabase
        .from('negotiations')
        .insert({
          title: form.title,
          description: form.description || null,
          created_by: user.id,
          counterparty_id: counterpartyId,
          counterparty_email: form.counterpartyEmail || null,
          status: counterpartyId ? 'active' : 'pending_invite',
        })
        .select()
        .single()

      if (error) throw new Error(error.message)

      toast.success('Negotiation created!')
      router.push(`/negotiations/${negotiation.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create negotiation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
            <FileText className="h-5 w-5 text-[#1e3a5f]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">New Negotiation</h1>
            <p className="text-sm text-slate-500">Set up a new contract negotiation</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Contract title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="e.g., Software Development Agreement — Acme Corp"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Brief description of what's being negotiated…"
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Counterparty email <span className="text-slate-400">(optional)</span>
            </label>
            <input
              type="email"
              value={form.counterpartyEmail}
              onChange={(e) => update('counterpartyEmail', e.target.value)}
              placeholder="counsel@otherside.com"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] transition-colors"
            />
            <p className="text-xs text-slate-400 mt-1">
              The other party must have a Contract Git account. You can also link them later.
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#1e3a5f] text-white font-medium py-2.5 rounded-lg hover:bg-[#2d5282] transition-colors disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Creating…' : 'Create Negotiation'}
            </button>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
