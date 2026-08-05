import { useMemo, useRef, useState } from 'react';
import {
  Bath,
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Crown,
  Layers3,
  MoreVertical,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  ImagePlus,
  Trash2,
  Tv,
  Users,
  WalletCards,
  Wifi,
  X,
} from 'lucide-react';
import type { RoomType } from '@/types';

type RoomTypeInput = Pick<RoomType, 'name' | 'description' | 'baseRate' | 'maxGuests' | 'amenities' | 'images' | 'isActive'>;

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(value);
}

const roomImages: Record<string, string> = {
  standard: '/assets/rooms/single-room.jpg',
  single: '/assets/rooms/single-room.jpg',
  twin: '/assets/rooms/twin-room.jpg',
  double: '/assets/rooms/double-room.jpg',
  queen: '/assets/rooms/queen-room.jpg',
  deluxe: '/assets/rooms/deluxe-room.jpg',
  king: '/assets/rooms/king-room.jpg',
  suite: '/assets/rooms/suite-room.jpg',
};

function roomImage(roomType: RoomType) {
  const preferredImage = roomType.images?.find(Boolean);
  if (preferredImage) return preferredImage;
  const normalized = roomType.name.trim().toLowerCase();
  return roomImages[normalized] || roomImages[Object.keys(roomImages).find((key) => normalized.includes(key)) || 'standard'];
}

function AmenityIcon({ amenity }: { amenity: string }) {
  const value = amenity.toLowerCase();
  const Icon = value.includes('wifi') || value.includes('wi-fi') ? Wifi
    : value.includes('tv') || value.includes('television') ? Tv
      : value.includes('air') || value.includes('conditioning') ? Snowflake
        : value.includes('coffee') || value.includes('tea') ? Coffee
          : value.includes('bath') || value.includes('shower') ? Bath
            : Sparkles;
  return <Icon className="h-4 w-4" aria-label={amenity} />;
}

function RoomTypeBadge({ name }: { name: string }) {
  const value = name.toLowerCase();
  if (value.includes('deluxe') || value.includes('king')) return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Crown className="h-5 w-5" /></span>;
  if (value.includes('double')) return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Users className="h-5 w-5" /></span>;
  if (value.includes('queen')) return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600"><Sparkles className="h-5 w-5" /></span>;
  if (value.includes('twin')) return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><BedDouble className="h-5 w-5" /></span>;
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><BedDouble className="h-5 w-5" /></span>;
}

