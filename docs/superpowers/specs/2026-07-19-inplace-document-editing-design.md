# In-place document editing — Design Spec

**Date:** 2026-07-19
**Status:** Approved for implementation
**Relates to:** `2026-07-16-pdf-freeze-design.md` (the frozen PDF this must not diverge from)

## 1. Purpose

Today a yurist creates a maʼlumotnoma by filling a form and never sees the document until after it
is saved. The admin corrects it through a modal that shows fields, not the page. The document — the
only artifact anyone outside the system ever sees — is invisible during the one activity that
decides what it will say.

This replaces the form with the document. Pick a firm, get the blank, type into the sheet where the
words will actually print, save.

## 2. Scope

**In:** the yurist's new-ariza flow; the admin's content edit; an editable mode on
`CertificateDocument`; a sidebar panel state; document-level undo; browser-local draft recovery.

**Out:** any change to the printed layout; the PDF pipeline; the workflow and its statuses; the
rahbar's screens; free-text rewriting of the template (`bodyText` stays unused).

## 3. Decisions

| Question | Decision | Why |
|---|---|---|
| What is editable | The variable slots only — never the template sentences | The document is a 1:1 replica of the source .docx. A free-text body would let a legal document say anything, and there is no reviewer between the yurist and the paper. |
| One component or two | `CertificateDocument` gains an optional `edit` prop | A separate `EditableCertificateDocument` is two copies of the layout that drift. When they drift, the screen and the frozen PDF disagree — the exact failure `2026-07-16` was written to prevent. |
| How editing reaches the component | Render props, passed in | `@spravka/shared/pdf` renders this module under Node for Chromium. Importing client-only editors into it would pull a browser bundle into the PDF path. |
| Firm selection | Sidebar, route-driven (`/arizalar/yangi/[firmId]`) | The firm picks the blank, so it is navigation, not a field. Deriving the panel from the URL means browser back works and a reload keeps the state. |
| PINFL | A slim bar above the sheet, outside the paper | PINFL is never printed. Everything on the paper must be something that prints, or "what you see is what you get" stops being true. |
| Long values | `contenteditable` spans in the real text flow | They must wrap and re-justify like the printed text does. An overlaid input cannot wrap. |
| Short masked values | Click-to-edit auto-width input, masked text only | Masks and validation are unworkable inside `contenteditable`. Dates get `maskDmy`, not a calendar: a popup opening inside a justified 14pt paragraph displaces the text it sits in, and a clerk copying a date off a contract types eight digits rather than navigating months. Dots optional, eight digits and it stops. |
| Adding a contract | A control in the bar above the paper | A «+» in the middle of a legal paragraph reads as part of the document. Removal stays inline — it has to say which contract — but is invisible until the paragraph is hovered. |
| An unsaved ariza's number | The `№` line is omitted entirely | The counter issues the number on save. A placeholder in its place puts a mark on the document that is not a certificate number. |
| Undo | App-level, over the whole draft | Native undo is per-field and does not see a contract row being added or removed. |
| Autosave | Browser only; the row is created on an explicit save | `nextCertNumber` increments an atomic counter that is never reused. A row per abandoned attempt punches holes in the official number sequence. |
| Screen colour | Soft grey text on screen, black in print | Softer on screen; the printed and frozen document is unchanged. A preview toggle shows the print truth on demand. |

## 4. Components

```
packages/shared/src/ui/
├─ CertificateDocument.tsx   + optional `edit` render-prop slots
├─ DocumentEdit.tsx          NEW — editable primitives + the draft/undo store
├─ CertSheetEditor.tsx       NEW — the chrome: PINFL bar, undo, preview toggle, save bar
└─ AppShell.tsx              + optional `panel` (route-triggered sidebar takeover)
```

- `DocumentEdit.tsx` holds `EditableText` (contenteditable), `EditableValue` (click-to-edit masked
  input), `EditableContracts`, `useCertDraft` (state, history, browser-local persistence), and
  `certificateEditSlots` — the function that assembles those primitives into the `edit` prop.
- The slot set lives beside the primitives rather than inside the editor screen so a test can hand
  the same slots to the same document. That is what makes §10's first assertion possible; built
  inside `CertSheetEditor` it would only be reachable through a rendered React tree.
- `CertSheetEditor.tsx` owns everything around the paper and nothing on it. It takes a draft and a
  set of save actions; the apps supply the save calls.
- `CertificateDocument.tsx` stays the single source of layout truth. With no `edit` prop its output
  is byte-identical to today's.

