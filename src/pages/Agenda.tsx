import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Gavel, FileText,
  AlertTriangle, Loader2, Clock,
} from 'lucide-react';
import { processosApi, contratosApi, avisosApi } from '../services/api';
import { useToast } from '../context/ToastContext';
import type { Processo, Contrato, Aviso } from '../types';

interface AgendaItem {
  id: string;
  data: Date;
  titulo: string;
  subtitulo?: string;
  tipo: 'audiencia' | 'prazo' | 'contrato' | 'aviso';
  urgente?: boolean;
}

const tipoConfig: Record<AgendaItem['tipo'], { icon: any; bg: string; text: string; label: string }> = {
  audiencia: { icon: Gavel, bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'Audiência' },
  prazo:     { icon: AlertTriangle, bg: 'bg-red-500/15', text: 'text-red-400', label: 'Prazo' },
  contrato:  { icon: FileText, bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'Contrato' },
  aviso:     { icon: AlertTriangle, bg: 'bg-amber-500/15', text: 'text-amber-400', label: 'Aviso' },
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function Agenda() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, av] = await Promise.all([
        processosApi.getAll(),
        contratosApi.getAll(),
        avisosApi.getAll(),
      ]);
      setProcessos(p);
      setContratos(c);
      setAvisos(av);
    } catch {
      showToast('error', 'Erro ao carregar agenda');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Build unified event list
  const items = useMemo<AgendaItem[]>(() => {
    const list: AgendaItem[] = [];

    // Audiências de processos
    processos.forEach(p => {
      p.audiencias.forEach((a, i) => {
        const data = new Date(a.data);
        if (!isNaN(data.getTime())) {
          list.push({
            id: `aud-${p.id}-${i}`,
            data,
            titulo: `Audiência: ${a.tipo}`,
            subtitulo: `${p.clienteNome} · ${a.vara || p.vara}`,
            tipo: 'audiencia',
            urgente: Math.ceil((data.getTime() - Date.now()) / 86400000) <= 7,
          });
        }
      });
    });

    // Avisos com dataLimite
    avisos.forEach(av => {
      if (!av.dataLimite || av.lido) return;
      const data = new Date(av.dataLimite);
      if (!isNaN(data.getTime())) {
        list.push({
          id: `aviso-${av.id}`,
          data,
          titulo: av.titulo,
          subtitulo: av.descricao.slice(0, 60) + (av.descricao.length > 60 ? '...' : ''),
          tipo: av.tipo === 'prazo' ? 'prazo' : 'aviso',
          urgente: av.urgencia === 'critica' || av.urgencia === 'alta',
        });
      }
    });

    // Contratos com dataFim próximo (30 dias)
    contratos.forEach(c => {
      if (!c.dataFim || c.status !== 'ativo') return;
      const data = new Date(c.dataFim);
      if (!isNaN(data.getTime())) {
        list.push({
          id: `contrato-${c.id}`,
          data,
          titulo: `Encerramento de contrato`,
          subtitulo: `${c.clienteNome} · ${c.tipo}`,
          tipo: 'contrato',
        });
      }
    });

    return list.sort((a, b) => a.data.getTime() - b.data.getTime());
  }, [processos, contratos, avisos]);

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  function prevMonth() { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function nextMonth() { setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  function itemsForDay(day: number): AgendaItem[] {
    const d = new Date(year, month, day);
    return items.filter(item => sameDay(item.data, d));
  }

  const selectedItems = selectedDay
    ? items.filter(item => sameDay(item.data, selectedDay))
    : [];

  // Upcoming items (next 30 days)
  const upcoming = useMemo(() => {
    const now = Date.now();
    const limit = now + 30 * 86400000;
    return items.filter(item => item.data.getTime() >= now && item.data.getTime() <= limit).slice(0, 8);
  }, [items]);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div>
        <h1 className="font-playfair text-2xl font-bold text-[#f5f5f5]">Agenda</h1>
        <p className="text-[#a0a0a0] text-sm">Audiências, prazos e eventos dos próximos meses</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Calendário */}
          <div className="lg:col-span-2 bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            {/* Navigation */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={prevMonth}
                className="p-2 text-[#a0a0a0] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="font-playfair text-lg font-bold text-[#f5f5f5]">
                {MONTHS[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                className="p-2 text-[#a0a0a0] hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-2">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-[#505050] py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for first day offset */}
              {Array.from({ length: firstDay }, (_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const dayItems = itemsForDay(day);
                const dayDate = new Date(year, month, day);
                const isToday = sameDay(dayDate, today);
                const isSelected = selectedDay && sameDay(dayDate, selectedDay);
                const hasUrgent = dayItems.some(item => item.urgente);

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(dayDate)}
                    className={`relative aspect-square flex flex-col items-center justify-start p-1 rounded-lg transition-all text-sm ${
                      isSelected
                        ? 'bg-amber-500 text-white'
                        : isToday
                        ? 'bg-amber-500/20 text-amber-400 font-bold'
                        : 'hover:bg-[#1e1e1e] text-[#a0a0a0]'
                    }`}
                  >
                    <span className="font-medium">{day}</span>
                    {dayItems.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                        {dayItems.slice(0, 3).map((_item, idx) => (
                          <div
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-white/70' :
                              hasUrgent ? 'bg-red-400' : 'bg-amber-400'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected day detail */}
            {selectedDay && (
              <div className="mt-5 pt-5 border-t border-[#2a2a2a]">
                <h3 className="text-sm font-semibold text-[#f5f5f5] mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  {selectedDay.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                {selectedItems.length === 0 ? (
                  <p className="text-sm text-[#505050] py-3">Nenhum evento neste dia</p>
                ) : (
                  <div className="space-y-2">
                    {selectedItems.map(item => {
                      const cfg = tipoConfig[item.tipo];
                      const Icon = cfg.icon;
                      return (
                        <div key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border border-[#2a2a2a] ${cfg.bg}`}>
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.text}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#f5f5f5]">{item.titulo}</p>
                            {item.subtitulo && <p className="text-xs text-[#a0a0a0] mt-0.5">{item.subtitulo}</p>}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border border-current/20 shrink-0`}>
                            {cfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar: Próximos eventos */}
          <div className="space-y-4">
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
              <h3 className="font-semibold text-[#f5f5f5] mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Próximos 30 dias
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-sm text-[#505050] text-center py-6">Nenhum evento nos próximos 30 dias</p>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(item => {
                    const cfg = tipoConfig[item.tipo];
                    const dias = Math.ceil((item.data.getTime() - Date.now()) / 86400000);

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentDate(new Date(item.data.getFullYear(), item.data.getMonth(), 1));
                          setSelectedDay(item.data);
                        }}
                        className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border border-[#2a2a2a] hover:border-amber-500/20 transition-all ${cfg.bg}`}
                      >
                        <div className="text-center min-w-[36px] shrink-0">
                          <p className={`font-bold text-base leading-none ${cfg.text}`}>
                            {item.data.getDate()}
                          </p>
                          <p className="text-[10px] text-[#505050] uppercase">
                            {MONTHS[item.data.getMonth()].slice(0, 3)}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#f5f5f5] truncate">{item.titulo}</p>
                          {item.subtitulo && (
                            <p className="text-[10px] text-[#a0a0a0] truncate mt-0.5">{item.subtitulo}</p>
                          )}
                        </div>
                        <span className={`text-xs font-semibold shrink-0 ${dias <= 3 ? 'text-red-400' : dias <= 7 ? 'text-amber-400' : 'text-[#505050]'}`}>
                          {dias === 0 ? 'hoje' : `${dias}d`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legenda */}
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
              <h4 className="text-xs font-medium text-[#505050] uppercase mb-3">Legenda</h4>
              <div className="space-y-2">
                {Object.entries(tipoConfig).map(([tipo, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <div key={tipo} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${cfg.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
                      </div>
                      <span className="text-xs text-[#a0a0a0]">{cfg.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
