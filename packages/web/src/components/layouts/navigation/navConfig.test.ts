import { describe, expect, it } from 'vitest';
import { navSections } from './navConfig';

describe('Operations navigation terminology', () => {
  it('contains only the nine consolidated Operations workspaces', () => {
    const operations = navSections.find((section) => section.id === 'operations');

    expect(operations?.items?.map((item) => item.label)).toEqual([
      'Operations Center',
      'Tasks & Advisories',
      'Operational Intelligence',
      'Security Center',
      'Incident Center',
      'Smart Building',
      'AI Recommendations',
      'Hotel Insights',
      'Enterprise Search',
    ]);
    expect(operations?.items?.map((item) => item.label)).not.toEqual(
      expect.arrayContaining(['CCTV', 'Access Logs', 'Visitors', 'Alerts', 'Active Incidents', 'Critical', 'Assigned to Me', 'Resolved', 'Closed', 'Doors', 'Sensors', 'Devices'])
    );
  });

  it('keeps recommendations and hotel information as distinct major workspaces', () => {
    const operations = navSections.find((section) => section.id === 'operations');
    const insightsWorkspace = operations?.items?.find((item) => item.id === 'hotel-insights');

    expect(insightsWorkspace).toMatchObject({
      label: 'Hotel Insights',
      href: '/hotel-insights',
    });
    expect(operations?.items?.find((item) => item.id === 'ai-recommendations')).toMatchObject({
      label: 'AI Recommendations',
      href: '/operations/ai-governance',
    });
    expect(operations?.items?.some((item) => item.label === 'AI Governance')).toBe(false);
    expect(operations?.items?.some((item) => item.label === 'Hotel Brain Console')).toBe(false);
  });

  it('opens Operational Intelligence on its broader overview', () => {
    const operations = navSections.find((section) => section.id === 'operations');
    expect(operations?.items?.find((item) => item.id === 'operational-intelligence')).toMatchObject({
      label: 'Operational Intelligence',
      href: '/operational-intelligence',
    });
  });

  it('labels the guest messaging workspace as Guest Experience Center', () => {
    const guest = navSections.find((section) => section.id === 'guest');
    expect(guest?.items?.find((item) => item.id === 'messages')).toMatchObject({
      label: 'Guest Experience Center',
      href: '/messages?tab=overview',
    });
  });
});
