import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { buildHotelContext } from '../src/ai/context/index.js';

async function main() {
  const hotel = await prisma.hotel.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true },
  });

  if (!hotel) {
    console.log('No hotel found. Seed or create a hotel first.');
    return;
  }

  const context = await buildHotelContext(hotel.id, { limit: 5 });

  console.log(JSON.stringify({
    hotelId: context.metadata.hotelId,
    hotelName: context.hotelProfile?.name || hotel.name,
    generatedAt: context.metadata.generatedAt,
    contextVersion: context.metadata.contextVersion,
    sectionsIncluded: context.metadata.sectionsIncluded,
    warnings: context.metadata.warnings,
    summary: {
      occupancyPercentage: context.occupancy?.occupancyPercentage,
      arrivalsToday: context.occupancy?.arrivalsToday,
      departuresToday: context.occupancy?.departuresToday,
      revenueToday: context.revenue?.revenueToday,
      unpaidInvoices: context.revenue?.unpaidInvoices,
      activeIncidents: Array.isArray(context.incidents?.activeIncidents)
        ? context.incidents?.activeIncidents.length
        : undefined,
      criticalIncidents: Array.isArray(context.incidents?.criticalIncidents)
        ? context.incidents?.criticalIncidents.length
        : undefined,
      activeSecurityAlerts: Array.isArray(context.security?.activeSecurityAlerts)
        ? context.security?.activeSecurityAlerts.length
        : undefined,
      offlineDevices: Array.isArray(context.smartBuilding?.devicesOffline)
        ? context.smartBuilding?.devicesOffline.length
        : undefined,
      openConversations: context.messages?.openConversations,
      outstandingBalances: context.financialSummary?.outstandingBalances,
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
