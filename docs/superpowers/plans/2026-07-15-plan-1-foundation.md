# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `spravka` npm-workspace monorepo with a shared `@spravka/shared` package (`/db` Prisma schema + client, `/core` auth + workflow + numbering), absorb the existing qrcode-pro app as `apps/web-qr` running on the single shared database, and seed initial firms + one user per role.

**Architecture:** One repo, one MySQL database, one shared package. Each app is a full-stack Next.js 14 app importing `@spravka/shared` (transpiled by Next). Pure business logic lives in `@spravka/shared/core` and is unit-tested with Vitest. qrcode-pro's code moves under `apps/web-qr` unchanged except its Prisma import is repointed to the shared client, and its `QrCode` model is merged into the single shared schema.

**Tech Stack:** Node 22, npm workspaces, TypeScript 5, Prisma 5 + MySQL 8, Next.js 14, `jose` (JWT, edge-safe), `bcryptjs` (hashing, node-only), Vitest.

## Global Constraints

- Node ≥ 22; npm workspaces (`apps/*`, `packages/*`). No pnpm/yarn/turbo.
- Enums use the **const-object + union** pattern in `@spravka/shared/core`, values matching the Prisma schema exactly (mutually assignable, no casts).
- One Prisma schema at `packages/shared/prisma/schema.prisma`; one generated client re-exported from `@spravka/shared/db`. No app has its own schema.
- `@spravka/shared` ships **TypeScript source** (no build step); every consuming Next app sets `transpilePackages: ['@spravka/shared']`.
- **web-qr behavior must stay identical** to today's qrcode-pro (same routes, same env-based admin login, same public `/q/[id]`, same QR PNG generation). Only the Prisma import path and schema location change in this plan.
- `bcryptjs` runs only in Node runtime (login route). `jose` `verifySession` is the only auth call allowed in middleware (edge runtime).
- Cookie name for the new role apps: `spravka_session`. web-qr keeps its existing `qrp_session` cookie untouched.
- DATABASE_URL points at a single `spravka` MySQL database.

## File Structure

```
spravka/
├─ package.json                      # workspaces + root scripts
├─ tsconfig.base.json                # shared compiler options
├─ .env                              # DATABASE_URL, AUTH_SECRET (gitignored)
├─ .env.example
├─ deploy/
│  └─ docker-compose.dev.yml         # local MySQL only (port 3310) for dev/testing
├─ packages/
│  └─ shared/
│     ├─ package.json                # @spravka/shared, exports ./db ./core ./ui
│     ├─ tsconfig.json
│     ├─ vitest.config.ts
│     ├─ prisma/
│     │  ├─ schema.prisma            # QrCode + User + Firm + Certificate + WorkflowEvent + Counter
│     │  └─ seed.ts                  # firms + one user per role
│     └─ src/
│        ├─ db/index.ts              # prisma client singleton + re-export generated types/enums
│        ├─ core/
│        │  ├─ enums.ts              # Role, CertStatus, WfAction (const-object pattern)
│        │  ├─ workflow.ts           # TRANSITIONS, findTransition, canEdit, canDelete, ROLE_INBOX
│        │  ├─ workflow.test.ts
│        │  ├─ numbering.ts          # formatCertNumber, counterId
│        │  ├─ numbering.test.ts
│        │  ├─ auth.ts               # jose session + bcrypt hashing
│        │  ├─ auth.test.ts
│        │  ├─ labels.ts             # uz status/role labels
│        │  └─ index.ts              # barrel
│        ├─ ui/index.ts              # placeholder (populated in Plan 2)
│        └─ index.ts                 # barrel
└─ apps/
   └─ web-qr/                        # = former qrcode-pro (repointed to shared db)
```

---

### Task 1: Root monorepo scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `.env`

**Interfaces:**
- Produces: npm workspaces resolving `packages/*` and `apps/*`; root scripts `db:push`, `db:seed`, `db:generate`, `test`.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "spravka",
  "private": true,
  "version": "0.1.0",
  "description": "Ma'lumotnoma tizimi — no-debt certificate system (monorepo)",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "db:generate": "prisma generate --schema packages/shared/prisma/schema.prisma",
    "db:push": "prisma db push --schema packages/shared/prisma/schema.prisma",
    "db:seed": "tsx packages/shared/prisma/seed.ts",
    "test": "npm run test -w @spravka/shared",
    "dev:qr": "npm run dev -w @spravka/web-qr",
    "build": "npm run db:generate && npm run build --workspaces --if-present"
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3"
  },
  "engines": { "node": ">=20" }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 3: Create `.env.example`**

