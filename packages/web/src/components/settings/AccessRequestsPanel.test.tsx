import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AccessRequestsPanel from './AccessRequestsPanel';
import type { AccessRequest } from '@/types';

const roles = [
  { value: 'RECEPTIONIST', label: 'Receptionist' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'ADMIN', label: 'Admin' },
];

const requests: AccessRequest[] = [
  {
    id: 'pending-1', fullName: 'Emily Johnson', email: 'emily@demo.hotel', company: 'Grand Palace Hotel',
    role: 'RECEPTIONIST', status: 'PENDING', createdAt: '2026-08-01T08:15:00.000Z', updatedAt: '2026-08-01T08:15:00.000Z',
    message: 'Please provide access for the reception team.',
  },
  {
    id: 'approved-1', fullName: 'Longe Ade', email: 'lawrences@laflogroup.com', company: 'Laflo',
    role: 'RECEPTIONIST', status: 'APPROVED', createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T11:30:00.000Z',
  },
  {
    id: 'info-1', fullName: 'Lena Parker', email: 'lena@demo.hotel', company: 'Grand Palace Hotel',
    role: 'MANAGER', status: 'INFO_RECEIVED', createdAt: '2026-08-02T09:07:00.000Z', updatedAt: '2026-08-02T10:00:00.000Z', lastReplyAt: '2026-08-02T09:55:00.000Z',
    adminNotes: 'Please provide proof of employment.',
  },
  {
    id: 'rejected-1', fullName: 'Michael Chen', email: 'michael@demo.hotel', company: 'Laflo',
    role: 'ADMIN', status: 'REJECTED', createdAt: '2026-07-12T16:32:00.000Z', updatedAt: '2026-07-12T17:00:00.000Z',
  },
];

const defaultProps = {
  requests,
  isLoading: false,
  isError: false,
  currentUserEmail: 'admin@laflogroup.com',
  roleOptions: roles,
  selectedRoles: {},
  onRoleChange: vi.fn(),
  onRetry: vi.fn(),
  onApprove: vi.fn().mockResolvedValue(undefined),
  onResend: vi.fn().mockResolvedValue(undefined),
  onReject: vi.fn(),
  onRequestInfo: vi.fn(),
  onViewResponse: vi.fn(),
  onDelete: vi.fn().mockResolvedValue(undefined),
};

