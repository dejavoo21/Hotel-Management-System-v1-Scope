import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HotelInfoPanel, { type HotelInfoForm } from './HotelInfoPanel';

const savedValues: HotelInfoForm = {
  name: 'Grand Palace Hotel',
  address: '123 Main Street, Downtown',
  addressLine1: 'Block A, 5th Floor',
  city: 'Johannesburg',
  country: 'South Africa',
  currency: 'ZAR',
  timezone: 'Africa/Johannesburg',
};

const currencyOptions = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'ZAR', label: 'ZAR — South African Rand' },
  { value: 'NGN', label: 'NGN — Nigerian Naira' },
];
const timezoneOptions = [
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos' },
];

function Harness({ canEdit = true, onSave = vi.fn().mockResolvedValue(undefined), onOpenOperations = vi.fn() }: { canEdit?: boolean; onSave?: () => Promise<void>; onOpenOperations?: () => void }) {
  const [values, setValues] = useState(savedValues);
  return <HotelInfoPanel values={values} savedValues={savedValues} currencyOptions={currencyOptions} timezoneOptions={timezoneOptions} canEdit={canEdit} saving={false} onChange={setValues} onSave={onSave} onReset={() => setValues(savedValues)} onOpenOperations={onOpenOperations} />;
}

describe('HotelInfoPanel', () => {
  it('renders the profile summary, grouped fields, and operational guidance', () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: 'Hotel Information' })).toBeInTheDocument();
    expect(screen.getByText('Profile complete')).toBeInTheDocument();
    expect(screen.getByText('Grand Palace Hotel')).toBeInTheDocument();
    expect(screen.getByText('Johannesburg, South Africa')).toBeInTheDocument();
    expect(screen.getByText('Operational Forecast Signals')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('tracks changes, resets the form, and submits valid values', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Hotel Name *'), { target: { value: 'LaFlo City Hotel' } });
    expect(screen.getByText('You have unsaved changes.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reset changes' }));
    expect(screen.getByLabelText('Hotel Name *')).toHaveValue('Grand Palace Hotel');
    fireEvent.change(screen.getByLabelText('Hotel Name *'), { target: { value: 'LaFlo City Hotel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('validates required fields before saving', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<Harness onSave={onSave} />);
    fireEvent.change(screen.getByLabelText('Hotel Name *'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('City *'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Hotel name is required.')).toBeInTheDocument();
    expect(screen.getByText('City is required.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('automatically applies the mapped currency when the country changes', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Country *'), { target: { value: 'Nigeria' } });
    expect(screen.getByLabelText('Currency *')).toHaveValue('NGN');
    expect(screen.getByText(/Currency is automatically set from Nigeria/)).toBeInTheDocument();
  });

  it('enforces read-only mode and opens the Operations Center', () => {
    const onOpenOperations = vi.fn();
    render(<Harness canEdit={false} onOpenOperations={onOpenOperations} />);
    expect(screen.getByLabelText('Hotel Name *')).toBeDisabled();
    expect(screen.getByText('You have read-only access.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Operations Center' }));
    expect(onOpenOperations).toHaveBeenCalledTimes(1);
  });
});
