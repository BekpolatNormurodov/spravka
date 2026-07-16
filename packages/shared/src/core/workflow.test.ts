import { describe, it, expect } from 'vitest';
import { Role, CertStatus, WfAction } from './enums';
import { findTransition, canEdit, canDelete, canActOnFirm, ROLE_INBOX } from './workflow';

describe('workflow transitions', () => {
  it('yurist submits a draft to admin review', () => {
    const t = findTransition(CertStatus.DRAFT, Role.YURIST, WfAction.SUBMIT);
    expect(t?.to).toBe(CertStatus.ADMIN_REVIEW);
  });

  it('admin approves review to director review', () => {
    const t = findTransition(CertStatus.ADMIN_REVIEW, Role.ADMIN, WfAction.APPROVE);
    expect(t?.to).toBe(CertStatus.DIRECTOR_REVIEW);
  });

  it('rahbar signs director review to signed', () => {
    const t = findTransition(CertStatus.DIRECTOR_REVIEW, Role.RAHBAR, WfAction.SIGN);
    expect(t?.to).toBe(CertStatus.SIGNED);
  });

  it('rejects an illegal transition (yurist cannot sign)', () => {
    expect(findTransition(CertStatus.DIRECTOR_REVIEW, Role.YURIST, WfAction.SIGN)).toBeUndefined();
  });
});

describe('edit-lock rule', () => {
  it('yurist may edit only DRAFT', () => {
    expect(canEdit(Role.YURIST, CertStatus.DRAFT)).toBe(true);
    expect(canEdit(Role.YURIST, CertStatus.ADMIN_REVIEW)).toBe(false);
  });
  it('admin may edit DRAFT and ADMIN_REVIEW but not after approval', () => {
    expect(canEdit(Role.ADMIN, CertStatus.ADMIN_REVIEW)).toBe(true);
    expect(canEdit(Role.ADMIN, CertStatus.DIRECTOR_REVIEW)).toBe(false);
    expect(canEdit(Role.ADMIN, CertStatus.SIGNED)).toBe(false);
  });
  it('rahbar never edits content', () => {
    expect(canEdit(Role.RAHBAR, CertStatus.DIRECTOR_REVIEW)).toBe(false);
  });
});

describe('delete-lock rule', () => {
  it('only rahbar may delete', () => {
    expect(canDelete(Role.RAHBAR)).toBe(true);
    expect(canDelete(Role.ADMIN)).toBe(false);
    expect(canDelete(Role.YURIST)).toBe(false);
  });
});

describe('firm binding', () => {
  const OWN = 'firm_bright_future';
  const OTHER = 'firm_urban_finance';

  it('rahbar acts on their own firm', () => {
    expect(canActOnFirm(Role.RAHBAR, OWN, OWN)).toBe(true);
  });

  it('rahbar cannot act on another firm', () => {
    // The signature block carries the firm's name and its director's — signing here would put
    // Urban's director on a document Bright Future's director approved.
    expect(canActOnFirm(Role.RAHBAR, OWN, OTHER)).toBe(false);
  });

  it('a rahbar with no firm acts on nothing', () => {
    // Fails closed: a broken account must not read as "allowed everywhere".
    expect(canActOnFirm(Role.RAHBAR, null, OWN)).toBe(false);
    expect(canActOnFirm(Role.RAHBAR, undefined, OWN)).toBe(false);
    expect(canActOnFirm(Role.RAHBAR, '', OWN)).toBe(false);
  });

  it('yurist and admin serve every firm', () => {
    expect(canActOnFirm(Role.YURIST, null, OTHER)).toBe(true);
    expect(canActOnFirm(Role.ADMIN, null, OTHER)).toBe(true);
  });
});

describe('role inbox', () => {
  it('maps each role to the status it acts on', () => {
    expect(ROLE_INBOX[Role.YURIST]).toBe(CertStatus.DRAFT);
    expect(ROLE_INBOX[Role.ADMIN]).toBe(CertStatus.ADMIN_REVIEW);
    expect(ROLE_INBOX[Role.RAHBAR]).toBe(CertStatus.DIRECTOR_REVIEW);
  });
});
