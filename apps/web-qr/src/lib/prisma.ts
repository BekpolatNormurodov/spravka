// The single shared Prisma client — one DB for the whole system.
// QrCode now lives in packages/shared/prisma/schema.prisma alongside Certificate/Firm/User.
export { prisma } from '@spravka/shared/db';
