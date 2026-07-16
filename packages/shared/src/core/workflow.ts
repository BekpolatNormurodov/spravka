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

/** The status each role acts on (their inbox queue). */
export const ROLE_INBOX: Record<Role, CertStatus | null> = {
  [Role.YURIST]: CertStatus.DRAFT,
  [Role.ADMIN]: CertStatus.ADMIN_REVIEW,
  [Role.RAHBAR]: CertStatus.DIRECTOR_REVIEW,
};
