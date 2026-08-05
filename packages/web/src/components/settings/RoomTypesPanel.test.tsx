import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RoomTypesPanel from './RoomTypesPanel';
import type { RoomType } from '@/types';

const roomTypes: RoomType[] = [
  { id: 'standard', name: 'Standard', description: 'Essential amenities', baseRate: 99, maxGuests: 2, amenities: ['Wi-Fi', 'TV'], isActive: true },
  { id: 'deluxe', name: 'Deluxe', description: 'Premium city view', baseRate: 149, maxGuests: 3, amenities: ['Wi-Fi', 'TV', 'Air conditioning'], isActive: true },
  { id: 'legacy', name: 'Legacy', description: 'Unavailable category', baseRate: 79, maxGuests: 1, amenities: [], isActive: false },
];

const defaults = { roomTypes, roomCounts: { standard: 12, deluxe: 5, legacy: 1 }, currency: 'ZAR', loading: false, error: false, canEdit: true, saving: false, onRetry: vi.fn(), onCreate: vi.fn().mockResolvedValue(undefined), onUpdate: vi.fn().mockResolvedValue(undefined) };

describe('RoomTypesPanel', () => {
  it('renders currency-aware summaries and room type cards', () => {
    render(<RoomTypesPanel {...defaults} />);
    expect(screen.getByRole('heading', { name: 'Room Types' })).toBeInTheDocument();
    expect(screen.getByText('Total Room Types')).toBeInTheDocument();
    expect(screen.getAllByText(/ZAR/).length).toBeGreaterThan(0);
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Deluxe')).toBeInTheDocument();
    expect(screen.getByText('Last Updated')).toBeInTheDocument();
    expect(screen.getByText('Amenities')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Standard room' })).toHaveAttribute('src', '/assets/rooms/single-room.jpg');
    expect(screen.getByText(/Showing 1–3 of 3 room types/)).toBeInTheDocument();
    expect(screen.getByLabelText('Room types per page')).toHaveValue('10');
  });

  it('searches, filters by status and capacity, and sorts', () => {
    render(<RoomTypesPanel {...defaults} />);
    fireEvent.change(screen.getByPlaceholderText('Search room types...'), { target: { value: 'Deluxe' } });
    expect(screen.getByText('Deluxe')).toBeInTheDocument();
    expect(screen.queryByText('Standard')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search room types...'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Room type status'), { target: { value: 'INACTIVE' } });
    expect(screen.getByText('Legacy')).toBeInTheDocument();
    expect(screen.queryByText('Deluxe')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Room type status'), { target: { value: 'ALL' } });
    fireEvent.change(screen.getByLabelText('Room type capacity'), { target: { value: '3_PLUS' } });
    expect(screen.getByText('Deluxe')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Sort room types'), { target: { value: 'RATE' } });
    expect(screen.getByLabelText('Sort room types')).toHaveValue('RATE');
  });

  it('opens add and edit forms, validates duplicates, and submits data', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<RoomTypesPanel {...defaults} onCreate={onCreate} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Room Type' }));
    expect(screen.getByRole('dialog', { name: 'Add Room Type' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Room type name *'), { target: { value: 'Standard' } });
    fireEvent.change(screen.getByLabelText('Base rate (ZAR) *'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Room Type' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/i);
    fireEvent.change(screen.getByLabelText('Room type name *'), { target: { value: 'Suite' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Room Type' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Suite', baseRate: 120, maxGuests: 2 })));
    const standardCard = screen.getByRole('heading', { name: 'Standard' }).closest('article');
    fireEvent.click(within(standardCard as HTMLElement).getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('dialog', { name: 'Edit Room Type' })).toBeInTheDocument();
    expect(screen.getByLabelText('Room type name *')).toHaveValue('Standard');
  });

  it('uploads, previews, persists, replaces, and removes a preferred room image', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<RoomTypesPanel {...defaults} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Room Type' }));
    const fileInput = document.querySelector('#room-image') as HTMLInputElement;
    const imageFile = new File(['room-photo'], 'suite.webp', { type: 'image/webp' });
    fireEvent.change(fileInput, { target: { files: [imageFile] } });
    const preview = await screen.findByRole('img', { name: 'Selected room preview' });
    expect(preview.getAttribute('src')).toMatch(/^data:image\/webp;base64,/);
    fireEvent.change(screen.getByLabelText('Room type name *'), { target: { value: 'Garden Suite' } });
    fireEvent.change(screen.getByLabelText('Base rate (ZAR) *'), { target: { value: '220' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Room Type' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ images: [expect.stringMatching(/^data:image\/webp;base64,/)] })));

    rerender(<RoomTypesPanel {...defaults} roomTypes={[{ ...roomTypes[0], images: ['data:image/png;base64,cHJlZmVycmVk'] }]} />);
    expect(screen.getByRole('img', { name: 'Standard room' })).toHaveAttribute('src', 'data:image/png;base64,cHJlZmVycmVk');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('img', { name: 'Selected room preview' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('img', { name: 'Selected room preview' })).not.toBeInTheDocument();
  });

  it('rejects unsupported or oversized room images', () => {
    render(<RoomTypesPanel {...defaults} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Room Type' }));
    const fileInput = document.querySelector('#room-image') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['not-an-image'], 'room.txt', { type: 'text/plain' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/JPG, PNG, or WebP/i);
    fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/2 MB or smaller/i);
  });

  it('requires confirmation before disabling and enforces read-only access', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<RoomTypesPanel {...defaults} onUpdate={onUpdate} />);
    const standardCard = screen.getByRole('heading', { name: 'Standard' }).closest('article');
    fireEvent.click(within(standardCard as HTMLElement).getByRole('button', { name: 'More actions for Standard' }));
    fireEvent.click(within(standardCard as HTMLElement).getByRole('button', { name: 'Disable' }));
    expect(screen.getByRole('dialog', { name: /Disable Standard/ })).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Disable room type' }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('standard', { isActive: false }));
    rerender(<RoomTypesPanel {...defaults} canEdit={false} />);
    expect(screen.queryByRole('button', { name: 'Add Room Type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('renders loading, error, empty, and no-results states', () => {
    const { rerender } = render(<RoomTypesPanel {...defaults} loading />);
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    rerender(<RoomTypesPanel {...defaults} loading={false} error />);
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    rerender(<RoomTypesPanel {...defaults} roomTypes={[]} />);
    expect(screen.getByText(/No room types configured yet/i)).toBeInTheDocument();
    rerender(<RoomTypesPanel {...defaults} />);
    fireEvent.change(screen.getByPlaceholderText('Search room types...'), { target: { value: 'missing' } });
    expect(screen.getByText(/No room types match your filters/i)).toBeInTheDocument();
  });
});
