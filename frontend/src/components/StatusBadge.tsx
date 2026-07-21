interface Props {
  status: string;
}

const styles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-mint-100 text-mint-600',
  declined: 'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-600',
  completed: 'bg-campus-100 text-campus-800',
  available: 'bg-mint-100 text-mint-600',
  unavailable: 'bg-slate-100 text-slate-600',
  verified: 'bg-mint-100 text-mint-600',
  rejected: 'bg-red-100 text-red-700',
  resolved: 'bg-campus-100 text-campus-800',
};

export default function StatusBadge({ status }: Props) {
  return (
    <span className={`badge capitalize ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
}
