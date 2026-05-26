import { Router, Request, Response } from 'express';
import { db, generateId } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { syncAviso } from '../google/calendar';

const router = Router();
router.use(requireAuth);

function parseAviso(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, lido: Boolean(row.lido) };
}

// GET /api/avisos
router.get('/', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT * FROM avisos ORDER BY criadoEm DESC').all() as Record<string, unknown>[];
    res.json(rows.map(parseAviso));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao listar avisos.', detail: msg });
  }
});

// POST /api/avisos
router.post('/', (req: Request, res: Response) => {
  try {
    const body = req.body;
    const id   = generateId();
    const now  = new Date().toISOString();

    db.prepare(`INSERT INTO avisos
      (id, titulo, descricao, tipo, urgencia, processoId, clienteId, lancamentoId, dataLimite, lido, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, body.titulo, body.descricao ?? '', body.tipo, body.urgencia,
      body.processoId ?? null, body.clienteId ?? null, body.lancamentoId ?? null,
      body.dataLimite ?? null, body.lido ? 1 : 0, body.criadoEm ?? now
    );

    const created = db.prepare('SELECT * FROM avisos WHERE id = ?').get(id) as Record<string, unknown>;
    const parsedAv = parseAviso(created);
    // Sync com Google Calendar (background)
    syncAviso({ id, titulo: body.titulo, descricao: body.descricao ?? '', dataLimite: body.dataLimite ?? null })
      .catch(err => console.error('[google] Erro sync aviso:', err));
    res.status(201).json(parsedAv);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao criar aviso.', detail: msg });
  }
});

// PUT /api/avisos/:id
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM avisos WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) { res.status(404).json({ error: 'Aviso não encontrado.' }); return; }

    const body = req.body;
    const lido = body.lido !== undefined ? (body.lido ? 1 : 0) : Number(existing.lido);

    db.prepare(`UPDATE avisos SET
      titulo=?, descricao=?, tipo=?, urgencia=?, processoId=?, clienteId=?, lancamentoId=?, dataLimite=?, lido=?
      WHERE id=?`
    ).run(
      body.titulo ?? existing.titulo, body.descricao ?? existing.descricao ?? '',
      body.tipo ?? existing.tipo, body.urgencia ?? existing.urgencia,
      body.processoId !== undefined ? (body.processoId ?? null) : (existing.processoId ?? null),
      body.clienteId  !== undefined ? (body.clienteId  ?? null) : (existing.clienteId  ?? null),
      body.lancamentoId !== undefined ? (body.lancamentoId ?? null) : (existing.lancamentoId ?? null),
      body.dataLimite !== undefined ? (body.dataLimite ?? null) : (existing.dataLimite ?? null),
      lido, req.params.id
    );

    const updated = db.prepare('SELECT * FROM avisos WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    const parsedUpAv = parseAviso(updated);
    // Sync com Google Calendar (background) — se marcado como lido, não precisa de evento
    if (!parsedUpAv.lido) {
      syncAviso({ id: req.params.id, titulo: parsedUpAv.titulo as string, descricao: parsedUpAv.descricao as string, dataLimite: parsedUpAv.dataLimite as string | null })
        .catch(err => console.error('[google] Erro sync aviso update:', err));
    }
    res.json(parsedUpAv);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao atualizar aviso.', detail: msg });
  }
});

// DELETE /api/avisos/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM avisos WHERE id = ?').run(req.params.id);
    if (result.changes === 0) { res.status(404).json({ error: 'Aviso não encontrado.' }); return; }
    // Remove evento do Google Calendar (background)
    syncAviso({ id: req.params.id, titulo: '', descricao: '', dataLimite: 'deleted', deleted: true })
      .catch(err => console.error('[google] Erro sync aviso delete:', err));
    res.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao deletar aviso.', detail: msg });
  }
});

// POST /api/avisos/gerar — gera avisos automáticos
router.post('/gerar', (_req: Request, res: Response) => {
  try {
    // Obter prazosDias da configuração do escritório
    const escritorioRow = db.prepare("SELECT dados FROM escritorio WHERE id = 'escritorio'").get() as { dados: string } | undefined;
    let prazosDias = 5;
    if (escritorioRow) {
      try {
        const dados = JSON.parse(escritorioRow.dados);
        if (dados?.notificacoes?.prazosDias) prazosDias = Number(dados.notificacoes.prazosDias);
      } catch { /* ignora */ }
    }

    const agora    = new Date();
    const hoje     = agora.toISOString().slice(0, 10);
    const limiteData = new Date(agora.getTime() + prazosDias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const now      = agora.toISOString();
    let criados    = 0;

    // ── Audiências ───────────────────────────────────────────────
    const processos = db.prepare(
      "SELECT id, clienteNome, numeroCNJ, proximaAudiencia FROM processos WHERE proximaAudiencia IS NOT NULL AND status != 'arquivado'"
    ).all() as Array<{ id: string; clienteNome: string; numeroCNJ: string; proximaAudiencia: string }>;

    for (const p of processos) {
      const dataAud = p.proximaAudiencia;
      if (dataAud < hoje || dataAud > limiteData) continue;

      const jaExiste = db.prepare(
        "SELECT id FROM avisos WHERE tipo='audiencia' AND processoId=? AND lido=0"
      ).get(p.id);
      if (jaExiste) continue;

      const diasAte = Math.ceil((new Date(dataAud).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
      const urgencia = diasAte <= 1 ? 'critica' : diasAte <= 3 ? 'alta' : 'media';

      db.prepare(`INSERT INTO avisos (id, titulo, descricao, tipo, urgencia, processoId, clienteId, lancamentoId, dataLimite, lido, criadoEm)
        VALUES (?, ?, ?, 'audiencia', ?, ?, NULL, NULL, ?, 0, ?)`
      ).run(
        generateId(),
        `Audiência próxima — ${p.clienteNome}`,
        `Processo ${p.numeroCNJ} — próxima audiência em ${dataAud}.`,
        urgencia, p.id, dataAud, now
      );
      criados++;
    }

    // ── Inadimplência / vencimentos ──────────────────────────────
    const vencidos = db.prepare(
      "SELECT id, clienteNome, descricao, dataVencimento FROM lancamentos WHERE status='a_receber' AND dataVencimento < ?"
    ).all(hoje) as Array<{ id: string; clienteNome: string | null; descricao: string; dataVencimento: string }>;

    for (const l of vencidos) {
      const jaExiste = db.prepare(
        "SELECT id FROM avisos WHERE tipo='pagamento' AND lancamentoId=? AND lido=0"
      ).get(l.id);
      if (jaExiste) continue;

      const diasAtraso = Math.floor((agora.getTime() - new Date(l.dataVencimento).getTime()) / (1000 * 60 * 60 * 24));
      const urgencia   = diasAtraso > 30 ? 'critica' : diasAtraso > 7 ? 'alta' : 'media';

      db.prepare(`INSERT INTO avisos (id, titulo, descricao, tipo, urgencia, processoId, clienteId, lancamentoId, dataLimite, lido, criadoEm)
        VALUES (?, ?, ?, 'pagamento', ?, NULL, NULL, ?, NULL, 0, ?)`
      ).run(
        generateId(),
        `Pagamento vencido — ${l.clienteNome ?? 'Sem cliente'}`,
        `${l.descricao} — venceu em ${l.dataVencimento} (${diasAtraso} dias em atraso).`,
        urgencia, l.id, now
      );
      criados++;
    }

    // ── Contratos vencendo ───────────────────────────────────────
    const contratosVencendo = db.prepare(
      "SELECT id, clienteNome, dataFim FROM contratos WHERE dataFim IS NOT NULL AND dataFim >= ? AND dataFim <= ? AND status != 'encerrado'"
    ).all(hoje, limiteData) as Array<{ id: string; clienteNome: string; dataFim: string }>;

    for (const c of contratosVencendo) {
      const jaExiste = db.prepare(
        "SELECT id FROM avisos WHERE tipo='contrato' AND lancamentoId=? AND lido=0"
      ).get(c.id);
      if (jaExiste) continue;

      const diasAte  = Math.ceil((new Date(c.dataFim).getTime() - agora.getTime()) / (1000 * 60 * 60 * 24));
      const urgencia = diasAte <= 1 ? 'critica' : diasAte <= 3 ? 'alta' : 'media';

      db.prepare(`INSERT INTO avisos (id, titulo, descricao, tipo, urgencia, processoId, clienteId, lancamentoId, dataLimite, lido, criadoEm)
        VALUES (?, ?, ?, 'contrato', ?, NULL, NULL, ?, ?, 0, ?)`
      ).run(
        generateId(),
        `Contrato vencendo — ${c.clienteNome}`,
        `Contrato de ${c.clienteNome} encerra em ${c.dataFim}.`,
        urgencia, c.id, c.dataFim, now
      );
      criados++;
    }

    res.json({ criados });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao gerar avisos.', detail: msg });
  }
});

export default router;
