import { db, generateId } from '../db/index';
import type { Request } from 'express';

/** Resolve o nome do usuário a partir do id na tabela users */
function resolveNome(userId: string): string {
  try {
    const row = db.prepare('SELECT nome FROM users WHERE id = ?').get(userId) as { nome: string } | undefined;
    return row?.nome ?? 'Desconhecido';
  } catch { return 'Desconhecido'; }
}

export function auditLog(params: {
  req?: Request;       // se informado, extrai userId/ip automaticamente
  userId?: string;
  userNome?: string;
  acao: string;
  entidade: string;
  entidadeId?: string;
  detalhe?: string;
  ip?: string;
}) {
  try {
    const userId   = params.userId ?? params.req?.user?.id ?? 'system';
    const userNome = params.userNome ?? resolveNome(userId);
    const ip       = params.ip ?? (params.req?.headers['x-forwarded-for'] as string | undefined)
                               ?? params.req?.socket?.remoteAddress ?? null;

    db.prepare(`INSERT INTO audit_log (id, userId, userNome, acao, entidade, entidadeId, detalhe, ip, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      generateId(), userId, userNome, params.acao,
      params.entidade, params.entidadeId ?? null, params.detalhe ?? null,
      ip, new Date().toISOString()
    );
  } catch (e) {
    console.warn('[audit] Erro ao registrar auditoria:', e);
  }
}