describe('AccessRequestsPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders summary cards, request details, status pills, and protected action sets', () => {
    render(<AccessRequestsPanel {...defaultProps} />);

    expect(screen.getByText('Pending Requests')).toBeInTheDocument();
    expect(screen.getByText('Approved This Month')).toBeInTheDocument();
    expect(screen.getByText('More Info Required')).toBeInTheDocument();
    expect(screen.getByText('Emily Johnson')).toBeInTheDocument();
    expect(screen.getByText('emily@demo.hotel')).toBeInTheDocument();
    expect(screen.getByText('Info Received')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend setup' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(2);
  });

  it('filters by search, status, role, and company', async () => {
    render(<AccessRequestsPanel {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('Search requests by name or email...'), { target: { value: 'Lena' } });
    expect(screen.getByText('Lena Parker')).toBeInTheDocument();
    expect(screen.queryByText('Emily Johnson')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search requests by name or email...'), { target: { value: '' } });
    fireEvent.click(screen.getByLabelText('Filter by status'));
    fireEvent.click(await screen.findByRole('option', { name: 'Approved' }));
    expect(screen.getByText('Longe Ade')).toBeInTheDocument();
    expect(screen.queryByText('Lena Parker')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Filter by status'));
    fireEvent.click(await screen.findByRole('option', { name: 'All Statuses' }));
    fireEvent.click(screen.getByLabelText('Filter by role'));
    fireEvent.click(await screen.findByRole('option', { name: 'Admin' }));
    expect(screen.getByText('Michael Chen')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Filter by role'));
    fireEvent.click(await screen.findByRole('option', { name: 'All Roles' }));
    fireEvent.click(screen.getByLabelText('Filter by company'));
    fireEvent.click(await screen.findByRole('option', { name: 'Grand Palace Hotel' }));
    expect(screen.getByText('Emily Johnson')).toBeInTheDocument();
    expect(screen.queryByText('Longe Ade')).not.toBeInTheDocument();
  });

  it('changes roles, expands notes, and routes row actions', async () => {
    const onRoleChange = vi.fn();
    const onRequestInfo = vi.fn();
    const onReject = vi.fn();
    const onViewResponse = vi.fn();
    render(<AccessRequestsPanel {...defaultProps} onRoleChange={onRoleChange} onRequestInfo={onRequestInfo} onReject={onReject} onViewResponse={onViewResponse} />);

    fireEvent.click(screen.getByLabelText('Role for Emily Johnson'));
    fireEvent.click(await screen.findByRole('option', { name: 'Manager' }));
    expect(onRoleChange).toHaveBeenCalledWith('pending-1', 'MANAGER');

    const emilyRow = screen.getByText('Emily Johnson').closest('tr');
    fireEvent.click(within(emilyRow!).getByRole('button', { name: 'Request info' }));
    fireEvent.click(within(emilyRow!).getByRole('button', { name: 'Reject' }));
    expect(onRequestInfo).toHaveBeenCalledWith(requests[0]);
    expect(onReject).toHaveBeenCalledWith(requests[0]);

    fireEvent.click(screen.getByLabelText('Toggle notes for Lena Parker'));
    expect(screen.getByText(/Please provide proof of employment/)).toBeInTheDocument();
    const lenaRow = screen.getByText('Lena Parker').closest('tr');
    fireEvent.click(within(lenaRow!).getByRole('button', { name: 'View response' }));
    expect(onViewResponse).toHaveBeenCalledWith(requests[2]);
  });

  it('confirms approve, resend, and delete actions and blocks self-approval', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onResend = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<AccessRequestsPanel {...defaultProps} onApprove={onApprove} onResend={onResend} onDelete={onDelete} />);

    const emilyRow = screen.getByText('Emily Johnson').closest('tr');
    fireEvent.click(within(emilyRow!).getByRole('button', { name: 'Approve' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve and send invite' }));
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith(requests[0], 'RECEPTIONIST'));

    fireEvent.click(screen.getByRole('button', { name: 'Resend setup' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Resend setup' }));
    await waitFor(() => expect(onResend).toHaveBeenCalledWith(requests[1], 'RECEPTIONIST'));

    fireEvent.click(screen.getByLabelText('Delete request from Michael Chen'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete request' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(requests[3]));

    rerender(<AccessRequestsPanel {...defaultProps} currentUserEmail="emily@demo.hotel" />);
    expect(within(screen.getByText('Emily Johnson').closest('tr')!).getByRole('button', { name: 'Approve' })).toBeDisabled();
  });

  it('shows loading, error, empty, and no-results states', () => {
    const { rerender } = render(<AccessRequestsPanel {...defaultProps} isLoading />);
    expect(screen.getByLabelText('Loading access requests')).toBeInTheDocument();

    rerender(<AccessRequestsPanel {...defaultProps} isLoading={false} isError />);
    expect(screen.getByText('Access requests could not be loaded.')).toBeInTheDocument();

    rerender(<AccessRequestsPanel {...defaultProps} requests={[]} />);
    expect(screen.getByText('No access requests yet.')).toBeInTheDocument();

    rerender(<AccessRequestsPanel {...defaultProps} />);
    fireEvent.change(screen.getByPlaceholderText('Search requests by name or email...'), { target: { value: 'nobody' } });
    expect(screen.getByText('No access requests match your filters.')).toBeInTheDocument();
  });

  it('paginates larger result sets and exports only non-sensitive request fields', () => {
    const manyRequests = Array.from({ length: 9 }, (_, index): AccessRequest => ({
      ...requests[0],
      id: `request-${index + 1}`,
      fullName: `Requester ${index + 1}`,
      email: `requester${index + 1}@example.com`,
    }));
    const createObjectURL = vi.fn().mockReturnValue('blob:access-requests');
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });

    render(<AccessRequestsPanel {...defaultProps} requests={manyRequests} />);
    expect(screen.getByText('Showing 1 to 8 of 9 requests')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByText('Showing 9 to 9 of 9 requests')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:access-requests');
    click.mockRestore();
  });
});
