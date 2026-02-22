type Contact = {
  id: string;
  name: string;
  phone: string;
};

type Props = {
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
};

export default function QuickContacts({ contacts, onSelect }: Props) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-text-main">Quick Contacts</h2>
        <p className="text-xs text-text-muted">Tap a contact to load their number in the dialer.</p>
      </div>

      <div className="space-y-2">
        {contacts.map((contact) => (
          <button
            key={contact.id}
            type="button"
            onClick={() => onSelect(contact)}
            className="w-full rounded-xl border border-border bg-bg px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-main">{contact.name}</p>
                <p className="truncate text-xs text-text-muted tabular-nums">{contact.phone}</p>
              </div>
              <span className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold text-text-muted">
                Select
              </span>
            </div>
          </button>
        ))}

        {contacts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-bg px-3 py-4 text-sm text-text-muted">
            No guest phone numbers available yet.
          </p>
        ) : null}
      </div>
    </section>
  );
}

