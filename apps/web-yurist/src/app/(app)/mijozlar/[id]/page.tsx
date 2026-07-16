import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { dmy, formatSum, maskPhone, PER_PAGE, pageSlice } from '@spravka/shared/core';
import {
  PageHeader, EmptyState, StatusBadge, ClickableRow, ViewAction, Pagination, StatCard, ContractCell } from '@spravka/shared/ui';

export const dynamic = 'force-dynamic';

type SP = { page?: string };

/** Definition-list row — '—' rather than a blank when the field was never filled. */
function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value || '—'}</dd>
    </div>
  );
}

export default async function MijozDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SP;
}) {
  const page = Math.max(1, Number(searchParams.page ?? '1') || 1);
  const session = await getSession();

  const client = await prisma.client.findUnique({ where: { id: params.id } });
  if (!client) notFound();

  // Scoped to this yurist's own arizas — the detail page 404s on anyone else's, so listing
  // them here would only produce dead rows.
  const where = { clientId: client.id, deletedAt: null, createdById: session!.sub };
  const [total, certs, signed] = await Promise.all([
    prisma.certificate.count({ where }),
    prisma.certificate.findMany({
      where,
      include: { contracts: { orderBy: { order: 'asc' } }, firm: { select: { shortName: true, name: true } } },
      orderBy: { issueDate: 'desc' },
      ...pageSlice(page),
    }),
    prisma.certificate.count({ where: { ...where, status: 'SIGNED' } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const hrefFor = (p: number) => `/mijozlar/${client.id}${p > 1 ? `?page=${p}` : ''}`;

  return (
    <div>
      <PageHeader
        title={client.fullName}
        subtitle={`PINFL ${client.pinfl} · ${total} ta arizangiz`}
        action={
          <Link href="/mijozlar" className="btn-ghost text-sm">
            ← Mijozlar
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Jami ariza" value={String(total)} />
        <StatCard label="Imzolangan" value={String(signed)} />
        <StatCard label="Jarayonda" value={String(total - signed)} />
      </div>

      <div className="card mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold">Shaxs maʼlumotlari</h2>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="PINFL" value={client.pinfl} />
          <Fact label="Passport" value={client.passport} />
          <Fact label="Kim bergan" value={client.passportIssuedBy} />
          <Fact label="Berilgan sana" value={client.passportIssuedAt ? dmy(client.passportIssuedAt) : null} />
          <Fact label="Tugʻilgan sana" value={client.birthDate ? dmy(client.birthDate) : null} />
          <Fact label="Telefon" value={client.phone ? maskPhone(client.phone) : null} />
          <Fact label="Manzil" value={client.address} />
          <Fact label="Qoʻshilgan" value={dmy(client.createdAt)} />
        </dl>
      </div>

      <h2 className="mb-3 text-sm font-semibold">Arizalari</h2>

      {total === 0 ? (
        <EmptyState title="Ariza yoʻq" hint="Bu mijoz nomiga hali maʼlumotnoma kiritilmagan." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface-2 text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Raqam</th>
                    <th className="px-4 py-3 text-left font-medium">Sana</th>
                    <th className="px-4 py-3 text-left font-medium">Firma</th>
                    <th className="px-4 py-3 text-left font-medium">Shartnoma</th>
                    <th className="px-4 py-3 text-right font-medium">Summa</th>
                    <th className="px-4 py-3 text-left font-medium">Holat</th>
                    <th className="w-12 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c) => (
                    <ClickableRow key={c.id} href={`/arizalar/${c.id}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums">{c.number}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{dmy(c.issueDate)}</td>
                      <td className="px-4 py-3">{c.firm.shortName ?? c.firm.name}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        <div className="font-mono"><ContractCell contracts={c.contracts} /></div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                        {formatSum(c.loanAmount.toString())}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-3 py-3 text-right">
                        <ViewAction href={`/arizalar/${c.id}`} />
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={page} pages={pages} total={total} perPage={PER_PAGE} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
