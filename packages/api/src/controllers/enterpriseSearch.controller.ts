import type { NextFunction, Response } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { recordAuditEvent } from '../platform/audit/auditEngine.service.js';
import { eventBus } from '../platform/event-bus/eventBus.service.js';
import {
  answerHotelBrainQuestion,
  rebuildSearchIndex,
  searchEnterpriseIndex,
} from '../search/enterpriseSearch.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const searchSchema = z.object({
  q: z.string().optional(),
  categories: z.string().optional(),
  sourceModules: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  severity: z.string().optional(),
  ownerId: z.string().optional(),
  department: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const brainSchema = z.object({
  question: z.string().trim().min(2).max(1000),
});

function actorFrom(req: AuthenticatedRequest) {
  return {
    userId: req.user!.id,
    role: req.user!.role,
    modulePermissions: req.user!.modulePermissions || [],
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

function auditActor(req: AuthenticatedRequest) {
  return {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
  };
}

function splitList(value?: string) {
  return value?.split(',').map((item) => item.trim()).filter(Boolean);
}

function canRebuildSearchIndex(req: AuthenticatedRequest) {
  if (!req.user) return false;
  if (req.user.role === Role.ADMIN || req.user.role === Role.MANAGER) return true;
  const permissions = req.user.modulePermissions || [];
  return permissions.includes('settings') || permissions.includes('users');
}

export async function search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = searchSchema.parse(req.query);
    const actor = actorFrom(req);
    const filters = {
      query: parsed.q,
      categories: splitList(parsed.categories),
      sourceModules: splitList(parsed.sourceModules),
      status: parsed.status,
      priority: parsed.priority,
      severity: parsed.severity,
      ownerId: parsed.ownerId,
      department: parsed.department,
      dateFrom: parsed.dateFrom ? new Date(parsed.dateFrom) : undefined,
      dateTo: parsed.dateTo ? new Date(parsed.dateTo) : undefined,
      limit: parsed.limit,
    };

    await eventBus.publish({
      eventType: 'enterpriseSearch.query.submitted',
      hotelId: req.user!.hotelId,
      source: 'enterprise-search',
      userId: req.user!.id,
      payload: {
        query: parsed.q || '',
        filters: {
          ...filters,
          dateFrom: filters.dateFrom?.toISOString(),
          dateTo: filters.dateTo?.toISOString(),
        },
      },
    });

    const result = await searchEnterpriseIndex(req.user!.hotelId, actor, filters);

    if (result.restrictedCount > 0) {
      await eventBus.publish({
        eventType: 'enterpriseSearch.permissionDenied',
        hotelId: req.user!.hotelId,
        source: 'enterprise-search',
        userId: req.user!.id,
        payload: {
          query: parsed.q || '',
          restrictedCount: result.restrictedCount,
        },
      });

      await recordAuditEvent({
        hotelId: req.user!.hotelId,
        actor: auditActor(req),
        action: 'ENTERPRISE_SEARCH_RESTRICTED_RESULTS_OMITTED',
        entity: 'ENTERPRISE_SEARCH',
        entityId: req.user!.id,
        source: 'enterprise-search',
        details: {
          query: parsed.q || '',
          restrictedCount: result.restrictedCount,
          reason: 'User lacks module access for one or more indexed records.',
        },
      });
    }

    await recordAuditEvent({
      hotelId: req.user!.hotelId,
      actor: auditActor(req),
      action: 'ENTERPRISE_SEARCH_QUERY_SUBMITTED',
      entity: 'ENTERPRISE_SEARCH',
      entityId: req.user!.id,
      source: 'enterprise-search',
      details: {
        query: parsed.q || '',
        filters: {
          categories: filters.categories,
          sourceModules: filters.sourceModules,
          status: filters.status,
          priority: filters.priority,
          severity: filters.severity,
        },
        resultCategories: result.groups.map((group) => group.category),
        resultCount: result.total,
        restrictedCount: result.restrictedCount,
      },
    });

    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid search query', errors: error.errors });
      return;
    }
    next(error);
  }
}

