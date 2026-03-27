export type Profile = {
  id: string
  email: string
  full_name: string
  firm_name: string | null
  public_key: string
  encrypted_private_key: string
  key_salt: string
  key_iv: string
  created_at: string
}

export type Negotiation = {
  id: string
  title: string
  description: string | null
  created_by: string
  counterparty_id: string | null
  counterparty_email: string | null
  status: 'pending_invite' | 'active' | 'completed'
  created_at: string
  updated_at: string
  creator?: Profile
  counterparty?: Profile
}

export type ContractVersion = {
  id: string
  negotiation_id: string
  version_number: number
  committed_by: string
  commit_message: string | null
  committed_at: string
  content_encrypted_author: string
  content_iv_author: string
  content_key_encrypted_author: string
  content_encrypted_counter: string | null
  content_iv_counter: string | null
  content_key_encrypted_counter: string | null
  word_count: number | null
  committer?: Profile
}

export type Draft = {
  id: string
  negotiation_id: string
  author_id: string
  content_encrypted: string
  content_iv: string
  content_key_encrypted: string
  base_version_id: string | null
  updated_at: string
}
