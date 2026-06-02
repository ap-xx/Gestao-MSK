/**
 * Decodificador do número CNJ (NNNNNNN-DD.AAAA.J.TT.OOOO)
 *
 * Padrão Resolução CNJ nº 65/2008
 *   J = ramo da Justiça
 *   TT = tribunal (código do estado para Justiça Estadual)
 */

export interface CNJDecoded {
  sequencial: string; // NNNNNNN
  digitos:    string; // DD
  ano:        number; // AAAA
  justica:    number; // J  (1=STF, 2=CNJ, 3=STJ, 4=Federal, 5=Trabalhista, 6=Eleitoral, 7=Militar Estadual, 8=Estadual, 9=Militar União)
  tribunal:   number; // TT
  origem:     string; // OOOO
  tribunalAlias: string;
  tribunalNome:  string;
  areaAtuacao:   string; // suggested area based on justice branch
}

// ── Tribunal codes for Justiça Estadual (J=8) ─────────────────
const ESTADUAL_TT: Record<number, { alias: string; nome: string }> = {
   1: { alias: 'tjac',  nome: 'TJ Acre' },
   2: { alias: 'tjal',  nome: 'TJ Alagoas' },
   3: { alias: 'tjap',  nome: 'TJ Amapá' },
   4: { alias: 'tjam',  nome: 'TJ Amazonas' },
   5: { alias: 'tjba',  nome: 'TJ Bahia' },
   6: { alias: 'tjce',  nome: 'TJ Ceará' },
   7: { alias: 'tjdft', nome: 'TJ DF e Territórios' },
   8: { alias: 'tjes',  nome: 'TJ Espírito Santo' },
   9: { alias: 'tjgo',  nome: 'TJ Goiás' },
  10: { alias: 'tjma',  nome: 'TJ Maranhão' },
  11: { alias: 'tjmt',  nome: 'TJ Mato Grosso' },
  12: { alias: 'tjms',  nome: 'TJ Mato Grosso do Sul' },
  13: { alias: 'tjmg',  nome: 'TJ Minas Gerais' },
  14: { alias: 'tjpa',  nome: 'TJ Pará' },
  15: { alias: 'tjpb',  nome: 'TJ Paraíba' },
  16: { alias: 'tjpr',  nome: 'TJ Paraná' },
  17: { alias: 'tjpe',  nome: 'TJ Pernambuco' },
  18: { alias: 'tjpi',  nome: 'TJ Piauí' },
  19: { alias: 'tjrj',  nome: 'TJ Rio de Janeiro' },
  20: { alias: 'tjrn',  nome: 'TJ Rio Grande do Norte' },
  21: { alias: 'tjrs',  nome: 'TJ Rio Grande do Sul' },
  22: { alias: 'tjro',  nome: 'TJ Rondônia' },
  23: { alias: 'tjrr',  nome: 'TJ Roraima' },
  24: { alias: 'tjsc',  nome: 'TJ Santa Catarina' },
  25: { alias: 'tjsp',  nome: 'TJ São Paulo' },
  26: { alias: 'tjse',  nome: 'TJ Sergipe' },
  27: { alias: 'tjto',  nome: 'TJ Tocantins' },
};

// ── TRF codes for Justiça Federal (J=4) ──────────────────────
const FEDERAL_TT: Record<number, { alias: string; nome: string }> = {
  1: { alias: 'trf1', nome: 'TRF 1ª Região' },
  2: { alias: 'trf2', nome: 'TRF 2ª Região' },
  3: { alias: 'trf3', nome: 'TRF 3ª Região' },
  4: { alias: 'trf4', nome: 'TRF 4ª Região' },
  5: { alias: 'trf5', nome: 'TRF 5ª Região' },
  6: { alias: 'trf6', nome: 'TRF 6ª Região' },
};

