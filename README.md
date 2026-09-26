# Cx Ledger

Cx Ledger is a browser-only demo of a commissioning data ledger: an equipment register, an
issues log, a document library, and an import pipeline for bringing contractor spreadsheets
in as clean, tagged equipment records. Everything runs client-side against a seeded sample
project (Kettle Creek Water Treatment Plant, fictional) and persists to the browser's own
storage, so there is no backend and no real project data involved.

## Pipeline design

Import is a linear pipeline, each stage a pure function with its own golden tests:

**Extract → Map → Transform → Validate → Review → Load**

- **Extract** — `parseCsv` and `readWorkbook` turn a pasted block, a `.csv`, or an `.xlsx`/`.xls`
  file into a plain grid of strings. Merged Excel cells are filled before the grid is returned.
- **Map** — `detectHeader` finds the header row in a messy sheet (title rows, notes, blank rows
  and all), and fuzzy column matching proposes a mapping from source columns to equipment fields.
  Saved **profiles** remember a mapping for a given source shape so repeat imports skip re-mapping.
- **Transform** — source rows become staged rows: tags run through `normalizeTag` once, at this
  boundary, so a non-normalized tag is never stored anywhere downstream.
- **Validate** — staged rows are diffed against the current register (new / update / duplicate /
  unchanged / error) so the reviewer sees exactly what will change before anything is written.
- **Review** — a human approves or excludes individual rows; nothing is written until this step.
- **Load** — approved rows are written through `applyChange()`, the single choke point for every
  create, update, and delete of equipment, issues, and documents. Loads are **idempotent**:
  loading the same file twice produces an all-no-change second pass, never duplicate records.

**Rollback** reverses a batch's own change records in one step, but first checks a **conflict
guard**: if a later change (in or outside this pipeline) touched a key the batch also touched,
rollback is refused with a message naming the key and what changed, rather than silently
clobbering a manual edit made after the import.

**Audit trail** — every mutation, whether from the pipeline or from editing a record by hand in
the Equipment drawer, goes through `applyChange()`, which appends an immutable `ChangeRecord`
(who, when, what changed, before/after). This is what makes rollback and per-record history
possible, and it's the only path allowed to touch equipment, issues, or documents.

## Stack

React 18 + TypeScript (strict) + Vite, tested with Vitest and Testing Library. State persists to
IndexedDB via `idb-keyval`. Spreadsheet reading uses SheetJS (`xlsx`, loaded lazily only when an
Excel file is chosen). No router, UI kit, date library, CSV library, or fuzzy-match library —
those are hand-rolled to keep the dependency list short and auditable.

## Running it

```bash
npm i
npm run dev       # start the dev server
npm test          # run the test suite
npm run fixtures  # regenerate the Excel test fixtures
```

## Commercial tools

CxAlloy and Facility Grid cover this space commercially; this demo is about the import pipeline.

Live demo: TBD (added after deploy)

## Screenshots

Coming soon.
