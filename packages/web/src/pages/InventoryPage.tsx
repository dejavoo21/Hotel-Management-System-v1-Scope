import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService, purchaseOrderService } from '@/services';
import type { InventoryItem } from '@/types';
import toast from 'react-hot-toast';
import { PAGE_TITLE_CLASS } from '@/styles/typography';

const inventoryImageByName: Record<string, string> = {
  towels: 'https://images.unsplash.com/photo-1600369672770-985fd300a37f?auto=format&fit=crop&w=240&q=80',
  shampoo: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=240&q=80',
  coffee: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=240&q=80',
  key: 'https://images.unsplash.com/photo-1616628182509-f0f2f79fef7a?auto=format&fit=crop&w=240&q=80',
  cleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=240&q=80',
  snack: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=240&q=80',
};

function getInventoryImage(name: string) {
  const n = name.toLowerCase();
  if (n.includes('towel')) return inventoryImageByName.towels;
  if (n.includes('shampoo') || n.includes('conditioner') || n.includes('soap')) return inventoryImageByName.shampoo;
  if (n.includes('coffee')) return inventoryImageByName.coffee;
  if (n.includes('key')) return inventoryImageByName.key;
  if (n.includes('clean') || n.includes('detergent') || n.includes('toilet')) return inventoryImageByName.cleaning;
  if (n.includes('snack')) return inventoryImageByName.snack;
  return inventoryImageByName.cleaning;
}

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPoModal, setShowPoModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<InventoryItem[]>([]);
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory', search],
    queryFn: () => inventoryService.list(search),
  });

  const { data: purchaseOrders } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: purchaseOrderService.list,
  });

  const createItemMutation = useMutation({
    mutationFn: inventoryService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Item added');
      setShowAddModal(false);
    },
    onError: () => {
      toast.error('Failed to add item');
    },
  });

  const createPoMutation = useMutation({
    mutationFn: purchaseOrderService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      toast.success('Purchase order created');
      setShowPoModal(false);
    },
    onError: () => {
      toast.error('Failed to create purchase order');
    },
  });

  const stats = useMemo(() => {
    const list = items ?? [];
    const totalItems = list.length;
    const lowStock = list.filter((item) => item.quantityOnHand <= item.reorderPoint);
    const categories = new Set(list.map((item) => item.category));
    const totalValue = list.reduce((sum, item) => sum + item.quantityOnHand * item.cost, 0);
    return {
      totalItems,
      lowStock,
      categories: categories.size,
      totalValue,
    };
  }, [items]);

  const toggleItemSelection = (item: InventoryItem) => {
    setSelectedItems((prev) => {
      if (prev.some((existing) => existing.id === item.id)) {
        return prev.filter((existing) => existing.id !== item.id);
      }
      return [...prev, item];
    });
  };

  const handleDownloadPo = async (id: string, reference: string, format: 'csv' | 'pdf') => {
    const blob =
      format === 'pdf'
        ? await purchaseOrderService.exportPdf(id)
        : await purchaseOrderService.exportCsv(id);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${reference}.${format}`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleEmailPo = async (id: string, vendorEmail?: string) => {
    try {
      await purchaseOrderService.email(id, vendorEmail);
      toast.success('Purchase order emailed');
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Failed to email purchase order';
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={PAGE_TITLE_CLASS}>Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">Track hotel supplies and reorder points.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="max-w-xs">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items..."
              className="input"
            />
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-outline">
            New item
          </button>
          <button onClick={() => setShowPoModal(true)} className="btn-primary">
            Create PO
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Items tracked</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.totalItems}</p>
          <p className="mt-1 text-xs text-slate-500">{stats.categories} categories</p>
        </div>
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Low stock</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{stats.lowStock.length}</p>
          <p className="mt-1 text-xs text-slate-500">Needs reorder</p>
        </div>
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Inventory value</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">${stats.totalValue.toFixed(0)}</p>
          <p className="mt-1 text-xs text-slate-500">On-hand value</p>
        </div>
        <div className="card card-hover">
          <p className="text-xs font-semibold uppercase text-slate-500">Active suppliers</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">6</p>
          <p className="mt-1 text-xs text-slate-500">Preferred vendors</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Inventory list</h2>
            <button onClick={() => setShowAddModal(true)} className="btn-outline">
              New item
            </button>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-3">Item</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Availability</th>
                  <th className="pb-3">Quantity in Stock</th>
                  <th className="pb-3">Quantity in Reorder</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500">
                      Loading inventory...
                    </td>
                  </tr>
                ) : items && items.length > 0 ? (
                  items.map((item) => {
                    const isLow = item.quantityOnHand <= item.reorderPoint;
                    const selected = selectedItems.some((entry) => entry.id === item.id);
                    return (
                      <tr key={item.id}>
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <img src={getInventoryImage(item.name)} alt={item.name} className="h-9 w-9 rounded-lg object-cover" />
                            <span className="font-medium text-slate-900">{item.name}</span>
                          </div>
                        </td>
                        <td className="py-3 text-slate-600">{item.category}</td>
                        <td className="py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isLow ? 'bg-amber-50 text-amber-700' : 'bg-lime-100 text-lime-700'}`}>
                            {isLow ? 'Low' : 'Available'}
                          </span>
                        </td>
                        <td className="py-3 text-slate-600">
                          {item.quantityOnHand} {item.unit}
                        </td>
                        <td className="py-3 text-slate-600">{item.reorderPoint}</td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              isLow ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {isLow ? 'Low stock' : 'Healthy'}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                              View detail
                            </button>
                            <button className="rounded-lg bg-lime-200 px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-lime-300">
                              Reorder
                            </button>
                          </div>
                        </td>
                        <td className="py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleItemSelection(item)}
                          />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500">
                      No inventory items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Reorder queue</h2>
              <button onClick={() => setShowPoModal(true)} className="btn-ghost">
                Create PO
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {isLoading ? (
                [...Array(4)].map((_, i) => <div key={i} className="h-12 animate-shimmer rounded-xl" />)
              ) : stats.lowStock.length > 0 ? (
                stats.lowStock.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.quantityOnHand} {item.unit} on hand - reorder at {item.reorderPoint}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">All items are above reorder points.</p>
              )}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900">Purchase orders</h2>
            <p className="text-sm text-slate-500">Recent orders sent to vendors.</p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {purchaseOrders && purchaseOrders.length > 0 ? (
                purchaseOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-900">{order.reference}</p>
                      <span className="text-xs text-slate-500">{order.status}</span>
                    </div>
                    <p className="text-xs text-slate-500">{order.vendorName}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => handleDownloadPo(order.id, order.reference, 'csv')}
                      >
                        Download CSV
                      </button>
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => handleDownloadPo(order.id, order.reference, 'pdf')}
                      >
                        Download PDF
                      </button>
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => handleEmailPo(order.id, order.vendorEmail)}
                      >
                        Email
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No purchase orders yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Add inventory item</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                createItemMutation.mutate({
                  name: formData.get('name') as string,
                  category: formData.get('category') as string,
                  unit: formData.get('unit') as string,
                  quantityOnHand: Number(formData.get('quantityOnHand')),
                  reorderPoint: Number(formData.get('reorderPoint')),
                  cost: Number(formData.get('cost')),
                  location: (formData.get('location') as string) || undefined,
                });
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Item name *</label>
                  <input name="name" required className="input" />
                </div>
                <div>
                  <label className="label">Category *</label>
                  <input name="category" required className="input" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Unit *</label>
                  <input name="unit" required className="input" />
                </div>
                <div>
                  <label className="label">Location</label>
                  <input name="location" className="input" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label">On hand *</label>
                  <input name="quantityOnHand" type="number" required className="input" />
                </div>
                <div>
                  <label className="label">Reorder *</label>
                  <input name="reorderPoint" type="number" required className="input" />
                </div>
                <div>
                  <label className="label">Unit cost *</label>
                  <input name="cost" type="number" required className="input" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-outline flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={createItemMutation.isPending} className="btn-primary flex-1">
                  {createItemMutation.isPending ? 'Saving...' : 'Add item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowPoModal(false)} />
          <div className="relative w-full max-w-xl rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900">Create purchase order</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                createPoMutation.mutate({
                  vendorName: formData.get('vendorName') as string,
                  vendorEmail: (formData.get('vendorEmail') as string) || undefined,
                  notes: (formData.get('notes') as string) || undefined,
                  items: selectedItems.map((item) => ({
                    inventoryItemId: item.id,
                    name: item.name,
                    unit: item.unit,
                    quantity: Math.max(Number(item.reorderPoint) || 0, 1),
                    unitCost: Number(item.cost) || 0,
                  })),
                });
              }}
              className="mt-6 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Vendor name *</label>
                  <input name="vendorName" required className="input" />
                </div>
                <div>
                  <label className="label">Vendor email</label>
                  <input name="vendorEmail" type="email" className="input" />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea name="notes" rows={3} className="input" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Selected items</p>
                <div className="mt-2 space-y-2">
                  {selectedItems.length > 0 ? (
                    selectedItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm text-slate-600">
                        <span>{item.name}</span>
                        <span>{item.reorderPoint} {item.unit}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Select items from the list to include in the PO.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPoModal(false)} className="btn-outline flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={createPoMutation.isPending || selectedItems.length === 0} className="btn-primary flex-1">
                  {createPoMutation.isPending ? 'Creating...' : 'Create PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

