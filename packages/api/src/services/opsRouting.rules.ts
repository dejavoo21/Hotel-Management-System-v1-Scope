import type { Department } from '@prisma/client';

export type AdvisoryPriority = 'low' | 'medium' | 'high';

export function routeOpsAdvisory(input: {
  title: string;
  reason?: string;
  priority?: AdvisoryPriority;
}): { department: Department; priority: AdvisoryPriority } {
  const text = `${input.title} ${input.reason ?? ''}`.toLowerCase();

  // Weather / safety / outdoor risk -> Front Desk or Maintenance
  if (/(storm|thunder|lightning|flood|evacuat|safety|hazard)/.test(text)) {
    return { department: 'FRONT_DESK', priority: 'high' };
  }
  if (/(wind|secure outdoor|furniture|terrace|poolside|awning)/.test(text)) {
    return { department: 'MAINTENANCE', priority: input.priority ?? 'medium' };
  }

  // Guest supplies / public areas -> Housekeeping
  if (/(umbrella|drying|mats|towels|lobby|spill|wet floor|linen)/.test(text)) {
    return { department: 'HOUSEKEEPING', priority: input.priority ?? 'medium' };
  }

  // Guest experience / activities -> Concierge
  if (/(indoor options|activities|tour|transport|itinerary|plan)/.test(text)) {
    return { department: 'CONCIERGE', priority: input.priority ?? 'low' };
  }

  // Pricing / revenue -> Management
  if (/(rate|pricing|promo|discount|occupancy|demand)/.test(text)) {
    return { department: 'MANAGEMENT', priority: input.priority ?? 'medium' };
  }

  // Default
  return { department: 'FRONT_DESK', priority: input.priority ?? 'medium' };
}
