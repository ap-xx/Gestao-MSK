// ============================================================
// SERVIÇOS DE API EXTERNA — MSK CONSULTATION
// CNPJ.ws | ViaCEP | DataJud CNJ
// ============================================================

import type { CNPJWsResponse, ViaCEPResponse, DataJudResponse } from '../types';

// ─── CNPJ.ws ─────────────────────────────────────────────────
export async function consultarCNPJ(cnpj: string): Promise<CNPJWsResponse> {
  const cnpjNumeros = cnpj.replace(/\D/g, '');
  if (cnpjNumeros.length !== 14) throw new Error('CNPJ inválido');

  const response = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjNumeros}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error('CNPJ não encontrado na base de dados.');
    if (response.status === 429) throw new Error('Muitas requisições. Aguarde alguns segundos e tente novamente.');
    throw new Error(`Erro ao consultar CNPJ: ${response.statusText}`);
  }
  return response.json();
}

// ─── ViaCEP ───────────────────────────────────────────────────
export async function consultarCEP(cep: string): Promise<ViaCEPResponse> {
  const cepNumeros = cep.replace(/\D/g, '');
  if (cepNumeros.length !== 8) throw new Error('CEP inválido');

  const response = await fetch(`https://viacep.com.br/ws/${cepNumeros}/json/`);
  if (!response.ok) throw new Error(`Erro ao consultar CEP: ${response.statusText}`);

  const data: ViaCEPResponse = await response.json();
  if (data.erro) throw new Error('CEP não encontrado.');
  return data;
}

// ─── DataJud CNJ ──────────────────────────────────────────────
const DATAJUD_API_KEY =
  (import.meta.env?.VITE_DATAJUD_API_KEY as string) ??
  'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

