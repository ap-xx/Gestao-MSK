// ============================================================
// TIPOS GLOBAIS DO SISTEMA JURÍDICO MSK CONSULTATION
// ============================================================

export type UserRole = 'admin' | 'advogado' | 'assistente';

export interface User {
  id: string;
  nome: string;
  email: string;
  senha?: string; // usado apenas no fallback local
  role: UserRole;
  oab?: string;
  avatar?: string;
  ativo: boolean;
  criadoEm: string;
}

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export interface Escritorio {
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  site?: string;
  endereco: Endereco;
  logo?: string;
  oabPrincipal: string;
  responsavel: string;
  notificacoes: {
    emailAlertas: boolean;
    whatsappAlertas: boolean;
    prazosDias: number;
    inadimplenciaAuto: boolean;
  };
  /** Chave PIX para geração de cobranças estáticas */
  pixKey?: string;
  /** Tipo da chave PIX */
  pixKeyType?: PixKeyType;
}

export interface Endereco {
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export type TipoPessoa = 'PF' | 'PJ';
export type StatusCliente = 'ativo' | 'inativo' | 'bloqueado';

export interface Cliente {
  id: string;
  tipoPessoa: TipoPessoa;
  nome: string;
  cpf?: string;
  cnpj?: string;
  razaoSocial?: string;
  email: string;
  telefone: string;
  celular?: string;
  status: StatusCliente;
  endereco: Endereco;
  observacoes?: string;
  avaliacao?: number; // 0-5 estrelas
  criadoEm: string;
  atualizadoEm: string;
  // Dados extras PJ
  porte?: string;
  naturezaJuridica?: string;
  capitalSocial?: string;
  socios?: Array<{ nome: string; qualificacao: string }>;
}

export type TipoContrato = 'Mensal' | 'Êxito' | 'Misto' | 'Avulso' | 'Bônus';
export type StatusContrato = 'ativo' | 'encerrado' | 'suspenso' | 'negociando';

export type PeriodicidadeFaturamento =
  | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual' | 'unico';

export interface FaturamentoConfig {
  valor: number;
  periodicidade: PeriodicidadeFaturamento;
  /** Total de parcelas a gerar; 0 = recorrente / sem limite */
  parcelas: number;
  primeiroVencimento: string; // YYYY-MM-DD
  /** true quando os lançamentos já foram gerados para evitar duplicatas */
  lancamentosGerados?: boolean;
}

export interface Contrato {
  id: string;
  clienteId: string;
  clienteNome: string;
  tipo: TipoContrato;
  valorMensal?: number;
  percentualExito?: number;
  valorCausa?: number;
  /** Valor do bônus (type = 'Bônus') */
  valorBonus?: number;
  descricao: string;
  areaAtuacao: string;
  dataInicio: string;
  dataFim?: string;
  status: StatusContrato;
  observacoes?: string;
  /** Habilita geração automática de faturas */
  faturamento?: boolean;
  faturamentoConfig?: FaturamentoConfig;
  criadoEm: string;
}

// ─── Previsão de Honorários ───────────────────────────────────

export interface ContatoItem {
  id: string;
  tipo: 'email' | 'telefone' | 'celular';
  valor: string;
}

export type StatusPrevisao = 'ativo' | 'fechado' | 'perdido';

export interface PrevisaoHonorario {
  id: string;
  nome: string;
  tipoPessoa: 'PF' | 'PJ';
  cpf?: string;
  cnpj?: string;
  contatos: ContatoItem[];
  valorPrevisto?: number;
  observacoes?: string;
  status: StatusPrevisao;
  origem?: string; // indicação, site, etc.
  criadoEm: string;
  atualizadoEm: string;
}

export type FaseProcessual =
  | 'Inicial'
  | 'Conhecimento'
  | 'Instrução'
  | 'Sentença'
  | 'Recursal'
  | 'Execução'
  | 'Transitado em Julgado'
  | 'Arquivado';

export type PoloProcessual = 'Ativo' | 'Passivo' | 'Terceiro';

export interface Audiencia {
  data: string;
  hora: string;
  tipo: string;
  local: string;
  vara?: string;
}

export interface Andamento {
  id: string;
  tipo: 'petição' | 'decisão' | 'despacho' | 'certidão' | 'audiência' | 'recurso' | 'outro';
  descricao: string;
  data: string;
  usuarioNome: string;
  criadoEm: string;
}

export type StatusPrazo = 'pendente' | 'cumprido' | 'perdido';

export interface PrazoProcessual {
  id: string;
  tipo: string;           // contestação, recurso, embargos, etc.
  descricao?: string;
  dataBase: string;       // YYYY-MM-DD — data de início da contagem
  diasUteis: number;      // prazo em dias úteis
  dataFinal: string;      // YYYY-MM-DD — calculado em adicionarDiasUteis()
  status: StatusPrazo;
  criadoEm: string;
}

export interface Processo {
  id: string;
  numeroCNJ: string;
  clienteId: string;
  clienteNome: string;
  contratoId?: string;
  tribunal: string;
  tribunalAlias: string;
  vara: string;
  juiz?: string;
  areaAtuacao: string;
  fase: FaseProcessual;
  polo: PoloProcessual;
  parteAdversa: string;
  advogadoAdverso?: string;
  valorCausa?: number;
  audiencias: Audiencia[];
  proximaAudiencia?: string;
  ultimaMovimentacao?: string;
  status: 'ativo' | 'encerrado' | 'suspenso' | 'arquivado';
  observacoes?: string;
  /** Notas internas — visíveis só para usuários do sistema, não compõem andamento oficial */
  notas?: string;
  /** Prazos processuais controlados */
  prazos?: PrazoProcessual[];
  criadoEm: string;
  atualizadoEm: string;
  // Dados do DataJud
  dadosDataJud?: any;
  // Andamentos (movimentações)
  andamentos?: Andamento[];
}

export type TipoLancamento = 'recebimento' | 'a_receber' | 'despesa';
export type StatusPagamento = 'pago' | 'pendente' | 'vencido' | 'cancelado';

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  clienteId?: string;
  clienteNome?: string;
  processoId?: string;
  contratoId?: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  dataPagamento?: string;
  status: StatusPagamento;
  formaPagamento?: string;
  comprovante?: string;
  observacoes?: string;
  criadoEm: string;
  // Encargos financeiros
  jurosMensais?: number;   // % ao mês sobre o valor original após vencimento
  multaPorAtraso?: number; // % fixo aplicado no 1º dia de atraso
  desconto?: number;       // valor em R$ de desconto/cortesia
  motivoDesconto?: string; // justificativa do desconto
  // Parcelamento
  parcelaGrupoId?: string; // UUID compartilhado entre todas as parcelas do mesmo grupo
  parcelaAtual?: number;   // número da parcela (1-based)
  parcelasTotal?: number;  // total de parcelas do grupo
  // Recorrência
  recorrente?: boolean;
  recorrenciaFrequencia?: 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral';
  recorrenciaProximaData?: string; // data ISO — próxima geração automática
}

