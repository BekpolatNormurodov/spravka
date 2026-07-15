# Ma'lumotnoma tizimi — Design Spec

**Date:** 2026-07-15
**Working name:** `spravka` (repo folder `Desktop/spravka`)
**Status:** Approved for planning

## 1. Purpose & scope

A web system for issuing **"Qarzdorligi yo'qligi to'g'risida ma'lumotnoma"** (no-debt certificate)
documents on behalf of 5–6 microfinance firms (mikromoliya tashkilotlari). A three-role approval
chain produces a formal, Cyrillic, A4 certificate that becomes **publicly verifiable via QR code** —
mirroring the public-QR pattern of the existing `qrcode-pro` app.

Deployed **next to** `qrcode-pro` on the same server. **`qrcode-pro` is not modified in any way.**

### In scope
- Three role apps (YURIST, ADMIN, RAHBAR), each on its own subdomain.
- One public verification app (QR portal).
- Firm (rekvizit) management, user management, the approval workflow, document rendering,
  seal/stamp ("suvener"), QR generation, and DevOps to run alongside `qrcode-pro`.

### Out of scope (v1)
- Individuals (fiz-litso) are **NOT** system users — no login, no accounts. They are only the
  *subject data* of a certificate, entered by the yurist.
- Server-side PDF engine (v1 uses browser print-to-PDF); e-signature crypto/PKI; SMS/email
  notifications; multi-language document body (Cyrillic only for the document).

## 2. Architecture — monorepo (npm workspaces, mirrors credit-core)

```
spravka/
├─ apps/
│  ├─ web-yurist    Next.js 14   yurist.<domain>   create/edit/submit arizas
│  ├─ web-admin     Next.js 14   admin.<domain>    edit, approve, manage firms + users
│  ├─ web-rahbar    Next.js 14   rahbar.<domain>   sign only (Imzolash)
│  └─ web-public    Next.js 14   verify.<domain>   /m/[id] public verification + QR
├─ packages/
│  ├─ db            Prisma schema + generated client (single shared MySQL)
│  ├─ core          business logic: auth (jose), workflow rules, numbering, doc-render, qr
│  └─ ui            shared Tailwind components (AppShell, DataTable, LoginPage, Modal, forms, Toast)
└─ deploy/          Dockerfile.web, docker-compose.yml, nginx/, (optional certbot)
```

- Each role app is **thin and full-stack**: it owns the Next.js API routes for its role's actions
  and imports shared logic from `packages/core`. No separate NestJS backend.
- All apps read/write the **same MySQL database** through `packages/db`.
- `packages/ui` and `packages/core` are the DRY layer so each app stays small.

**Why this shape:** user chose "3 separate Next.js apps + shared". Public verification is a 4th
thin app so it can live on its own subdomain, be cached, and stay isolated from authenticated apps.

## 3. Data model (Prisma / MySQL)

