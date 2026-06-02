import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function parseProcesso(row: Record<string, unknown>) {
  return {
    ...row,
    audiencias:   JSON.parse((row.audiencias   as string) || '[]'),
    andamentos:   JSON.parse((row.andamentos   as string) || '[]'),
    dadosDataJud: row.dadosDataJud ? JSON.parse(row.dadosDataJud as string) : null,
  };
}

function parseCliente(row: Record<string, unknown>) {
  return {
    ...row,
    endereco: JSON.parse((row.endereco as string) || '{}'),
    socios:   JSON.parse((row.socios   as string) || '[]'),
  };
}

function parseAviso(row: Record<string, unknown>) {
  return { ...row, lido: Boolean(row.lido) };
}

// GET /api/backup
router.get('/', (_req: Request, res: Response) => {
  try {
    const clientes    = (db.prepare('SELECT * FROM clientes').all()    as Record<string, unknown>[]).map(parseCliente);
    const contratos   =  db.prepare('SELECT * FROM contratos').all();
    const processos   = (db.prepare('SELECT * FROM processos').all()   as Record<string, unknown>[]).map(parseProcesso);
    const lancamentos =  db.prepare('SELECT * FROM lancamentos').all();
    const avisos      = (db.prepare('SELECT * FROM avisos').all()      as Record<string, unknown>[]).map(parseAviso);

    const escrRow = db.prepare("SELECT dados FROM escritorio WHERE id = 'escritorio'").get() as { dados: string } | undefined;
    const escritorio = escrRow ? JSON.parse(escrRow.dados) : {};

    res.json({
      clientes,
      contratos,
      processos,
      lancamentos,
      avisos,
      escritorio,
      exportadoEm: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao exportar backup.', detail: msg });
  }
});

// POST /api/backup
router.post('/', (req: Request, res: Response) => {
  try {
    const { clientes, contratos, processos, lancamentos, avisos, escritorio } = req.body as {
      clientes?: Record<string, unknown>[];
      contratos?: Record<string, unknown>[];
      processos?: Record<string, unknown>[];
      lancamentos?: Record<string, unknown>[];
      avisos?: Record<string, unknown>[];
      escritorio?: Record<string, unknown>;
    };

    const summary: Record<string, number> = {};

    // Clientes
    if (Array.isArray(clientes)) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO clientes
        (id, tipoPessoa, nome, cpf, cnpj, razaoSocial, email, telefone, celular, status, observacoes,
         endereco, porte, naturezaJuridica, capitalSocial, socios, criadoEm, atualizadoEm)
        VALUES (@id, @tipoPessoa, @nome, @cpf, @cnpj, @razaoSocial, @email, @telefone, @celular, @status,
                @observacoes, @endereco, @porte, @naturezaJuridica, @capitalSocial, @socios, @criadoEm, @atualizadoEm)`);
      for (const c of clientes) {
        stmt.run({
          ...c,
          endereco: typeof c.endereco === 'object' ? JSON.stringify(c.endereco) : (c.endereco ?? '{}'),
          socios:   Array.isArray(c.socios)        ? JSON.stringify(c.socios)   : (c.socios   ?? '[]'),
        });
      }
      summary.clientes = clientes.length;
    }

    // Contratos
    if (Array.isArray(contratos)) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO contratos
        (id, clienteId, clienteNome, tipo, valorMensal, percentualExito, valorCausa, descricao,
         areaAtuacao, dataInicio, dataFim, status, observacoes, criadoEm)
        VALUES (@id, @clienteId, @clienteNome, @tipo, @valorMensal, @percentualExito, @valorCausa,
                @descricao, @areaAtuacao, @dataInicio, @dataFim, @status, @observacoes, @criadoEm)`);
      for (const c of contratos) stmt.run(c);
      summary.contratos = contratos.length;
    }

    // Processos
    if (Array.isArray(processos)) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO processos
        (id, numeroCNJ, clienteId, clienteNome, contratoId, tribunal, tribunalAlias, vara, juiz,
         areaAtuacao, fase, polo, parteAdversa, advogadoAdverso, valorCausa, audiencias,
         proximaAudiencia, status, observacoes, andamentos, dadosDataJud, criadoEm, atualizadoEm)
        VALUES (@id, @numeroCNJ, @clienteId, @clienteNome, @contratoId, @tribunal, @tribunalAlias, @vara,
                @juiz, @areaAtuacao, @fase, @polo, @parteAdversa, @advogadoAdverso, @valorCausa,
                @audiencias, @proximaAudiencia, @status, @observacoes, @andamentos, @dadosDataJud,
                @criadoEm, @atualizadoEm)`);
      for (const p of processos) {
        stmt.run({
          ...p,
          audiencias:   Array.isArray(p.audiencias)   ? JSON.stringify(p.audiencias)   : (p.audiencias   ?? '[]'),
          andamentos:   Array.isArray(p.andamentos)   ? JSON.stringify(p.andamentos)   : (p.andamentos   ?? '[]'),
          dadosDataJud: p.dadosDataJud && typeof p.dadosDataJud === 'object' ? JSON.stringify(p.dadosDataJud) : (p.dadosDataJud ?? null),
        });
      }
      summary.processos = processos.length;
    }

    // Lançamentos
    if (Array.isArray(lancamentos)) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO lancamentos
        (id, tipo, clienteId, clienteNome, processoId, contratoId, descricao, valor,
         dataVencimento, dataPagamento, status, formaPagamento, observacoes, criadoEm)
        VALUES (@id, @tipo, @clienteId, @clienteNome, @processoId, @contratoId, @descricao, @valor,
                @dataVencimento, @dataPagamento, @status, @formaPagamento, @observacoes, @criadoEm)`);
      for (const l of lancamentos) stmt.run(l);
      summary.lancamentos = lancamentos.length;
    }

    // Avisos
    if (Array.isArray(avisos)) {
      const stmt = db.prepare(`INSERT OR REPLACE INTO avisos
        (id, titulo, descricao, tipo, urgencia, processoId, clienteId, lancamentoId, dataLimite, lido, criadoEm)
        VALUES (@id, @titulo, @descricao, @tipo, @urgencia, @processoId, @clienteId, @lancamentoId, @dataLimite, @lido, @criadoEm)`);
      for (const a of avisos) {
        stmt.run({ ...a, lido: a.lido ? 1 : 0 });
      }
      summary.avisos = avisos.length;
    }

    // Escritório
    if (escritorio && typeof escritorio === 'object') {
      db.prepare(
        "INSERT INTO escritorio (id, dados) VALUES ('escritorio', ?) ON CONFLICT(id) DO UPDATE SET dados = excluded.dados"
      ).run(JSON.stringify(escritorio));
      summary.escritorio = 1;
    }

    res.json({ ok: true, summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao importar backup.', detail: msg });
  }
});