// ── Documentos emitidos ───────────────────────────────────────

export type StatusBoleto = 'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CANCELLED';

export interface BoletoRegistrado {
  id: string;
  asaasId?: string;
  clienteId?: string;
  clienteNome: string;
  valor: number;
  vencimento: string;
  descricao: string;
  status: StatusBoleto;
  bankSlipUrl?: string;
  invoiceUrl?: string;
  nossoNumero?: string;
  linhaDigitavel?: string;
  criadoEm: string;
}

export type StatusNF = 'Processing' | 'Issued' | 'Cancelled' | 'Error';

export interface NotaFiscalEmitida {
  id: string;
  nfeioId?: string;
  clienteId?: string;
  clienteNome: string;
  valor: number;
  descricao: string;
  status: StatusNF;
  pdfUrl?: string;
  xmlUrl?: string;
  numero?: string;
  codigoVerificacao?: string;
  criadoEm: string;
}

export type UrgenciaAviso = 'critica' | 'alta' | 'media' | 'baixa';
export type TipoAviso = 'prazo' | 'audiencia' | 'pagamento' | 'contrato' | 'sistema';

export interface Aviso {
  id: string;
  titulo: string;
  descricao: string;
  tipo: TipoAviso;
  urgencia: UrgenciaAviso;
  processoId?: string;
  clienteId?: string;
  lancamentoId?: string;
  dataLimite?: string;
  lido: boolean;
  criadoEm: string;
}

