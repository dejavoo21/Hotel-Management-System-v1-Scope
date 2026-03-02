import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { openai, OPENAI_MODEL } from '../config/openai.js';

const router = Router();

router.use(authenticate);

router.get('/health', (_req, res) => {
  const provider = (process.env.ASSISTANT_PROVIDER ?? '').toLowerCase();
  const enabled = Boolean(openai) && provider !== 'none';

  res.json({
    success: true,
    data: {
      enabled,
      provider: provider || 'openai',
      model: OPENAI_MODEL,
      reason: enabled
        ? null
        : !process.env.OPENAI_API_KEY
          ? 'OPENAI_API_KEY missing'
          : provider === 'none'
            ? 'ASSISTANT_PROVIDER=none'
            : 'OpenAI client not initialized',
    },
  });
});

export default router;

