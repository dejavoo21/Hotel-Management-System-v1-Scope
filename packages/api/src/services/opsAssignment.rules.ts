import type { Department, Prisma, TicketStatus } from '@prisma/client';

type ModulePermission =
  | 'dashboard'
  | 'bookings'
  | 'rooms'
  | 'messages'
  | 'housekeeping'
  | 'inventory'
  | 'calendar'
  | 'guests'
  | 'financials'
  | 'reviews'
  | 'concierge'
  | 'users'
  | 'settings';

type DbClient = Prisma.TransactionClient;

const DEPARTMENT_MODULE_MAP: Record<Department, ModulePermission> = {
  FRONT_DESK: 'bookings',
  HOUSEKEEPING: 'housekeeping',
  MAINTENANCE: 'rooms',
  CONCIERGE: 'concierge',
  BILLING: 'financials',
  MANAGEMENT: 'dashboard',
};

export async function pickAssigneeForDepartment(params: {
  tx: DbClient;
  hotelId: string;
  department: Department;
  openStatus?: TicketStatus;
}): Promise<string | null> {
  const { tx, hotelId, department, openStatus = 'OPEN' } = params;
  const requiredModule = DEPARTMENT_MODULE_MAP[department];

  const eligibleUsers = await tx.user.findMany({
    where: {
      hotelId,
      isActive: true,
      OR: [
        { role: 'ADMIN' },
        { modulePermissions: { has: requiredModule } },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
    },
  });

  if (eligibleUsers.length === 0) {
    return null;
  }

  const eligibleIds = eligibleUsers.map((user) => user.id);

  const currentLoad = await tx.ticket.groupBy({
    by: ['assignedToId'],
    where: {
      hotelId,
      department,
      status: openStatus,
      assignedToId: { in: eligibleIds },
    },
    _count: {
      _all: true,
    },
  });

  const loadByUserId = new Map<string, number>();
  for (const row of currentLoad) {
    if (row.assignedToId) {
      loadByUserId.set(row.assignedToId, row._count._all);
    }
  }

  let selectedUserId: string | null = null;
  let selectedLoad = Number.POSITIVE_INFINITY;

  for (const user of eligibleUsers) {
    const load = loadByUserId.get(user.id) ?? 0;
    if (load < selectedLoad) {
      selectedLoad = load;
      selectedUserId = user.id;
    }
  }

  return selectedUserId;
}

