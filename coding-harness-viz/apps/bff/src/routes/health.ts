import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '@coding-harness/shared';
import * as multica from '../services/multica-cli.js';
import * as github from '../services/github.js';

export async function healthRoute(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => {
    const [multicaCli, gh] = await Promise.all([
      multica.checkCli(),
      github.checkGithub(),
    ]);

    const body: HealthResponse = {
      ok: multicaCli && gh,
      multicaCli,
      github: gh,
    };
    return body;
  });
}
