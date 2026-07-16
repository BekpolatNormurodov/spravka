# PDF freeze at sign — Design Spec

**Date:** 2026-07-16
**Status:** Approved for planning
**Supersedes:** the unbuilt "ideal A4 PDF file" line in `2026-07-15-malumotnoma-system-design.md` §1

## 1. Purpose

When a rahbar signs a maʼlumotnoma, the system must produce **one PDF file, once**, store it, and
serve that exact file forever after. Today nothing is stored: the document is a React component
re-rendered on every request, and the "PDF" only exists as whatever the operator's browser produced
from the print dialog. `Certificate.pdfPath` has existed since the first schema and has never been
written to.

This closes two gaps:

- **Legal integrity.** A signed maʼlumotnoma must not change. `firmSnapshot` already freezes the
  firm's rekvizitlar at SIGN for exactly this reason, but the *rendering* is still live — a CSS or
  component edit silently restyles documents that were issued months ago. Freezing the bytes
  finishes the job `firmSnapshot` started.
- **A signable artifact.** E-IMZO signs bytes, not React trees. Whatever we hand the signer must be
  a fixed file. This work is the prerequisite, and it is useful on its own if E-IMZO never happens.

### Why E-IMZO is not in this spec

Verified 2026-07-16 against the E-IMZO Client v6.4.7 local API (`https://127.0.0.1:64443/apidoc.html`)
and the official integration docs:

