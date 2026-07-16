import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  // Did SIGN actually freeze the firm rekvizitlar? Check the certs the E2E run signed.
  const arch = await p.certificate.findMany({
    where: { NOT: { deletedAt: null } },
    select: { id: true, number: true, status: true, personFullName: true, firmSnapshot: true, deletedReason: true },
    orderBy: { createdAt: 'desc' },
  });
  for (const a of arch) {
    const snap = a.firmSnapshot as Record<string, unknown> | null;
    console.log(
      `${a.number}  status=${a.status}  snapshot=${snap ? 'YES director=' + snap.directorName : 'NO'}  reason="${a.deletedReason}"`,
    );
  }

  console.log('--- test rows that would pollute real data ---');
  console.log('test certs:', await p.certificate.count({ where: { personPinfl: '31234567890123' } }));
  console.log('test client:', await p.client.count({ where: { pinfl: '31234567890123' } }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
