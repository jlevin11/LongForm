'use client'

import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { GitCommitHorizontal, PenLine, Eye, GitCompare } from 'lucide-react'
import type { ContractVersion, Profile } from '@/types'

export type TimelineView =
  | { type: 'draft' }
  | { type: 'version'; versionId: string }
  | { type: 'diff'; fromId: string; toId: string }

interface VersionTimelineProps {
  versions: (ContractVersion & { committer?: Profile })[]
  currentUserId: string
  hasDraft: boolean
  currentView: TimelineView
  onSelect: (view: TimelineView) => void
  onComparePick?: (versionId: string) => void
  comparingFrom?: string | null
}

export default function VersionTimeline({
  versions,
  currentUserId,
  hasDraft,
  currentView,
  onSelect,
  onComparePick,
  comparingFrom,
}: VersionTimelineProps) {
  const sorted = [...versions].sort((a, b) => b.version_number - a.version_number)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Version History
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Draft */}
        {hasDraft && (
          <button
            onClick={() => onSelect({ type: 'draft' })}
            className={cn(
              'w-full text-left px-4 py-3 border-b border-slate-100 transition-colors hover:bg-slate-50',
              currentView.type === 'draft' && 'bg-blue-50 border-l-2 border-l-blue-500'
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <PenLine className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-600">Draft (unpublished)</span>
            </div>
            <p className="text-xs text-slate-400 pl-5">Your private working copy</p>
          </button>
        )}

        {/* Versions */}
        {sorted.length === 0 && !hasDraft && (
          <div className="px-4 py-8 text-center text-xs text-slate-400">
            No committed versions yet
          </div>
        )}

        {sorted.map((version, idx) => {
          const isSelected =
            currentView.type === 'version' && currentView.versionId === version.id
          const isCompareFrom = comparingFrom === version.id
          const isMyVersion = version.committed_by === currentUserId

          return (
            <div
              key={version.id}
              className={cn(
                'border-b border-slate-100',
                isSelected && 'bg-blue-50 border-l-2 border-l-blue-500',
                isCompareFrom && 'bg-amber-50 border-l-2 border-l-amber-400'
              )}
            >
              <button
                onClick={() => {
                  if (comparingFrom && comparingFrom !== version.id) {
                    onSelect({ type: 'diff', fromId: comparingFrom, toId: version.id })
                    onComparePick?.(version.id)
                  } else {
                    onSelect({ type: 'version', versionId: version.id })
                  }
                }}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <GitCommitHorizontal
                    className={cn(
                      'h-3.5 w-3.5 flex-shrink-0',
                      isMyVersion ? 'text-[#1e3a5f]' : 'text-emerald-600'
                    )}
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    v{version.version_number}
                  </span>
                  {idx === 0 && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 font-medium">
                      latest
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 pl-5 mb-1">
                  {version.committer?.full_name ?? 'Unknown'}
                  {version.committer?.firm_name ? ` · ${version.committer.firm_name}` : ''}
                </p>
                {version.commit_message && (
                  <p className="text-xs text-slate-400 pl-5 italic truncate">
                    &ldquo;{version.commit_message}&rdquo;
                  </p>
                )}
                <p className="text-xs text-slate-400 pl-5 mt-1">
                  {formatDate(version.committed_at)}
                </p>
              </button>

              {/* Compare button */}
              {!comparingFrom && sorted.length > 1 && (
                <button
                  onClick={() => onComparePick?.(version.id)}
                  title="Compare from this version"
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#1e3a5f] pl-9 pb-2 transition-colors"
                >
                  <GitCompare className="h-3 w-3" />
                  Compare from here
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* View mode legend */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Eye className="h-3 w-3" />
          Click version to view
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <GitCompare className="h-3 w-3" />
          &ldquo;Compare from here&rdquo; then click another
        </div>
      </div>
    </div>
  )
}
