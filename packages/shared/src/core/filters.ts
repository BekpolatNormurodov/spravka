// Shared certificate list filtering. Pure: returns plain objects that happen to be
// valid Prisma `where` fragments, so core never imports Prisma.

export const PER_PAGE = 20;

export interface CertFilterParams {
  q?: string;
  status?: string;
  firm?: string;
  from?: string;
  to?: string;
  page?: string;
}

export interface ParsedFilters {
  q?: string;
  status?: string;
  firmId?: string;
  from?: string;
  to?: string;
  page: number;
}

export function parseCertFilters(sp: CertFilterParams, allowedStatuses: readonly string[]): ParsedFilters {
  const status = sp.status && allowedStatuses.includes(sp.status) ? sp.status : undefined;
  return {
    q: sp.q?.trim() || undefined,
    status,
    firmId: sp.firm || undefined,
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
            { contractNumber: { contains: p.q } },
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
  if (p.from) sp.set('from', p.from);
  if (p.to) sp.set('to', p.to);
  if (page > 1) sp.set('page', String(page));
  const s = sp.toString();
  return s ? `${base}?${s}` : base;
}
