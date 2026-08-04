import { describe, expect, it } from 'vitest';
import {
  buildAmbiguousPlatformClarification,
  buildDashboardDeepDiveReply,
  buildDirectWeatherReply,
  catalogueGuideFor,
} from './unifiedAssistant.service.js';

describe('assistant topic routing', () => {
  it('does not replace a new unmatched topic with the current page', () => {
    expect(catalogueGuideFor('door', '/settings')).toBeNull();
  });

  it('uses current-page guidance only when the user explicitly references it', () => {
    expect(catalogueGuideFor('What can I do on this page?', '/settings')?.id).toBe('settings');
  });

  it('clarifies the distinct door workflows instead of inheriting CCTV context', () => {
    const result = buildAmbiguousPlatformClarification('door');
    expect(result?.reply).toContain('Which door workflow');
    expect(result?.reply).toContain('Access Logs');
    expect(result?.reply).toContain('Smart Building');
    expect(result?.reply).toContain('Maintenance Center');
    expect(result?.reply).not.toContain('CCTV');
    expect(result?.prompts).toHaveLength(3);
  });
});

describe('buildDirectWeatherReply', () => {
  it('answers with location and temperature before offering deeper navigation', () => {
    const reply = buildDirectWeatherReply('What is the current city and temperature?', {
      hotelProfile: { city: 'London', country: 'United Kingdom' },
      weather: {
        currentWeather: {
          city: 'London',
          country: 'United Kingdom',
          isFresh: true,
          stale: false,
          current: {
            temperatureC: 21,
            feelsLikeC: 20,
            summary: 'Overcast clouds',
            observedAtUtc: '2026-08-03T12:00:00.000Z',
          },
          next24h: {
            summary: 'Overcast clouds',
            lowC: 18,
            highC: 23,
            rainRisk: 'low',
          },
        },
      },
    });

    expect(reply).toContain('London, United Kingdom');
    expect(reply).toContain('current observed temperature is 21°C');
    expect(reply).toContain('overcast clouds');
    expect(reply?.indexOf('London')).toBeLessThan(reply?.indexOf('Open Weather') ?? 0);
  });

  it('states when the city is known but weather data is unavailable', () => {
    const reply = buildDirectWeatherReply('Tell me the weather now', {
      hotelProfile: { city: 'Cape Town', country: 'South Africa' },
      weather: { currentWeather: null },
    });

    expect(reply).toContain('Cape Town, South Africa');
    expect(reply).toContain('current temperature is not available');
  });

  it('does not intercept unrelated platform questions', () => {
    expect(buildDirectWeatherReply('Explain the Rooms page', null)).toBeNull();
  });
});

describe('buildDashboardDeepDiveReply', () => {
  it('selects a live operational risk instead of repeating the dashboard overview', () => {
    const result = buildDashboardDeepDiveReply('pick something on the dashboard and dive deep into it', {
      security: { activeSecurityAlerts: [] },
      smartBuilding: {
        cameraOfflineEvents: [{ id: 'camera-1' }],
        devicesOffline: [{ id: 'device-1' }],
        criticalSensors: [],
        doorForcedOpenEvents: [{ id: 'door-1' }],
      },
      incidents: { criticalIncidents: [] },
      tasks: { overdueTasks: [], highPriority: [] },
      housekeeping: { dirtyRooms: 3, inspectionRooms: 1, outOfServiceRooms: 1 },
      occupancy: { roomsAvailable: 18, roomsTotal: 20, arrivalsToday: 0 },
    });

    expect(result?.reply).toContain('Security and Smart Building');
    expect(result?.reply).toContain('1 offline camera');
    expect(result?.reply).toContain('1 recent forced/held-open door event');
    expect(result?.reply).not.toContain('hotel operations command centre');
    expect(result?.prompts).toHaveLength(3);
  });

  it('uses room-readiness evidence when no higher operational risk exists', () => {
    const result = buildDashboardDeepDiveReply('choose one area and go deeper', {
      security: { activeSecurityAlerts: [] },
      smartBuilding: {
        cameraOfflineEvents: [],
        devicesOffline: [],
        criticalSensors: [],
        doorForcedOpenEvents: [],
      },
      incidents: { criticalIncidents: [] },
      tasks: { overdueTasks: [], highPriority: [] },
      housekeeping: { dirtyRooms: 3, inspectionRooms: 1, outOfServiceRooms: 1 },
      occupancy: { roomsAvailable: 18, roomsTotal: 20, arrivalsToday: 2 },
    });

    expect(result?.reply).toContain('Room readiness');
    expect(result?.reply).toContain('3 dirty');
    expect(result?.reply).toContain('18 available out of 20 rooms');
  });
});