```prisma
enum Role      { YURIST ADMIN RAHBAR }
enum CertStatus { DRAFT ADMIN_REVIEW DIRECTOR_REVIEW SIGNED REJECTED CANCELLED }
enum WfAction  { SUBMIT APPROVE RETURN SIGN REJECT CANCEL REOPEN }

model User {
  id           String   @id @default(cuid())
  fullName     String
  login        String   @unique
  passwordHash String                 // bcrypt
  plainPassword String?               // admin-visible (internal tool convenience, like credit-core)
  role         Role
  firmId       String?                // optional: a rahbar/yurist tied to one firm
  phone        String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// The firm's "dalniylar" / rekvizitlar. Admin-managed CRUD + seeded.
model Firm {
  id            String  @id @default(cuid())
  name          String                  // Cyrillic, e.g. "BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI" MCHJ
  shortName     String?
  directorName  String                  // Ижрочи директори (fixed → enables one-click sign)
  executorName  String                  // Ижрочи
  phone         String
  address       String?
  logoPath      String?
  sealPath      String?                 // муҳр image
  signaturePath String?                 // director imzo image
  isActive      Boolean @default(true)
  certificates  Certificate[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Certificate {
  id               String     @id @db.VarChar(32)   // short nanoid → QR target
  number           String     @unique               // "DDMMYYYY/NN"
  seq              Int                               // NN counter value
  issueDate        DateTime                          // "Сана"
  firm             Firm       @relation(fields: [firmId], references: [id])
  firmId           String
  status           CertStatus @default(DRAFT)

  // fiz-litso (subject; NOT a user)
  personFullName   String                            // ЖЎРАБЕКОВА ... (Cyrillic)
  personPassport   String                            // AE5348993
  passportIssuedBy String?
  passportIssuedAt DateTime?

  // contract facts
  contractNumber   String                            // 24273
  contractDate     DateTime                          // 15.04.2026
  contractType     String  @default("«Микроқарз» универсал шартномаси")
  loanAmount       Decimal @db.Decimal(18,2)         // 4 000 000
  asOfDate         DateTime                          // holat sanasi (26.06.2026)

  bodyText         String? @db.Text                  // generated; admin-editable override

  signedBy         User?   @relation(fields: [signedById], references: [id])
  signedById       String?
  signedAt         DateTime?

  scans            Int     @default(0)
  createdBy        User    @relation("CertCreatedBy", fields: [createdById], references: [id])
  createdById      String
  events           WorkflowEvent[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([status])
  @@index([firmId])
}

model WorkflowEvent {
  id            String   @id @default(cuid())
  certificate   Certificate @relation(fields: [certificateId], references: [id])
  certificateId String
  actorId       String
  action        WfAction
  fromStatus    CertStatus
  toStatus      CertStatus
  note          String?  @db.Text
  createdAt     DateTime @default(now())
}

// Number sequence counters. id = "<firmId>:<year>".
model Counter { id String @id  value Int @default(0) }
```

## 4. Roles & workflow

```
YURIST creates (DRAFT) ──submit──▶ ADMIN_REVIEW ──approve──▶ DIRECTOR_REVIEW ──sign──▶ SIGNED (public ✓)
                          ▲              │ return                   │ return
                          └──────────────┘◀─────────────────────────┘
                            reject/cancel (admin or rahbar) → REJECTED / CANCELLED
```

Allowed transitions (single source of truth in `packages/core/workflow.ts`):

| From | To | Role | Action |
|------|----|------|--------|
| DRAFT | ADMIN_REVIEW | YURIST | SUBMIT |
| ADMIN_REVIEW | DIRECTOR_REVIEW | ADMIN | APPROVE |
| ADMIN_REVIEW | DRAFT | ADMIN | RETURN |
| ADMIN_REVIEW | REJECTED | ADMIN | REJECT |
| DIRECTOR_REVIEW | SIGNED | RAHBAR | SIGN |
| DIRECTOR_REVIEW | ADMIN_REVIEW | RAHBAR | RETURN |
| any active | CANCELLED | ADMIN | CANCEL |

Per-role capabilities:

| Role | App | Capabilities |
|------|-----|--------------|
| **YURIST** | web-yurist | Create ariza; pick firm; enter fiz-litso + contract data; submit; edit own DRAFTs; view own list + statuses |
| **ADMIN** | web-admin | Full edit of any ariza; approve → rahbar / return / reject; **Firms CRUD** (+ upload logo/seal/imzo); **Users CRUD** (roles, passwords); analytics/timeline |
| **RAHBAR** | web-rahbar | View admin-approved queue; **Imzolash** one-click (stamps firm imzo + muhr, → SIGNED/public); return; read-only otherwise |

Each app authenticates **only its own role** — the login endpoint rejects a user whose `role`
doesn't match the app.

**Signature semantics (explicit):** the signature + seal applied on SIGN are always the **selected
firm's stored `directorName` / `signaturePath` / `sealPath`** — NOT the logged-in rahbar's. So a
single RAHBAR account can sign certificates for any firm, and each certificate correctly shows that
firm's director. `User.firmId` is reserved for optionally scoping a rahbar's queue to one firm; it is
**not** used for filtering in v1 (a rahbar sees all DIRECTOR_REVIEW items).

## 5. Document + public verification (the "qrcode system" part)

