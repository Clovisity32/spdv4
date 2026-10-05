# UX audit: student — 2026-10-05 (fifth audit, audience tabs + pathway table)

Journey: `node tests/ux/student-journey.js` (Plan tab, forced through `localStorage spd.view`) plus an ad hoc first-visit run of the Explore tab (six G3 subjects, School A, desktop 1200px and phone 390px; Explore screenshots `debug/ux-student-{desktop,mobile}-explore.png`).
Previous audit: 1.75 (`reports/2026-10-05-student-table.md`). Scores are the auditor's judgement from the measurements below (1 = no friction, 5 = severe).

## Scores

| Screen                      | Previous | Now      | Notes                                                                                                                                  |
| --------------------------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Subject entry               | 1.7      | 1.7      | Unchanged: 21 interactions for six subjects with marks. Raw Mark now says "(optional)", which removes a small doubt                    |
| Pathway Eligibility (Explore) | 1.9    | **1.5**  | Six-box table answers "where can I go" at a glance; cards appear for one option on demand. Page is 1,654px (desktop) / 2,068px (phone), was about 3,500px with tracks open |
| Your Action Plan (Plan tab) | 1.9      | **1.6**  | Plan table now 1,058px (desktop) / 1,368px (phone) down the page, was 2,109 / 3,117. Midpoint marks remove the "+40 marks" overstatement |
| Tap-through details         | 1.5      | 1.5      | Unchanged                                                                                                                              |
| Tab choice (new)            | n/a      | 2.2      | Tabs sit below the subject table, 976px down on desktop and 1,306px on phone. Easy to miss; "Sec 1–2 / Sec 3–4" labels are clear      |
| **Overall**                 | **1.75** | **1.7**  | Improved slightly (1.75 → 1.70)                                                                                                       |

## Measurements (Explore tab, first visit)

- 10 interactions to see one option's cards (school, picker, six ticks, Add, tap a box). Tap to cards shown: about 560ms including a re-render.
- Table is 228px (desktop) / 220px (phone) tall; tab bar and table are below the first screen (tab bar at 976px / 1,306px, table at 1,140px / 1,486px).
- Phone: no sideways page scroll; the table scrolls inside its own container. All boxes, column headings, tabs and the "Show every pathway" button are at least 44px tall.
- With nothing selected no pathway card is on screen (0 visible); after tapping Polytechnic Year 1, 5 cards.
- Plan tab: table present after switching; no page errors on either tab.

## Regression

- None. Entry effort stays at 21 interactions (regression from audit 3, still open).

## Chronic (2+ audits)

- **Action Plan position**: improved (2,109 → 1,058px desktop, 3,117 → 1,368px phone) because Pathway Eligibility no longer sits above it. Not fully resolved; keep watching.
- **Entry effort (21 interactions)**: still open.

## New issues found

- **"See where you can go: open Your Action Plan ↓" always switches to the Plan tab**, even for a Sec 1–2 student on Explore who has no use for it (heuristic: clarity). There is no equivalent jump to the Explore table.
- **Tab bar is below the fold** after subjects are added (heuristic: clarity / shortest path). A student may never notice the second view.

## Proposed fixes (not applied: they change a shared button and the tab bar position)

1. Make the jump button follow the active tab: on Explore it reads "See where you can go: open the pathway table ↓" and scrolls to `#eligTableWrap`; on Plan it keeps today's behaviour.
2. Move the tab bar above the Your Subjects table (or make it sticky) so it is visible without scrolling.

## Fixed this session

None.
