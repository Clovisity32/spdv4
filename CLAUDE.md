# Student Pathway Dashboard — CLAUDE.md

## Project Identity

- **Name**: Student Pathway Dashboard
- **Type**: Static Single-Page Application (SPA)
- **Purpose**: Singapore secondary school students enter O-Level subject grades
  (G3/G2/G1) to discover post-secondary pathway eligibility (JC/MI, Poly, PFP, ITE)

## Stack

- Vanilla HTML/CSS/JavaScript (ES6+, IIFE pattern)
- Tailwind CSS via CDN (`https://cdn.tailwindcss.com`)
- Google Fonts (Inter) via CDN
- Google Analytics 4 — tag ID `G-5C9YVR0W01`

## Commands

| Task            | Command                                  |
| --------------- | ---------------------------------------- |
| Build           | _(none — no build step)_                 |
| Dev server      | _(none — open file directly in browser)_ |
| Tests           | `node scripts/run_edge_case_tests.js`    |
| Invariant tests | `node scripts/run_invariant_tests.js`    |
| Advice tests    | `node scripts/run_advice_tests.js`       |
| Screenshot      | `node scripts/screenshot.js`             |

## DEV_URL

```
file:///C:/Users/Admin/Documents/spdv4/index.html
```

## Architecture

Single-file app — all HTML, CSS, and JavaScript lives in `index.html`.

- **HTML**: semantic layout with Tailwind utility classes
- **CSS**: minimal `<style>` block (custom scrollbar, tooltip, bar chart)
- **JS**: one IIFE at the bottom of `<body>` containing:
  - Grade scale constants and conversion maps (G3/G2/G1)
  - Subject list and pathway definitions (`PATHWAYS` array)
  - Calculation functions: `calculateL1R4`, `calculateELR2B2_G3_Mixed`,
    `calculateELMAB3_G2`, `calculateITEHnitecSpecific`, `calculateITEHnitecCompleted`
  - DOM renderers: `renderEligibilityResults`, `renderStudentSubjectsTable`,
    `renderResultsAdvice` (the FSBB table)
  - Event wiring in `DOMContentLoaded`

**Never split into multiple files unless explicitly asked.**

## User Roles

One role: **student** — Singapore Sec 4/5 student exploring post-secondary options.

## Core Task Flow

1. Select school → the **Subjects** dropdown lists that school's offerings
2. Open the dropdown, tick every subject you take (search box narrows the list), enter CCA bonus points (0–5)
3. Click **Add N subjects** → each ticked subject lands in the "Your Subjects" table at G3 A1 (or the top grade of its only level), tagged "Set grade"
4. Set each subject's level, grade and optional raw mark in the table (the tag and note clear as rows are edited)
5. Added subjects show as "Added" and are locked in the dropdown, so a subject cannot be added twice
6. Eligibility cards update automatically across all pathway groups
7. "Your Action Plan" shows the FSBB Summary table with the student's row marked; tap a box for the easiest way in

## Do Not Touch

- **GA4 tag** (`<!-- Google tag (gtag.js) -->` block, lines ~95–103)
- **Eligibility calculation logic**: `calculateL1R4`, `calculateELR2B2_G3_Mixed`,
  `calculateELMAB3_G2`, `calculateITEHnitecSpecific`, `calculateITEHnitecCompleted`,
  `checkMerRequirements` — encodes Singapore MOE policy; never change without
  explicit instruction
- **Grade conversion maps**: `G3_TO_G2_CONVERSION_MAP`, `G3_TO_G1_EQUIV_MAP`,
  `G2_TO_G1_EQUIV_MAP` — policy data, do not modify

## Directory Map

