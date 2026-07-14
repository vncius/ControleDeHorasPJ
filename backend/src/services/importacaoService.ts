import { v4 as uuid } from 'uuid'
import { lancamentosRepo, projetosRepo } from '../repositories'
import {
  LinhaImportacao,
  LancamentoHoras,
  StatusLinhaImportacao,
} from '../types'
import { calcularDiferenca, agora, isHoraValida } from '../utils/tempo'

// ── constantes ──────────────────────────────────────────────────

const MESES: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04',
  mai: '05', jun: '06', jul: '07', ago: '08',
  set: '09', out: '10', nov: '11', dez: '12',
}

const TOLERANCIA_DECIMAL = 0.02

// ── helpers ─────────────────────────────────────────────────────

function parsearData(texto: string, ano: number): string | null {
  // "sex, 01/mai" → "2026-05-01"
  const match = texto.trim().match(/\d{1,2}\/(\w{3})/)
  if (!match) return null
  const [, mesStr] = match
  const mes = MESES[mesStr.toLowerCase()]
  if (!mes) return null
  const diaMatch = texto.match(/(\d{1,2})\//)
  if (!diaMatch) return null
  const dia = diaMatch[1].padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function parsearDecimal(texto: string): number | null {
  // aceita "2,65" ou "2.65"
  const limpo = texto.trim().replace(',', '.')
  const n = parseFloat(limpo)
  return isNaN(n) ? null : n
}

function isHHMM(texto: string): boolean {
  return /^\d{2}:\d{2}$/.test(texto.trim())
}

// ── parser principal ─────────────────────────────────────────────

export function parsearLinhas(texto: string, ano: number): LinhaImportacao[] {
  const linhas = texto.split('\n')
  const resultado: LinhaImportacao[] = []
  let indice = 0

  for (const linha of linhas) {
    const limpa = linha.trim()
    if (!limpa) continue // ignora vazias

    indice++
    const entry: LinhaImportacao = {
      indice,
      textoOriginal: limpa,
      status: 'valida',
    }

    // split por TAB
    const colunas = limpa.split('\t').map(c => c.trim())

    if (colunas.length < 5) {
      entry.status = 'erro'
      entry.mensagem = `Esperado pelo menos 5 colunas, encontrado ${colunas.length}`
      resultado.push(entry)
      continue
    }

    const [colData, colDesc, colInicio, colFim, colHHMM, colDecimal] = colunas

    // ── data ──
    const data = parsearData(colData, ano)
    if (!data) {
      entry.status = 'erro'
      entry.mensagem = `Data inválida: "${colData}". Use formato "sex, 01/mai"`
      resultado.push(entry)
      continue
    }
    entry.data = data

    // ── descrição ──
    entry.descricao = colDesc?.trim() ?? ''
    const avisos: string[] = []
    if (!entry.descricao) avisos.push('Descrição vazia')

    // ── hora início ──
    if (!isHoraValida(colInicio)) {
      entry.status = 'erro'
      entry.mensagem = `Hora início inválida: "${colInicio}"`
      resultado.push(entry)
      continue
    }
    entry.horaInicio = colInicio

    // ── hora fim ──
    if (!isHoraValida(colFim)) {
      entry.status = 'erro'
      entry.mensagem = `Hora fim inválida: "${colFim}"`
      resultado.push(entry)
      continue
    }
    entry.horaFim = colFim

    // ── diferença calculada ──
    const diff = calcularDiferenca(colInicio, colFim)
    if (!diff) {
      entry.status = 'erro'
      entry.mensagem = `Hora fim (${colFim}) anterior à hora início (${colInicio})`
      resultado.push(entry)
      continue
    }
    entry.totalHHMMCalculado = diff.hhMM
    entry.totalDecimalCalculado = diff.decimal

    // ── total hh:mm informado ──
    if (colHHMM) {
      if (!isHHMM(colHHMM)) {
        avisos.push(`Total HH:MM informado inválido: "${colHHMM}"`)
      } else {
        entry.totalHHMMInformado = colHHMM
        if (colHHMM !== diff.hhMM) {
          avisos.push(`Total HH:MM informado (${colHHMM}) difere do calculado (${diff.hhMM})`)
        }
      }
    }

    // ── total decimal informado ──
    if (colDecimal) {
      const dec = parsearDecimal(colDecimal)
      if (dec === null) {
        avisos.push(`Total decimal informado inválido: "${colDecimal}"`)
      } else {
        entry.totalDecimalInformado = dec
        const diferenca = Math.abs(dec - diff.decimal)
        if (diferenca > TOLERANCIA_DECIMAL) {
          avisos.push(
            `Total decimal informado (${dec}) difere do calculado (${diff.decimal}) em ${diferenca.toFixed(2)}`
          )
        }
      }
    }

    if (avisos.length > 0) {
      entry.status = 'aviso'
      entry.mensagem = avisos.join(' | ')
    }

    resultado.push(entry)
  }

  return resultado
}

// ── confirmação ──────────────────────────────────────────────────

export const importacaoService = {
  preview(texto: string, ano: number): LinhaImportacao[] {
    return parsearLinhas(texto, ano)
  },

  async confirmar(tenantId: string, projetoId: string, linhas: LinhaImportacao[]): Promise<LancamentoHoras[]> {
    if (!(await projetosRepo.existsForTenant(projetoId, tenantId))) {
      throw new Error('Projeto não encontrado')
    }

    // importa apenas linhas válidas e com aviso
    const importaveis = linhas.filter(
      l => l.status !== 'erro' && l.data && l.horaInicio && l.horaFim
    )

    const agr = agora()
    const criados: LancamentoHoras[] = []

    for (const linha of importaveis) {
      const diff = calcularDiferenca(linha.horaInicio!, linha.horaFim!)
      if (!diff) continue

      const lancamento: LancamentoHoras = {
        id: uuid(),
        tenantId,
        projetoId,
        data: linha.data!,
        horaInicio: linha.horaInicio!,
        horaFim: linha.horaFim!,
        totalHHMM: diff.hhMM,
        totalDecimal: diff.decimal,
        descricao: linha.descricao ?? '',
        tipo: 'Importado',
        dataCriacao: agr,
        dataAtualizacao: agr,
      }

      await lancamentosRepo.create(lancamento)
      criados.push(lancamento)
    }

    return criados
  },
}
