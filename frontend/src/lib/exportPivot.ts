import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCurrency } from './formatters'

export interface DiaDataExport {
  data: string
  entradas: number
  saidas: number
  acumulado: number
  saldo_anterior: number | null
}

export interface PivotExportData {
  diasData: DiaDataExport[]
  entradasByObra: Record<string, Record<string, number>>
  saidasByObra: Record<string, Record<string, number>>
  obrasEntrada: string[]
  obrasSaida: string[]
  necessidadeAporte: (number | null)[]
  empresaLabel: string
  periodoLabel: string
  saldoBancario: number | null
}

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(v: number | null): string {
  if (v === null || v === undefined) return ''
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

function buildHeaders(dias: DiaDataExport[]): string[] {
  return ['Rótulos de Linha', ...dias.map(d => d.data.slice(0, 5)), 'Total']
}

// Returns rows as { label, values, type }
function buildRowData(data: PivotExportData) {
  const { diasData, entradasByObra, saidasByObra, obrasEntrada, obrasSaida, necessidadeAporte } = data

  const rows: { label: string; cells: string[]; type: 'group-entrada' | 'group-saida' | 'sub' | 'saldo' | 'aporte' }[] = []

  // Entrada total
  const totEntrada = diasData.map(d => d.entradas)
  const sumEntrada = totEntrada.reduce((s, v) => s + v, 0)
  rows.push({
    label: '— Entrada',
    cells: [...totEntrada.map(v => v > 0 ? fmt(v) : ''), fmt(sumEntrada)],
    type: 'group-entrada',
  })

  // Entrada sub-obras
  for (const obra of obrasEntrada) {
    const byDate = entradasByObra[obra] ?? {}
    const vals = diasData.map(d => byDate[d.data] ?? 0)
    const total = vals.reduce((s, v) => s + v, 0)
    rows.push({
      label: `   ${obra}`,
      cells: [...vals.map(v => v > 0 ? fmt(v) : ''), fmt(total)],
      type: 'sub',
    })
  }

  // Saída total
  const totSaida = diasData.map(d => d.saidas)
  const sumSaida = totSaida.reduce((s, v) => s + v, 0)
  rows.push({
    label: '— Saída',
    cells: [...totSaida.map(v => v > 0 ? fmt(v) : ''), fmt(sumSaida)],
    type: 'group-saida',
  })

  // Saída sub-obras
  for (const obra of obrasSaida) {
    const byDate = saidasByObra[obra] ?? {}
    const vals = diasData.map(d => byDate[d.data] ?? 0)
    const total = vals.reduce((s, v) => s + v, 0)
    rows.push({
      label: `   ${obra}`,
      cells: [...vals.map(v => v > 0 ? fmt(v) : ''), fmt(total)],
      type: 'sub',
    })
  }

  // Saldo acumulado
  rows.push({
    label: 'Saldo Acumulado',
    cells: [...diasData.map(d => fmt(d.acumulado)), ''],
    type: 'saldo',
  })

  // Necessidade de aporte
  const totalAporte = necessidadeAporte.reduce((s: number, v) => s + (v ?? 0), 0)
  rows.push({
    label: 'Necessidade de Aporte',
    cells: [...necessidadeAporte.map(v => v !== null ? fmt(v) : ''), totalAporte !== 0 ? fmt(totalAporte) : ''],
    type: 'aporte',
  })

  return rows
}

// ─── PDF ────────────────────────────────────────────────────────────────────

// Colors matching the Excel screenshot
const COLOR_HEADER_BG: [number, number, number] = [64, 64, 64]
const COLOR_GROUP_BG: [number, number, number] = [244, 177, 131]   // salmon — Entrada/Saída
const COLOR_SUB_BG: [number, number, number] = [252, 228, 214]     // light peach — sub-obras
const COLOR_SALDO_BG: [number, number, number] = [242, 242, 242]   // light gray — Saldo
const COLOR_APORTE_BG: [number, number, number] = [252, 228, 214]  // same peach — Aporte
const COLOR_NEG: [number, number, number] = [192, 0, 0]            // red for negatives
const COLOR_WHITE: [number, number, number] = [255, 255, 255]
const COLOR_DARK: [number, number, number] = [30, 30, 30]

export function exportPivotPDF(data: PivotExportData): void {
  const { diasData, empresaLabel, periodoLabel, saldoBancario } = data
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const marginX = 8
  let y = 12

  // ── Header text ──
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 30, 30)
  doc.text(`FLUXO DE CAIXA DIÁRIO: ${empresaLabel}`, marginX, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`PERÍODO: ${periodoLabel}`, marginX, y)
  y += 5

  const saldoTxt = saldoBancario !== null ? formatCurrency(saldoBancario) : 'N/D'
  doc.text(`SALDO BANCÁRIO: ${saldoTxt}`, marginX, y)
  y += 8  // blank line

  // ── Build table data ──
  const headers = buildHeaders(diasData)
  const rowData = buildRowData(data)
  const bodyRows = rowData.map(r => [r.label, ...r.cells])

  // Dynamic column widths — always fits exactly within page width
  const pageW = 297 - marginX * 2
  const labelW = 32
  const totalW = 20
  const available = pageW - labelW - totalW
  const dateW = available / Math.max(diasData.length, 1)
  const fontSize = dateW < 14 ? 6 : 7
  const cellPad = dateW < 14 ? 1 : 1.5

  const colStyles: Record<number, object> = {
    0: { halign: 'left', cellWidth: labelW, fontStyle: 'bold' },
    [headers.length - 1]: { cellWidth: totalW, fontStyle: 'bold' },
  }
  for (let i = 1; i < headers.length - 1; i++) {
    colStyles[i] = { cellWidth: dateW }
  }

  autoTable(doc, {
    startY: y,
    head: [headers],
    body: bodyRows,
    theme: 'grid',
    tableWidth: pageW,
    margin: { left: marginX, right: marginX },
    styles: {
      fontSize,
      cellPadding: { top: cellPad, bottom: cellPad, left: cellPad, right: cellPad },
      halign: 'right',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: COLOR_HEADER_BG,
      textColor: COLOR_WHITE,
      fontStyle: 'bold',
      fontSize,
    },
    columnStyles: colStyles,
    didParseCell: (hookData) => {
      if (hookData.section !== 'body') return
      const row = rowData[hookData.row.index]
      if (!row) return

      // Background by row type
      if (row.type === 'group-entrada' || row.type === 'group-saida') {
        hookData.cell.styles.fillColor = COLOR_GROUP_BG
        hookData.cell.styles.textColor = COLOR_DARK
        hookData.cell.styles.fontStyle = 'bold'
      } else if (row.type === 'sub') {
        hookData.cell.styles.fillColor = COLOR_SUB_BG
        hookData.cell.styles.textColor = COLOR_DARK
      } else if (row.type === 'saldo') {
        hookData.cell.styles.fillColor = COLOR_SALDO_BG
        hookData.cell.styles.textColor = COLOR_DARK
        hookData.cell.styles.fontStyle = 'bold'
        // Red for negative values
        const raw = hookData.cell.raw as string
        if (raw && raw.startsWith('-')) {
          hookData.cell.styles.textColor = COLOR_NEG
        }
      } else if (row.type === 'aporte') {
        hookData.cell.styles.fillColor = COLOR_APORTE_BG
        hookData.cell.styles.textColor = COLOR_NEG
        hookData.cell.styles.fontStyle = 'bold'
      }
    },
  })

  doc.save(`fluxo_caixa_${empresaLabel.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
}

// ─── XLSX ───────────────────────────────────────────────────────────────────

export function exportPivotXLSX(data: PivotExportData): void {
  const { diasData, empresaLabel, periodoLabel, saldoBancario } = data

  const headers = buildHeaders(diasData)
  const rowData = buildRowData(data)

  const aoa: (string | number | null)[][] = [
    [`FLUXO DE CAIXA DIÁRIO: ${empresaLabel}`],
    [`PERÍODO: ${periodoLabel}`],
    [`SALDO BANCÁRIO: ${saldoBancario !== null ? formatCurrency(saldoBancario) : 'N/D'}`],
    [],
    headers,
    ...rowData.map(r => [r.label, ...r.cells]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Column widths
  ws['!cols'] = [
    { wch: 28 },                                           // label
    ...diasData.map(() => ({ wch: 16 })),                  // dates
    { wch: 18 },                                           // Total Geral
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Fluxo de Caixa')
  XLSX.writeFile(wb, `fluxo_caixa_${empresaLabel.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`)
}
