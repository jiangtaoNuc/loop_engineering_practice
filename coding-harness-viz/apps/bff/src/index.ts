import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { issueRoutes } from './routes/issues.js';
import { healthRoute } from './routes/health.js';

const PORT = parseInt(process.env.BFF_PORT ?? '3300', 10);

async function main() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, { origin: true });

  await app.register(issueRoutes);
  await app.register(healthRoute);

  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`BFF listening on http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error('BFF failed to start:', err);
  process.exit(1);
});
