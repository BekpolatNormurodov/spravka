import { Role, CertStatus, WfAction } from './enums';

export interface TransitionRule {
  from: CertStatus;
  to: CertStatus;
  role: Role;
  action: WfAction;
}

/** Single source of truth for status transitions (soft-delete is handled separately). */
export const TRANSITIONS: TransitionRule[] = [
  { from: CertStatus.DRAFT, to: CertStatus.ADMIN_REVIEW, role: Role.YURIST, action: WfAction.SUBMIT },
  { from: CertStatus.ADMIN_REVIEW, to: CertStatus.DIRECTOR_REVIEW, role: Role.ADMIN, action: WfAction.APPROVE },
  { from: CertStatus.ADMIN_REVIEW, to: CertStatus.DRAFT, role: Role.ADMIN, action: WfAction.RETURN },
  { from: CertStatus.DIRECTOR_REVIEW, to: CertStatus.SIGNED, role: Role.RAHBAR, action: WfAction.SIGN },
  { from: CertStatus.DIRECTOR_REVIEW, to: CertStatus.ADMIN_REVIEW, role: Role.RAHBAR, action: WfAction.RETURN },
];

export function findTransition(
  from: CertStatus,
  role: Role,
  action: WfAction,
): TransitionRule | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.role === role && t.action === action);
}

/** Content is editable only before admin approval. */
export function canEdit(role: Role, status: CertStatus): boolean {
  if (role === Role.YURIST) return status === CertStatus.DRAFT;
  if (role === Role.ADMIN) return status === CertStatus.DRAFT || status === CertStatus.ADMIN_REVIEW;
  return false;
}

/** Deletion (soft-delete to arxiv) is RAHBAR-only. */
export function canDelete(role: Role): boolean {
  return role === Role.RAHBAR;
}

/**
 * A RAHBAR is one firm's ijrochi direktor and acts only on that firm's documents. Their signature
 * carries the firm's name, so signing another firm's maʼlumotnoma is not an oversight to tidy up
 * later — it is the document claiming a director who never saw it.
 *
 * YURIST and ADMIN serve every firm by design (the yurist picks the firm on each ariza), so they
 * are unscoped and carry no `firmId`.
 *
 * Fails closed: a RAHBAR with no firm is a broken account, not a rahbar who may act on all of them.
 */
export function canActOnFirm(
  role: Role,
  userFirmId: string | null | undefined,
  certFirmId: string,
): boolean {
  if (role !== Role.RAHBAR) return true;
  return !!userFirmId && userFirmId === certFirmId;
}

/** The status each role acts on (their inbox queue). */
export const ROLE_INBOX: Record<Role, CertStatus | null> = {
  [Role.YURIST]: CertStatus.DRAFT,
  [Role.ADMIN]: CertStatus.ADMIN_REVIEW,
  [Role.RAHBAR]: CertStatus.DIRECTOR_REVIEW,
};