export default function RoomTypesPanel({ roomTypes, roomCounts = {}, currency, loading, error, canEdit, saving, onRetry, onCreate, onUpdate }: { roomTypes: RoomType[]; roomCounts?: Record<string, number>; currency: string; loading: boolean; error: boolean; canEdit: boolean; saving: boolean; onRetry: () => void; onCreate: (input: RoomTypeInput) => Promise<void>; onUpdate: (id: string, input: Partial<RoomTypeInput>) => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [capacity, setCapacity] = useState('ALL');
  const [sort, setSort] = useState('NAME');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoomType | null | 'NEW'>(null);
  const [disabling, setDisabling] = useState<RoomType | null>(null);
  const active = roomTypes.filter((item) => item.isActive);
  const averageRate = active.length ? active.reduce((total, item) => total + Number(item.baseRate), 0) / active.length : 0;
  const highestCapacity = roomTypes.reduce((highest, item) => Math.max(highest, item.maxGuests), 0);
  const visible = useMemo(() => roomTypes.filter((item) => {
    const matchesSearch = !search.trim() || `${item.name} ${item.description || ''}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesStatus = status === 'ALL' || (status === 'ACTIVE' ? item.isActive : !item.isActive);
    const matchesCapacity = capacity === 'ALL' || (capacity === '3_PLUS' ? item.maxGuests >= 3 : item.maxGuests === Number(capacity));
    return matchesSearch && matchesStatus && matchesCapacity;
  }).sort((a, b) => sort === 'RATE' ? Number(a.baseRate) - Number(b.baseRate) : sort === 'CAPACITY' ? b.maxGuests - a.maxGuests : a.name.localeCompare(b.name)), [capacity, roomTypes, search, sort, status]);
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRoomTypes = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageStart = visible.length ? (currentPage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(currentPage * pageSize, visible.length);
  const fetchedAt = new Date();

  if (loading) return <div className="space-y-4"><div className="h-16 animate-pulse rounded-2xl bg-border/60" /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl bg-border/60" />)}</div></div>;
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700"><p className="font-semibold">Room types could not be loaded.</p><button type="button" className="btn-outline mt-4" onClick={onRetry}>Try again</button></div>;

  return <div className="space-y-4 pb-16">
    <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100"><BedDouble className="h-6 w-6" /></span><div><h2 className="text-2xl font-bold tracking-tight text-text-main">Room Types</h2><p className="mt-1 text-sm text-text-muted">Manage your room categories, rates, occupancy limits and amenities.</p></div></div>{canEdit ? <button type="button" aria-label="Add Room Type" className="btn-primary" onClick={() => setEditing('NEW')}><span aria-hidden="true" className="text-lg leading-none">+</span>Add Room Type</button> : null}</header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Room type summary">
      <article className="rounded-2xl border border-blue-100 bg-card p-4 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><Layers3 className="h-5 w-5" /></span><p className="mt-2 text-xs font-semibold text-text-muted">Total Room Types</p><p className="mt-1 text-xl font-bold text-text-main">{roomTypes.length}</p><p className="text-xs text-text-muted">Active categories</p></article>
      <article className="rounded-2xl border border-emerald-100 bg-card p-4 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><WalletCards className="h-5 w-5" /></span><p className="mt-2 text-xs font-semibold text-text-muted">Average Base Rate</p><p className="mt-1 text-xl font-bold text-text-main">{formatCurrency(averageRate, currency)}</p><p className="text-xs text-text-muted">Across active types</p></article>
      <article className="rounded-2xl border border-violet-100 bg-card p-4 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Users className="h-5 w-5" /></span><p className="mt-2 text-xs font-semibold text-text-muted">Highest Capacity</p><p className="mt-1 text-xl font-bold text-text-main">{highestCapacity} guests</p><p className="text-xs text-text-muted">Maximum occupancy</p></article>
      <article className="rounded-2xl border border-teal-100 bg-card p-4 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-600"><ShieldCheck className="h-5 w-5" /></span><p className="mt-2 text-xs font-semibold text-text-muted">Active Room Types</p><p className="mt-1 text-xl font-bold text-text-main">{active.length}</p><p className="text-xs text-text-muted">Currently available</p></article>
      <article className="rounded-2xl border border-orange-100 bg-card p-4 shadow-sm"><span className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50 text-orange-600"><CalendarDays className="h-5 w-5" /></span><p className="mt-2 text-xs font-semibold text-text-muted">Last Updated</p><p className="mt-1 text-xl font-bold text-text-main">Today</p><p className="text-xs text-text-muted">{fetchedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p></article>
    </section>

    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="grid gap-2.5 border-b border-border p-4 md:grid-cols-2 xl:grid-cols-[1.25fr_1fr_1fr_1fr_auto]">
        <label className="relative"><span className="sr-only">Search room types</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" /><input className="input h-10 pl-9" placeholder="Search room types..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <select className="input h-10" aria-label="Room type status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select>
        <select className="input h-10" aria-label="Room type capacity" value={capacity} onChange={(event) => { setCapacity(event.target.value); setPage(1); }}><option value="ALL">All capacities</option><option value="1">1 guest</option><option value="2">2 guests</option><option value="3_PLUS">3+ guests</option></select>
        <select className="input h-10" aria-label="Sort room types" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="NAME">Sort by: Name (A–Z)</option><option value="RATE">Sort by: Base rate</option><option value="CAPACITY">Sort by: Max guests</option></select>
        <button type="button" className="btn-outline h-10 whitespace-nowrap" onClick={() => { setSearch(''); setStatus('ALL'); setCapacity('ALL'); setSort('NAME'); setPage(1); }}><SlidersHorizontal className="h-4 w-4" />Filters</button>
      </div>

      {!roomTypes.length ? <div className="border-t border-border px-6 py-14 text-center"><BedDouble className="mx-auto h-9 w-9 text-text-muted" /><p className="mt-3 font-semibold text-text-main">No room types configured yet.</p><p className="mt-1 text-sm text-text-muted">Add your first room type to start managing room categories.</p>{canEdit ? <button type="button" className="btn-primary mt-4" onClick={() => setEditing('NEW')}>Add Room Type</button> : null}</div> : visible.length ? <>
        <div className="hidden grid-cols-[minmax(18rem,2.4fr)_0.8fr_0.65fr_0.6fr_1fr_0.65fr_0.7fr] gap-3 border-b border-border bg-bg/50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted lg:grid"><span>Room Type</span><span>Base Rate</span><span>Max Guests</span><span>Rooms</span><span>Amenities</span><span>Status</span><span className="text-right">Actions</span></div>
        <div className="divide-y divide-border">{pagedRoomTypes.map((item) => <article key={item.id} className="relative grid gap-4 px-4 py-3 transition hover:bg-bg/40 lg:grid-cols-[minmax(18rem,2.4fr)_0.8fr_0.65fr_0.6fr_1fr_0.65fr_0.7fr] lg:items-center lg:px-5">
          <div className="flex min-w-0 items-center gap-3"><img src={roomImage(item)} alt={`${item.name} room`} className="h-16 w-20 shrink-0 rounded-xl object-cover ring-1 ring-border" /><RoomTypeBadge name={item.name} /><div className="min-w-0"><h3 className="font-semibold text-text-main">{item.name}</h3><p className="mt-1 line-clamp-2 text-sm text-text-muted">{item.description || 'No description provided.'}</p></div></div>
          <div><span className="text-xs font-semibold uppercase text-text-muted lg:hidden">Base rate </span><p className="font-semibold text-text-main">{formatCurrency(Number(item.baseRate), currency)}</p><p className="text-xs text-text-muted">per night</p></div>
          <div className="flex items-center gap-2 text-sm text-text-main"><Users className="h-4 w-4 text-text-muted" /><span>{item.maxGuests}</span></div>
          <div><p className="font-semibold text-text-main">{roomCounts[item.id] ?? 0}</p><p className="text-xs text-text-muted">Rooms</p></div>
          <div className="flex min-h-8 items-center gap-2 text-text-muted">{item.amenities?.length ? item.amenities.slice(0, 4).map((amenity) => <span key={amenity} className="grid h-7 w-7 place-items-center rounded-lg bg-bg" title={amenity}><AmenityIcon amenity={amenity} /></span>) : <span className="text-xs">No amenities</span>}{item.amenities?.length > 4 ? <span className="rounded-full bg-bg px-2 py-1 text-xs">+{item.amenities.length - 4}</span> : null}</div>
          <div><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${item.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{item.isActive ? 'Active' : 'Inactive'}</span></div>
          <div className="flex items-center justify-end gap-2">{canEdit ? <><button type="button" className="btn-outline h-9 px-4 text-xs" onClick={() => setEditing(item)}>Edit</button><button type="button" className="btn-ghost h-9 w-9 p-0" aria-label={`More actions for ${item.name}`} aria-expanded={menuId === item.id} onClick={() => setMenuId((current) => current === item.id ? null : item.id)}><MoreVertical className="h-4 w-4" /></button>{menuId === item.id ? <div className="absolute right-4 top-14 z-10 w-36 rounded-xl border border-border bg-card p-1.5 shadow-lg"><button type="button" className="w-full rounded-lg px-3 py-2 text-left text-sm text-text-main hover:bg-bg" onClick={() => { setMenuId(null); item.isActive ? setDisabling(item) : void onUpdate(item.id, { isActive: true }); }}>{item.isActive ? 'Disable' : 'Enable'}</button></div> : null}</> : <span className="text-xs text-text-muted">Read-only</span>}</div>
        </article>)}</div>
        <footer className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between"><span>Showing {pageStart}–{pageEnd} of {visible.length} room types</span><div className="flex items-center gap-2"><button type="button" className="btn-outline h-9 w-9 p-0" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></button><span className="grid h-9 min-w-9 place-items-center rounded-lg border border-primary-300 bg-primary-50 px-2 text-primary-700">{currentPage}</span><button type="button" className="btn-outline h-9 w-9 p-0" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight className="h-4 w-4" /></button><select aria-label="Room types per page" className="input h-9 w-auto py-1" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10 per page</option><option value={20}>20 per page</option><option value={50}>50 per page</option></select></div></footer>
      </> : <div className="px-6 py-14 text-center"><Search className="mx-auto h-8 w-8 text-text-muted" /><p className="mt-3 font-semibold text-text-main">No room types match your filters.</p></div>}
    </section>

    {editing ? <RoomTypeForm roomType={editing === 'NEW' ? null : editing} existing={roomTypes} currency={currency} saving={saving} onClose={() => setEditing(null)} onSubmit={async (input) => { if (editing === 'NEW') await onCreate(input); else await onUpdate(editing.id, input); setEditing(null); }} /> : null}
    {disabling ? <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="disable-room-type-title"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"><h3 id="disable-room-type-title" className="text-lg font-semibold text-text-main">Disable {disabling.name}?</h3><p className="mt-2 text-sm text-text-muted">Disabling this room type prevents it from being used for new bookings but does not affect existing bookings or rooms.</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-outline" onClick={() => setDisabling(null)}>Cancel</button><button type="button" className="btn-primary" onClick={async () => { await onUpdate(disabling.id, { isActive: false }); setDisabling(null); }}>Disable room type</button></div></div></div> : null}
  </div>;
}

function RoomTypeForm({ roomType, existing, currency, saving, onClose, onSubmit }: { roomType: RoomType | null; existing: RoomType[]; currency: string; saving: boolean; onClose: () => void; onSubmit: (input: RoomTypeInput) => Promise<void> }) {
  const [error, setError] = useState('');
  const [image, setImage] = useState(roomType?.images?.[0] || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectImage = (file?: File) => {
    setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Room images must be 2 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => setError('The image could not be read. Please choose another file.');
    reader.readAsDataURL(file);
  };

  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="room-type-form-title"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl"><div className="flex items-start justify-between border-b border-border p-5"><div><h3 id="room-type-form-title" className="text-xl font-bold text-text-main">{roomType ? 'Edit Room Type' : 'Add Room Type'}</h3><p className="mt-1 text-sm text-text-muted">Configure pricing, occupancy, amenities, image, and availability.</p></div><button type="button" className="btn-ghost h-9 w-9 p-0" onClick={onClose} aria-label="Close room type form"><X className="h-4 w-4" /></button></div><form className="space-y-4 p-5" onSubmit={async (event) => { event.preventDefault(); setError(''); const data = new FormData(event.currentTarget); const name = String(data.get('name') || '').trim(); if (existing.some((item) => item.id !== roomType?.id && item.name.toLowerCase() === name.toLowerCase())) { setError('A room type with this name already exists.'); return; } await onSubmit({ name, description: String(data.get('description') || '').trim() || undefined, baseRate: Number(data.get('baseRate')), maxGuests: Number(data.get('maxGuests')), amenities: String(data.get('amenities') || '').split(',').map((item) => item.trim()).filter(Boolean), images: image ? [image] : [], isActive: data.get('isActive') === 'on' }); }}><label><span className="label">Room type name *</span><input name="name" className="input" required maxLength={50} defaultValue={roomType?.name || ''} /></label><label><span className="label">Description</span><textarea name="description" className="input" rows={3} maxLength={240} defaultValue={roomType?.description || ''} /></label><div><span className="label">Preferred room image</span><div className="flex flex-col gap-3 rounded-xl border border-dashed border-border bg-bg/40 p-3 sm:flex-row sm:items-center">{image ? <img src={image} alt="Selected room preview" className="h-24 w-full rounded-lg object-cover ring-1 ring-border sm:w-36" /> : <span className="grid h-24 w-full shrink-0 place-items-center rounded-lg bg-card text-text-muted ring-1 ring-border sm:w-36"><ImagePlus className="h-7 w-7" /></span>}<div className="flex-1"><p className="text-sm font-semibold text-text-main">{image ? 'Preferred image selected' : 'Upload a room image'}</p><p className="mt-1 text-xs leading-5 text-text-muted">JPG, PNG, or WebP. Maximum 2 MB. The image is cropped to fit room thumbnails.</p><div className="mt-3 flex flex-wrap gap-2"><input ref={fileInputRef} id="room-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectImage(event.target.files?.[0])} /><button type="button" className="btn-outline h-9 px-3 text-xs" onClick={() => fileInputRef.current?.click()}><ImagePlus className="h-4 w-4" />{image ? 'Replace image' : 'Choose image'}</button>{image ? <button type="button" className="btn-ghost h-9 px-3 text-xs text-danger hover:bg-danger/10" onClick={() => { setImage(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}><Trash2 className="h-4 w-4" />Remove</button> : null}</div></div></div></div><div className="grid gap-4 sm:grid-cols-2"><label><span className="label">Base rate ({currency}) *</span><input name="baseRate" type="number" min="0.01" step="0.01" className="input" required defaultValue={roomType?.baseRate || ''} /></label><label><span className="label">Max guests *</span><input name="maxGuests" type="number" min="1" max="10" className="input" required defaultValue={roomType?.maxGuests || 2} /></label></div><label><span className="label">Amenities</span><input name="amenities" className="input" placeholder="Wi-Fi, TV, Air conditioning" defaultValue={roomType?.amenities?.join(', ') || ''} /><span className="mt-1 block text-xs text-text-muted">Separate amenities with commas.</span></label><label className="flex items-center gap-3 rounded-xl border border-border p-3"><input name="isActive" type="checkbox" defaultChecked={roomType?.isActive ?? true} className="h-5 w-5 rounded border-border text-primary-600" /><span><span className="block text-sm font-semibold text-text-main">Active room type</span><span className="text-xs text-text-muted">Available for new room assignments and bookings.</span></span></label>{error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}<div className="flex justify-end gap-2 border-t border-border pt-4"><button type="button" className="btn-outline" onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Room Type'}</button></div></form></div></div>;
}
