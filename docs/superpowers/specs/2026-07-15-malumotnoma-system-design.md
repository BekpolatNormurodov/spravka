# Ma'lumotnoma tizimi — Design Spec (v2, consolidated)

**Date:** 2026-07-15
**Working name:** `spravka` (single monorepo evolved from `qrcode-pro`)
**Status:** Approved for planning

## 1. Purpose & scope

A web system for issuing **"Qarzdorligi yo'qligi to'g'risida ma'lumotnoma"** (no-debt certificate)
documents on behalf of 5–6 microfinance firms, through a three-role approval chain
(YURIST → ADMIN → RAHBAR). A director-signed certificate is generated as an **ideal A4 PDF file**
and becomes **publicly verifiable via QR code**, reusing the existing `qrcode-pro` public
file-serving mechanism.

### Consolidation decision (supersedes v1)
Everything lives in **ONE repo, ONE MySQL database, ONE shared package**. The existing `qrcode-pro`
app is **absorbed into this monorepo** as `apps/web-qr` (behaviour unchanged) and also acts as the
**public surface** for signed certificates. There is **no separate `web-public` app**.

### In scope
- Three role apps (YURIST, ADMIN, RAHBAR), each on its own subdomain.
- `web-qr` = the existing QR system + public verification/file-serving for certificates.
- Firm (rekvizit) management, user management, approval workflow, PDF document generation,
  seal/stamp ("suvener"), QR generation, DevOps for the whole system.

### Out of scope (v1)
- Individuals (fiz-litso) are **NOT** system users — no login, no accounts. They are only the
  *subject data* of a certificate, entered by the yurist.
- E-signature crypto/PKI; SMS/email notifications; non-Cyrillic document body.

## 2. Architecture — ONE monorepo, ONE DB, ONE shared package

```
spravka/                         (evolved from qrcode-pro — one repo)
├─ apps/
│  ├─ web-qr        Next.js 14   qr.<domain>       existing QR system + PUBLIC certificate view/file
│  ├─ web-yurist    Next.js 14   yurist.<domain>   create/edit/submit arizas
│  ├─ web-admin     Next.js 14   admin.<domain>    edit, approve, manage firms + users
│  └─ web-rahbar    Next.js 14   rahbar.<domain>   sign only (Imzolash)
├─ packages/
│  └─ shared        @spravka/shared — ONE shared package with subpath exports:
│       ├─ /db      Prisma client + single schema (QrCode + User + Firm + Certificate + …)
│       ├─ /core    auth (jose+bcrypt), workflow rules, numbering, PDF render, qr helpers
│       └─ /ui      Tailwind components (AppShell, DataTable, LoginPage, Modal, forms, Toast)
└─ deploy/          Dockerfile.web, ONE docker-compose.yml, ONE MySQL, nginx (subdomains)
```

- **One database.** A single Prisma schema holds the existing `QrCode` model **and** the new
  `User / Firm / Certificate / WorkflowEvent / Counter` models. One MySQL instance for everything.
- **One shared package** `@spravka/shared` (subpaths `/db`, `/core`, `/ui`) — no duplicated logic
  across apps. Prisma client is server-only; UI components are client-safe; enforced via exports.
- Each role app is thin and full-stack (owns its own API routes), importing `@spravka/shared`.
- **No `web-public`.** Public verification/serving is done by `web-qr` (see §5).

**Note on `qrcode-pro`:** its current single Next.js app moves into `apps/web-qr`. Routes, public
`/q/[id]`, and QR generation behave exactly as today; only the import paths (`@/lib/*` →
`@spravka/shared`) and Prisma location change. The live deployment keeps running until cutover.

## 3. Data model (single Prisma schema / one MySQL)

