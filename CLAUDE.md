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

| Task       | Command                                  |
| ---------- | ---------------------------------------- |
| Build      | _(none — no build step)_                 |
| Dev server | _(none — open file directly in browser)_ |
| Tests      | _(none — no test suite)_                 |

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
├── .gitignore
├── .claude/
│   ├── settings.json
│   └── commands/
│       └── screenshot.md
└── scripts/
    └── screenshot.js
```
