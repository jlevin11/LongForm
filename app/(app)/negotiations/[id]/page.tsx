import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import NegotiationWorkspace from './NegotiationWorkspace'
import type { ContractVersion, Negotiation, Profile } from '@/types'

export default async function NegotiationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch negotiation with parties
  const { data: negotiation } = await supabase
    .from('negotiations')
    .select(
      `*, creator:profiles!negotiations_created_by_fkey(*), counterparty:profiles!negotiations_counterparty_id_fkey(*)`
    )
    .eq('id', id)
    .single<Negotiation & { creator: Profile; counterparty: Profile | null }>()

  if (!negotiation) notFound()

  // Verify user is a party
  if (negotiation.created_by !== user.id && negotiation.counterparty_id !== user.id) {
    notFound()
  }

  // Fetch version metadata (no content — content is decrypted client-side)
  const { data: versions } = await supabase
    .from('contract_versions')
    .select(
      `id, negotiation_id, version_number, committed_by, commit_message, committed_at, word_count,
       content_encrypted_author, content_iv_author, content_key_encrypted_author,
       content_encrypted_counter, content_iv_counter, content_key_encrypted_counter,
       committer:profiles!contract_versions_committed_by_fkey(id, full_name, firm_name, email)`
    )
    .eq('negotiation_id', id)
    .order('version_number', { ascending: false })

  const typedVersions = (versions ?? []) as unknown as (ContractVersion & { committer: Profile })[]

  // Fetch user's current draft (encrypted — decrypted client-side)
  const { data: draft } = await supabase
    .from('drafts')
    .select('*')
    .eq('negotiation_id', id)
    .eq('author_id', user.id)
    .maybeSingle()

  // Fetch user profile for keys
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>()

  if (!profile) redirect('/login')

  return (
    <NegotiationWorkspace
      negotiation={negotiation}
      versions={typedVersions}
      draft={draft}
      currentUser={profile}
    />
  )
}
