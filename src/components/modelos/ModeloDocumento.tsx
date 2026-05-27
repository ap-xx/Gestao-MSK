import React from 'react';
import { X, Printer } from 'lucide-react';

export type TipoModelo = 'procuracao' | 'contrato_honorarios' | 'declaracao';

export interface ModeloDados {
  clienteNome: string;
  clienteCpf?: string;
  clienteCnpj?: string;
  advogadoNome: string;
  advogadoOAB: string;
  escritorioNome: string;
  cidade?: string;
}

export interface ModeloDocumentoProps {
  open: boolean;
  onClose: () => void;
  tipo: TipoModelo;
  dados: ModeloDados;
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

function dataFormatada(cidade?: string): string {
  const now = new Date();
  const d = now.getDate();
  const m = MESES[now.getMonth()];
  const a = now.getFullYear();
  return `${cidade ?? 'São Paulo'}, ${d} de ${m} de ${a}`;
}

function TituloPorTipo(tipo: TipoModelo): string {
  switch (tipo) {
    case 'procuracao':          return 'PROCURAÇÃO AD JUDICIA ET EXTRA';
    case 'contrato_honorarios': return 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS';
    case 'declaracao':          return 'DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA';
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

function ProcuracaoTemplate({ dados }: { dados: ModeloDados }) {
  const documentoCliente = dados.clienteCpf
    ? `CPF nº ${dados.clienteCpf}`
    : dados.clienteCnpj
    ? `CNPJ nº ${dados.clienteCnpj}`
    : 'documento não informado';

  return (
    <div className="doc-print" style={docStyle}>
      <h1 style={h1Style}>PROCURAÇÃO AD JUDICIA ET EXTRA</h1>

      <p style={paraStyle}>
        <strong>OUTORGANTE:</strong> {dados.clienteNome}, portador(a) do {documentoCliente},
        doravante denominado(a) simplesmente OUTORGANTE.
      </p>

      <p style={paraStyle}>
        <strong>OUTORGADO:</strong> {dados.advogadoNome}, advogado(a) inscrito(a) na Ordem dos
        Advogados do Brasil — {dados.advogadoOAB}, com escritório em {dados.escritorioNome},
        doravante denominado(a) OUTORGADO.
      </p>

      <p style={paraStyle}>
        Pelo presente instrumento particular de mandato, o OUTORGANTE constitui e nomeia o
        OUTORGADO como seu bastante procurador, ao(à) qual confere amplos, gerais e ilimitados
        poderes para o foro em geral, em qualquer Juízo, Instância ou Tribunal, podendo propor
        contra quem de direito as ações competentes e defendê-lo nas contrárias, seguindo-as em
        todos os seus termos até final decisão; usar dos recursos cabíveis; interpor agravos,
        apelações e recursos em geral; requerer, alegar e assinar o que for necessário ao fiel
        desempenho deste mandato.
      </p>

      <p style={paraStyle}>
        Outrossim, ficam conferidos os poderes da cláusula <em>ad judicia et extra</em>, incluindo
        os poderes especiais para: confessar, desistir, transigir, firmar compromissos ou acordos,
        receber e dar quitação, agir em juízos arbitrais, assinar declarações de hipossuficiência,
        receber citação, intimação, notificação e reconvir.
      </p>

      <p style={paraStyle}>
        <strong>Substabelecimento:</strong> Fica vedado o substabelecimento deste mandato sem
        prévia e expressa autorização do OUTORGANTE.
      </p>

      <p style={{ ...paraStyle, marginTop: '40px' }}>{dataFormatada(dados.cidade)}</p>

      <div style={assinaturaStyle}>
        <div style={assinaturaLinhaStyle}>
          <div style={linhaStyle} />
          <p style={assinaturaNomeStyle}>{dados.clienteNome}</p>
          <p style={assinaturaCargoStyle}>Outorgante</p>
        </div>
        <div style={assinaturaLinhaStyle}>
          <div style={linhaStyle} />
          <p style={assinaturaNomeStyle}>{dados.advogadoNome}</p>
          <p style={assinaturaCargoStyle}>Outorgado — {dados.advogadoOAB}</p>
        </div>
      </div>
    </div>
  );
}

function ContratoHonorariosTemplate({ dados }: { dados: ModeloDados }) {
  const documentoCliente = dados.clienteCpf
    ? `CPF nº ${dados.clienteCpf}`
    : dados.clienteCnpj
    ? `CNPJ nº ${dados.clienteCnpj}`
    : 'documento não informado';

  return (
    <div className="doc-print" style={docStyle}>
      <h1 style={h1Style}>CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</h1>

      <p style={paraStyle}>
        As partes abaixo qualificadas, de um lado <strong>CONTRATANTE</strong>:{' '}
        {dados.clienteNome}, {documentoCliente}; e de outro lado{' '}
        <strong>CONTRATADO(A)</strong>: {dados.advogadoNome}, advogado(a) inscrito(a) na OAB sob
        o nº {dados.advogadoOAB}, atuante pelo escritório {dados.escritorioNome}; têm entre si
        justo e contratado o seguinte:
      </p>

      <h2 style={h2Style}>CLÁUSULA 1ª — DO OBJETO</h2>
      <p style={paraStyle}>
        O presente contrato tem por objeto a prestação de serviços jurídicos pelo CONTRATADO(A)
        ao CONTRATANTE, compreendendo assessoria jurídica, consultoria, elaboração de documentos
        e representação judicial e extrajudicial, conforme escopo acordado entre as partes.
      </p>

      <h2 style={h2Style}>CLÁUSULA 2ª — DOS HONORÁRIOS</h2>
      <p style={paraStyle}>
        Os honorários advocatícios serão fixados conforme tabela de honorários da OAB e acordo
        prévio entre as partes, devendo ser pagos nas datas e condições estabelecidas no
        instrumento de proposta de honorários apresentada ao CONTRATANTE, que passa a integrar
        o presente contrato.
      </p>

      <h2 style={h2Style}>CLÁUSULA 3ª — DAS OBRIGAÇÕES DO CONTRATADO(A)</h2>
      <p style={paraStyle}>
        O CONTRATADO(A) se obriga a: (i) prestar os serviços com diligência, ética e dedicação;
        (ii) manter o CONTRATANTE informado sobre o andamento dos trabalhos; (iii) guardar sigilo
        sobre as informações recebidas; (iv) observar o Estatuto da OAB e o Código de Ética e
        Disciplina.
      </p>

      <h2 style={h2Style}>CLÁUSULA 4ª — DAS OBRIGAÇÕES DO CONTRATANTE</h2>
      <p style={paraStyle}>
        O CONTRATANTE se obriga a: (i) fornecer todos os documentos e informações necessários ao
        desempenho dos serviços; (ii) pagar pontualmente os honorários acordados; (iii) reembolsar
        despesas processuais, custas e emolumentos previamente aprovados.
      </p>

      <h2 style={h2Style}>CLÁUSULA 5ª — DA RESCISÃO</h2>
      <p style={paraStyle}>
        Qualquer das partes poderá resilir o presente contrato mediante aviso prévio de 15 (quinze)
        dias, sem prejuízo do pagamento dos honorários pelos serviços já prestados.
      </p>

      <h2 style={h2Style}>CLÁUSULA 6ª — DO FORO</h2>
      <p style={paraStyle}>
        As partes elegem o foro da Comarca de {dados.cidade ?? 'São Paulo'} para dirimir quaisquer
        controvérsias oriundas do presente contrato, renunciando a qualquer outro por mais
        privilegiado que seja.
      </p>

      <p style={{ ...paraStyle, marginTop: '40px' }}>{dataFormatada(dados.cidade)}</p>

      <div style={assinaturaStyle}>
        <div style={assinaturaLinhaStyle}>
          <div style={linhaStyle} />
          <p style={assinaturaNomeStyle}>{dados.clienteNome}</p>
          <p style={assinaturaCargoStyle}>Contratante</p>
        </div>
        <div style={assinaturaLinhaStyle}>
          <div style={linhaStyle} />
          <p style={assinaturaNomeStyle}>{dados.advogadoNome}</p>
          <p style={assinaturaCargoStyle}>Contratado(a) — {dados.advogadoOAB}</p>
        </div>
      </div>
    </div>
  );
}

function DeclaracaoTemplate({ dados }: { dados: ModeloDados }) {
  const documentoCliente = dados.clienteCpf
    ? `CPF nº ${dados.clienteCpf}`
    : dados.clienteCnpj
    ? `CNPJ nº ${dados.clienteCnpj}`
    : 'documento não informado';

  return (
    <div className="doc-print" style={docStyle}>
      <h1 style={h1Style}>DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA</h1>

      <p style={paraStyle}>
        Eu, <strong>{dados.clienteNome}</strong>, {documentoCliente}, venho, por meio desta
        declaração, sob as penas da lei, declarar que <strong>não possuo condições financeiras
        de arcar com as custas do processo e honorários advocatícios</strong>, sem prejuízo do
        sustento próprio e de minha família.
      </p>

      <p style={paraStyle}>
        Declaro, ainda, que as informações aqui prestadas são verídicas e que tenho plena
        ciência de que a falsa declaração de pobreza sujeitará o declarante às sanções civis e
        penais previstas em lei, incluindo a instauração de processo por litigância de má-fé,
        nos termos do art. 80 do Código de Processo Civil, e o crime de falsidade ideológica
        previsto no art. 299 do Código Penal Brasileiro.
      </p>

      <p style={paraStyle}>
        Requeiro, por isso, seja-me concedido o benefício da <strong>JUSTIÇA GRATUITA</strong>,
        nos termos da Lei nº 1.060/1950 e do art. 98 e seguintes do Código de Processo Civil
        (Lei nº 13.105/2015), isentando-me do pagamento de custas processuais, taxa judiciária,
        despesas com intimações, honorários periciais e de advogado, nos termos do que dispõe
        o art. 98, §1º, incisos I a IX do Código de Processo Civil.
      </p>

      <p style={paraStyle}>
        Por ser expressão da verdade, assino a presente declaração.
      </p>

      <p style={{ ...paraStyle, marginTop: '40px' }}>{dataFormatada(dados.cidade)}</p>

      <div style={{ ...assinaturaStyle, justifyContent: 'center' }}>
        <div style={assinaturaLinhaStyle}>
          <div style={linhaStyle} />
          <p style={assinaturaNomeStyle}>{dados.clienteNome}</p>
          <p style={assinaturaCargoStyle}>Declarante</p>
        </div>
      </div>

      <div
        style={{
          marginTop: '48px',
          borderTop: '1px solid #000',
          paddingTop: '16px',
          fontSize: '11px',
          color: '#555',
        }}
      >
        <p>
          Advogado(a) responsável: {dados.advogadoNome} — {dados.advogadoOAB} —{' '}
          {dados.escritorioNome}
        </p>
      </div>
    </div>
  );
}

// ─── Estilos inline para impressão ───────────────────────────────────────────

const docStyle: React.CSSProperties = {
  background: '#fff',
  color: '#000',
  padding: '48px 56px',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '13px',
  lineHeight: '1.8',
  maxWidth: '800px',
  margin: '0 auto',
};

const h1Style: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  textAlign: 'center',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '28px',
  marginTop: '0',
};

const h2Style: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginTop: '20px',
  marginBottom: '4px',
};

const paraStyle: React.CSSProperties = {
  marginBottom: '14px',
  textAlign: 'justify',
};

const assinaturaStyle: React.CSSProperties = {
  display: 'flex',
  gap: '48px',
  marginTop: '64px',
};

const assinaturaLinhaStyle: React.CSSProperties = {
  flex: 1,
  textAlign: 'center',
};

const linhaStyle: React.CSSProperties = {
  borderTop: '1px solid #000',
  marginBottom: '6px',
};

const assinaturaNomeStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '12px',
  fontWeight: 600,
};

const assinaturaCargoStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '11px',
  color: '#555',
};

// ─── Componente principal ─────────────────────────────────────────────────────

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  .doc-print, .doc-print * { visibility: visible !important; }
  .doc-print { position: fixed; left: 0; top: 0; width: 100%; }
}
`;

export function ModeloDocumento({ open, onClose, tipo, dados }: ModeloDocumentoProps) {
  if (!open) return null;

  const titulo = TituloPorTipo(tipo);

  return (
    <>
      <style>{PRINT_STYLE}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-4xl rounded-2xl border shadow-2xl"
          style={{ background: '#141414', borderColor: '#2a2a2a' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: '#2a2a2a' }}
          >
            <h2 className="text-sm font-semibold text-[#f5f5f5] truncate pr-4">{titulo}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[#505050] hover:text-[#a0a0a0] hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Documento scrollável */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
            {tipo === 'procuracao' && <ProcuracaoTemplate dados={dados} />}
            {tipo === 'contrato_honorarios' && <ContratoHonorariosTemplate dados={dados} />}
            {tipo === 'declaracao' && <DeclaracaoTemplate dados={dados} />}
          </div>
        </div>
      </div>
    </>
  );
}