```
spdv4/
├── index.html              ← entire app lives here
├── CLAUDE.md               ← this file
├── Post_Sec_pathways.md    ← authoritative MOE policy reference (check before adding/changing pathways)
├── .gitignore
├── .claude/
│   ├── settings.json
│   └── commands/
│       └── screenshot.md
└── scripts/
    ├── screenshot.js
    ├── run_edge_case_tests.js   ← 170 assertions across 15 phases
    ├── run_invariant_tests.js   ← 102 assertions across 3 phases
    ├── run_ca_tests.js          ← 18 conditional-admission checks
    └── run_advice_tests.js      ← Action Plan engine + FSBB table UI (96 checks)
```

## Pathway Groups (2027 cohort)

Insertion order in `groupedPathways` determines sort tie-breaking:

| Order | Group                   | Calc type                       | Entry route       |
| ----- | ----------------------- | ------------------------------- | ----------------- |
| 0     | JC/MI                   | L1R4                            | PSE               |
| 1     | Polytechnic Year 1      | ELR2B2                          | PSE               |
| 2     | PFP                     | ELMAB3 ≤ 12                     | PSE               |
| 3     | ITE 3-Year Higher Nitec | ITE_Hnitec_Specific / Completed | PSE (Year 1 only) |

**Removed from 2027:** "ITE Year 2 Higher Nitec" (Year 2 PSE entry gone — internal acceleration only) and "ITE 2-Year Nitec" ("Nitec" qualification abolished).

Tracks always render in this fixed order, JC/MI down to ITE 3-Year Higher Nitec, whatever is eligible. Each track is a `<details data-track>`: open when at least one of its pathways is eligible, collapsed to its header (track name + "N of M eligible" / "Not yet eligible") otherwise. A track the student opens or closes by hand stays that way across re-renders (`eligibilityGroupPref`). Cards inside an open track are never collapsed individually.

## Known Gotchas

**`mer: {}` always fails** — In `checkMerRequirements`, an empty MER object causes `pathway.mer && pathway.mer.el_g2 && condition` to short-circuit to `undefined` → `overallMerMet = false` → pathway always shows Not Eligible. For pathways with no real MER requirement use `mer: { el_g2: "6", math_am_g2: "6" }` (grade 6 = worst passing grade, so condition is always true for any valid student).

**Screenshot / test element IDs** — `#school` (use value `"School A"` for the test school), `#subjectPicker` (opens the menu), `[data-pick="ID"]` (tick boxes), `#subjectMenuAdd` / `#addUpdateSubjectBtn` (add ticked subjects), `#subjectSearch`, `#addMsg`. After adding, set values in the table row `[data-subject-row="ID"]` via `[data-row-level]`, `[data-row-grade]`, `[data-row-raw]`. There are no `#subject` / `#level` / `#grade` / `#rawMark` fields any more. School must be selected first and given 300 ms before opening the picker.

**Conditional Admission masks MER-failure tests** — `checkMerRequirements` sets `conditionalAdmission = true` for JC/MI when `merMet = false` but gross ≤ 12 (JC, threshold ≤ 16) or ≤ 15 (MI, threshold > 16), OR when all 4 R-subjects score ≤ 2. A test expecting MER-failure → `isEligible = false` must use gross > 15 AND at least one R-subject grade > 2 to stay clear of both CA paths.

**`isCA` flag on pathway results** — `calculateAllPathwaysStatus` returns `isCA: true` per entry when the student is eligible via conditional admission rather than a clean MER pass. Use it in tests to distinguish the two eligibility states.

## Changelog

