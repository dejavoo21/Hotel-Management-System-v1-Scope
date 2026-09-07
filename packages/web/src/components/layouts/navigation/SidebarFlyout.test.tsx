import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { SidebarFlyout } from './SidebarFlyout';

describe('SidebarFlyout', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: {
        id: 'admin-1',
        email: 'admin@laflo.test',
        role: 'ADMIN',
        modulePermissions: [],
      } as never,
    });
  });

  it('renders Operations as a fixed overlay flyout without sub-area menu items', () => {
    render(
      <MemoryRouter initialEntries={['/operations-center']}>
        <SidebarFlyout
          openSection="operations"
          onFlyoutEnter={vi.fn()}
          onFlyoutLeave={vi.fn()}
          onItemClick={vi.fn()}
          onClickOutside={vi.fn()}
        />
      </MemoryRouter>
    );

    const flyout = screen.getByRole('menu', { name: 'Operations navigation' });
    expect(flyout).toHaveAttribute('data-positioning', 'overlay');
    expect(flyout).toHaveClass('fixed', 'left-[68px]', 'w-72');
    expect(screen.getAllByRole('menuitem')).toHaveLength(9);
    expect(screen.getByRole('menuitem', { name: /Operations Center/ })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'CCTV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Active Incidents' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Doors' })).not.toBeInTheDocument();
  });
});
