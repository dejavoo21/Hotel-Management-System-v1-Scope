import { askCopilot } from '../src/ai/copilot/index.js';
import type { AIHotelContext } from '../src/ai/context/index.js';

const context: AIHotelContext = {
  metadata: {
    generatedAt: new Date().toISOString(),
    hotelId: 'demo-hotel',
    contextVersion: 'hotel-brain-v1',
    sectionsIncluded: ['hotelProfile', 'occupancy', 'maintenance', 'security', 'smartBuilding', 'housekeeping', 'guests', 'messages'],
    warnings: [],
    dataFreshness: {},
    range: {
      from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    },
  },
  hotelProfile: {
    name: 'LaFlo Demo Hotel',
    city: 'New York',
    country: 'USA',
    timezone: 'America/New_York',
    currency: 'USD',
    checkInTime: '15:00',
    checkOutTime: '11:00',
  },
  occupancy: {
    arrivalsToday: 12,
    departuresToday: 9,
    currentInHouseGuests: 48,
  },
  maintenance: {
    urgentFaults: 2,
    openWorkOrders: 7,
  },
  security: {
    activeAlerts: 1,
  },
  smartBuilding: {
    devicesOffline: 2,
    criticalSensors: 1,
  },
  housekeeping: {
    dirtyRooms: 8,
    inspectionRooms: 3,
  },
  guests: {
    vipGuests: [{ name: 'Demo VIP' }],
  },
  messages: {
    openConversations: 4,
  },
};

async function main() {
  const adminUser = {
    id: 'test-admin',
    role: 'ADMIN',
    modulePermissions: [],
  };
  const housekeepingUser = {
    id: 'test-housekeeping',
    role: 'HOUSEKEEPING',
    modulePermissions: ['housekeeping'],
  };

  const questions = [
    'What needs attention today?',
    'Which maintenance items are urgent?',
    'Are there any security risks?',
  ];

  for (const question of questions) {
    const response = await askCopilot('demo-hotel', adminUser.id, question, {
      overrideUser: adminUser,
      overrideContext: context,
      skipAudit: true,
    });
    console.log(`\nQuestion: ${question}`);
    console.log(`Confidence: ${Math.round(response.confidence * 100)}%`);
    console.log(`Cited sections: ${response.citedContextSections.join(', ') || 'none'}`);
    console.log(`Answer: ${response.answer}`);
    console.log(`Actions: ${response.suggestedActions.map((item) => item.title).join(' | ') || 'none'}`);
  }

  const filtered = await askCopilot('demo-hotel', housekeepingUser.id, 'Are there any security risks?', {
    contextScope: ['security', 'housekeeping'],
    overrideUser: housekeepingUser,
    overrideContext: context,
    skipAudit: true,
  });
  console.log('\nRole-aware filtering check:');
  console.log(`Cited sections: ${filtered.citedContextSections.join(', ') || 'none'}`);
  console.log(`Warnings: ${filtered.safetyWarnings.join(' | ') || 'none'}`);
  if (filtered.citedContextSections.includes('security')) {
    throw new Error('Role-aware filtering failed: housekeeping user cited security context');
  }
  console.log('Role-aware filtering passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
