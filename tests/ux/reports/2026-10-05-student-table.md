# UX audit: student — 2026-10-05 (fourth audit, slot requirements table)

Journey: `node tests/ux/student-journey.js` (desktop 1200px and phone 390px, six G3 subjects, School A). The journey now also opens the easiest course in the Polytechnic Year 1 box and measures its requirements table (`course-table` step). Screenshots: `debug/ux-student-*-3b-course-table.png`.
Previous audit: 1.8 (`reports/2026-10-05-student-picker.md`, 1.83). Scores are the auditor's judgement from the measurements below (1 = no friction, 5 = severe).

## Scores

| Screen                 | Previous | Now      | Notes                                                                                                                              |
| ---------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Subject entry          | 1.7      | 1.7      | Unchanged: still 21 interactions for six subjects with marks (regression from audit 2 not yet fixed)                               |
| Eligibility cards      | 1.9      | 1.9      | Unchanged                                                                                                                          |
| Your Action Plan table | 1.9      | 1.9      | Unchanged: still 2,109px (desktop) / 3,117px (phone) down the page; chronic                                                         |
| Tap-through details    | 1.8      | **1.5**  | Course panel is now one table: slot, subject, now, need, marks; rule on tap/hover; no jargon lines. Two wording gaps remain (below) |
| **Overall**            | **1.8**  | **1.75** | Improved slightly (1.83 → 1.75)                                                                                                    |

## Measurements (course table, easiest Polytechnic course)

- 5 slot rows plus 2 extra rows; each row has Need and Marks (for example `A2 · 70+`, `+1`); total line under the table.
- Tooltip opens on tap in about 70–80ms, text names the rule and minimum grade, and stays inside the viewport on a 390px phone.
- Phone: no sideways page scroll; every subject name fits on at most two lines. Smallest text is 11px (14px on desktop). Table height 420px (phone) / 287px (desktop).
- The script reports 1 clipped cell: that is the open tooltip inside the first row, not a clipped value.
- No page errors; all 15 grid boxes labelled and at least 44px; keyboard reaches the first box in 6 Tab presses.

## Regression

- **Entry effort 15 → 21 interactions** (from audit 3, still open). Heuristic: shortest path. Not touched this session.

## Chronic (2+ audits)

- **Resolved: "Why you qualify / Why not yet" lines read technically.** Replaced by the requirements table.
- Still open: the Action Plan sits 2,100px (desktop) / 3,100px (phone) down the page; the "See where you can go" button works around it.

## New issues found

- **"Needs a matching subject"** on a slot with no fitting subject (heuristic: clarity). It does not say which subjects fit; the answer is only in the tooltip.
- **"Aggregate cannot be counted yet: fix the highlighted rows first"** (clarity). Says nothing about why, and "highlighted" is only the amber Need cells.
- 11px text on phones (trust/legibility).

## Fixed this session

None. Proposed fixes wait for approval (see audit summary).
