import { ActivityEntityType, Prisma } from '../../prisma/client';

/** Catalog mutation events recorded on the shared ActivityLog table. */
export type CatalogActivityEvent =
  | 'CREATED'
  | 'UPDATED'
  | 'SOFT_DELETED'
  | 'HARD_DELETED'
  | 'REORDERED'
  | 'TABS_SET'
  | 'ITEMS_CHANGED';

export interface CatalogActor {
  userId?: string;
  name?: string;
}

export interface LogCatalogActivityInput {
  entityType: ActivityEntityType;
  entityId: string;
  event: CatalogActivityEvent;
  actor?: CatalogActor;
  detail?: string;
  meta?: Prisma.InputJsonValue;
}

/**
 * Write a single ActivityLog row inside the given transaction client. Call from
 * every catalog mutation so admin actions are traceable. Read paths never log.
 */
export function logCatalogActivity(
  tx: Prisma.TransactionClient,
  input: LogCatalogActivityInput,
): Promise<unknown> {
  return tx.activityLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      event: input.event,
      detail: input.detail,
      actorUserId: input.actor?.userId,
      actorName: input.actor?.name,
      meta: input.meta,
    },
  });
}
