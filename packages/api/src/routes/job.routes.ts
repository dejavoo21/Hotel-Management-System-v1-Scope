/**
 * Job Routes - Protected endpoints for scheduled tasks
 *
 * These routes are protected by X-Job-Secret header, not user authentication.
 * Used by Railway cron jobs or external schedulers.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { processSlaEscalations, SLA_JOB_SECRET } from '../services/ticket.service.js';

const router = Router();

// Middleware to validate job secret
function validateJobSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-job-secret'] as string | undefined;

  if (!SLA_JOB_SECRET) {
    console.warn('SLA_JOB_SECRET not configured - job endpoint disabled');
    res.status(503).json({
      success: false,
      error: 'Job endpoint not configured. Set SLA_JOB_SECRET environment variable.',
    });
    return;
  }

  if (!secret || secret !== SLA_JOB_SECRET) {
    res.status(401).json({
      success: false,
      error: 'Invalid or missing X-Job-Secret header',
    });
    return;
  }

  next();
}

/**
 * POST /api/jobs/sla-escalation/run
 *
 * Processes SLA escalations for all open tickets.
 * Should be called by a cron job (e.g., every 5 minutes).
 *
 * Protected by X-Job-Secret header.
 */
router.post('/sla-escalation/run', validateJobSecret, async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    const result = await processSlaEscalations();
    const durationMs = Date.now() - startTime;

    console.log(`[SLA Escalation Job] Completed in ${durationMs}ms:`, result);

    res.json({
      success: true,
      data: {
        ...result,
        durationMs,
        runAt: new Date().toISOString(),
      },
      message: `Checked ${result.checkedTickets} tickets: ${result.escalationsTriggered} escalated, ${result.overdueResponse} overdue response, ${result.overdueResolution} overdue resolution`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SLA Escalation Job] Failed:', errorMessage);

    res.status(500).json({
      success: false,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    });
  }
});

/**
 * GET /api/jobs/health
 *
 * Health check for job system.
 * Can be used to verify job endpoint is reachable.
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      configured: Boolean(SLA_JOB_SECRET),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