- **Signing works today, with no contract.** `pfx.list_all_certificates` → `pfx.load_key` (the
  password prompt is the plugin's own native dialog; the password never reaches the browser or us) →
  `pkcs7.create_pkcs7(data_64, id, detached)`.
- **Verification does not exist client-side.** The `pkcs7` plugin exposes exactly one function:
  `create_pkcs7`. There is no `verify_pkcs7`. The only "verify" in the whole API is
  `x509.verify_certificate`, which checks a certificate against an issuer — and runs on the signer's
  own machine, so it is worthless as a trust anchor.
- Verification and timestamping are only in **E-IMZO-SERVER** (Java, `/backend/pkcs7/verify/attached`
  and `/frontend/timestamp/pkcs7`), which needs a written contract with NIC, VPN keys, and a
  connection to `vpn.e-imzo.uz:3443` reachable only from inside Uzbekistan. The production host
  (`213.230.64.140`, Uzbektelecom) satisfies the geography; the contract is not yet in place.

Signatures created before the contract would carry **no timestamp**, and E-IMZO certificates expire
in ~1 year — so such a signature becomes unprovable once the certificate lapses, permanently. That
is why the signing flow waits and the PDF does not.

## 2. Scope

**In:** server-side PDF rendering; deterministic fonts; storage; wiring into the SIGN transition;
lazy generation for already-signed certificates; a public download route; a download control on the
public page.

**Out:** E-IMZO/PKCS#7 of any kind; changing the document's layout; changing the workflow; replacing
the on-screen HTML view.

## 3. Decisions

| Question | Decision | Why |
|---|---|---|
| Render engine | Headless Chromium (Puppeteer) | The only engine that can reuse `CertificateDocument`. A PDF library would mean re-drawing the layout by hand and re-breaking the 1:1 fidelity with the source .docx. |
| How Chromium gets the HTML | `renderToStaticMarkup` → `page.setContent` | No internal render route, so no auth bypass to protect. One source of layout truth. |
| Font | Bundled Liberation Serif, base64-inlined | See §5. |
| Storage | Filesystem under `CERT_STORAGE_DIR`, path in `pdfPath` | `pdfPath` already exists and implies it; single host; nginx + systemd already in the deploy. |
| Public page | Keeps the HTML view, adds a "Rasmiy PDF" download | HTML reads better on a phone. The stored file stays one click away and is the legal artifact. |
| Already-signed certs | Generated lazily on first request | One legacy row (`26062026/01`); a migration script for a single document is not worth its own failure mode. |

### Accepted tension

The public page shows a *re-render* while the *stored file* is the legal artifact. These can drift
if the component changes. Accepted because the drift only affects presentation of an already-issued
document, the download is prominent, and the alternative (embedding a PDF viewer) is materially
worse on the phones most scanners use. If drift ever matters, §11 is the escape hatch.

## 4. Components

Each unit does one thing and can be tested without the others.

```
packages/shared/src/pdf/           new node-only subpath: @spravka/shared/pdf
├─ fonts.ts       reads the bundled .ttf files, returns base64 @font-face CSS (cached)
├─ html.ts        CertificateDocumentProps -> a complete standalone HTML string
├─ render.ts      html -> Buffer (owns the Chromium lifecycle; one browser, reused)
├─ storage.ts     Buffer <-> disk under CERT_STORAGE_DIR; path building; safe reads
└─ ensure.ts      certId -> pdfPath (generate+store+persist if absent, else return existing)
```

- `@spravka/shared/pdf` must be its own subpath, not `core`: Puppeteer is node-only and must never
  reach an edge bundle. Same rule that already separates `qr` and `password` from `core`.
- `render.ts` keeps a module-level browser promise and reuses it. Launching Chromium per document
  (~1s) is the difference between a signing click that feels instant and one that feels broken.
- `ensure.ts` is the only unit that touches Prisma. `render`/`storage` stay pure so they can be
  tested with fixtures.

### Touched
- `apps/web-rahbar/src/app/api/certificates/[id]/route.ts` — the SIGN branch.
- `apps/web-public/src/app/m/[id]/pdf/route.ts` — **new**, serves the stored file.
- `apps/web-public/src/app/m/[id]/page.tsx` — the download control.

## 5. The font problem

The document is `Times New Roman`. It exists on the developer's Windows machine and **does not exist
on the Linux production host**. Chromium does not fail on a missing font — it silently substitutes,
re-flowing every line. The result would be that the layout is correct in dev, wrong in prod, wrong
in every file already frozen by the time anyone notices, and unfixable after the fact.

**Fix:** bundle **Liberation Serif** (Regular + Bold) in the repo and inline it as base64 `@font-face`
in the generated HTML, with `font-family` resolving to it. Liberation Serif is metrically compatible
with Times New Roman — glyph advance widths match by design — and covers Cyrillic. The rendered PDF
then depends on nothing installed on the host, and dev and prod agree.

The bundled files are a build input, not an asset: they are read at render time and embedded in the
HTML, so nothing is served over HTTP and no CDN is involved.

**Verification (must be part of the work, not assumed):** render the same certificate on Windows and
on the Linux host and compare the text layout. A font fallback is not subtle once measured — line
counts and the signature block's position move.

## 6. Flow

### Sign
1. Rahbar clicks Imzolash → `PATCH …/certificates/:id { action: 'sign' }`.
2. Existing guards run unchanged (session, transition, `deletedAt`).
3. Build `firmSnapshot` from the live firm (as today).
4. **Render the PDF from that snapshot** with `signed: true` — i.e. the document exactly as it will
   be issued, stamp and QR included. This resolves the apparent circularity (the stamp needs
   `signed`, `signed` needs the file): the file is rendered optimistically and only *kept* if the
   transaction lands.
5. Assert the buffer is non-empty and starts with `%PDF`.
6. Write the file.
7. `$transaction`: update `status`/`signedAt`/`signedById`/`firmSnapshot`/`pdfPath`/`pdfSha256` +
   create the `WorkflowEvent` — as today, plus the two PDF columns.
8. If the transaction throws, unlink the file and rethrow. No half state either way: a file with no
   row is garbage-collectable, a row with no file is not.

Rendering happens **outside** the transaction — it takes ~1s and must not hold row locks.

### Download
`GET /m/:id/pdf` → 404 unless the certificate exists, is not soft-deleted, and is `SIGNED` (same rule
as the existing public page) → `ensureCertificatePdf(id)` → stream with
`Content-Type: application/pdf` and `Content-Disposition: inline; filename="<number>.pdf"`.

### Lazy generation
`ensureCertificatePdf` returns the stored path when `pdfPath` is set **and the file is on disk**;
otherwise it renders from `firmSnapshot`, stores, persists `pdfPath`/`pdfSha256`, and returns. This
covers `26062026/01` and any row whose file was lost. It must never run for an unsigned certificate.

## 7. Data model

```prisma
model Certificate {
  pdfPath   String?   // already exists — this spec is the first writer
  pdfSha256 String?   // NEW: hex digest of the stored file
}
```

`pdfSha256` earns its place twice: it detects a corrupted or swapped file on disk (the row and the
bytes can disagree; nothing else would notice), and it is what E-IMZO will sign later, so recording
it now costs one column and saves a migration.

No new tables. No `SignChallenge` — that belongs to the signing flow, which is out of scope.

## 8. Ops

- **`CERT_STORAGE_DIR`** — new env var, absolute, outside the repo. Documented in `deploy/README.md`.
- **systemd** — the unit needs `ReadWritePaths=` for that directory.
- **Backup** — these files are legal documents, not cache. Losing one is not "regenerate it": a
  re-render is a *different file*. This must be stated in `deploy/README.md` next to the DB backup.
- **Chromium** — Puppeteer downloads its own (~300 MB) on install. The host needs its shared
  libraries. This is a real deploy step and must be verified on the box, not assumed.

## 9. Error handling

| Case | Behaviour |
|---|---|
| Chromium fails to launch / render | SIGN returns 500, nothing written, status unchanged. Signing must fail loudly rather than produce an unsignable document. |
| Buffer empty or not `%PDF` | Same — treat as a render failure. |
| Disk write fails | Same. |
| Transaction fails after the write | Unlink the file, rethrow. |
| Download for an unsigned/deleted cert | 404, identical to the current public page. |
| Download when the file is gone | `ensure` regenerates from `firmSnapshot`. |

## 10. Testing

Unit (`packages/shared`, vitest — the existing suite is 46 tests / 6 files):

- `fonts.ts` — emits `@font-face` with a base64 payload for both weights; result is cached.
- `html.ts` — output is standalone: contains the `@font-face`, references no external URL
  (`http`/`https`/`//`), and contains the document's Cyrillic body and the certificate number.
- `storage.ts` — round-trips a buffer; the path derives only from the certificate id and rejects an
  id containing separators or `..`; reading an absent file reports absence rather than throwing.
- `ensure.ts` — with a stubbed renderer: skips rendering when `pdfPath` is set and the file exists;
  renders exactly once when absent; refuses a non-SIGNED certificate.

Integration (not in the unit suite — needs Chromium):

- Render `26062026/01` and assert: starts with `%PDF`, one page, A4 (595×842pt ±1), Liberation Serif
  is listed in the PDF's embedded fonts (this is the font-fallback tripwire), and the extracted text
  contains the firm name, the person's name and `ТАСДИҚЛАНДИ`.

Byte-for-byte determinism is **not** asserted: Puppeteer stamps a creation date into the PDF.

## 11. Future

- **E-IMZO** hooks in at §6 step 5: the rendered buffer is what goes to `create_pkcs7` as `data_64`,
  and `pdfSha256` is what the signature is checked against. When the NIC contract lands, the signing
  flow adds a prepare/commit pair around this exact artifact; nothing here is rewritten.
- **Signer binding** (recorded here so it is not re-derived): the E-IMZO verify response returns the
  organisation INN, so a signature must be bound with `cert.INN === Firm.stir`, rejecting when `stir`
  is null — it is `String?` today, and a null must reject rather than skip the check. Without this
  binding, any valid E-IMZO key holder in Uzbekistan can sign any firm's document.
- **Drift escape hatch:** if the HTML/PDF divergence in §3 ever matters, the public page swaps to an
  embedded viewer of the stored file. Nothing in this design blocks that.
