import { EventEmitter } from 'events';
import crypto from 'crypto';
import { logger } from '../../config/logger.js';

export type PlatformEventMetadata = {
  eventId: string;
  eventType: string;
  hotelId: string;
  source: string;
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
  publishedAt: string;
  schemaVersion: number;
  userId?: string;
};

export type PlatformEvent<TPayload = unknown> = {
  metadata: PlatformEventMetadata;
  payload: TPayload;
};

export type PublishEventInput<TPayload = unknown> = {
  eventType: string;
  hotelId: string;
  payload: TPayload;
  source: string;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  schemaVersion?: number;
  userId?: string;
};

export type EventHandler<TPayload = unknown> = (event: PlatformEvent<TPayload>) => void | Promise<void>;
export type Unsubscribe = () => void;

const WILDCARD_EVENT = '*';
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;

class InMemoryEventBus {
  private readonly emitter = new EventEmitter();
  private readonly publishedIdempotencyKeys = new Map<string, number>();

  async publish<TPayload>(input: PublishEventInput<TPayload>): Promise<PlatformEvent<TPayload>> {
    this.pruneIdempotencyKeys();

    const correlationId = input.correlationId || crypto.randomUUID();
    const idempotencyScope = input.idempotencyKey
      ? `${input.hotelId}:${input.eventType}:${input.idempotencyKey}`
      : null;

    if (idempotencyScope && this.publishedIdempotencyKeys.has(idempotencyScope)) {
      logger.debug('Skipping duplicate platform event', {
        eventType: input.eventType,
        hotelId: input.hotelId,
        idempotencyKey: input.idempotencyKey,
      });
      return {
        metadata: {
          eventId: crypto.randomUUID(),
          eventType: input.eventType,
          hotelId: input.hotelId,
          source: input.source,
          correlationId,
          causationId: input.causationId,
          idempotencyKey: input.idempotencyKey,
          publishedAt: new Date().toISOString(),
          schemaVersion: input.schemaVersion || 1,
          userId: input.userId,
        },
        payload: input.payload,
      };
    }

    const event: PlatformEvent<TPayload> = {
      metadata: {
        eventId: crypto.randomUUID(),
        eventType: input.eventType,
        hotelId: input.hotelId,
        source: input.source,
        correlationId,
        causationId: input.causationId,
        idempotencyKey: input.idempotencyKey,
        publishedAt: new Date().toISOString(),
        schemaVersion: input.schemaVersion || 1,
        userId: input.userId,
      },
      payload: input.payload,
    };

    if (idempotencyScope) {
      this.publishedIdempotencyKeys.set(idempotencyScope, Date.now() + IDEMPOTENCY_TTL_MS);
    }

    this.emitter.emit(input.eventType, event);
    this.emitter.emit(WILDCARD_EVENT, event);
    return event;
  }

  subscribe<TPayload>(eventType: string, handler: EventHandler<TPayload>): Unsubscribe {
    const wrapped = (event: PlatformEvent<TPayload>) => {
      Promise.resolve(handler(event)).catch((error) => {
        logger.error('Platform event handler failed', {
          eventType,
          eventId: event.metadata.eventId,
          correlationId: event.metadata.correlationId,
          error,
        });
      });
    };

    this.emitter.on(eventType, wrapped);
    return () => this.emitter.off(eventType, wrapped);
  }

  subscribeAll(handler: EventHandler): Unsubscribe {
    return this.subscribe(WILDCARD_EVENT, handler);
  }

  private pruneIdempotencyKeys() {
    const now = Date.now();
    for (const [key, expiresAt] of this.publishedIdempotencyKeys.entries()) {
      if (expiresAt <= now) {
        this.publishedIdempotencyKeys.delete(key);
      }
    }
  }
}

export const eventBus = new InMemoryEventBus();

