'use client'

import { jsPDF } from 'jspdf'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import { saveAs } from 'file-saver'
import { stripHtml, formatDate } from '@/lib/utils'
import type { ContractVersion, Negotiation, Profile } from '@/types'

function htmlToPlainParagraphs(html: string): string[] {
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function exportVersionToPDF(
  negotiation: Negotiation,
  content: string,
  versionLabel: string
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 20
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Header
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text('CONTRACT GIT', margin, y)
  doc.text(formatDate(new Date().toISOString()), pageWidth - margin, y, { align: 'right' })
  y += 6

  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Title
  doc.setFontSize(16)
  doc.setTextColor(30)
  doc.setFont('helvetica', 'bold')
  const titleLines = doc.splitTextToSize(negotiation.title, contentWidth) as string[]
  doc.text(titleLines, margin, y)
  y += titleLines.length * 8 + 4

  // Version label
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80)
  doc.text(`${versionLabel}`, margin, y)
  y += 10

  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Content
  doc.setFontSize(11)
  doc.setTextColor(30)
  doc.setFont('helvetica', 'normal')

  const paragraphs = htmlToPlainParagraphs(content)
  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para, contentWidth) as string[]
    if (y + lines.length * 6 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(lines, margin, y)
    y += lines.length * 6 + 4
  }

  const filename = `${negotiation.title.replace(/\s+/g, '-')}-${versionLabel}.pdf`
  doc.save(filename)
}

export async function exportVersionToWord(
  negotiation: Negotiation,
  content: string,
  versionLabel: string
): Promise<void> {
  const paragraphs = htmlToPlainParagraphs(content)

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: negotiation.title,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${versionLabel} — ${formatDate(new Date().toISOString())}`,
                color: '888888',
                size: 20,
              }),
            ],
          }),
          new Paragraph({ text: '' }),
          ...paragraphs.map(
            (text) =>
              new Paragraph({
                children: [new TextRun({ text, size: 24 })],
                alignment: AlignmentType.JUSTIFIED,
              })
          ),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `${negotiation.title.replace(/\s+/g, '-')}-${versionLabel}.docx`
  saveAs(blob, filename)
}

export function exportHistoryToPDF(
  negotiation: Negotiation & { creator?: Profile; counterparty?: Profile | null },
  versions: { version: ContractVersion & { committer?: Profile }; content: string }[]
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 20
  const pageWidth = doc.internal.pageSize.getWidth()
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const newPage = () => {
    doc.addPage()
    y = margin
  }

  const checkSpace = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) newPage()
  }

  // Cover page
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text('CONTRACT GIT — NEGOTIATION HISTORY', margin, y)
  doc.text(formatDate(new Date().toISOString()), pageWidth - margin, y, { align: 'right' })
  y += 6

  doc.setDrawColor(200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(20)
  const titleLines = doc.splitTextToSize(negotiation.title, contentWidth) as string[]
  doc.text(titleLines, margin, y)
  y += titleLines.length * 9 + 6

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80)

  if (negotiation.creator) {
    doc.text(`Party A: ${negotiation.creator.full_name}${negotiation.creator.firm_name ? ' · ' + negotiation.creator.firm_name : ''}`, margin, y)
    y += 6
  }
  if (negotiation.counterparty) {
    doc.text(`Party B: ${negotiation.counterparty.full_name}${negotiation.counterparty.firm_name ? ' · ' + negotiation.counterparty.firm_name : ''}`, margin, y)
    y += 6
  }

  y += 4
  doc.text(`Total versions: ${versions.length}`, margin, y)
  y += 6
  doc.text(`Exported: ${formatDate(new Date().toISOString())}`, margin, y)
  y += 10

  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  doc.setFontSize(9)
  doc.setTextColor(120)
  doc.text(
    'This document is an immutable record of the negotiation history exported from LongForm.',
    margin,
    y
  )

  // Versions
  for (const { version, content } of versions) {
    newPage()

    // Version header
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20)
    doc.text(`Version ${version.version_number}`, margin, y)
    y += 7

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80)
    doc.text(
      `Committed by: ${version.committer?.full_name ?? 'Unknown'}${version.committer?.firm_name ? ' · ' + version.committer.firm_name : ''}`,
      margin,
      y
    )
    y += 5
    doc.text(`Date: ${formatDate(version.committed_at)}`, margin, y)
    y += 5
    if (version.commit_message) {
      doc.text(`Note: "${version.commit_message}"`, margin, y)
      y += 5
    }
    if (version.word_count) {
      doc.text(`Words: ${version.word_count}`, margin, y)
      y += 5
    }

    y += 3
    doc.setDrawColor(220)
    doc.line(margin, y, pageWidth - margin, y)
    y += 6

    // Version content
    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30)

    const paragraphs = htmlToPlainParagraphs(content)
    for (const para of paragraphs) {
      const lines = doc.splitTextToSize(para, contentWidth) as string[]
      checkSpace(lines.length * 5.5 + 3)
      doc.text(lines, margin, y)
      y += lines.length * 5.5 + 3
    }
  }

  const filename = `${negotiation.title.replace(/\s+/g, '-')}-negotiation-history.pdf`
  doc.save(filename)
}
