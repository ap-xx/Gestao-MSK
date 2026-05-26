import React, { useState, useEffect } from 'react';

// ─── Utilitários de data ──────────────────────────────────────
function isoToDisplay(iso: string): string {
  if (!iso || iso.length < 10) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function displayToISO(display: string): string {
  const digits = display.replace(/\D/g, '');
  if (digits.length !== 8) return '';
  return `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

function applyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// ─── DateInput ────────────────────────────────────────────────
// Aceita e emite datas no formato ISO (YYYY-MM-DD),
// mas exibe e recebe entrada do usuário em DD/MM/AAAA.
interface DateInputRawProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function DateInput({ value = '', onChange, ...props }: DateInputRawProps) {
  const [display, setDisplay] = useState(() => isoToDisplay(value));

  useEffect(() => {
    // Só sincroniza se o valor externo mudou de verdade (auto-fill, limpeza, etc.)
    const currentISO = displayToISO(display);
    if (currentISO !== value) {
      setDisplay(isoToDisplay(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = applyMask(e.target.value);
    setDisplay(masked);

    const iso = displayToISO(masked);
    // Cria evento sintético compatível com os handlers existentes
    const fakeEvent = {
      ...e,
      target: { ...e.target, value: iso },
      currentTarget: { ...e.currentTarget, value: iso },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange?.(fakeEvent);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder="DD/MM/AAAA"
      maxLength={10}
      {...props}
    />
  );
}

// ─── Input ────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const inputBaseClass = `w-full px-3 py-2.5 rounded-lg text-sm text-white border transition-colors bg-dark-700 placeholder-gray-600`;
const inputStyle = (error?: string) => ({
  background: '#1e1e1e',
  borderColor: error ? 'rgba(239,68,68,0.5)' : '#2e2e2e',
});

export default function Input({ label, error, hint, className = '', type, value, onChange, ...props }: InputProps) {
  if (type === 'date') {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {label}
          </label>
        )}
        <DateInput
          value={value as string}
          onChange={onChange as (e: React.ChangeEvent<HTMLInputElement>) => void}
          className={`${inputBaseClass} ${error ? 'border-red-500/50' : 'border-dark-600 hover:border-dark-400'} ${className}`}
          style={inputStyle(error)}
          {...props}
        />
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={`${inputBaseClass} ${error ? 'border-red-500/50' : 'border-dark-600 hover:border-dark-400'} ${className}`}
        style={inputStyle(error)}
        {...props}
      />
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className = '', ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        className={`w-full px-3 py-2.5 rounded-lg text-sm text-white border transition-colors ${className}`}
        style={{ background: '#1e1e1e', borderColor: error ? 'rgba(239,68,68,0.5)' : '#2e2e2e' }}
        {...props}
      >
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#1e1e1e' }}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <textarea
        className={`w-full px-3 py-2.5 rounded-lg text-sm text-white border transition-colors resize-none ${className}`}
        style={{ background: '#1e1e1e', borderColor: error ? 'rgba(239,68,68,0.5)' : '#2e2e2e' }}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