```prisma
// Existing — kept as-is from qrcode-pro
enum QrType { URL TEXT HTML FILE IMAGE }
model QrCode { … unchanged … }

// New
enum Role       { YURIST ADMIN RAHBAR }
enum CertStatus { DRAFT ADMIN_REVIEW DIRECTOR_REVIEW SIGNED }
enum WfAction   { SUBMIT APPROVE RETURN SIGN DELETE RESTORE }

model User {
  id String @id @default(cuid())
  fullName String
  login String @unique
  passwordHash String            // bcrypt
  plainPassword String?          // admin-visible convenience (internal tool)
  role Role
  firmId String?                 // reserved: optional rahbar-firm scoping (unused for filtering in v1)
  phone String?
  isActive Boolean @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Firm "dalniylar" / rekvizitlar — admin-managed CRUD + seeded
model Firm {
  id String @id @default(cuid())
  name String                    // Cyrillic org name (e.g. "BRIGHT FUTURE FINANCING …" MCHJ)
  shortName String?
  directorName String            // Ижрочи директори (fixed → one-click sign)
  executorName String            // Ижрочи
  phone String
  address String?
  logoPath String?
  sealPath String?               // муҳр image
  signaturePath String?          // director imzo image
  isActive Boolean @default(true)
  certificates Certificate[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Certificate {
  id String @id @db.VarChar(32)  // short nanoid → QR target + public URL
  number String @unique          // "DDMMYYYY/NN"
  seq Int
  issueDate DateTime             // Сана
  firmId String
  firm Firm @relation(fields:[firmId], references:[id])
  status CertStatus @default(DRAFT)

  // fiz-litso (subject; NOT a user)
  personFullName String          // Cyrillic
  personPassport String          // AE5348993
  passportIssuedBy String?
  passportIssuedAt DateTime?

  // contract facts
  contractNumber String
  contractDate DateTime
  contractType String @default("«Микроқарз» универсал шартномаси")
  loanAmount Decimal @db.Decimal(18,2)
  asOfDate DateTime              // holat sanasi

  bodyText String? @db.Text      // generated; admin-editable override
  pdfPath String?                // generated ideal PDF file (set on SIGN)

  signedById String?
  signedAt DateTime?
  scans Int @default(0)

  // Soft-delete (arxiv) — RAHBAR-only. Recoverable + audited. deletedReason mandatory.
  deletedAt DateTime?
  deletedById String?
  deletedReason String? @db.Text

  createdById String
  events WorkflowEvent[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status])
  @@index([firmId])
}

model WorkflowEvent {
  id String @id @default(cuid())
  certificateId String
  certificate Certificate @relation(fields:[certificateId], references:[id])
  actorId String
  action WfAction
  fromStatus CertStatus
  toStatus CertStatus
  note String? @db.Text
  createdAt DateTime @default(now())
}

model Counter { id String @id  value Int @default(0) }   // id = "<firmId>:<year>"
```

## 4. Roles & workflow

```
YURIST creates (DRAFT) ──submit──▶ ADMIN_REVIEW ──approve──▶ DIRECTOR_REVIEW ──sign──▶ SIGNED (public ✓)
                          ▲              │ return                   │ return
                          └──────────────┘◀─────────────────────────┘
                            reject / cancel (admin or rahbar) → REJECTED / CANCELLED
```

Single source of truth in `@spravka/shared/core/workflow.ts`:

| From | To | Role | Action |
|------|----|------|--------|
| DRAFT | ADMIN_REVIEW | YURIST | SUBMIT |
| ADMIN_REVIEW | DIRECTOR_REVIEW | ADMIN | APPROVE |
| ADMIN_REVIEW | DRAFT | ADMIN | RETURN |
| DIRECTOR_REVIEW | SIGNED | RAHBAR | SIGN |
| DIRECTOR_REVIEW | ADMIN_REVIEW | RAHBAR | RETURN |
| any status | (soft-deleted → arxiv) | **RAHBAR** | DELETE / RESTORE |

**Edit-lock rule:** a certificate's content is **editable only before approval** — by YURIST in
`DRAFT`, and by ADMIN in `DRAFT`/`ADMIN_REVIEW`. **Once ADMIN approves (→ `DIRECTOR_REVIEW`) the
content is frozen: no edits by anyone** (director only signs/returns/deletes). If the director
RETURNs it, it re-enters `ADMIN_REVIEW` and becomes editable again.

**Delete-lock rule:** deletion is **RAHBAR-only** (soft-delete to arxiv, with a mandatory reason;
restorable). ADMIN and YURIST cannot delete. A deleted certificate's public page shows invalid.

| Role | App | Capabilities |
|------|-----|--------------|
| **YURIST** | web-yurist | Create ariza; pick firm; enter fiz-litso + contract data; submit; **edit own DRAFTs**; view/print own list + statuses |
| **ADMIN** | web-admin | **View + edit any ariza until approval**; approve → rahbar / return; **Firms CRUD** (+ upload logo/seal/imzo); **Users CRUD** (roles, passwords); analytics/timeline; print. **No delete.** |
| **RAHBAR** | web-rahbar | View admin-approved queue; **Imzolash** one-click → generates PDF → SIGNED/public; return; **delete/restore (arxiv)**; print; read-only otherwise |

Each app authenticates **only its own role** (login rejects a mismatched role).

**Signature semantics (explicit):** on SIGN, the applied signature + seal are always the **selected
firm's** stored `directorName` / `signaturePath` / `sealPath` — not the logged-in rahbar's. One RAHBAR
account can sign for any firm; the certificate always shows the correct firm director.

## 5. Document generation + public verification (the "qrcode system" part)

