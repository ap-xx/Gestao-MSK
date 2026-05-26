import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './db/index';
import authRoutes      from './routes/auth';
import emailRoutes     from './routes/email';
import clientesRoutes  from './routes/clientes';
import contratosRoutes from './routes/contratos';
import processosRoutes from './routes/processos';
import lancamentosRoutes from './routes/lancamentos';
import avisosRoutes    from './routes/avisos';
import escritorioRoutes from './routes/escritorio';
import usersRoutes     from './routes/users';
import configRoutes    from './routes/config';
import backupRoutes    from './routes/backup';
import googleRoutes    from './routes/google';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
app.use(cors({
  origin: (origin, cb) => {
    // Permitir requisições sem origin (mobile, Postman, cron) e origens conhecidas
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS bloqueado: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth',        authRoutes);
app.use('/api/email',       emailRoutes);
app.use('/api/clientes',    clientesRoutes);
app.use('/api/contratos',   contratosRoutes);
app.use('/api/processos',   processosRoutes);
app.use('/api/lancamentos', lancamentosRoutes);
app.use('/api/avisos',      avisosRoutes);
app.use('/api/escritorio',  escritorioRoutes);
app.use('/api/users',       usersRoutes);
app.use('/api/config',      configRoutes);
app.use('/api/backup',      backupRoutes);
app.use('/api/google',      googleRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Cron endpoint (sem JWT, autenticado por CRON_SECRET) ──────
// Chamado pelo Render Cron Job ou qualquer scheduler externo.
// Render Cron Job URL: GET https://msk-api.onrender.com/api/cron/gerar-avisos?secret=CRON_SECRET
app.get('/api/cron/gerar-avisos', (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  // Reutiliza a lógica do endpoint de avisos chamando a rota internamente
  fetch(`http://localhost:${PORT}/api/avisos/gerar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CRON_JWT ?? ''}`, 'Content-Type': 'application/json' },
  })
    .then(r => r.json())
    .then(data => res.json({ ok: true, ...data }))
    .catch(err => res.status(500).json({ error: String(err) }));
});

async function main() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`[server] MSK API rodando em http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('[server] Falha ao iniciar:', err);
  process.exit(1);
});