export const TRIBUNAIS: Record<string, { nome: string; url: string }> = {
  // Superiores
  tst:   { nome: 'Tribunal Superior do Trabalho', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tst/_search' },
  tse:   { nome: 'Tribunal Superior Eleitoral', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tse/_search' },
  stj:   { nome: 'Superior Tribunal de Justiça', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_stj/_search' },
  stm:   { nome: 'Superior Tribunal Militar', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_stm/_search' },
  // Federal
  trf1:  { nome: 'TRF 1ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trf1/_search' },
  trf2:  { nome: 'TRF 2ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trf2/_search' },
  trf3:  { nome: 'TRF 3ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trf3/_search' },
  trf4:  { nome: 'TRF 4ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trf4/_search' },
  trf5:  { nome: 'TRF 5ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trf5/_search' },
  trf6:  { nome: 'TRF 6ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trf6/_search' },
  // Estadual
  tjac:  { nome: 'TJ Acre', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjac/_search' },
  tjal:  { nome: 'TJ Alagoas', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjal/_search' },
  tjam:  { nome: 'TJ Amazonas', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjam/_search' },
  tjap:  { nome: 'TJ Amapá', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjap/_search' },
  tjba:  { nome: 'TJ Bahia', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjba/_search' },
  tjce:  { nome: 'TJ Ceará', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjce/_search' },
  tjdft: { nome: 'TJ DF e Territórios', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjdft/_search' },
  tjes:  { nome: 'TJ Espírito Santo', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjes/_search' },
  tjgo:  { nome: 'TJ Goiás', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjgo/_search' },
  tjma:  { nome: 'TJ Maranhão', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjma/_search' },
  tjmg:  { nome: 'TJ Minas Gerais', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjmg/_search' },
  tjms:  { nome: 'TJ Mato Grosso do Sul', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjms/_search' },
  tjmt:  { nome: 'TJ Mato Grosso', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjmt/_search' },
  tjpa:  { nome: 'TJ Pará', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjpa/_search' },
  tjpb:  { nome: 'TJ Paraíba', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjpb/_search' },
  tjpe:  { nome: 'TJ Pernambuco', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjpe/_search' },
  tjpi:  { nome: 'TJ Piauí', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjpi/_search' },
  tjpr:  { nome: 'TJ Paraná', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjpr/_search' },
  tjrj:  { nome: 'TJ Rio de Janeiro', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjrj/_search' },
  tjrn:  { nome: 'TJ Rio Grande do Norte', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjrn/_search' },
  tjro:  { nome: 'TJ Rondônia', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjro/_search' },
  tjrr:  { nome: 'TJ Roraima', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjrr/_search' },
  tjrs:  { nome: 'TJ Rio Grande do Sul', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjrs/_search' },
  tjsc:  { nome: 'TJ Santa Catarina', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsc/_search' },
  tjse:  { nome: 'TJ Sergipe', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjse/_search' },
  tjsp:  { nome: 'TJ São Paulo', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search' },
  tjto:  { nome: 'TJ Tocantins', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjto/_search' },
  // Trabalho
  trt1:  { nome: 'TRT 1ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt1/_search' },
  trt2:  { nome: 'TRT 2ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt2/_search' },
  trt3:  { nome: 'TRT 3ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt3/_search' },
  trt4:  { nome: 'TRT 4ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt4/_search' },
  trt5:  { nome: 'TRT 5ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt5/_search' },
  trt6:  { nome: 'TRT 6ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt6/_search' },
  trt7:  { nome: 'TRT 7ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt7/_search' },
  trt8:  { nome: 'TRT 8ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt8/_search' },
  trt9:  { nome: 'TRT 9ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt9/_search' },
  trt10: { nome: 'TRT 10ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt10/_search' },
  trt11: { nome: 'TRT 11ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt11/_search' },
  trt12: { nome: 'TRT 12ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt12/_search' },
  trt13: { nome: 'TRT 13ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt13/_search' },
  trt14: { nome: 'TRT 14ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt14/_search' },
  trt15: { nome: 'TRT 15ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt15/_search' },
  trt16: { nome: 'TRT 16ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt16/_search' },
  trt17: { nome: 'TRT 17ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt17/_search' },
  trt18: { nome: 'TRT 18ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt18/_search' },
  trt19: { nome: 'TRT 19ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt19/_search' },
  trt20: { nome: 'TRT 20ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt20/_search' },
  trt21: { nome: 'TRT 21ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt21/_search' },
  trt22: { nome: 'TRT 22ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt22/_search' },
  trt23: { nome: 'TRT 23ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt23/_search' },
  trt24: { nome: 'TRT 24ª Região', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_trt24/_search' },
  // Eleitoral
  treac: { nome: 'TRE Acre', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-ac/_search' },
  treal: { nome: 'TRE Alagoas', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-al/_search' },
  tream: { nome: 'TRE Amazonas', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-am/_search' },
  treap: { nome: 'TRE Amapá', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-ap/_search' },
  treba: { nome: 'TRE Bahia', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-ba/_search' },
  trece: { nome: 'TRE Ceará', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-ce/_search' },
  tredf: { nome: 'TRE Distrito Federal', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-dft/_search' },
  trees: { nome: 'TRE Espírito Santo', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-es/_search' },
  trego: { nome: 'TRE Goiás', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-go/_search' },
  trema: { nome: 'TRE Maranhão', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-ma/_search' },
  tremg: { nome: 'TRE Minas Gerais', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-mg/_search' },
  trems: { nome: 'TRE Mato Grosso do Sul', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-ms/_search' },
  tremt: { nome: 'TRE Mato Grosso', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-mt/_search' },
  trepa: { nome: 'TRE Pará', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-pa/_search' },
  trepb: { nome: 'TRE Paraíba', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-pb/_search' },
  trepe: { nome: 'TRE Pernambuco', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-pe/_search' },
  trepi: { nome: 'TRE Piauí', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-pi/_search' },
  trepr: { nome: 'TRE Paraná', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-pr/_search' },
  trerj: { nome: 'TRE Rio de Janeiro', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-rj/_search' },
  trern: { nome: 'TRE Rio Grande do Norte', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-rn/_search' },
  trero: { nome: 'TRE Rondônia', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-ro/_search' },
  trerr: { nome: 'TRE Roraima', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-rr/_search' },
  trers: { nome: 'TRE Rio Grande do Sul', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-rs/_search' },
  tresc: { nome: 'TRE Santa Catarina', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-sc/_search' },
  trese: { nome: 'TRE Sergipe', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-se/_search' },
  tresp: { nome: 'TRE São Paulo', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-sp/_search' },
  treto: { nome: 'TRE Tocantins', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tre-to/_search' },
  // Militar
  tjmmg: { nome: 'TJM Minas Gerais', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjmmg/_search' },
  tjmrs: { nome: 'TJM Rio Grande do Sul', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjmrs/_search' },
  tjmsp: { nome: 'TJM São Paulo', url: 'https://api-publica.datajud.cnj.jus.br/api_publica_tjmsp/_search' },
};

export async function consultarProcessoDataJud(
  numeroCNJ: string,
  tribunalAlias: string
): Promise<DataJudResponse> {
  const tribunal = TRIBUNAIS[tribunalAlias];
  if (!tribunal) throw new Error(`Tribunal '${tribunalAlias}' não encontrado.`);

  // Use term query on the keyword sub-field for exact CNJ number matching.
  // Falls back to a match query so older indices without .keyword still work.
  const body = {
    query: {
      bool: {
        should: [
          { term: { 'numeroProcesso.keyword': numeroCNJ } },
          { match: { numeroProcesso: numeroCNJ } },
        ],
        minimum_should_match: 1,
      },
    },
  };

  const response = await fetch(tribunal.url, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${DATAJUD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Erro ao consultar DataJud: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function buscarProcessosPorCliente(
  nomeOuCPF: string,
  tribunalAlias: string
): Promise<DataJudResponse> {
  const tribunal = TRIBUNAIS[tribunalAlias];
  if (!tribunal) throw new Error(`Tribunal '${tribunalAlias}' não encontrado.`);

  const body = {
    query: {
      multi_match: {
        query: nomeOuCPF,
        fields: ['partes.nome', 'partes.cpf_cnpj'],
      },
    },
    size: 10,
  };

  const response = await fetch(tribunal.url, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${DATAJUD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar processos: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ─── Helpers ──────────────────────────────────────────────────
export function formatCNPJ(cnpj: string): string {
  const n = cnpj.replace(/\D/g, '');
  return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function formatCPF(cpf: string): string {
  const n = cpf.replace(/\D/g, '');
  return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatCEP(cep: string): string {
  const n = cep.replace(/\D/g, '');
  return n.replace(/(\d{5})(\d{3})/, '$1-$2');
}

export function formatTelefone(tel: string): string {
  const n = tel.replace(/\D/g, '');
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return tel;
}

export function validarCNPJ(cnpj: string): boolean {
  const n = cnpj.replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const calc = (digits: string, weights: number[]): number => {
    const sum = digits.split('').reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const d1 = calc(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== parseInt(n[12])) return false;
  const d2 = calc(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d2 === parseInt(n[13]);
}

export function validarCPF(cpf: string): boolean {
  const n = cpf.replace(/\D/g, '');
  if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(n[i]) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(n[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(n[i]) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(n[10]);
}
