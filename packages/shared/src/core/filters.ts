// Shared certificate list filtering. Pure: returns plain objects that happen to be
// valid Prisma `where` fragments, so core never imports Prisma.

import { DOC_TYPE_LABELS } from './labels';

export const PER_PAGE = 20;

export interface CertFilterParams {
  q?: string;
  status?: string;
  firm?: string;
  docType?: string;
  from?: string;
  to?: string;
  page?: string;
}

export interface ParsedFilters {
  q?: string;
  status?: string;
  firmId?: string;
  docType?: string;
  from?: string;
  to?: string;
  page: number;
}

export function parseCertFilters(sp: CertFilterParams, allowedStatuses: readonly string[]): ParsedFilters {
  const status = sp.status && allowedStatuses.includes(sp.status) ? sp.status : undefined;
  // Only a real DocType passes — an unknown ?docType= is dropped rather than matched to nothing.
  const docType = sp.docType && sp.docType in DOC_TYPE_LABELS ? sp.docType : undefined;
  return {
    q: sp.q?.trim() || undefined,
    status,
    firmId: sp.firm || undefined,
    docType,
    from: sp.from || undefined,
    to: sp.to || undefined,
    page: Math.max(1, Number(sp.page ?? '1') || 1),
  };
}

/** Prisma-compatible `where` fragment. Spread it into the page's own base filter. */
export function buildCertWhere(p: ParsedFilters): Record<string, unknown> {
  return {
    ...(p.status ? { status: p.status } : {}),
    ...(p.firmId ? { firmId: p.firmId } : {}),
    ...(p.docType ? { docType: p.docType } : {}),
    ...(p.from || p.to
      ? {
          issueDate: {
            ...(p.from ? { gte: new Date(p.from) } : {}),
            ...(p.to ? { lte: new Date(`${p.to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(p.q
      ? {
          OR: [
            { number: { contains: p.q } },
            { personFullName: { contains: p.q } },
            { personPassport: { contains: p.q } },
            // Ariza/ishonchnoma are keyed by PINFL rather than passport, so search that too.
            { personPinfl: { contains: p.q } },
            // A maʼlumotnoma may list several contracts — match on any of them.
            { contracts: { some: { number: { contains: p.q } } } },
          ],
        }
      : {}),
  };
}

export function pageSlice(page: number) {
  return { skip: (page - 1) * PER_PAGE, take: PER_PAGE };
}

/** Build a querystring that preserves the active filters while changing the page. */
export function pageHref(base: string, p: ParsedFilters, page: number): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.status) sp.set('status', p.status);
  if (p.firmId) sp.set('firm', p.firmId);
  if (p.docType) sp.set('docType', p.docType);
  if (p.from) sp.set('from', p.from);
  if (p.to) sp.set('to', p.to);
  if (page > 1) sp.set('page', String(page));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}