// ── TRT codes for Justiça do Trabalho (J=5) ──────────────────
const TRABALHISTA_TT: Record<number, { alias: string; nome: string }> = {
   1: { alias: 'trt1',  nome: 'TRT 1ª Região (RJ)' },
   2: { alias: 'trt2',  nome: 'TRT 2ª Região (SP)' },
   3: { alias: 'trt3',  nome: 'TRT 3ª Região (MG)' },
   4: { alias: 'trt4',  nome: 'TRT 4ª Região (RS)' },
   5: { alias: 'trt5',  nome: 'TRT 5ª Região (BA)' },
   6: { alias: 'trt6',  nome: 'TRT 6ª Região (PE)' },
   7: { alias: 'trt7',  nome: 'TRT 7ª Região (CE)' },
   8: { alias: 'trt8',  nome: 'TRT 8ª Região (PA/AP)' },
   9: { alias: 'trt9',  nome: 'TRT 9ª Região (PR)' },
  10: { alias: 'trt10', nome: 'TRT 10ª Região (DF/TO)' },
  11: { alias: 'trt11', nome: 'TRT 11ª Região (AM/RR)' },
  12: { alias: 'trt12', nome: 'TRT 12ª Região (SC)' },
  13: { alias: 'trt13', nome: 'TRT 13ª Região (PB)' },
  14: { alias: 'trt14', nome: 'TRT 14ª Região (RO/AC)' },
  15: { alias: 'trt15', nome: 'TRT 15ª Região (Campinas)' },
  16: { alias: 'trt16', nome: 'TRT 16ª Região (MA)' },
  17: { alias: 'trt17', nome: 'TRT 17ª Região (ES)' },
  18: { alias: 'trt18', nome: 'TRT 18ª Região (GO)' },
  19: { alias: 'trt19', nome: 'TRT 19ª Região (AL)' },
  20: { alias: 'trt20', nome: 'TRT 20ª Região (SE)' },
  21: { alias: 'trt21', nome: 'TRT 21ª Região (RN)' },
  22: { alias: 'trt22', nome: 'TRT 22ª Região (PI)' },
  23: { alias: 'trt23', nome: 'TRT 23ª Região (MT)' },
  24: { alias: 'trt24', nome: 'TRT 24ª Região (MS)' },
};

const AREA_BY_JUSTICA: Record<number, string> = {
  4: 'Cível',        // Federal
  5: 'Trabalhista',  // Trabalhista
  6: 'Administrativo', // Eleitoral
  8: 'Cível',        // Estadual — default, user can change
};

/**
 * Decodes a CNJ process number and returns tribunal info + suggested area.
 * Returns null if the number has fewer than 20 digits (incomplete).
 */
export function parseCNJ(cnj: string): CNJDecoded | null {
  const d = cnj.replace(/\D/g, '');
  if (d.length !== 20) return null;

  const sequencial = d.slice(0,  7);
  const digitos    = d.slice(7,  9);
  const ano        = parseInt(d.slice(9,  13));
  const justica    = parseInt(d.slice(13, 14));
  const tribunal   = parseInt(d.slice(14, 16));
  const origem     = d.slice(16, 20);

  let tribunalAlias = '';
  let tribunalNome  = '';

  if (justica === 8) {
    const t = ESTADUAL_TT[tribunal];
    if (t) { tribunalAlias = t.alias; tribunalNome = t.nome; }
  } else if (justica === 4) {
    const t = FEDERAL_TT[tribunal];
    if (t) { tribunalAlias = t.alias; tribunalNome = t.nome; }
  } else if (justica === 5) {
    const t = TRABALHISTA_TT[tribunal];
    if (t) { tribunalAlias = t.alias; tribunalNome = t.nome; }
  } else if (justica === 3) {
    tribunalAlias = 'stj'; tribunalNome = 'Superior Tribunal de Justiça';
  } else if (justica === 1) {
    tribunalAlias = 'stf'; tribunalNome = 'Supremo Tribunal Federal';
  }

  return {
    sequencial, digitos, ano, justica, tribunal, origem,
    tribunalAlias,
    tribunalNome,
    areaAtuacao: AREA_BY_JUSTICA[justica] ?? 'Cível',
  };
}
