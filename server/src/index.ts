import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { seedUsersIfEmpty } from './users';
import authRoutes from './routes/auth';
import emailRoutes from './routes/email';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/email', emailRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

async function main() {
  await seedUsersIfEmpty();
  app.listen(PORT, () => {
    console.log(`[server] MSK API rodando em http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('[server] Falha ao iniciar:', err);
  process.exit(1);
});
