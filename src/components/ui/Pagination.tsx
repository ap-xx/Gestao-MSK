import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
  next: () => void;
  prev: () => void;
  setPage: (p: number) => void;
}

export function Pagination({ page, totalPages, total, hasNext, hasPrev, next, prev }: Props) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-2 py-3 text-sm text-[#a0a0a0]">
      <span>{total} registros — página {page + 1} de {totalPages}</span>
      <div className="flex gap-2">
        <button
          onClick={prev}
          disabled={!hasPrev}
          className="px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] hover:border-amber-500/30 disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Anterior
        </button>
        <button
          onClick={next}
          disabled={!hasNext}
          className="px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] hover:border-amber-500/30 disabled:opacity-40 transition-colors flex items-center gap-1"
        >
          Próximo <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
