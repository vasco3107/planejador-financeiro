import { formatBRL, formatPercent } from '@/domain/money'
import { formatDateBR } from '@/domain/period'
import { SEMANTIC } from '@/lib/colors'

export interface PdfSection {
  title: string
  head: string[]
  body: (string | number)[][]
  /** Índices de colunas numéricas (alinhadas à direita) */
  numeric?: number[]
  foot?: (string | number)[]
}

export interface PdfReport {
  title: string
  subtitle: string
  company: string
  summary: { label: string; cents?: number; text?: string; color?: string }[]
  sections: PdfSection[]
  filename: string
}

/** As fontes padrão do PDF usam WinAnsi: normaliza caracteres fora dela. */
const safe = (v: string | number) =>
  String(v).replace(/[  ]/g, ' ').replace(/[−–—]/g, '-').replace(/→/g, '>')

const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/** Gera o PDF sob demanda (a biblioteca só é baixada quando o usuário exporta). */
export async function exportPDF(r: PdfReport) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  const brand = hex(SEMANTIC.saldo)

  // Cabeçalho
  doc.setFillColor(...brand)
  doc.rect(0, 0, W, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(15, 23, 42)
  doc.text(safe(r.title), M, 48)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(safe(`${r.company} · ${r.subtitle}`), M, 66)
  doc.text(`Gerado em ${formatDateBR(new Date().toISOString().slice(0, 10))}`, W - M, 48, { align: 'right' })

  // Resumo em cartões
  let y = 88
  const cols = Math.min(4, r.summary.length)
  const gap = 8
  const cw = (W - M * 2 - gap * (cols - 1)) / cols
  r.summary.forEach((s, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = M + col * (cw + gap)
    const yy = y + row * 58
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(x, yy, cw, 50, 6, 6, 'FD')
    if (s.color) {
      doc.setFillColor(...hex(s.color))
      doc.circle(x + 12, yy + 15, 3, 'F')
    }
    doc.setFontSize(8.5)
    doc.setTextColor(100, 116, 139)
    doc.text(safe(s.label), x + (s.color ? 20 : 10), yy + 18)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12.5)
    doc.setTextColor(15, 23, 42)
    doc.text(safe(s.text ?? formatBRL(s.cents ?? 0)), x + 10, yy + 38)
    doc.setFont('helvetica', 'normal')
  })
  y += Math.ceil(r.summary.length / cols) * 58 + 12

  for (const s of r.sections) {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage()
      y = 48
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.text(safe(s.title), M, y)
    const columnStyles: Record<number, { halign: 'right' }> = {}
    for (const i of s.numeric ?? []) columnStyles[i] = { halign: 'right' }
    autoTable(doc, {
      startY: y + 8,
      head: [s.head],
      body: s.body.map((row) => row.map(safe)),
      foot: s.foot ? [s.foot.map(safe)] : undefined,
      margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.5 },
      headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [252, 253, 254] },
      columnStyles,
      didParseCell: (data) => {
        if ((data.section === 'head' || data.section === 'foot') && s.numeric?.includes(data.column.index)) {
          data.cell.styles.halign = 'right'
        }
      },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 28
  }

  // Rodapé com paginação
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(safe(`${r.company} · ${r.title}`), M, doc.internal.pageSize.getHeight() - 20)
    doc.text(`Página ${i} de ${pages}`, W - M, doc.internal.pageSize.getHeight() - 20, { align: 'right' })
  }
  doc.save(r.filename)
}

export const pct = (v: number | null) => formatPercent(v, 1)
