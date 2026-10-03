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
    `renderImprovementSuggestions`
  - Event wiring in `DOMContentLoaded`

**Never split into multiple files unless explicitly asked.**

## User Roles

One role: **student** — Singapore Sec 4/5 student exploring post-secondary options.

## Core Task Flow

1. Select school → subject dropdown filters to that school's offerings
2. Select subject → level dropdown filters to allowed levels for that subject
3. Select level → grade dropdown populates (G3: A1–F9 / G2: 1–6 / G1: A–E)
4. Enter CCA bonus points (0–5)
5. Click **Add Subject** → row appears in subject table
6. Eligibility cards update automatically across all pathway groups
7. Improvement suggestions show which single grade change unlocks new pathways

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
    ├── run_edge_case_tests.js   ← 152 assertions across 14 phases
    ├── run_invariant_tests.js   ← 102 assertions across 3 phases
    ├── run_ca_tests.js          ← 18 conditional-admission checks
    └── run_advice_tests.js      ← Action Plan engine + UI (79 checks)
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

Eligible groups sort before not-eligible groups; original insertion order preserved within each tier.

## Known Gotchas

**`mer: {}` always fails** — In `checkMerRequirements`, an empty MER object causes `pathway.mer && pathway.mer.el_g2 && condition` to short-circuit to `undefined` → `overallMerMet = false` → pathway always shows Not Eligible. For pathways with no real MER requirement use `mer: { el_g2: "6", math_am_g2: "6" }` (grade 6 = worst passing grade, so condition is always true for any valid student).

**Screenshot element IDs** — `#school` (use value `"School A"` for the test school), `#subject`, `#level`, `#grade`, `#addUpdateSubjectBtn`. School must be selected first and given 300 ms before selecting a subject.

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