export async function rebuild(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!canRebuildSearchIndex(req)) {
      await eventBus.publish({
        eventType: 'enterpriseSearch.permissionDenied',
        hotelId: req.user!.hotelId,
        source: 'enterprise-search',
        userId: req.user!.id,
        payload: {
          action: 'rebuild',
          reason: 'INSUFFICIENT_PERMISSIONS',
        },
      });

      await recordAuditEvent({
        hotelId: req.user!.hotelId,
        actor: auditActor(req),
        action: 'ENTERPRISE_SEARCH_PERMISSION_DENIED',
        entity: 'ENTERPRISE_SEARCH',
        entityId: req.user!.id,
        source: 'enterprise-search',
        details: {
          action: 'rebuild',
          requiredAccess: ['ADMIN', 'MANAGER', 'settings', 'users'],
        },
      });

      res.status(403).json({
        success: false,
        error: 'Permission denied. Search index rebuild requires manager, admin, or settings access.',
        code: 'PERMISSION_DENIED',
      });
      return;
    }

    const result = await rebuildSearchIndex(req.user!.hotelId, actorFrom(req));
    await recordAuditEvent({
      hotelId: req.user!.hotelId,
      actor: auditActor(req),
      action: 'ENTERPRISE_SEARCH_INDEX_REBUILT',
      entity: 'ENTERPRISE_SEARCH',
      entityId: req.user!.hotelId,
      source: 'enterprise-search',
      details: result,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function askHotelBrain(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const parsed = brainSchema.parse(req.body || {});
    await eventBus.publish({
      eventType: 'hotelBrain.query.submitted',
      hotelId: req.user!.hotelId,
      source: 'hotel-brain',
      userId: req.user!.id,
      payload: { questionLength: parsed.question.length },
    });
    const answer = await answerHotelBrainQuestion(req.user!.hotelId, actorFrom(req), parsed.question);

    await eventBus.publish({
      eventType: 'hotelBrain.summary.generated',
      hotelId: req.user!.hotelId,
      source: 'hotel-brain',
      userId: req.user!.id,
      payload: {
        confidence: answer.confidence,
        supportingRecordCount: answer.supportingRecords.length,
        citedContextSections: answer.citedContextSections,
      },
    });

    if (answer.suggestedActions.length > 0) {
      await eventBus.publish({
        eventType: 'hotelBrain.action.suggested',
        hotelId: req.user!.hotelId,
        source: 'hotel-brain',
        userId: req.user!.id,
        payload: {
          actionCount: answer.suggestedActions.length,
          actions: answer.suggestedActions.map((action) => ({
            title: action.title,
            department: action.department,
            priority: action.priority,
            requiresConfirmation: action.requiresConfirmation,
          })),
        },
      });

      await recordAuditEvent({
        hotelId: req.user!.hotelId,
        actor: auditActor(req),
        action: 'HOTEL_BRAIN_ACTION_SUGGESTED',
        entity: 'HOTEL_BRAIN',
        entityId: req.user!.id,
        source: 'hotel-brain',
        details: {
          actionCount: answer.suggestedActions.length,
          actions: answer.suggestedActions.map((action) => ({
            title: action.title,
            department: action.department,
            priority: action.priority,
            requiresConfirmation: action.requiresConfirmation,
          })),
        },
      });
    }

    await recordAuditEvent({
      hotelId: req.user!.hotelId,
      actor: auditActor(req),
      action: 'HOTEL_BRAIN_ANSWER_GENERATED',
      entity: 'HOTEL_BRAIN',
      entityId: req.user!.id,
      source: 'hotel-brain',
      details: {
        question: parsed.question,
        supportingRecordCount: answer.supportingRecords.length,
        confidence: answer.confidence,
        citedContextSections: answer.citedContextSections,
        safetyWarnings: answer.safetyWarnings,
      },
    });

    res.json({ success: true, data: answer });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: 'Invalid Hotel Brain question', errors: error.errors });
      return;
    }
    next(error);
  }
}
