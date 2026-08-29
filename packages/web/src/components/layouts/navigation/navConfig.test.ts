import { describe, expect, it } from 'vitest';
import { navSections } from './navConfig';

describe('Operations navigation terminology', () => {
  it('contains only the nine major Operations workspaces', () => {
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

  it('labels the existing governance route as AI Recommendations', () => {
    const operations = navSections.find((section) => section.id === 'operations');
    const recommendationWorkspace = operations?.items?.find((item) => item.id === 'operations-ai');

    expect(recommendationWorkspace).toMatchObject({
      label: 'AI Recommendations',
      href: '/operations/ai-governance',
    });
    expect(operations?.items?.some((item) => item.label === 'AI Governance')).toBe(false);
  });

  it('labels the existing Hotel Brain route as Hotel Insights', () => {
    const operations = navSections.find((section) => section.id === 'operations');
    const insightsWorkspace = operations?.items?.find((item) => item.id === 'hotel-brain');

    expect(insightsWorkspace).toMatchObject({
      label: 'Hotel Insights',
      href: '/operations/hotel-brain-console',
    });
    expect(operations?.items?.some((item) => item.label === 'Hotel Brain Console')).toBe(false);
  });
});