// ─── POST /api/backup/sync — store latest snapshot on server ──────────────────
// Called by the "Enviar para servidor" button in Configurações → Aparência.
// Stores the full backup as a single row in the `sync_snapshots` table.
//
// GET /api/backup/sync — retrieve the latest snapshot
// Called by "Receber do servidor" on the destination PC.

router.post('/sync', (req: Request, res: Response) => {
  try {
    const payload = JSON.stringify(req.body);
    db.prepare(`
      INSERT INTO sync_snapshots (id, userId, data, criadoEm)
      VALUES ('latest_' || @userId, @userId, @data, @now)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, criadoEm = excluded.criadoEm
    `).run({ userId: req.user!.id, data: payload, now: new Date().toISOString() });
    res.json({ ok: true, syncedAt: new Date().toISOString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao salvar snapshot.', detail: msg });
  }
});

router.get('/sync', (req: Request, res: Response) => {
  try {
    const row = db.prepare(
      "SELECT data FROM sync_snapshots WHERE id = 'latest_' || ?"
    ).get(req.user!.id) as { data: string } | undefined;
    if (!row) {
      res.status(404).json({ error: 'Nenhum snapshot encontrado. Envie os dados de outro PC primeiro.' });
      return;
    }
    res.json(JSON.parse(row.data));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Erro ao ler snapshot.', detail: msg });
  }
});

export default router;