`EditableText` renders its value as children once, from a frozen ref, and updates the node
imperatively after that. Children alone would move the caret to the start on every keystroke; the
effect alone would leave the span empty in the server's markup and blank on first paint.

It also places the caret itself when the slot is empty. **An empty inline `contenteditable` is a box
browsers will not focus on click** — the click lands, nothing takes focus, and typing goes to the
page. On screen that is indistinguishable from a field that does not work, and it is exactly what
happened: the name slots refused every keystroke while the masked inputs beside them were fine.
Taking over caret placement is limited to the empty case; with text in it, clicking mid-name has to
land mid-name.

### Touched
- `apps/web-yurist/src/app/(app)/layout.tsx` — supplies the sidebar panel.
- `apps/web-yurist/src/app/(app)/arizalar/yangi/page.tsx` — becomes the "pick a firm" state.
- `apps/web-yurist/src/app/(app)/arizalar/yangi/[firmId]/` — **new**, the sheet.
- `apps/web-admin/src/app/(app)/arizalar/[id]/tahrir/` — **new**, the same sheet over an existing row.
- `apps/web-admin/src/app/(app)/arizalar/[id]/page.tsx` — the edit control points at that route.

`CreateAriza.tsx` and `EditAriza.tsx` are deleted. Keeping them would leave two ways to write the
same record, and they would not stay in step.

## 5. Flow

1. `Yangi ariza` → `/arizalar/yangi`. The sidebar swaps its menu for a back control and the active
   firms. The main area says the firm has not been picked.
2. A firm → `/arizalar/yangi/[firmId]`. The blank renders with that firm's letterhead, rekvizitlar
   and director. The sidebar keeps the list with the chosen firm marked.
3. PINFL in the bar above the sheet. A hit fills the name, passport and issuing details and reports
   `✓ Mijoz topildi`; a miss reports `Yangi mijoz`.
4. The slots on the sheet are typed into directly. Text reflows; contract rows are added and removed
   inline.
5. `Qoralama saqlash` or `Admin tasdigʻiga yuborish` posts to the existing
   `POST /api/certificates` — unchanged, same body it takes today.

Both edit routes are the same sheet over a loaded row, saving through `PUT /api/certificates/[id]`.
The firm is fixed there, so the sidebar does not change.

**Who may reopen a document is core's `canEdit`, not a UI choice.** A yurist gets their own `DRAFT`;
an admin gets `DRAFT` and `ADMIN_REVIEW`; after that the document is frozen for everyone. The
yurist's route adds an ownership check on top — `canEdit` says *whether a draft may be edited*, not
*whose draft it is*, and neither guard implies the other. A yurist arriving at a submitted ariza is
redirected to the read-only page rather than refused: they came to look at their document.

## 6. Editable slots

| Slot | Kind | Note |
|---|---|---|
| `personFullName` | text | Appears three times; all three edit one value. |
| `passportIssuedBy` | text | Optional. |
| `contractType` | text | Editable at its singular occurrence only. The first paragraph prints the derived plural, read-only — one value cannot have two independent editors. |
| `personPassport` | value | Mask `AE5348993`. |
| `passportIssuedAt` | value | Optional. |
| `loanAmount` | value | Mask `4 000 000`. |
| `asOfDate`, `issueDate` | value | |
| `contracts` | list | Inline `date + number` pairs, add and remove in place. |

Not editable: letterhead, rekvizitlar, director, certificate number. Those come from the firm row
and the counter.

**An unfilled slot is blank, not a specimen.** «00.00.0000» and «AE0000000» standing in every empty
slot made the document read as though it said those things, loudly enough to drown out what was
actually written. A blank in the line is what a paper blank leaves, and it is also the truth. The
slot keeps a minimum box so it can still be clicked; the field's name is in its `title` and
`aria-label`.

**An open slot is sized to its own text**, by a grid wrapper echoing the value into a hidden
`::after`, so the box is exactly as wide as that text in the document's own font. Sizing in `ch` —
the width of a zero, wider than most letters in Times — made opening a slot jump wider than the
text it replaced and shove the justified paragraph sideways.

**One deliberate difference between editing and printing.** The passport clause prints its short
form when the issuing details are blank. In edit mode the long form is always shown, or the optional
slots would have nowhere to be typed. The preview toggle resolves it: it renders exactly what will
print.

## 7. Undo

One history over the whole draft, and **one step per value edited**.

