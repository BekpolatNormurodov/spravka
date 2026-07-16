# Spravka — «Қарздорлиги йўқлиги тўғрисида маълумотнома»

No-debt certificate issuance for a group of Uzbek microfinance firms. A yurist drafts the
maʼlumotnoma, an admin checks it, the firm's director signs it, and anyone can verify the signed
document by scanning its QR code.

One repo, one MySQL database, one shared package. Each role is its own web app so a firm can
expose only what a given role needs.

## Apps

| App | Port | Who logs in | What it does |
|---|---|---|---|
| `apps/web-yurist` | 5101 | YURIST | Creates arizas, picks any firm, resubmits returned ones |
| `apps/web-admin` | 5102 | ADMIN | Reviews, edits, approves or returns; manages firms and users |
| `apps/web-rahbar` | 5103 | RAHBAR | Signs, returns, archives; sees the dashboard |
| `apps/web-public` | 5100 | nobody | `/m/[id]` — public certificate verification |
| `apps/web-qr` | 5000 | env admin | `/q/[id]` — the standalone QR system (absorbed from qrcode-pro) |

`packages/shared` holds everything they have in common: the Prisma schema and client, the workflow
rules, the document renderer, and the UI kit.

Individuals (fiz-litso) are **not** users. They are certificate subjects, keyed by PINFL in the
`Client` table so a repeat client autofills.

## Workflow

```
          SUBMIT           APPROVE            SIGN
  DRAFT ──────────> ADMIN_REVIEW ──────> DIRECTOR_REVIEW ──────> SIGNED
    ^                    │                     │
    └──── RETURN ────────┘                     │
         (admin)                               │
    ^                                          │
    └──────────── RETURN (rahbar) ─────────────┘
                  → back to ADMIN_REVIEW
```

Rules that the code enforces, not just convention (`packages/shared/src/core/workflow.ts`):

- **Returning requires a reason.** Both RETURN transitions reject an empty note — the person
  fixing the document needs to know what is wrong.
- **Edit-lock.** `canEdit` allows YURIST on DRAFT, ADMIN on DRAFT/ADMIN_REVIEW. Once approved or
  signed, the content is frozen and the API answers 403.
- **Delete is RAHBAR-only** (`canDelete`), and it is a soft-delete to arxiv with a mandatory
  reason. A deleted document stops verifying in public.
- **Signing freezes the firm.** SIGN writes the firm's rekvizitlar into `Certificate.firmSnapshot`,
  and the document renderer prefers that snapshot over the live `Firm` row. Editing a firm later
  can never rewrite a document it already issued.

Each role's web app only accepts its own role at login — an admin password will not open the
yurist app.

## Requirements

- Node **>= 22**
- MySQL **8**, utf8mb4 (the documents are Cyrillic)

## Setup

```bash
npm install

# Point every app at the same database. Each app reads its own .env:
#   apps/web-*/.env  ->  DATABASE_URL="mysql://root:PASSWORD@localhost:3306/spravka"
# See apps/web-qr/.env.example for the full key list.

npm run db:generate     # prisma generate from packages/shared/prisma/schema.prisma
npm run db:push         # create/refresh the tables
npm run db:seed         # 9 firms + 3 users (idempotent — it upserts)
```

Seed logins — all `parol123`:

| Login | Role |
|---|---|
| `yurist` | YURIST |
| `admin` | ADMIN |
| `rahbar` | RAHBAR (attached to BRIGHT FUTURE) |

`web-qr` is separate: it authenticates against `ADMIN_USERNAME` / `ADMIN_PASSWORD` in its own
`.env`, not against the `User` table.

## Running

```bash
npm run dev -w @spravka/web-yurist    # 5101
npm run dev -w @spravka/web-admin     # 5102
npm run dev -w @spravka/web-rahbar    # 5103
npm run dev -w @spravka/web-public    # 5100
npm run dev:qr                        # 5000
```

Dev mode compiles each route on first request, so the first hit to a page is slow. For anything
resembling real use, build first:

```bash
npm run build          # db:generate + build every workspace
npm start -w @spravka/web-admin
```

> Do not run `npm install` or `next build` while a dev server is running on the same app — they
> swap `node_modules`/`.next` underneath it and the server starts throwing `MODULE_NOT_FOUND`.
> Stop the servers, then install/build.

## Tests

```bash
npm test        # vitest, packages/shared
```

The suite covers the pure core: workflow transitions, edit/delete permissions, certificate
numbering (`DDMMYYYY/NN`), input masks, PINFL validation, calendar helpers, session signing and
password hashing. Anything needing a database or a browser is not in here — see the workflow
rules above for what actually guards the data.

## The document

`packages/shared/src/ui/CertificateDocument.tsx` is a 1:1 replica of the source `.docx` —
A4 210×297mm, Times New Roman 14pt justified, first-line indent 1.25cm, the letterhead and
rekvizitlar block, and the margins measured from the original (top/bottom 20mm, right 15mm,
left 30mm). It prints to a real A4 page.

A signed document carries the green «ТАСДИҚЛАНДИ» stamp; anything unsigned, archived, or unknown
shows the red «ТАСДИҚЛАНМАГАН» card instead. The public page answers 200 in both cases on
purpose — someone scanning a QR should be told the document is not verified, not handed a broken
page.

## Deployment

See [deploy/README.md](deploy/README.md) — nginx, certbot and systemd units for the
`qrsystem.uz` subdomains.
