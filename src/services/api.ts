import type { Cliente, Contrato, Processo, Lancamento, Aviso, Escritorio, User, Andamento } from '../types';

const BASE = '/api';

function authHeaders(): HeadersInit {
  const token = sessionStorage.getItem('msk_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as any)?.error ?? `Erro ${res.status}`);
  return data as T;
}

export const clientesApi = {
  getAll:  ()                                    => req<Cliente[]>('GET', '/clientes'),
  getById: (id: string)                          => req<Cliente>('GET', `/clientes/${id}`),
  create:  (c: Omit<Cliente, 'id'>)             => req<Cliente>('POST', '/clientes', c),
  update:  (id: string, c: Partial<Cliente>)    => req<Cliente>('PUT', `/clientes/${id}`, c),
  remove:  (id: string)                          => req<{ok: true}>('DELETE', `/clientes/${id}`),
};

export const contratosApi = {
  getAll:  ()                                     => req<Contrato[]>('GET', '/contratos'),
  getById: (id: string)                           => req<Contrato>('GET', `/contratos/${id}`),
  create:  (c: Omit<Contrato, 'id'>)             => req<Contrato>('POST', '/contratos', c),
  update:  (id: string, c: Partial<Contrato>)    => req<Contrato>('PUT', `/contratos/${id}`, c),
  remove:  (id: string)                           => req<{ok: true}>('DELETE', `/contratos/${id}`),
};

export const processosApi = {
  getAll:       ()                                          => req<Processo[]>('GET', '/processos'),
  getById:      (id: string)                               => req<Processo>('GET', `/processos/${id}`),
  create:       (p: Omit<Processo, 'id'>)                  => req<Processo>('POST', '/processos', p),
  update:       (id: string, p: Partial<Processo>)         => req<Processo>('PUT', `/processos/${id}`, p),
  remove:       (id: string)                               => req<{ok: true}>('DELETE', `/processos/${id}`),
  addAndamento: (id: string, a: Omit<Andamento, 'id' | 'criadoEm'>) =>
                  req<{andamento: Andamento}>('POST', `/processos/${id}/andamentos`, a),
};

export const lancamentosApi = {
  getAll:  ()                                       => req<Lancamento[]>('GET', '/lancamentos'),
  getById: (id: string)                             => req<Lancamento>('GET', `/lancamentos/${id}`),
  create:  (l: Omit<Lancamento, 'id'>)             => req<Lancamento>('POST', '/lancamentos', l),
  update:  (id: string, l: Partial<Lancamento>)    => req<Lancamento>('PUT', `/lancamentos/${id}`, l),
  remove:  (id: string)                             => req<{ok: true}>('DELETE', `/lancamentos/${id}`),
};

export const avisosApi = {
  getAll:     ()                                    => req<Aviso[]>('GET', '/avisos'),
  create:     (a: Omit<Aviso, 'id'>)               => req<Aviso>('POST', '/avisos', a),
  update:     (id: string, a: Partial<Aviso>)      => req<Aviso>('PUT', `/avisos/${id}`, a),
  marcarLido: (id: string)                          => req<Aviso>('PUT', `/avisos/${id}`, { lido: true }),
  remove:     (id: string)                          => req<{ok: true}>('DELETE', `/avisos/${id}`),
  gerar:      ()                                    => req<{criados: number}>('POST', '/avisos/gerar'),
};

export const escritorioApi = {
  get:  ()                  => req<Escritorio>('GET', '/escritorio'),
  save: (e: Escritorio)     => req<Escritorio>('PUT', '/escritorio', e),
};

export const usersApi = {
  getAll:  ()                                                                      => req<User[]>('GET', '/users'),
  create:  (u: { nome: string; email: string; role: string; oab?: string; senha: string }) =>
             req<User>('POST', '/users', u),
  update:  (id: string, u: Partial<User> & { senha?: string })                    => req<User>('PUT', `/users/${id}`, u),
  remove:  (id: string)                                                            => req<{ok: true}>('DELETE', `/users/${id}`),
};

export const configApi = {
  getEmail: () => req<{
    admin:      { user: string; configured: boolean };
    advogado:   { user: string; configured: boolean };
    assistente: { user: string; configured: boolean };
  }>('GET', '/config/email'),
  setEmail: (role: string, appPassword: string) =>
    req<{ok: true}>('PUT', '/config/email', { role, appPassword }),
};

export const backupApi = {
  exportar: () => req<any>('GET', '/backup'),
  importar: (data: any) => req<{ok: true; summary: Record<string, number>}>('POST', '/backup', data),
};