| Date    | Section Updated          | What Changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06 | Known Gotchas + Commands | Added `run_invariant_tests.js` (123 assertions across 3 phases); `window.__spdTest` hook; CA masking gotcha + `isCA` flag docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-10 | Do Not Touch / calc      | `calculateELMAB3_G2` + ELMAB3 MER branch: G3 grade 9 and G2 grades 5–6 excluded from every ELMAB3 aggregate (PFP + ITE Yr 2); G3 9 / G2 6 cannot fulfil MER; G1 excluded; B subjects ranked by G2 equivalent. Removed ITE Yr 2 `calcOptions`. User-authorised                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-10 | Results Action Plan      | New `#resultsAdviceSection` + optional Raw Mark field. Engine `buildResultsAdvice` (exposed as `window.__spdTest.advise`) recommends: (1) drop at most 1 subject, (2) one voluntary move down, (3) compulsory lower level (G3 E8/F9, G2 6; all subjects if weak). Realistic = within 5 raw marks of next grade. Surfaces conflicts C1–C5 where data disagrees with priority order. Read-only use of calc functions and conversion maps. `run_advice_tests.js` added                                                                                                                                                                                                                             |
| 2026-10 | Action Plan UI           | `#resultsAdviceSection` merged with Improvement Suggestions into one "Your Action Plan": summary tiles, a short suggested plan (reasons and other options in one dropdown), and a filterable pathway explorer (`#resultsExplorerContainer`) laid out as a staircase in `PATHWAYS` order (JC/MI → ITE 3-Year). Every pathway expands to Subject/Now/Need/Marks. Quick wins are no longer a separate block: `computeQuickWins()` marks rows (`data-quick`, `[data-qw]` lines) and adds a "Quick wins" filter pill. Engine adds additive `rows`/`needs`/`blocker` to staircase steps; calc functions untouched. Test runners now exit 1 on a thrown error instead of printing "All checks passed!" |

