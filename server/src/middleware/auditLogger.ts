import { db, generateId } from '../db/index';
import { Request, Response, NextFunction } from 'express';

export function auditLog(params: {
  userId: string;
  userNome: string;
  acao: string;      // ex: 'CREATE', 'UPDATE', 'DELETE'
  entidade: string;  // ex: 'clientes', 'processos'
  entidadeId?: string;
  detalhe?: string;
  ip?: string;
}) {
  try {
    db.prepare(`INSERT INTO audit_log (id, userId, userNome, acao, entidade, entidadeId, detalhe, ip, criadoEm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      generateId(), params.userId, params.userNome, params.acao,
      params.entidade, params.entidadeId ?? null, params.detalhe ?? null,
      params.ip ?? null, new Date().toISOString()
    );
  } catch (e) {
    console.warn('[audit] Erro ao registrar auditoria:', e);
  }
}
