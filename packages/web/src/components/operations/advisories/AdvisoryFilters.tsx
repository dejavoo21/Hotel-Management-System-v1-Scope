type Props = {
  department: string;
  priority: string;
  onDepartmentChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
};

export default function AdvisoryFilters({
  department,
  priority,
  onDepartmentChange,
  onPriorityChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={department}
        onChange={(e) => onDepartmentChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
      >
        <option value="all">All departments</option>
        <option value="FRONT_DESK">Front Desk</option>
        <option value="HOUSEKEEPING">Housekeeping</option>
        <option value="CONCIERGE">Concierge</option>
        <option value="MAINTENANCE">Maintenance</option>
        <option value="BILLING">Billing</option>
        <option value="MANAGEMENT">Management</option>
      </select>
      <select
        value={priority}
        onChange={(e) => onPriorityChange(e.target.value)}
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
      >
        <option value="all">All priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
    </div>
  );
}