- `Ctrl+Z` / `Ctrl+Shift+Z` / `Ctrl+Y`, plus two buttons — the shortcut is not discoverable.
- A step ends when the person moves to a different part of the document, not on a timer. That is
  how they describe what they just did — "I fixed the name", "I fixed the sum" — and it does not
  depend on typing speed. The 400 ms quiet period this replaced cut a slow typist's name into four
  steps and merged a fast one's name and passport into one.
- Structural changes (a contract row added or removed) close their step immediately.
- History is capped at 50 steps.
- The browser's own `contenteditable` history is suppressed inside the slots by cancelling
  `historyUndo`/`historyRedo` on `beforeinput` and dispatching ours. Two competing stacks is why an
  undo would otherwise sometimes jump two steps.

## 8. Draft recovery

The draft is written to `localStorage` under a per-firm (yurist) or per-certificate (admin) key,
debounced. On return, a differing stored draft offers restore or discard; it is cleared on a
successful save. Nothing reaches the database without an explicit save.

## 9. Error handling

| Case | Behaviour |
|---|---|
| Invalid slot (passport shape, empty required, bad contract row) | Nothing is marked until a submit is refused. A blank maʼlumotnoma is entirely unfilled, so validating from the first render paints the whole document red before a word is typed. The save bar always counts what submitting still needs; the red marks appear when they mean something and clear as each is fixed. |
| Saving a draft | Held to the same standard as submitting: firm, PINFL, name, passport, sum and both dates. Saving allocates a maʼlumotnoma number that is never reused, so an ariza too empty to be worth a number is not worth saving — until then the sheet keeps itself in the browser. (This was briefly relaxed for PINFL and put back: a draft that reaches the admin without one leaves a client the system can never match to their next.) |
| Save rejected by the API | The message is shown above the save bar; the draft is untouched and stays recoverable. |
| Content overflows one A4 page | A warning under the sheet. It must be visible while it can still be fixed, not discovered after signing. |
| `localStorage` unavailable or full | Editing continues without persistence. Recovery is a convenience; losing it must not block saving. |
| Firm id not found / inactive | The route 404s, same as any unknown ariza. |

## 10. Testing

The load-bearing test: **the same draft rendered in edit mode and rendered for the PDF produce the
same text.** That assertion is the only thing standing between this feature and the drift the freeze
spec forbids.

Two environments, because a static render says nothing about whether keystrokes arrive. `.test.ts`
runs in node; `.test.tsx` runs in happy-dom. **The first version of this work shipped with only the
node half, and every interaction bug in it survived a green suite** — that is what the second half
is for, not thoroughness for its own sake.

Interaction — `src/ui/editing.test.tsx` (happy-dom):
- A contenteditable slot keeps what is typed, on the second and third keystroke as well as the
  first, and carries it to the other places the same field prints.
- Clicking an empty slot focuses it; clicking a slot with text in it does not hijack the caret.
- A date types as `27102024` or `27.10.2024`, shows `27.10.2024`, stores `2024-10-27`, stops at
  eight digits, and holds a partial `27.10` without inventing a date to go with it.
- A passport masks to `AE5348993` as it is typed.

Unit — `src/ui/document-edit.test.ts` (node), rendering through `renderToStaticMarkup`:
- Editing and printing produce the same words, from the same draft.
- The sum is grouped, and every contract stays in the sentence, exactly as printed.
- The one deliberate divergence is pinned: empty issuer slots appear while editing and are absent
  from the printed page. Pinning it is the point — an unasserted difference is a bug in waiting.
- The draft reducer: undo/redo round-trips; unsettled typing counts as a step; a contract row
  addition is undoable; both ends are no-ops; a new edit drops the redo trail; history caps at 50.
- `draftProblems` reports each missing value once in page order, and skips PINFL where none is
  asked for; `draftContracts` drops a row left blank.

Manual, on the running app — what neither environment can settle:
- A long F.I.SH. wraps to a second line and the paragraph re-justifies.
- The caret stays put mid-word, across all three places the name appears. happy-dom reports focus
  but does not lay text out, so caret drift is only visible in a real browser.
- `Ctrl+Z` undoes a contract row addition.
- A reload after typing offers the draft back.
- Saving produces a row identical to one the old form would have produced.

## 11. Future

- The rahbar's screens keep the read-only document. If in-place editing is ever wanted there, the
  question to answer first is who is accountable for a change made after admin approval.
- `bodyText` stays unused. If free-text ever becomes a requirement, it needs a reviewer step and an
  audit trail before it needs an editor.
