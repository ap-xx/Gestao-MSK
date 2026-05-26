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

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
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
