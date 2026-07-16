// Temporary integration check — deleted after running. Unit tests cannot see Chromium.
import { ensureCertificatePdf, closeRenderer, resolvePdf } from './src/pdf/index';
import { prisma } from './src/db/index';

const ID = process.argv[2] ?? '4ROAztohkCl8';

const row = await prisma.certificate.findUnique({
  where: { id: ID },
  include: { contracts: { orderBy: { order: 'asc' } }, firm: { select: { name: true } } },
});
console.log('cert     :', row?.number, '| status:', row?.status);
console.log('firma    :', row?.firm.name);
console.log('shartnoma:', row?.contracts.map((c) => `${c.number} (${c.date.toISOString().slice(0, 10)})`).join(', ') || '— YO\'Q —');

const t0 = Date.now();
const out = await ensureCertificatePdf(ID);
const ms = Date.now() - t0;
if (!out) { console.log('\n>>> ensureCertificatePdf null qaytardi'); process.exit(1); }

const pdf = out.pdf;
const raw = pdf.toString('latin1');

const mediaBox = raw.match(/\/MediaBox\s*\[([^\]]+)\]/);
const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
const fonts = [...new Set([...raw.matchAll(/\/BaseFont\s*\/([A-Z]{6}\+)?([A-Za-z0-9\-]+)/g)].map((m) => m[2]))];

console.log('\n--- natija (' + ms + 'ms) ---');
console.log('sarlavha :', JSON.stringify(raw.slice(0, 8)));
console.log('hajm     :', (pdf.length / 1024).toFixed(1), 'KB');
console.log('sahifa   :', pages);
console.log('MediaBox :', mediaBox?.[1].trim(), '  (A4 = 595 x 842 pt)');
console.log('shriftlar:', fonts.join(', ') || '— HECH QANDAY EMBEDDED SHRIFT YO\'Q —');
console.log('diskda   :', resolvePdf(`certificates/${ID}.pdf`));

const wantFonts = ['Tinos', 'Arimo'];
const missing = wantFonts.filter((f) => !fonts.some((g) => g.includes(f)));
console.log('\n>>> ' + (missing.length
  ? 'SHRIFT TUSHIB QOLGAN: ' + missing.join(', ') + ' — fallback bo\'lgan!'
  : 'Tinos + Arimo ikkalasi ham PDF ichiga kirgan — fallback yo\'q'));

await closeRenderer();
await prisma.$disconnect();
