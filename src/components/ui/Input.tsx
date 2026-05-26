import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Input({ label, error, hint, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        className={`w-full px-3 py-2.5 rounded-lg text-sm text-white border transition-colors bg-dark-700 placeholder-gray-600
          ${error ? 'border-red-500/50' : 'border-dark-600 hover:border-dark-400'}
          ${className}`}
        style={{
          background: '#1e1e1e',
          borderColor: error ? 'rgba(239,68,68,0.5)' : '#2e2e2e',
        }}
        {...props}
      />
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

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
        style={{
          background: '#1e1e1e',
          borderColor: error ? 'rgba(239,68,68,0.5)' : '#2e2e2e',
        }}
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
        style={{
          background: '#1e1e1e',
          borderColor: error ? 'rgba(239,68,68,0.5)' : '#2e2e2e',
        }}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
