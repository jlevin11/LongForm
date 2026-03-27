'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  GitCommitHorizontal,
  Save,
  Users,
  AlertCircle,
  Download,
  LinkIcon,
  CheckCircle2,
  Upload,
  FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getStoredPrivateKey,
  encryptContent,
  decryptContent,
  rewrapKeyForParty,
} from '@/lib/crypto'
import { countWords, formatDate } from '@/lib/utils'
import ContractEditor from '@/components/editor/ContractEditor'
import VersionTimeline, { type TimelineView } from '@/components/timeline/VersionTimeline'
import DiffViewer from '@/components/diff/DiffViewer'
import type { ContractVersion, Draft, Negotiation, Profile } from '@/types'
import { exportVersionToPDF, exportVersionToWord, exportHistoryToPDF } from '@/lib/export'

interface NegotiationWorkspaceProps {
  negotiation: Negotiation & { creator: Profile; counterparty: Profile | null }
  versions: (ContractVersion & { committer: Profile })[]
  draft: Draft | null
  currentUser: Profile
}

export default function NegotiationWorkspace({
  negotiation,
  versions: initialVersions,
  draft: initialDraft,
  currentUser,
}: NegotiationWorkspaceProps) {
  const [privateKey, setPrivateKey] = useState<string | null>(null)
  const [keyMissing, setKeyMissing] = useState(false)

  const [versions, setVersions] = useState(initialVersions)
  const [draft, setDraft] = useState<Draft | null>(initialDraft)

  const [currentView, setCurrentView] = useState<TimelineView>(
    initialDraft ? { type: 'draft' } : initialVersions.length > 0 ? { type: 'version', versionId: initialVersions[0].id } : { type: 'draft' }
  )
  const [comparingFrom, setComparingFrom] = useState<string | null>(null)

  // Decrypted content cache
  const [contentCache, setContentCache] = useState<Record<string, string>>({})
  const [draftContent, setDraftContent] = useState<string>('')
  const [loadingContent, setLoadingContent] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [committing, setCommitting] = useState(false)

  // Invite counterparty
  const [inviteEmail, setInviteEmail] = useState(negotiation.counterparty_email ?? '')
  const [linkingParty, setLinkingParty] = useState(false)

  // Commit dialog
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')

  // Word import
  const importFileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  async function importFromWord(file: File) {
    if (!file.name.endsWith('.docx')) {
      toast.error('Please select a .docx Word file')
      return
    }
    setImporting(true)
    try {
      const mammoth = (await import('mammoth')).default
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.convertToHtml({ arrayBuffer })
      if (result.messages.length > 0) {
        const warnings = result.messages.filter((m) => m.type === 'warning')
        if (warnings.length > 0) toast.warning('Some formatting may not have imported perfectly')
      }
      setDraftContent(result.value)
      setCurrentView({ type: 'draft' })
      toast.success(`"${file.name}" imported successfully`)
    } catch {
      toast.error('Failed to parse Word document')
    } finally {
      setImporting(false)
      if (importFileRef.current) importFileRef.current.value = ''
    }
  }

  // Load private key from sessionStorage on mount
  useEffect(() => {
    const pk = getStoredPrivateKey(currentUser.id)
    if (pk) {
      setPrivateKey(pk)
    } else {
      setKeyMissing(true)
    }
  }, [currentUser.id])

  // Decrypt a version's content
  const decryptVersion = useCallback(
    async (version: ContractVersion) => {
      if (!privateKey) return ''
      if (contentCache[version.id]) return contentCache[version.id]

      setLoadingContent(true)
      try {
        const isAuthor = version.committed_by === currentUser.id
        const encContent = isAuthor
          ? version.content_encrypted_author
          : version.content_encrypted_counter
        const encIv = isAuthor ? version.content_iv_author : version.content_iv_counter
        const encKey = isAuthor
          ? version.content_key_encrypted_author
          : version.content_key_encrypted_counter

        if (!encContent || !encIv || !encKey) {
          const msg = '<p style="color:#6b7280;font-style:italic">This version was committed before you were added to this negotiation. Ask the other party to re-commit so it is encrypted for you.</p>'
          setContentCache((prev) => ({ ...prev, [version.id]: msg }))
          return msg
        }

        const decrypted = await decryptContent(encContent, encIv, encKey, privateKey)
        setContentCache((prev) => ({ ...prev, [version.id]: decrypted }))
        return decrypted
      } catch (err) {
        console.error('Decryption failed for version', version.id, err)
        const msg = '<p style="color:#ef4444;font-style:italic">Decryption failed. Your session key may not match — try signing out and back in.</p>'
        setContentCache((prev) => ({ ...prev, [version.id]: msg }))
        return msg
      } finally {
        setLoadingContent(false)
      }
    },
    [privateKey, contentCache, currentUser.id]
  )

  // Decrypt draft on load
  useEffect(() => {
    if (!draft || !privateKey) return
    ;(async () => {
      try {
        const decrypted = await decryptContent(
          draft.content_encrypted,
          draft.content_iv,
          draft.content_key_encrypted,
          privateKey
        )
        setDraftContent(decrypted)
      } catch {
        setDraftContent('')
        toast.error('Failed to decrypt draft')
      }
    })()
  }, [draft, privateKey])

  // Preload selected version content
  useEffect(() => {
    if (!privateKey) return
    if (currentView.type === 'version') {
      const version = versions.find((v) => v.id === currentView.versionId)
      if (version) decryptVersion(version)
    }
    if (currentView.type === 'diff') {
      const from = versions.find((v) => v.id === currentView.fromId)
      const to = versions.find((v) => v.id === currentView.toId)
      if (from) decryptVersion(from)
      if (to) decryptVersion(to)
    }
  }, [currentView, versions, privateKey, decryptVersion])

  async function saveDraft(content: string) {
    if (!privateKey) return
    setSavingDraft(true)
    try {
      const supabase = createClient()
      const encrypted = await encryptContent(content, currentUser.public_key)

      if (draft) {
        await supabase
          .from('drafts')
          .update({
            content_encrypted: encrypted.encryptedContent,
            content_iv: encrypted.iv,
            content_key_encrypted: encrypted.encryptedKey,
          })
          .eq('id', draft.id)
      } else {
        const { data } = await supabase
          .from('drafts')
          .insert({
            negotiation_id: negotiation.id,
            author_id: currentUser.id,
            content_encrypted: encrypted.encryptedContent,
            content_iv: encrypted.iv,
            content_key_encrypted: encrypted.encryptedKey,
          })
          .select()
          .single<Draft>()
        if (data) setDraft(data)
      }
    } catch {
      toast.error('Failed to save draft')
    } finally {
      setSavingDraft(false)
    }
  }

  // Debounced auto-save
  useEffect(() => {
    if (!draftContent || currentView.type !== 'draft') return
    const timer = setTimeout(() => saveDraft(draftContent), 2000)
    return () => clearTimeout(timer)
  }, [draftContent]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCommit() {
    if (!privateKey || !draftContent.trim()) return
    setCommitting(true)
    try {
      const supabase = createClient()
      const counterparty = negotiation.created_by === currentUser.id
        ? negotiation.counterparty
        : (await supabase.from('profiles').select('*').eq('id', negotiation.created_by).single<Profile>()).data

      // Encrypt content for author
      const forAuthor = await encryptContent(draftContent, currentUser.public_key)

      // Encrypt content for counterparty (if they exist)
      let forCounter: typeof forAuthor | null = null
      if (counterparty) {
        // Re-wrap the same symmetric key for counterparty using their public key
        const rewrappedKey = await rewrapKeyForParty(
          forAuthor.encryptedKey,
          privateKey,
          counterparty.public_key
        )
        // Counter uses same ciphertext — just different key wrapping
        forCounter = {
          encryptedContent: forAuthor.encryptedContent,
          iv: forAuthor.iv,
          encryptedKey: rewrappedKey,
        }
      }

      const nextVersion = Math.max(0, ...versions.map((v) => v.version_number)) + 1

      const { data: newVersion, error } = await supabase
        .from('contract_versions')
        .insert({
          negotiation_id: negotiation.id,
          version_number: nextVersion,
          committed_by: currentUser.id,
          commit_message: commitMessage || null,
          content_encrypted_author: forAuthor.encryptedContent,
          content_iv_author: forAuthor.iv,
          content_key_encrypted_author: forAuthor.encryptedKey,
          content_encrypted_counter: forCounter?.encryptedContent ?? null,
          content_iv_counter: forCounter?.iv ?? null,
          content_key_encrypted_counter: forCounter?.encryptedKey ?? null,
          word_count: countWords(draftContent),
        })
        .select(`*, committer:profiles!contract_versions_committed_by_fkey(*)`)
        .single()

      if (error) throw new Error(error.message)

      // Delete draft after committing
      if (draft) {
        await supabase.from('drafts').delete().eq('id', draft.id)
        setDraft(null)
        setDraftContent('')
      }

      setVersions((prev) => [newVersion as ContractVersion & { committer: Profile }, ...prev])
      setContentCache((prev) => ({ ...prev, [newVersion.id]: draftContent }))
      setCurrentView({ type: 'version', versionId: newVersion.id })
      setShowCommitDialog(false)
      setCommitMessage('')
      toast.success(`Version ${nextVersion} committed!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Commit failed')
    } finally {
      setCommitting(false)
    }
  }

  async function linkCounterparty() {
    if (!inviteEmail) return
    setLinkingParty(true)
    try {
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, public_key')
        .eq('email', inviteEmail)
        .single<Pick<Profile, 'id' | 'public_key'>>()

      if (!profile) {
        toast.error('No account found for that email')
        return
      }
      if (profile.id === currentUser.id) {
        toast.error('You cannot be your own counterparty')
        return
      }

      const { error } = await supabase
        .from('negotiations')
        .update({ counterparty_id: profile.id, counterparty_email: inviteEmail, status: 'active' })
        .eq('id', negotiation.id)

      if (error) throw error
      toast.success('Counterparty linked! They can now access this negotiation.')
      window.location.reload()
    } catch {
      toast.error('Failed to link counterparty')
    } finally {
      setLinkingParty(false)
    }
  }

  async function handleExport(format: 'pdf' | 'word' | 'history') {
    if (!privateKey) return toast.error('Session expired')

    if (format === 'history') {
      // Decrypt all versions
      const decryptedVersions: { version: ContractVersion & { committer: Profile }; content: string }[] = []
      for (const v of [...versions].sort((a, b) => a.version_number - b.version_number)) {
        const content = await decryptVersion(v)
        decryptedVersions.push({ version: v, content })
      }
      exportHistoryToPDF(negotiation, decryptedVersions)
      return
    }

    let content = ''
    let versionLabel = ''
    if (currentView.type === 'version') {
      const v = versions.find((v) => v.id === currentView.versionId)
      if (!v) return
      content = await decryptVersion(v)
      versionLabel = `v${v.version_number}`
    } else if (currentView.type === 'draft') {
      content = draftContent
      versionLabel = 'Draft'
    } else {
      toast.info('Switch to a version view to export')
      return
    }

    if (format === 'pdf') exportVersionToPDF(negotiation, content, versionLabel)
    if (format === 'word') exportVersionToWord(negotiation, content, versionLabel)
  }

  if (keyMissing) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-sm bg-white rounded-xl border border-slate-200 p-8">
          <AlertCircle className="h-10 w-10 text-amber-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Session Expired</h2>
          <p className="text-slate-500 text-sm mb-6">
            Your encryption keys are not available in this tab. Please sign in again to decrypt your
            contracts.
          </p>
          <a
            href="/login"
            className="inline-block bg-[#1e3a5f] text-white font-medium px-6 py-2.5 rounded-lg hover:bg-[#2d5282] transition-colors text-sm"
          >
            Sign In Again
          </a>
        </div>
      </div>
    )
  }

  const otherParty =
    negotiation.created_by === currentUser.id ? negotiation.counterparty : negotiation.creator

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -mt-8 -mx-6">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-slate-900 truncate">{negotiation.title}</h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
            <Users className="h-3 w-3" />
            {otherParty ? (
              <span>
                {otherParty.full_name}
                {otherParty.firm_name ? ` · ${otherParty.firm_name}` : ''}
              </span>
            ) : (
              <span className="text-amber-500">No counterparty linked</span>
            )}
            <span>·</span>
            <span>{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Hidden file input for Word import */}
          <input
            ref={importFileRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importFromWord(file)
            }}
          />

          {/* Import Word button — only in draft mode */}
          {currentView.type === 'draft' && (
            <button
              onClick={() => importFileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {importing ? 'Importing…' : 'Import Word'}
            </button>
          )}

          {/* Export dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 text-sm text-slate-600 border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px] hidden group-hover:block z-20">
              <button
                onClick={() => handleExport('pdf')}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Export as PDF
              </button>
              <button
                onClick={() => handleExport('word')}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Export as Word (.docx)
              </button>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={() => handleExport('history')}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Export Full History (PDF)
              </button>
            </div>
          </div>

          {/* Commit button */}
          {currentView.type === 'draft' && draftContent && (
            <button
              onClick={() => setShowCommitDialog(true)}
              className="flex items-center gap-1.5 bg-[#1e3a5f] text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-[#2d5282] transition-colors"
            >
              <GitCommitHorizontal className="h-4 w-4" />
              Commit Version
            </button>
          )}

          {/* Draft save indicator */}
          {currentView.type === 'draft' && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => saveDraft(draftContent)}
                disabled={savingDraft}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingDraft ? 'Saving…' : 'Save draft'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Counterparty invite banner */}
      {!otherParty && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center gap-3 flex-wrap">
          <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="text-sm text-amber-700 flex-1">
            Link a counterparty so they can see committed versions.
          </span>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="their@email.com"
              className="text-sm border border-amber-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white w-52"
            />
            <button
              onClick={linkCounterparty}
              disabled={linkingParty || !inviteEmail}
              className="flex items-center gap-1 text-sm bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {linkingParty ? 'Linking…' : 'Link'}
            </button>
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Version Timeline */}
        <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-white overflow-hidden">
          <VersionTimeline
            versions={versions}
            currentUserId={currentUser.id}
            hasDraft={!!draft || currentView.type === 'draft'}
            currentView={currentView}
            onSelect={(view) => {
              setCurrentView(view)
              setComparingFrom(null)
            }}
            onComparePick={(versionId) => {
              if (comparingFrom) {
                setCurrentView({ type: 'diff', fromId: comparingFrom, toId: versionId })
                setComparingFrom(null)
              } else {
                setComparingFrom(versionId)
              }
            }}
            comparingFrom={comparingFrom}
          />
        </div>

        {/* Main panel */}
        <div className="flex-1 overflow-hidden bg-white">
          {loadingContent && (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400 text-sm">Decrypting…</p>
            </div>
          )}

          {!loadingContent && currentView.type === 'draft' && !draftContent && (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-8">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                <FileText className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-700 mb-1">Start your draft</h3>
                <p className="text-sm text-slate-400 max-w-xs">
                  Import an existing Word document or start writing from scratch.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => importFileRef.current?.click()}
                  disabled={importing}
                  className="flex items-center gap-2 bg-[#1e3a5f] text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-[#2d5282] transition-colors disabled:opacity-50"
                >
                  <Upload className="h-4 w-4" />
                  {importing ? 'Importing…' : 'Import Word (.docx)'}
                </button>
                <button
                  onClick={() => setDraftContent('<p></p>')}
                  className="text-sm text-slate-500 border border-slate-300 px-5 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Start from scratch
                </button>
              </div>
            </div>
          )}

          {!loadingContent && currentView.type === 'draft' && draftContent && (
            <ContractEditor
              content={draftContent}
              onChange={setDraftContent}
              readOnly={false}
            />
          )}

          {!loadingContent && currentView.type === 'version' && (() => {
            const version = versions.find((v) => v.id === currentView.versionId)
            const content = version ? contentCache[version.id] : undefined
            return (
              <div className="flex flex-col h-full">
                {version && (
                  <div className="flex items-center justify-between px-6 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <GitCommitHorizontal className="h-3.5 w-3.5" />
                      <span className="font-medium">
                        Version {version.version_number}
                      </span>
                      <span>·</span>
                      <span>
                        {version.committer?.full_name} · {formatDate(version.committed_at)}
                      </span>
                      {version.commit_message && (
                        <>
                          <span>·</span>
                          <span className="italic">&ldquo;{version.commit_message}&rdquo;</span>
                        </>
                      )}
                    </div>
                    {version.word_count && (
                      <span>{version.word_count} words</span>
                    )}
                  </div>
                )}
                {content !== undefined ? (
                  <ContractEditor
                    content={content}
                    onChange={() => {}}
                    readOnly={true}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-slate-400 text-sm">Loading…</p>
                  </div>
                )}
              </div>
            )
          })()}

          {!loadingContent && currentView.type === 'diff' && (() => {
            const fromVersion = versions.find((v) => v.id === currentView.fromId)
            const toVersion = versions.find((v) => v.id === currentView.toId)
            const fromContent = fromVersion ? contentCache[fromVersion.id] : undefined
            const toContent = toVersion ? contentCache[toVersion.id] : undefined

            if (fromContent === undefined || toContent === undefined) {
              return (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400 text-sm">Loading diff…</p>
                </div>
              )
            }

            return (
              <DiffViewer
                fromContent={fromContent}
                toContent={toContent}
                fromLabel={`v${fromVersion!.version_number}`}
                toLabel={`v${toVersion!.version_number}`}
              />
            )
          })()}
        </div>
      </div>

      {/* Commit dialog */}
      {showCommitDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-1">Commit Version</h2>
            <p className="text-sm text-slate-500 mb-4">
              This will publish your draft as a new committed version visible to{' '}
              {otherParty ? otherParty.full_name : 'the counterparty'}.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Commit note <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="e.g., Revised indemnification clause"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCommit}
                disabled={committing}
                className="flex-1 flex items-center justify-center gap-2 bg-[#1e3a5f] text-white font-medium py-2.5 rounded-lg hover:bg-[#2d5282] transition-colors disabled:opacity-60 text-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                {committing ? 'Committing…' : 'Confirm Commit'}
              </button>
              <button
                onClick={() => setShowCommitDialog(false)}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
