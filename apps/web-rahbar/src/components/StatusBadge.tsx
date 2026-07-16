import { CertStatus, STATUS_LABELS } from '@spravka/shared/core';

const TONE: Record<string, string> = {
  [CertStatus.DRAFT]: 'bg-slate-500/15 text-slate-300 border-slate-400/20',
  [CertStatus.ADMIN_REVIEW]: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
  [CertStatus.DIRECTOR_REVIEW]: 'bg-violet-500/15 text-violet-300 border-violet-400/20',
  [CertStatus.SIGNED]: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${TONE[status] ?? TONE[CertStatus.DRAFT]}`}>
      {STATUS_LABELS[status as CertStatus] ?? status}
    </span>
  );
}