- **On SIGN**, `@spravka/shared/core` renders the ma'lumotnoma to an **ideal A4 PDF file** (Uzbek
  **Cyrillic**, matching the source `.docx` layout: Сана, №, firm header, addressee, «МАЪЛУМОТНОМА»,
  body paragraph, director signature block, Ижрочи + phone) with the firm `sealPath` + director
  `signaturePath` and a green round **«ТАСДИҚЛАНГАН»** seal baked in. A **QR** pointing to the public
  URL is printed on the PDF. The file is stored under the uploads volume; `Certificate.pdfPath` is set.
  Rendering: server-side HTML→PDF (headless Chromium) for layout fidelity + embedded Cyrillic font.
- **Public surface = `web-qr`.** The public URL `qr.<domain>/m/[id]` (a sibling of the existing
  `/q/[id]`) serves the generated PDF for SIGNED certificates — exactly like qrcode-pro's FILE type
  ("qrcode dagidek, faqat file shaklida"). Each view increments `Certificate.scans`.
- **Not-yet-signed:** the public URL shows a minimal red **«ТАСДИҚЛАНМАГАН»** status page (no valid
  file yet). Signed = valid file; unsigned = clearly marked invalid. (Verify-anytime behavior.)
- **Print** ("Chop etish"): a print button on the document view (role apps' preview **and** the
  public page) opens the browser print dialog with print-optimized A4 CSS (or the generated PDF for
  signed certs) — clean printout with no app chrome.
- Public surface is **read-only**; no write endpoints exposed.

## 6. Auth & security

- `jose` HS256 JWT in an httpOnly cookie per subdomain (reused from qrcode-pro), **bcrypt** hashing,
  `User.role`. Individuals never authenticate. Middleware gates each app to its role. No secrets in URLs.

## 7. UI / design

- Role UIs in Uzbek **Latin**; certificate body in Uzbek **Cyrillic**. Dark theme from qrcode-pro;
  `DataTable`/`AppShell`/`LoginPage`/`Modal`/forms adapted from credit-core into `@spravka/shared/ui`.
- **Beautiful, consistent components are a priority.** A single design system in `@spravka/shared/ui`:
  polished data tables (sorting/filtering/status badges), cards, modals, toasts, form controls,
  timeline, tasteful motion/transitions, empty states, and skeletons — reused identically across all
  four apps so they feel like one product. Built and refined with **/ui-ux-pro-max** and
  **/frontend-design**.

## 8. DevOps — one system

- **ONE** `deploy/docker-compose.yml`: one **MySQL** (single volume), the 4 Next apps, one **nginx**
  routing subdomains (`qr.` `yurist.` `admin.` `rahbar.`) → apps. Optional certbot/TLS from credit-core.
- Existing qrcode-pro QR data is migrated into the single database during cutover.
- Shared uploads volume for firm logos/seals/signatures, generated QR PNGs, and certificate PDFs,
  served directly by nginx (qrcode-pro pattern).

## 9. Reuse map

| Source | Reused |
|--------|--------|
| **qrcode-pro** | becomes `web-qr`; Next 14 + Prisma + jose auth, `qrImage.ts` QR gen, public FILE-serving `/q/[id]` → `/m/[id]`, dark theme, Docker/nginx shape |
| **credit-core** | `DataTable`/`AppShell`/`LoginPage`/`Modal`/forms UI, Role model, workflow-transition pattern, WorkflowEvent timeline, deploy/nginx/subdomain topology |

## 10. Seed data

- One user per role (YURIST/ADMIN/RAHBAR) with known login/password.
- The 5–6 known firms, incl. "BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI" MCHJ
  (director А.А.Бойназаров, executor Б.Тоиров, +99855-503-01-90). Placeholders where unknown.

## 11. Defaults / assumptions

- Number format `DDMMYYYY/NN`; NN = per-firm running counter (`Counter` id `<firmId>:<year>`).
- **4 apps** total (web-qr + 3 roles); **no web-public**.
- Firm director fixed per firm → one-click sign uses stored imzo + muhr.
- Signed deliverable = **ideal A4 PDF file**, served via web-qr's public mechanism.
- **Edit** allowed only pre-approval (YURIST in DRAFT; ADMIN in DRAFT/ADMIN_REVIEW); frozen after.
- **Delete** is RAHBAR-only (soft-delete/arxiv, reason required, restorable).
- **Print** available on document views (role apps + public).

## 12. Build phases (→ implementation plan)

1. Monorepo scaffold; move qrcode-pro → `apps/web-qr`; create `@spravka/shared` (db/core/ui);
   merge Prisma schema (QrCode + new models) into one; seed (firms + one user per role).
2. `@spravka/shared/core` (auth, workflow, numbering, PDF render, qr) + `@spravka/shared/ui`.
3. web-yurist (create / edit / submit).
4. web-admin (approve + Firms/Users CRUD + analytics).
5. web-rahbar (sign → PDF generation; delete/restore arxiv).
6. web-qr public certificate view (`/m/[id]`: serve PDF for signed, TASDIQLANMAGAN for unsigned; print).
7. DevOps: one compose, one MySQL, nginx subdomains; migrate existing QR data; cutover.