| 2026-10 | Suggested plan restructure | "Your suggested plan" is now four fixed blocks: where you stand (standing + 4 status tiles), four selectable choices A Keep / B Reduce / C Lower 1 / D Lower 2+ (least to most narrowing; each shows pathway count and what it gives up), next steps + "Does this plan make sense?" practical check (P1 majority-lowered: lists remaining higher-level subjects with "Consider lowering too" / "Keep at current level"; P2 close-to-next-grade; P3 pathways given up; P4 order notes; P5 few subjects — information only, never overrides), and a collapsed "Before you decide" (recalibration order with the student's subjects, reasons). "Try your own mix" lets the student set Keep/Lower/Drop per subject (`window.__spdTest.evalCustom`). Engine additions are additive: `choices`, `standing`, `summary`, `recommended.key/check`, per-step `status`/`via`. Explorer statuses now come from one source (`open`/`close`=realistic/`lower`/`further`), so tiles = choice A count; rows get "Opens/Closes with this choice" badges and level-change rows state whether they are part of the suggested plan. A student coping everywhere is never told to drop a subject. Calc functions untouched. `run_advice_tests.js` now 77 checks. UX quick fix: "Push" advice and choice A "Improve" only name subjects whose next grade opens a pathway or that are weak (`worthPushing`), so a strong subject like English B3 is no longer told to chase A2 |

| 2026-10 | Action Plan wording | ITE route labels (`MER (Pass EL & Math)` etc.) shown in plain language in the Action Plan only, via display-only `plain()` / `PLAIN_NAMES`; PATHWAYS data names, eligibility cards and edge tests unchanged. Choice D lists each lowered subject on its own line. `run_advice_tests.js` now 79 checks |
| 2026-10 | FSBB table Action Plan | "Your Action Plan" is now the MOE FSBB Summary table (poster column order: 3-Year Higher Nitec, 2-Year Higher Nitec, PFP, Polytechnic Year 1, MI, JC; rows 5 G3 / 4 G3 + 1 G2 / 5 G2 / 4 G1; NAFA and Arts left out). Rows are the options, so the A–D choice cards, ★ suggestion, "Try your own mix", status tiles, practical check, "Before you decide" and the separate explorer were removed. Boxes: ✓ eligible, ↑ almost there (≤5 marks), ○ needs more work, grey = not offered (`FSBB_MATRIX`). "You are here" row uses today's staircase; other rows are the easiest mix landing on that row (`fsbbConfigs` / `fsbbBuild`: lower subjects in recalibration order with protect/drop variants; rows above the student's row are estimates, dashed + "est."). Drop only for weaker subjects, only with more than 5 subjects. Tap a box (or column heading) for `fsbbExplain` (KEEP / MOVE / RAISE / DROP / EITHER per subject, two warnings: within 5 marks of next grade, only 5 subjects left) plus that column's course rows (easiest first, quick-win lines on your row). Engine and calc functions untouched; test hooks `__spdTest.fsbb`, `fsbbExplain`, `fsbbRow`, `quickWins`. `run_edge_case_tests.js` reads quick wins via `__spdTest.quickWins`. `run_advice_tests.js` now 82 checks |
| 2026-10 | FSBB table UX pass | First student UX audit (`tests/ux/`, `node tests/ux/student-journey.js`, friction 2.1 → 1.9). "See where you can go" button (`#jumpToPlan`) under the subject list scrolls to `#actionPlanTitle`. Lower-row details: short status line plus a separate "To be on this row:" route line (`[data-fsbb-route]`); details scroll to the top of the screen on tap; EST. note under the table. Far-off (○) boxes on lower rows show the marks route ("+16 marks in 2 subjects") instead of vague text: drawn first with interim wording (`data-pending`), then filled in one box per tick by `fsbbFillPending` because it needs the full advice engine; pathways marks cannot reach say "Marks alone won't be enough". `run_advice_tests.js` now 85 checks |
| 2026-10 | Eligibility tracks | Removed the eligible-first group sort (groups keep PATHWAYS order). Each track (JC/MI, Polytechnic Year 1, PFP, ITE Year 2, ITE 3-Year) is a `<details data-track>`: open when something in it is eligible or conditionally admitted, otherwise collapsed to a header showing "Not yet eligible"; choices persist in `eligibilityGroupPref`. Cards inside stay as before. Pulls the Action Plan up the page (about 3,500 → 2,200px on desktop). Phase 14 of `run_edge_case_tests.js` rewritten (SORT-01–03 fixed order, CARD-01–06 track collapse); now 156 assertions |
| 2026-10 | FSBB table: no needless moves, and why | Moving down (or dropping) is only suggested when it opens or improves a pathway. After the table is built, any lower-row box that is no better than the best row above it becomes `have` ("Already open") or `nobetter` ("Moving down won't help"): pale, no route, and tapping it shows the row that already answers it (`cell.ref`). A student with six G3 A1s therefore sees no move or drop anywhere. The standalone "frees time" DROP suggestion was removed (a drop now only appears inside a route that opens something). Details panel: "What to do with your subjects" is one KEEP line when nothing changes (naming what moving down would close), or MOVE / RAISE / DROP rows plus one KEEP line for the rest; the old EITHER label is gone from the screen. Each course row now starts with "Why you qualify" or "Why not yet", listing every requirement with ✓ / ✗ (`reasonLines`). 2-Year at 4 G1 reads "Via 3-Year, Year 1" and lists the 3-Year courses (`courseCol`). `run_advice_tests.js` now 93 checks |
| 2026-10 | FSBB table: wording and free-time hint | A lower box that gains nothing now reads "LDL does not increase eligibility" (status `nobetter`; "Already open" for `have` is unchanged). 2-Year Higher Nitec at 4 G1 is its own box, "Possible after Year 1" (status `later`): per the poster those students join Year 1 of the 3-Year course and may be offered the 2-year route, so it no longer shows a 3-Year course count; its details list the 3-Year courses they would join (`courseCol`). The free-time DROP idea is back as a separate OPTION line (`exp.free`), never part of a route: it only names weaker subjects (`weakness >= 0.5`), only with more than 5 subjects, only when dropping leaves every eligible or within-reach pathway intact, and never a subject that the column's own improvement routes ask you to raise; with 6 subjects it carries the "only 5 subjects left" warning. `run_advice_tests.js` now 96 checks |
| 2026-10 | Add several subjects at once | New `<details id="bulkAdd">` panel under the single-subject form: one row per subject the school offers (`getSchoolSubjects()`, shared with the single form), each with level (only the levels that subject allows), grade and optional raw mark; picking a grade ticks the row; a search box (`#bulkSearch`) narrows the list but ticked rows stay visible; the Add button is sticky at the bottom of the panel. One click adds every ticked row with the same checks as the single form (grade needed, raw mark must fit the grade) and is all-or-nothing, naming each problem subject; the results and Action Plan update once. Added subjects show "Added" and are locked. State lives in `bulkState`, so ticks survive school changes and re-renders. Single form unchanged. Phase 15 of `run_edge_case_tests.js` (BULK-01–13) added; now 169 assertions |
| 2026-10 | UX audit 2 + small fixes | Second student UX audit (`tests/ux/`, friction 1.9 → 1.8; journey now runs one-at-a-time and bulk entry, 25 → 15 interactions for six subjects). Phone-only button `#bulkJump` at the top of the entry form opens and scrolls to the bulk panel (hidden from `md` up). The "Duplicate Subject" popup had its title and message swapped; fixed (`DUP-01`). `run_edge_case_tests.js` now 172 assertions (BULK-14/15, DUP-01) |
| 2026-10 | Subject picker replaces bulk panel | Removed `#bulkAdd`, `#bulkJump` and the single-subject Subject/Level/Grade/Raw Mark fields. The form is now School · **Subjects** dropdown (`#subjectPicker` → `#subjectMenu`: search box, tick list `[data-pick]`, sticky `#subjectMenuAdd`) · Bonus · `#addUpdateSubjectBtn` ("Add N subjects"). One click adds every ticked subject to Your Subjects at G3 A1 (top grade of its only level for G2/G1-only subjects, no raw mark), each row tagged "Set grade" with a note above the table until its level or grade is edited (`defaultRows`); level, grade and raw mark are then set in the table (`[data-subject-row]`, `[data-row-level|grade|raw]`). Added subjects are ticked, locked and marked "Added" in the menu, so duplicates cannot happen; ticks survive school changes; Escape / outside click close the menu and keep ticks; Enter in the search box adds. Table cells use tighter padding on phones so Level and Grade stay in view. Calc functions untouched. Phase 15 of `run_edge_case_tests.js` rewritten as PICK-01–14 (parity with one-by-one entry kept); `add()` helpers in the edge, CA and advice runners and `tests/ux/student-journey.js` use the picker. `run_edge_case_tests.js` now 170 assertions |
| 2026-10 | FSBB details: slot requirements table | Tapping a course in the box panel now opens a requirements table (`fsbbSlotTableHtml`, `fsbbSlotDefs`): one row per slot named by requirement (EL, R1, R2, B1, B2 / L1, R1–R4 / EL, MA, B1–B3; ITE courses list their counted subjects), columns Slot · Your subject · Now · Need · Marks. Slots come from `subjectsUsed` roles (best-effort pick when the calc cannot fill a slot yet); Need/Marks come from the existing improve-route rows; a moved subject shows `(was G3 …)`. Other subjects allowed in a slot appear as an `or` row when they tie the primary (or are within 2 grade steps and the slot needs work); subjects used nowhere are `Extra`. Slot name has a hover/tap/focus tooltip (rule + minimum grade). Removed from the panel: 'What to do with your subjects' (KEEP/MOVE/RAISE/DROP), free-time OPTION line, 'To be on this row' line, ✓/✗ why list; kept: status line, warnings, est. note. 'Already open' wording is now 'Eligible' in the grid and panel. Engine (`fsbbExplain`, `exp.free`) and calc functions untouched. `run_advice_tests.js` now 100 checks |
| 2026-10 | Slot table: G2 equivalents, no LDL headline | Slots counted at G2 (Polytechnic B2, all PFP and ITE 2-Year slots) show a G3 grade's G2 equivalent in Now (`G3 E8 → G2 4`) and Need (`D7 · 45+ → G2 3`); display only, via `getStudentSubjectG2Grade` / `convertG3toG2`. A box that gains nothing (`nobetter`) no longer opens with 'LDL does not increase eligibility here' plus a subline: the panel leads with the status and marks of the row it points to, using that status's symbol. Grid box wording unchanged. `run_advice_tests.js` now 101 checks |