```dotenv
# Single MySQL database for the whole system
DATABASE_URL="mysql://root:root@localhost:3310/spravka"
# JWT signing secret for the role apps (min 32 chars)
AUTH_SECRET="change-me-to-a-long-random-string-min-32-chars"
# Public base URL of web-qr (QR targets + public certificate links)
NEXT_PUBLIC_PUBLIC_URL="http://localhost:5000"
```

- [ ] **Step 4: Create `.env`** (copy of `.env.example` with the dev DB) — same content as Step 3.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/JONIBEK/Desktop/spravka"
git add package.json tsconfig.base.json .env.example
git commit -m "chore: root monorepo scaffold (npm workspaces + scripts)"
```

---

### Task 2: `@spravka/shared` package skeleton + Vitest

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/ui/index.ts`

**Interfaces:**
- Produces: importable subpaths `@spravka/shared/db`, `@spravka/shared/core`, `@spravka/shared/ui`; `npm run test -w @spravka/shared` runs Vitest.

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@spravka/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./db": "./src/db/index.ts",
    "./core": "./src/core/index.ts",
    "./ui": "./src/ui/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "jose": "^5.9.6",
    "nanoid": "^5.0.9"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "noEmit": true },
  "include": ["src", "prisma"]
}
```

- [ ] **Step 3: Create `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create placeholders**

`packages/shared/src/ui/index.ts`:
```ts
// Populated in Plan 2 (shared UI). Kept so the ./ui export resolves.
export {};
```

`packages/shared/src/index.ts`:
```ts
export * as core from './core/index';
```
(Barrel is convenience only; apps import the subpaths directly.)

- [ ] **Step 5: Install and commit**

```bash
cd "C:/Users/JONIBEK/Desktop/spravka"
npm install
git add packages/shared/package.json packages/shared/tsconfig.json packages/shared/vitest.config.ts packages/shared/src/index.ts packages/shared/src/ui/index.ts package-lock.json
git commit -m "chore: @spravka/shared package skeleton + vitest"
```

Expected: `npm install` completes; `node_modules/@spravka/shared` symlink exists.

---

### Task 3: Single Prisma schema + client singleton

**Files:**
- Create: `packages/shared/prisma/schema.prisma`
- Create: `packages/shared/src/db/index.ts`

**Interfaces:**
- Produces: Prisma models `QrCode, User, Firm, Certificate, WorkflowEvent, Counter` + enums `QrType, Role, CertStatus, WfAction`; `import { prisma } from '@spravka/shared/db'`; generated types/enums re-exported from the same module.