- `verify.<domain>/m/[id]` renders the ma'lumotnoma as an **A4 document** matching the source
  `.docx` layout, in Uzbek **Cyrillic**: Сана, №, firm header block, addressee line, "МАЪЛУМОТНОМА"
  heading, body paragraph (contract №, date, amount, "қарздорлиги ... мавжуд эмас"), director
  signature block (Ижрочи директори + name), Ижрочи + phone. A **QR** is printed on the document.
- **Seal / "suvener" (muhr):**
  - SIGNED → green round **«ТАСДИҚЛАНГАН»** seal + firm `sealPath` + director `signaturePath`
    rendered into the signature block.
  - not SIGNED → red diagonal **«ТАСДИҚЛАНМАГАН»** watermark; document shown but marked invalid.
- **QR** encodes `verify.<domain>/m/[id]`; server-side PNG generation reused from `qrcode-pro`'s
  `qrImage.ts`. Each public view increments `scans` (like qrcode-pro).
- **Download:** print-optimized HTML + print CSS → browser PDF in v1.
- Public app is **read-only**; no write endpoints exposed.

## 6. Auth & security

- `jose` HS256 JWT in an httpOnly cookie, scoped per subdomain (reused from `qrcode-pro/auth.ts`).
- **bcrypt** password hashing; `User` table with `role`. Individuals never authenticate.
- Next.js middleware gates each app to its role and redirects unauthenticated users to that app's
  login. Public app requires no auth. No secrets in URLs.

## 7. UI / design

- Admin/role UIs in Uzbek **Latin**; the certificate body in Uzbek **Cyrillic** (matches the form).
- Dark theme + look from `qrcode-pro`; `DataTable`/`AppShell`/`LoginPage`/`Modal`/forms adapted
  from `credit-core`'s `packages/ui`.
- Visual polish with **/ui-ux-pro-max** and **/frontend-design** during implementation.

## 8. DevOps (handled here; qrcode-pro untouched)

- New `deploy/docker-compose.yml`: own **MySQL** (own volume; host port `3309` — separate from
  qrcode-pro's `3308`), the 4 Next apps, one **nginx** routing subdomains → apps.
- Distinct external ports so nothing collides with qrcode-pro (`8090`/`3308`). Optional certbot/TLS
  mirrored from credit-core's deploy.
- Shared uploads volume for firm logos/seals/signatures + generated QR PNGs, served by nginx
  directly (qrcode-pro pattern).

## 9. Reuse map

| Source | Reused |
|--------|--------|
| **qrcode-pro** | Next 14 + Prisma + jose auth, `qrImage.ts` QR gen, public `/q/[id]` → `/m/[id]` pattern, dark theme, Docker/nginx shape |
| **credit-core** | `DataTable`/`AppShell`/`LoginPage`/`Modal`/forms UI, Role model, workflow-transition pattern, WorkflowEvent timeline, deploy/nginx/subdomain topology |

## 10. Seed data

- One user per role (YURIST/ADMIN/RAHBAR) with known login/password.
- The 5–6 known firms, incl. "BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI" MCHJ
  (director А.А.Бойназаров, executor Б.Тоиров, +99855-503-01-90). Placeholders where unknown.

## 11. Defaults / assumptions

- Number format `DDMMYYYY/NN`; NN = per-firm running counter (`Counter` id `<firmId>:<year>`).
- **4 apps** total (3 roles + 1 public).
- Firm director is fixed per firm → enables one-click sign using stored imzo + muhr.
- v1 PDF = browser print. Firm/logo/seal/signature images uploaded by admin.

## 12. Build phases (→ implementation plan)

1. Monorepo scaffold + `packages/db` schema + seed (firms + one user per role).
2. `packages/core` (auth, workflow, numbering, doc-render, qr) + `packages/ui`.
3. web-yurist (create / edit / submit).
4. web-admin (approve + Firms/Users CRUD + analytics).
5. web-rahbar (sign).
6. web-public (document render + seal + QR verification).
7. DevOps (compose + nginx + subdomains, running alongside qrcode-pro).
