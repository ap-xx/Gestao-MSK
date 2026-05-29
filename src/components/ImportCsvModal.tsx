import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { parseCsv } from '../utils/parseCsv';
import Portal from './ui/Portal';

export interface CsvColumnMapping {
  /** Header value from the CSV file */
  csvCol: string;
  /** Internal field key this column maps to */
  field: string;
}

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface Props {
  title: string;
  fields: FieldDef[];
  /** Called with array of mapped row objects after user confirms. Must return counts. */
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  onClose: () => void;
}

const STEP = {
  UPLOAD: 'upload',
  MAP: 'map',
  PREVIEW: 'preview',
  DONE: 'done',
} as const;
type Step = (typeof STEP)[keyof typeof STEP];

export default function ImportCsvModal({ title, fields, onImport, onClose }: Props) {
  const [step, setStep]       = useState<Step>(STEP.UPLOAD);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult]   = useState<ImportResult | null>(null);
  const [error, setError]     = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = csvRows[0] ?? [];
  const dataRows = csvRows.slice(1);

  // ── Step 1: Upload ─────────────────────────────────────────
  function handleFile(file: File) {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setError('Selecione um arquivo .csv ou .txt');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length < 2) { setError('Arquivo sem dados (mínimo 1 cabeçalho + 1 linha).'); return; }
      setCsvRows(rows);
      // Auto-map columns whose header loosely matches a field label/key
      const auto: Record<string, string> = {};
      fields.forEach(f => {
        const match = rows[0].find(h =>
          h.toLowerCase().replace(/[^a-z]/g, '').includes(f.key.toLowerCase()) ||
          h.toLowerCase().includes(f.label.toLowerCase())
        );
        if (match) auto[f.key] = match;
      });
      setMapping(auto);
      setError('');
      setStep(STEP.MAP);
    };
    reader.readAsText(file, 'UTF-8');
  }

  // ── Step 2: Mapping ─────────────────────────────────────────
  const requiredMapped = fields.filter(f => f.required).every(f => mapping[f.key]);

  function buildMappedRows(): Record<string, string>[] {
    return dataRows.map(row => {
      const obj: Record<string, string> = {};
      fields.forEach(f => {
        const col = mapping[f.key];
        if (col) {
          const idx = headers.indexOf(col);
          obj[f.key] = idx >= 0 ? (row[idx] ?? '') : '';
        }
      });
      return obj;
    });
  }

  // ── Step 3: Import ──────────────────────────────────────────
  async function handleImport() {
    setImporting(true);
    try {
      const rows = buildMappedRows();
      const r = await onImport(rows);
      setResult(r);
      setStep(STEP.DONE);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao importar');
    } finally {
      setImporting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <Portal>
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a] shrink-0">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" />
              <h2 className="font-playfair text-base font-bold text-[#f5f5f5]">{title}</h2>
            </div>
            <button onClick={onClose} className="text-[#505050] hover:text-[#f5f5f5]">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 px-6 py-3 border-b border-[#2a2a2a] shrink-0">
            {[
              { key: STEP.UPLOAD,  label: '1. Arquivo' },
              { key: STEP.MAP,     label: '2. Colunas' },
              { key: STEP.PREVIEW, label: '3. Prévia' },
              { key: STEP.DONE,    label: '4. Concluído' },
            ].map((s, i, arr) => (
              <React.Fragment key={s.key}>
                <span className={`text-xs font-medium ${step === s.key ? 'text-amber-400' : 'text-[#505050]'}`}>
                  {s.label}
                </span>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-[#303030]" />}
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── UPLOAD ── */}
            {step === STEP.UPLOAD && (
              <div className="space-y-4">
                <p className="text-sm text-[#a0a0a0]">
                  Selecione um arquivo <strong className="text-[#f5f5f5]">.csv</strong> exportado de Excel ou outra planilha.
                  A primeira linha deve conter os cabeçalhos das colunas.
                </p>
                <label
                  className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-[#2a2a2a] hover:border-amber-500/30 rounded-xl cursor-pointer transition-colors group"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                >
                  <FileText className="w-8 h-8 text-[#303030] group-hover:text-amber-400/40 transition-colors" />
                  <span className="text-sm text-[#505050]">Arraste o arquivo aqui ou clique para selecionar</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.txt"
                    className="sr-only"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </label>
                {error && <p className="text-xs text-red-400">{error}</p>}

                {/* Template hint */}
                <div className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg p-3 text-xs text-[#505050]">
                  <p className="font-medium text-[#a0a0a0] mb-1">Colunas esperadas (exemplo):</p>
                  <p className="font-mono">{fields.map(f => f.label).join(', ')}</p>
                </div>
              </div>
            )}

            {/* ── MAP ── */}
            {step === STEP.MAP && (
              <div className="space-y-4">
                <p className="text-sm text-[#a0a0a0]">
                  Arquivo lido: <strong className="text-[#f5f5f5]">{dataRows.length} linha(s)</strong>.
                  Associe cada campo do sistema a uma coluna do seu CSV.
                </p>
                <div className="space-y-2">
                  {fields.map(f => (
                    <div key={f.key} className="grid grid-cols-2 gap-3 items-center">
                      <span className="text-sm text-[#f5f5f5]">
                        {f.label}
                        {f.required && <span className="text-red-400 ml-1">*</span>}
                      </span>
                      <select
                        value={mapping[f.key] ?? ''}
                        onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                        className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-[#f5f5f5]"
                      >
                        <option value="">— ignorar —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {!requiredMapped && (
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Mapeie todos os campos obrigatórios (*) para continuar.
                  </p>
                )}
              </div>
            )}

            {/* ── PREVIEW ── */}
            {step === STEP.PREVIEW && (
              <div className="space-y-3">
                <p className="text-sm text-[#a0a0a0]">
                  Prévia das primeiras 5 linhas. Confirme para importar todas as{' '}
                  <strong className="text-[#f5f5f5]">{dataRows.length}</strong> linhas.
                </p>
                <div className="overflow-x-auto rounded-lg border border-[#2a2a2a]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#2a2a2a] bg-[#1e1e1e]">
                        {fields.filter(f => mapping[f.key]).map(f => (
                          <th key={f.key} className="px-3 py-2 text-left text-[#505050] font-medium whitespace-nowrap">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {buildMappedRows().slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-[#1e1e1e] last:border-0">
                          {fields.filter(f => mapping[f.key]).map(f => (
                            <td key={f.key} className="px-3 py-2 text-[#a0a0a0] truncate max-w-[140px]">
                              {row[f.key] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
              </div>
            )}

            {/* ── DONE ── */}
            {step === STEP.DONE && result && (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <CheckCircle className="w-12 h-12 text-green-400" />
                <div>
                  <p className="text-lg font-bold text-[#f5f5f5]">Importação concluída!</p>
                  <p className="text-sm text-[#a0a0a0] mt-1">
                    <strong className="text-green-400">{result.imported}</strong> importado(s)
                    {result.skipped > 0 && <> · <strong className="text-amber-400">{result.skipped}</strong> ignorado(s) (duplicatas)</>}
                  </p>
                </div>
                {result.errors.length > 0 && (
                  <div className="w-full bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-left">
                    <p className="text-xs font-medium text-red-400 mb-1">Erros ({result.errors.length}):</p>
                    <ul className="text-xs text-[#a0a0a0] space-y-0.5 list-disc list-inside">
                      {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                      {result.errors.length > 5 && <li>…e mais {result.errors.length - 5}</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-[#2a2a2a] shrink-0">
            {step === STEP.UPLOAD && (
              <button onClick={onClose} className="flex-1 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm">Cancelar</button>
            )}
            {step === STEP.MAP && (
              <>
                <button onClick={() => setStep(STEP.UPLOAD)} className="flex-1 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm">Voltar</button>
                <button
                  disabled={!requiredMapped}
                  onClick={() => setStep(STEP.PREVIEW)}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-semibold rounded-lg text-sm"
                >
                  Prévia →
                </button>
              </>
            )}
            {step === STEP.PREVIEW && (
              <>
                <button onClick={() => setStep(STEP.MAP)} className="flex-1 py-2.5 bg-[#1e1e1e] border border-[#2a2a2a] text-[#a0a0a0] rounded-lg text-sm">Voltar</button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando…</> : `Importar ${dataRows.length} linha(s)`}
                </button>
              </>
            )}
            {step === STEP.DONE && (
              <button onClick={onClose} className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-sm">Fechar</button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