- [ ] **Step 1: Create `packages/shared/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ─── Existing QR system (moved verbatim from qrcode-pro) ───────────────────
enum QrType { URL TEXT HTML FILE IMAGE }

model QrCode {
  id         String   @id @db.VarChar(32)
  name       String   @db.VarChar(120)
  type       QrType   @default(URL)
  content    String?  @db.Text
  fileUrl    String?  @db.VarChar(500)
  fileName   String?  @db.VarChar(255)
  fgColor    String   @default("#0f172a") @db.VarChar(9)
  bgColor    String   @default("#ffffff") @db.VarChar(9)
  size       Int      @default(256)
  level      String   @default("M") @db.VarChar(1)
  qrImageUrl String?  @db.VarChar(500)
  scans      Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([type])
}

// ─── Ma'lumotnoma system ───────────────────────────────────────────────────
enum Role       { YURIST ADMIN RAHBAR }
enum CertStatus { DRAFT ADMIN_REVIEW DIRECTOR_REVIEW SIGNED }
enum WfAction   { SUBMIT APPROVE RETURN SIGN DELETE RESTORE }

model User {
  id            String   @id @default(cuid())
  fullName      String
  login         String   @unique
  passwordHash  String
  plainPassword String?
  role          Role
  position      String?
  phone         String?
  email         String?
  avatarPath    String?
  firmId        String?
  isActive      Boolean  @default(true)
  lastLoginAt   DateTime?
  createdCerts  Certificate[]   @relation("CertCreatedBy")
  signedCerts   Certificate[]   @relation("CertSignedBy")
  events        WorkflowEvent[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Firm {
  id               String   @id @default(cuid())
  name             String
  shortName        String?
  stir             String?
  oked             String?
  directorName     String
  directorPosition String   @default("Ижрочи директори")
  executorName     String
  executorPhone    String?
  phone            String
  email            String?
  website          String?
  region           String?
  address          String?
  bankName         String?
  bankAccount      String?
  mfo              String?
  logoPath         String?
  sealPath         String?
  signaturePath    String?
  isActive         Boolean  @default(true)
  certificates     Certificate[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model Certificate {
  id               String     @id @db.VarChar(32)
  number           String     @unique
  seq              Int
  issueDate        DateTime
  firm             Firm       @relation(fields: [firmId], references: [id])
  firmId           String
  status           CertStatus @default(DRAFT)

  personFullName   String
  personPassport   String
  passportIssuedBy String?
  passportIssuedAt DateTime?

  contractNumber   String
  contractDate     DateTime
  contractType     String     @default("«Микроқарз» универсал шартномаси")
  loanAmount       Decimal    @db.Decimal(18, 2)
  asOfDate         DateTime

  bodyText         String?    @db.Text
  pdfPath          String?

  signedBy         User?      @relation("CertSignedBy", fields: [signedById], references: [id])
  signedById       String?
  signedAt         DateTime?
  scans            Int        @default(0)

  deletedAt        DateTime?
  deletedById      String?
  deletedReason    String?    @db.Text

  createdBy        User       @relation("CertCreatedBy", fields: [createdById], references: [id])
  createdById      String
  events           WorkflowEvent[]
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  @@index([status])
  @@index([firmId])
}

model WorkflowEvent {
  id            String      @id @default(cuid())
  certificate   Certificate @relation(fields: [certificateId], references: [id])
  certificateId String
  actor         User        @relation(fields: [actorId], references: [id])
  actorId       String
  action        WfAction
  fromStatus    CertStatus
  toStatus      CertStatus
  note          String?     @db.Text
  createdAt     DateTime    @default(now())

  @@index([certificateId])
}

model Counter {
  id    String @id
  value Int    @default(0)
}
```

- [ ] **Step 2: Create `packages/shared/src/db/index.ts`**

```ts
import { PrismaClient } from '@prisma/client';

const g = globalThis as unknown as { __spravkaPrisma?: PrismaClient };

export const prisma =
  g.__spravkaPrisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'] });

if (process.env.NODE_ENV !== 'production') g.__spravkaPrisma = prisma;

// Re-export generated types + enums so apps get them from one place.
export * from '@prisma/client';
```

- [ ] **Step 3: Generate the client and validate**

```bash
cd "C:/Users/JONIBEK/Desktop/spravka"
npm run db:generate
```
Expected: "Generated Prisma Client" with no schema errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/prisma/schema.prisma packages/shared/src/db/index.ts
git commit -m "feat(db): single Prisma schema (QrCode + ma'lumotnoma models) + client singleton"
```

---

### Task 4: Core enums + workflow (TDD)

**Files:**
- Create: `packages/shared/src/core/enums.ts`
- Create: `packages/shared/src/core/workflow.ts`
- Test: `packages/shared/src/core/workflow.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Role`, `CertStatus`, `WfAction` (const-object + union types).
  - `TransitionRule { from: CertStatus; to: CertStatus; role: Role; action: WfAction }`.
  - `TRANSITIONS: TransitionRule[]`.
  - `findTransition(from: CertStatus, role: Role, action: WfAction): TransitionRule | undefined`.
  - `canEdit(role: Role, status: CertStatus): boolean`.
  - `canDelete(role: Role): boolean`.
  - `ROLE_INBOX: Record<Role, CertStatus | null>`.

- [ ] **Step 1: Write the failing test** — `packages/shared/src/core/workflow.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { Role, CertStatus, WfAction } from './enums';
import { findTransition, canEdit, canDelete, ROLE_INBOX } from './workflow';

describe('workflow transitions', () => {
  it('yurist submits a draft to admin review', () => {
    const t = findTransition(CertStatus.DRAFT, Role.YURIST, WfAction.SUBMIT);
    expect(t?.to).toBe(CertStatus.ADMIN_REVIEW);
  });

  it('admin approves review to director review', () => {
    const t = findTransition(CertStatus.ADMIN_REVIEW, Role.ADMIN, WfAction.APPROVE);
    expect(t?.to).toBe(CertStatus.DIRECTOR_REVIEW);
  });

  it('rahbar signs director review to signed', () => {
    const t = findTransition(CertStatus.DIRECTOR_REVIEW, Role.RAHBAR, WfAction.SIGN);
    expect(t?.to).toBe(CertStatus.SIGNED);
  });

  it('rejects an illegal transition (yurist cannot sign)', () => {
    expect(findTransition(CertStatus.DIRECTOR_REVIEW, Role.YURIST, WfAction.SIGN)).toBeUndefined();
  });
});

