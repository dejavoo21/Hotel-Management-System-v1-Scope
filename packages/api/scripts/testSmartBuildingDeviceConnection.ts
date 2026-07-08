import { HardwareIntegrationType, HardwareProtocol, HardwareProvider, IoTDeviceType } from '@prisma/client';
import { prisma } from '../src/config/database.js';
import {
  createSmartBuildingDeviceIntegration,
  testSmartBuildingDeviceIntegration,
} from '../src/services/smartBuildingDeviceIntegration.service.js';

async function main() {
  const hotel = await prisma.hotel.findFirst();
  if (!hotel) throw new Error('No hotel found');

  const device = await createSmartBuildingDeviceIntegration(hotel.id, {
    integrationType: HardwareIntegrationType.SMART_DEVICE,
    name: 'Demo Basement Water Leak Sensor',
    location: 'Basement',
    floor: -1,
    roomArea: 'Plant room',
    provider: HardwareProvider.MQTT,
    protocol: HardwareProtocol.MQTT,
    host: 'mqtt://192.0.2.30',
    port: 1883,
    username: 'sensor-user',
    secret: 'sensor-api-key',
    deviceIdentifier: 'demo-basement-water-leak',
    topicPathChannel: 'laflo/demo/basement/water-leak',
    metadata: { deviceType: IoTDeviceType.WATER_LEAK_SENSOR },
  });

  const result = await testSmartBuildingDeviceIntegration(hotel.id, device.id);
  console.log('Smart Building device connection test complete');
  console.log({
    id: result.id,
    provider: result.provider,
    protocol: result.protocol,
    status: result.status,
    healthStatus: result.healthStatus,
    secretReturned: Boolean((result as any).secretCiphertext),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
