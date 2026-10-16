// ============================================================
// Geração de CSV (separador ";", aberto direto no Excel em pt-BR).
//
// Todo campo vai entre aspas, com aspas internas dobradas — sem isso, um ";"
// ou quebra de linha num nome de cliente desloca as colunas.
//
// Campos de TEXTO vindos do usuário (cliente, projeto, escopo, descrição)
// passam por neutralização de fórmula: célula que começa com = + - @ (ou TAB
// / CR) é interpretada como fórmula pelo Excel/Sheets (CSV injection). O
// prefixo ' faz a planilha tratá-la como texto. Números gerados pelo próprio
// app usam `campoNumero`, que não é neutralizado.
// ============================================================

const INICIO_DE_FORMULA = /^[=+\-@\t\r]/

const entreAspas = (valor: string) => `"${valor.replace(/"/g, '""')}"`

/** Texto livre (potencialmente digitado pelo usuário). */
export function campoTexto(valor: string | null | undefined): string {
  const texto = valor ?? ''
  return entreAspas(INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto)
}

/** Valor gerado pelo app (número já formatado, data, hora): só aspas. */
export function campoNumero(valor: string | null | undefined): string {
  return entreAspas(valor ?? '')
}

export const SEPARADOR_CSV = ';'

/** Linhas → conteúdo CSV com BOM UTF-8 (para o Excel reconhecer acentos). */
export function montarCsv(linhas: string[][]): string {
  return '﻿' + linhas.map((l) => l.join(SEPARADOR_CSV)).join('\r\n')
}