describe('edit-lock rule', () => {
  it('yurist may edit only DRAFT', () => {
    expect(canEdit(Role.YURIST, CertStatus.DRAFT)).toBe(true);
    expect(canEdit(Role.YURIST, CertStatus.ADMIN_REVIEW)).toBe(false);
  });
  it('admin may edit DRAFT and ADMIN_REVIEW but not after approval', () => {
    expect(canEdit(Role.ADMIN, CertStatus.ADMIN_REVIEW)).toBe(true);
    expect(canEdit(Role.ADMIN, CertStatus.DIRECTOR_REVIEW)).toBe(false);
    expect(canEdit(Role.ADMIN, CertStatus.SIGNED)).toBe(false);
  });
  it('rahbar never edits content', () => {
    expect(canEdit(Role.RAHBAR, CertStatus.DIRECTOR_REVIEW)).toBe(false);
  });
});

describe('delete-lock rule', () => {
  it('only rahbar may delete', () => {
    expect(canDelete(Role.RAHBAR)).toBe(true);
    expect(canDelete(Role.ADMIN)).toBe(false);
    expect(canDelete(Role.YURIST)).toBe(false);
  });
});

describe('role inbox', () => {
  it('maps each role to the status it acts on', () => {
    expect(ROLE_INBOX[Role.YURIST]).toBe(CertStatus.DRAFT);
    expect(ROLE_INBOX[Role.ADMIN]).toBe(CertStatus.ADMIN_REVIEW);
    expect(ROLE_INBOX[Role.RAHBAR]).toBe(CertStatus.DIRECTOR_REVIEW);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "C:/Users/JONIBEK/Desktop/spravka"
npm run test -w @spravka/shared
```
Expected: FAIL — cannot resolve `./enums.js` / `./workflow.js`.

- [ ] **Step 3: Create `packages/shared/src/core/enums.ts`**

```ts
export const Role = { YURIST: 'YURIST', ADMIN: 'ADMIN', RAHBAR: 'RAHBAR' } as const;
export type Role = (typeof Role)[keyof typeof Role];

export const CertStatus = {
  DRAFT: 'DRAFT',
  ADMIN_REVIEW: 'ADMIN_REVIEW',
  DIRECTOR_REVIEW: 'DIRECTOR_REVIEW',
  SIGNED: 'SIGNED',
} as const;
export type CertStatus = (typeof CertStatus)[keyof typeof CertStatus];

export const WfAction = {
  SUBMIT: 'SUBMIT',
  APPROVE: 'APPROVE',
  RETURN: 'RETURN',
  SIGN: 'SIGN',
  DELETE: 'DELETE',
  RESTORE: 'RESTORE',
} as const;
export type WfAction = (typeof WfAction)[keyof typeof WfAction];
```

- [ ] **Step 4: Create `packages/shared/src/core/workflow.ts`**

```ts
import { Role, CertStatus, WfAction } from './enums';

export interface TransitionRule {
  from: CertStatus;
  to: CertStatus;
  role: Role;
  action: WfAction;
}

/** Single source of truth for status transitions (soft-delete is handled separately). */
export const TRANSITIONS: TransitionRule[] = [
  { from: CertStatus.DRAFT, to: CertStatus.ADMIN_REVIEW, role: Role.YURIST, action: WfAction.SUBMIT },
  { from: CertStatus.ADMIN_REVIEW, to: CertStatus.DIRECTOR_REVIEW, role: Role.ADMIN, action: WfAction.APPROVE },
  { from: CertStatus.ADMIN_REVIEW, to: CertStatus.DRAFT, role: Role.ADMIN, action: WfAction.RETURN },
  { from: CertStatus.DIRECTOR_REVIEW, to: CertStatus.SIGNED, role: Role.RAHBAR, action: WfAction.SIGN },
  { from: CertStatus.DIRECTOR_REVIEW, to: CertStatus.ADMIN_REVIEW, role: Role.RAHBAR, action: WfAction.RETURN },
];

export function findTransition(
  from: CertStatus,
  role: Role,
  action: WfAction,
): TransitionRule | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.role === role && t.action === action);
}

/** Content is editable only before admin approval. */
export function canEdit(role: Role, status: CertStatus): boolean {
  if (role === Role.YURIST) return status === CertStatus.DRAFT;
  if (role === Role.ADMIN) return status === CertStatus.DRAFT || status === CertStatus.ADMIN_REVIEW;
  return false;
}

/** Deletion (soft-delete to arxiv) is RAHBAR-only. */
export function canDelete(role: Role): boolean {
  return role === Role.RAHBAR;
}

/** The status each role acts on (their inbox queue). */
export const ROLE_INBOX: Record<Role, CertStatus | null> = {
  [Role.YURIST]: CertStatus.DRAFT,
  [Role.ADMIN]: CertStatus.ADMIN_REVIEW,
  [Role.RAHBAR]: CertStatus.DIRECTOR_REVIEW,
};
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test -w @spravka/shared
```
Expected: all workflow tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/core/enums.ts packages/shared/src/core/workflow.ts packages/shared/src/core/workflow.test.ts
git commit -m "feat(core): workflow transitions + edit/delete rules (TDD)"
```

---

### Task 5: Core numbering (TDD)

**Files:**
- Create: `packages/shared/src/core/numbering.ts`
- Test: `packages/shared/src/core/numbering.test.ts`

**Interfaces:**
- Produces:
  - `formatCertNumber(date: Date, seq: number): string` → `"DDMMYYYY/NN"` (NN zero-padded to 2, wider if needed).
  - `counterId(firmId: string, year: number): string` → `"<firmId>:<year>"`.

- [ ] **Step 1: Write the failing test** — `packages/shared/src/core/numbering.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { formatCertNumber, counterId } from './numbering';

describe('formatCertNumber', () => {
  it('formats date as DDMMYYYY and pads seq to 2 digits', () => {
    expect(formatCertNumber(new Date(2026, 5, 26), 4)).toBe('26062026/04');
  });
  it('keeps seq wider than 2 digits', () => {
    expect(formatCertNumber(new Date(2026, 0, 1), 123)).toBe('01012026/123');
  });
});

describe('counterId', () => {
  it('combines firmId and year', () => {
    expect(counterId('firm_x', 2026)).toBe('firm_x:2026');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w @spravka/shared
```
Expected: FAIL — cannot resolve `./numbering.js`.

- [ ] **Step 3: Create `packages/shared/src/core/numbering.ts`**

```ts
/** Certificate number: DDMMYYYY/NN (NN zero-padded to at least 2 digits). */
export function formatCertNumber(date: Date, seq: number): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}${mm}${yyyy}/${String(seq).padStart(2, '0')}`;
}

/** Counter row id for a firm's yearly sequence. */
export function counterId(firmId: string, year: number): string {
  return `${firmId}:${year}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -w @spravka/shared
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/core/numbering.ts packages/shared/src/core/numbering.test.ts
git commit -m "feat(core): certificate numbering helpers (TDD)"
```

---

### Task 6: Core auth — jose session + bcrypt (TDD)

**Files:**
- Create: `packages/shared/src/core/auth.ts`
- Test: `packages/shared/src/core/auth.test.ts`

**Interfaces:**
- Consumes: `Role` from `./enums`.
- Produces:
  - `COOKIE_NAME = 'spravka_session'`.
  - `interface SessionPayload { sub: string; login: string; role: Role; fullName: string }`.
  - `createSession(p: SessionPayload): Promise<string>` (7d JWT).
  - `verifySession(token: string | undefined): Promise<SessionPayload | null>` (edge-safe; jose only).
  - `hashPassword(pw: string): Promise<string>` and `verifyPassword(pw: string, hash: string): Promise<boolean>` (bcrypt; node-only).

- [ ] **Step 1: Write the failing test** — `packages/shared/src/core/auth.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { Role } from './enums';
import { createSession, verifySession, hashPassword, verifyPassword } from './auth';

const payload = { sub: 'u1', login: 'yurist', role: Role.YURIST, fullName: 'Test Yurist' };

describe('session', () => {
  it('round-trips a signed session', async () => {
    const token = await createSession(payload);
    const back = await verifySession(token);
    expect(back?.login).toBe('yurist');
    expect(back?.role).toBe(Role.YURIST);
  });
  it('returns null for a missing or bad token', async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession('not.a.jwt')).toBeNull();
  });
});

describe('password hashing', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -w @spravka/shared
```
Expected: FAIL — cannot resolve `./auth.js`.

- [ ] **Step 3: Create `packages/shared/src/core/auth.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { Role } from './enums';

const secret = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-change-me-min-32-chars-long!!');

export const COOKIE_NAME = 'spravka_session';

export interface SessionPayload {
  sub: string;
  login: string;
  role: Role;
  fullName: string;
}

export async function createSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ login: p.login, role: p.role, fullName: p.fullName })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      sub: String(payload.sub),
      login: String(payload.login),
      role: payload.role as Role,
      fullName: String(payload.fullName),
    };
  } catch {
    return null;
  }
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -w @spravka/shared
```
Expected: PASS (all core tests green).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/core/auth.ts packages/shared/src/core/auth.test.ts
git commit -m "feat(core): jose session + bcrypt password helpers (TDD)"
```

---

### Task 7: Core labels + barrel

**Files:**
- Create: `packages/shared/src/core/labels.ts`
- Create: `packages/shared/src/core/index.ts`

**Interfaces:**
- Produces: `STATUS_LABELS: Record<CertStatus, string>`, `ROLE_LABELS: Record<Role, string>`, `ACTION_LABELS: Record<WfAction, string>`; `@spravka/shared/core` barrel re-exporting enums, workflow, numbering, auth, labels.

- [ ] **Step 1: Create `packages/shared/src/core/labels.ts`**

```ts
import { Role, CertStatus, WfAction } from './enums';

export const STATUS_LABELS: Record<CertStatus, string> = {
  [CertStatus.DRAFT]: 'Qoralama',
  [CertStatus.ADMIN_REVIEW]: 'Admin ko‘rigida',
  [CertStatus.DIRECTOR_REVIEW]: 'Rahbar imzosida',
  [CertStatus.SIGNED]: 'Imzolangan',
};

export const ROLE_LABELS: Record<Role, string> = {
  [Role.YURIST]: 'Yurist',
  [Role.ADMIN]: 'Admin',
  [Role.RAHBAR]: 'Rahbar',
};

export const ACTION_LABELS: Record<WfAction, string> = {
  [WfAction.SUBMIT]: 'Yuborildi',
  [WfAction.APPROVE]: 'Tasdiqlandi',
  [WfAction.RETURN]: 'Qaytarildi',
  [WfAction.SIGN]: 'Imzolandi',
  [WfAction.DELETE]: 'O‘chirildi (arxiv)',
  [WfAction.RESTORE]: 'Tiklandi',
};
```

- [ ] **Step 2: Create `packages/shared/src/core/index.ts`**

```ts
export * from './enums';
export * from './workflow';
export * from './numbering';
export * from './auth';
export * from './labels';
```

- [ ] **Step 3: Run tests (still green)**

```bash
npm run test -w @spravka/shared
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/core/labels.ts packages/shared/src/core/index.ts
git commit -m "feat(core): uz labels + core barrel export"
```

---

### Task 8: Dev database + seed (firms + one user per role)

**Files:**
- Create: `deploy/docker-compose.dev.yml`
- Create: `packages/shared/prisma/seed.ts`

**Interfaces:**
- Consumes: `prisma` from `@spravka/shared/db`, `hashPassword` from `@spravka/shared/core`.
- Produces: a reachable dev MySQL on `localhost:3310`; seeded `Firm` rows (incl. BRIGHT FUTURE FINANCING) and three `User` rows (`yurist`/`admin`/`rahbar`, password `parol123`).

- [ ] **Step 1: Create `deploy/docker-compose.dev.yml`**

```yaml
# Local dev database only. App runs on the host (npm run dev).
services:
  mysql-dev:
    image: mysql:8.4
    container_name: spravka-mysql-dev
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: spravka
    ports:
      - "3310:3306"
    volumes:
      - spravka_mysql_dev:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -proot --silent"]
      interval: 5s
      timeout: 5s
      retries: 30
volumes:
  spravka_mysql_dev:
```

- [ ] **Step 2: Bring up the DB and push the schema**

```bash
cd "C:/Users/JONIBEK/Desktop/spravka"
docker compose -f deploy/docker-compose.dev.yml up -d
# wait until healthy, then:
npm run db:push
```
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 3: Create `packages/shared/prisma/seed.ts`**

```ts
import { prisma } from '../src/db/index';
import { hashPassword, Role } from '../src/core/index';

async function main() {
  const firms = [
    {
      id: 'firm_bright_future',
      name: '“BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI” МЧЖ',
      shortName: 'BRIGHT FUTURE FINANCING',
      directorName: 'А.А.Бойназаров',
      executorName: 'Б.Тоиров',
      executorPhone: '+99855-503-01-90',
      phone: '+99855-503-01-90',
      region: 'Samarqand',
    },
    { id: 'firm_2', name: 'МИКРОМОЛИЯ ТАШКИЛОТИ 2 МЧЖ', directorName: 'Ф.И.Ш.', executorName: 'Ф.И.Ш.', phone: '+998000000002' },
    { id: 'firm_3', name: 'МИКРОМОЛИЯ ТАШКИЛОТИ 3 МЧЖ', directorName: 'Ф.И.Ш.', executorName: 'Ф.И.Ш.', phone: '+998000000003' },
    { id: 'firm_4', name: 'МИКРОМОЛИЯ ТАШКИЛОТИ 4 МЧЖ', directorName: 'Ф.И.Ш.', executorName: 'Ф.И.Ш.', phone: '+998000000004' },
    { id: 'firm_5', name: 'МИКРОМОЛИЯ ТАШКИЛОТИ 5 МЧЖ', directorName: 'Ф.И.Ш.', executorName: 'Ф.И.Ш.', phone: '+998000000005' },
  ];

  for (const f of firms) {
    await prisma.firm.upsert({ where: { id: f.id }, update: f, create: f });
  }

  const pass = await hashPassword('parol123');
  const users = [
    { login: 'yurist', fullName: 'Yurist Foydalanuvchi', role: Role.YURIST, position: 'Yurist' },
    { login: 'admin', fullName: 'Admin Foydalanuvchi', role: Role.ADMIN, position: 'Administrator' },
    { login: 'rahbar', fullName: 'Rahbar Foydalanuvchi', role: Role.RAHBAR, position: 'Ijrochi direktor' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { login: u.login },
      update: { fullName: u.fullName, role: u.role, position: u.position },
      create: { ...u, passwordHash: pass, plainPassword: 'parol123' },
    });
  }

  console.log('Seed complete: %d firms, %d users', firms.length, users.length);
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 4: Run the seed**

```bash
npm run db:seed
```
Expected: `Seed complete: 5 firms, 3 users`.

- [ ] **Step 5: Verify rows exist**

```bash
docker exec spravka-mysql-dev mysql -uroot -proot spravka -e "SELECT login, role FROM User; SELECT COUNT(*) firms FROM Firm;"
```
Expected: three users (yurist/admin/rahbar) and `firms = 5`.

- [ ] **Step 6: Commit**

```bash
git add deploy/docker-compose.dev.yml packages/shared/prisma/seed.ts
git commit -m "feat(db): dev mysql compose + seed (5 firms + 3 role users)"
```

---

### Task 9: Absorb qrcode-pro as `apps/web-qr` (repoint to shared DB)

**Files:**
- Create: `apps/web-qr/**` (copied from qrcode-pro source)
- Modify: `apps/web-qr/src/lib/prisma.ts` (re-export shared client)
- Modify: `apps/web-qr/package.json` (name, deps, scripts)
- Modify: `apps/web-qr/next.config.js` (transpilePackages)
- Delete: `apps/web-qr/prisma/` (schema now lives in shared)

**Interfaces:**
- Consumes: `prisma` from `@spravka/shared/db`.
- Produces: `apps/web-qr` = the QR app on the shared DB, behavior unchanged; workspace name `@spravka/web-qr`.

- [ ] **Step 1: Copy the qrcode-pro app source into the monorepo** (exclude git/build/deploy/db artifacts)

```bash
cd "C:/Users/JONIBEK/Desktop"
mkdir -p spravka/apps/web-qr
# copy app source, config and public assets — NOT node_modules/.next/.git/prisma/docker files
robocopy qrcode-pro spravka/apps/web-qr /E \
  /XD node_modules .next .git prisma nginx \
  /XF docker-compose.yml Dockerfile .dockerignore docker-entrypoint.sh docker-fix-permissions.sh \
      deploy.sh deploy.ps1 install-docker.sh debug-login.sh resolve-git-conflict.sh \
      start.cmd stop.cmd package-lock.json
# robocopy exit codes 0-7 are success; ignore non-zero
echo done
```
(If `robocopy` is unavailable in the shell, use `cp -r` and then remove the excluded files.)

- [ ] **Step 2: Repoint the Prisma import** — overwrite `apps/web-qr/src/lib/prisma.ts`

```ts
// The single shared Prisma client (one DB for the whole system).
export { prisma } from '@spravka/shared/db';
```

- [ ] **Step 3: Update `apps/web-qr/package.json`**

Set the name and scripts; add the shared dep; drop the app-local prisma generate (the schema is shared):

```json
{
  "name": "@spravka/web-qr",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -H 0.0.0.0 -p 5000",
    "build": "next build",
    "start": "next start -H 0.0.0.0 -p 5000",
    "lint": "next lint"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "@spravka/shared": "*",
    "bcryptjs": "^2.4.3",
    "iconsax-react": "^0.0.8",
    "jose": "^5.9.6",
    "nanoid": "^5.0.9",
    "next": "14.2.18",
    "qrcode": "^1.5.4",
    "qrcode.react": "^4.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.17.6",
    "@types/qrcode": "^1.5.6",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 4: Enable transpilation of the shared package** — overwrite `apps/web-qr/next.config.js`

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@spravka/shared'],
};
module.exports = nextConfig;
```

- [ ] **Step 5: Reinstall workspaces and build web-qr**

```bash
cd "C:/Users/JONIBEK/Desktop/spravka"
npm install
npm run db:generate
npm run build -w @spravka/web-qr
```
Expected: Next build succeeds with no module-resolution errors for `@spravka/shared/db`.

- [ ] **Step 6: Smoke-test web-qr against the shared DB**

```bash
npm run dev -w @spravka/web-qr
```
Then in a browser: open `http://localhost:5000/login`, log in with the qrcode-pro env admin creds (`ADMIN_USERNAME`/`ADMIN_PASSWORD` in `apps/web-qr/.env`), create a URL QR, and open its `/q/[id]` public page — confirm the redirect works and `scans` increments. Stop the dev server.

> Note: ensure `apps/web-qr/.env` has `DATABASE_URL` pointing at the shared `spravka` DB (localhost:3310) plus the existing `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`AUTH_SECRET`/`NEXT_PUBLIC_APP_URL` keys copied from qrcode-pro.

- [ ] **Step 7: Commit**

```bash
git add apps/web-qr
git commit -m "feat(web-qr): absorb qrcode-pro into monorepo on the shared Prisma client"
```

---

### Task 10: Root README + verify full foundation

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: documented dev bootstrap; a green `npm test` + a building, running `web-qr`.

- [ ] **Step 1: Create `README.md`**

```markdown
# Spravka — Ma'lumotnoma tizimi (monorepo)

No-debt certificate system for microfinance firms. One repo, one MySQL DB, one shared package.

## Apps
- `apps/web-qr` — QR system + public certificate verification (from qrcode-pro)
- (Plan 3+) `apps/web-yurist`, `apps/web-admin`, `apps/web-rahbar`

## Packages
- `packages/shared` — `@spravka/shared/db` (Prisma), `/core` (auth, workflow, numbering), `/ui`

## Dev bootstrap
```bash
npm install
docker compose -f deploy/docker-compose.dev.yml up -d   # MySQL on :3310
cp .env.example .env                                     # set DATABASE_URL + AUTH_SECRET
npm run db:push
npm run db:seed                                          # yurist/admin/rahbar — parol123
npm run test                                             # shared/core unit tests
npm run dev:qr                                           # web-qr on :5000
```
```

- [ ] **Step 2: Full verification**

```bash
cd "C:/Users/JONIBEK/Desktop/spravka"
npm run test          # all @spravka/shared vitest specs green
npm run db:generate   # prisma client generates
```
Expected: tests PASS; client generates. web-qr already verified in Task 9.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: root README + dev bootstrap"
```

---

## Self-Review

**Spec coverage (foundation slice):**
- One repo / one DB / one shared package → Tasks 1–3, 9. ✓
- Prisma models incl. ideal User/Firm fields + Certificate soft-delete → Task 3. ✓
- Workflow transitions + edit-lock + delete-lock (RAHBAR) → Task 4. ✓
- Numbering `DDMMYYYY/NN` → Task 5. ✓
- Auth (jose + bcrypt), `spravka_session` cookie → Task 6. ✓
- Seed (5 firms incl. BRIGHT FUTURE + 3 role users) → Task 8. ✓
- qrcode-pro absorbed as web-qr, behavior unchanged → Task 9. ✓
- Deferred to later plans: UI (Plan 2), role apps + PDF + public cert view + print + calendar + monitoring (Plans 3–5), production devops (Plan 5). Tracked in the roadmap.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `Role`/`CertStatus`/`WfAction` string values in `core/enums.ts` match the Prisma enums in `schema.prisma`. `SessionPayload` fields used in `auth.ts` match the test. `findTransition`/`canEdit`/`canDelete`/`ROLE_INBOX` signatures match Task 4's Interfaces block and the tests.