export interface KPI {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositivo?: boolean;
  icon: string;
  color: string;
}

export interface ChartData {
  mes: string;
  recebido: number;
  previsto: number;
}

// Tipos para APIs externas
export interface CNPJWsResponse {
  cnpj_raiz: string;
  razao_social: string;
  capital_social: string;
  responsavel_federativo: string;
  criado_em: string;
  atualizado_em: string;
  porte: { id: string; descricao: string };
  natureza_juridica: { id: string; descricao: string };
  qualificacao_do_responsavel: { id: string; descricao: string };
  socios: Array<{
    cpf_cnpj_socio: string;
    nome: string;
    tipo: string;
    data_entrada: string;
    cpf_representante_legal: string;
    nome_representante_legal: string;
    qualificacao_representante_legal: { id: string; descricao: string };
    qualificacao_socio: { id: string; descricao: string };
    faixa_etaria: string;
  }>;
  estabelecimento: {
    cnpj: string;
    atividade_principal: { id: string; descricao: string };
    tipo_logradouro: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cep: string;
    ddd1: string;
    telefone1: string;
    email: string;
    municipio: { id: string; descricao: string };
    estado: { id: string; sigla: string; descricao: string };
    situacao_cadastral: string;
    data_situacao_cadastral: string;
    motivo_situacao_cadastral: string;
  };
  simples?: {
    simples: string;
    data_opcao_simples: string;
    data_exclusao_simples: string;
    mei: string;
    data_opcao_mei: string;
    data_exclusao_mei: string;
  };
}

export interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  estado: string;
  regiao: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export interface DataJudHit {
  _source: {
    numeroProcesso: string;
    classe: { codigo: number; nome: string };
    sistema: { codigo: number; nome: string };
    formato: { codigo: number; nome: string };
    tribunal: string;
    dataHoraUltimaAtualizacao: string;
    grau: string;
    dataAjuizamento: string;
    movimentos: Array<{
      codigo: number;
      nome: string;
      dataHora: string;
    }>;
    orgaoJulgador: {
      codigo: number;
      nome: string;
      codigoMunicipioIBGE: number;
    };
    assuntos: Array<{ codigo: number; nome: string }>;
    partes?: Array<{
      nome: string;
      polo: string;
      advogados?: Array<{ nome: string; numeroDocumentoPrincipal: string }>;
    }>;
    valor?: { valor: number; moeda: string };
    nivelSigilo: number;
    id: string;
  };
}

export interface DataJudResponse {
  hits: {
    total: { value: number; relation: string };
    hits: DataJudHit[];
  };
}

// ── Licenças ──────────────────────────────────────────────────

/** License stored in this machine's localStorage */
export interface LocalLicense {
  machineId:   string;   // stable UUID-like ID for this browser/machine
  machineName: string;   // friendly name set on first activation
  licenseKey:  string;   // MSK-XXXX-XXXX-XXXX-XXXX
  activatedAt: string;   // ISO — first activation date
  lastLogin:   string;   // ISO — last time the app was accessed
  loginCount:  number;
  cidade?:     string;   // from IP geolocation (ipapi.co)
  uf?:         string;
  ip?:         string;
}

export type LicenseStatus = 'active' | 'revoked';

/** Registry entry stored on the admin's machine */
export interface LicenseRecord {
  id:          string;
  key:         string;            // MSK-XXXX-XXXX-XXXX-XXXX
  descricao?:  string;            // optional note, e.g. "PC Recepção"
  status:      LicenseStatus;
  criadoEm:    string;
  atualizadoEm: string;
  // Populated when the machine activates or syncs with server
  machineId?:  string;
  machineName?: string;
  cidade?:     string;
  uf?:         string;
  dbSizeKb?:   number;
  lastLogin?:  string;
  loginCount?: number;
  ip?:         string;
  activatedAt?: string;
}
