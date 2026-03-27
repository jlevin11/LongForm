'use client'

import { useMemo } from 'react'
import { diff_match_patch } from 'diff-match-patch'
import { stripHtml } from '@/lib/utils'

interface DiffViewerProps {
  fromContent: string
  toContent: string
  fromLabel: string
  toLabel: string
}

export default function DiffViewer({ fromContent, toContent, fromLabel, toLabel }: DiffViewerProps) {
  const { html, stats } = useMemo(() => {
    const dmp = new diff_match_patch()
    const fromText = stripHtml(fromContent)
    const toText = stripHtml(toContent)
    const diffs = dmp.diff_main(fromText, toText)
    dmp.diff_cleanupSemantic(diffs)

    let additions = 0
    let deletions = 0
    let resultHtml = ''

    for (const [op, text] of diffs) {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')

      if (op === 1) {
        // Insertion
        additions += text.split(/\s+/).filter(Boolean).length
        resultHtml += `<span class="diff-added">${escaped}</span>`
      } else if (op === -1) {
        // Deletion
        deletions += text.split(/\s+/).filter(Boolean).length
        resultHtml += `<span class="diff-removed">${escaped}</span>`
      } else {
        // Equal
        resultHtml += escaped
      }
    }

    return { html: resultHtml, stats: { additions, deletions } }
  }, [fromContent, toContent])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-200 flex-wrap gap-2">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600 font-medium">{fromLabel}</span>
          <span className="text-slate-400">→</span>
          <span className="text-slate-600 font-medium">{toLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-medium">
          <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
            +{stats.additions} added
          </span>
          <span className="flex items-center gap-1 text-red-700 bg-red-100 px-2 py-1 rounded">
            −{stats.deletions} removed
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-6 py-2 bg-white border-b border-slate-100 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-emerald-200" />
          Added text
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-red-200" />
          Removed text (strikethrough)
        </span>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div
          className="max-w-3xl mx-auto text-sm leading-8 whitespace-pre-wrap font-sans"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  )
}
