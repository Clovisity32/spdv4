# UX audit: student — 2026-10-05 (third audit, subject picker)

Journey: `node tests/ux/student-journey.js`, now run two ways: desktop and phone, entering the same six G3 subjects through the new subject picker (tick, add together, then set each grade and raw mark in the table). School A.
Previous audit: 1.8 (`reports/2026-10-05-student.md`). Scores are the auditor's judgement from the measurements below (1 = no friction, 5 = severe).

## Scores

| Screen                 | Previous | Now     | Notes                                                                                                                                  |
| ---------------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Subject entry          | 1.6      | 1.7     | One way in instead of three; but the same six subjects now cost 21 interactions, not 15 (see Regression)                               |
| Eligibility cards      | 1.9      | 1.9     | Unchanged                                                                                                                              |
| Your Action Plan table | 1.9      | 1.9     | Still 2,109px (desktop) and 3,117px (phone) down the page; chronic                                                                     |
| Tap-through details    | 1.8      | 1.8     | Unchanged                                                                                                                              |
| **Overall**            | **1.8**  | **1.8** | Unchanged (1.83)                                                                                                                       |

## Measurements

- Six subjects with grades and raw marks: **21 interactions** (school 1, open menu 1, six ticks, add 1, six grades, six marks). The old "add several" panel took 15 for the same data, because picking a grade ticked the row. Without raw marks (they are optional) the picker takes 15.
- Level never needs changing for these subjects (they start at G3), so no level interactions.
- The Action Plan appears about 110–140ms after the add click. Load 243ms on the phone run; the desktop run's 2.9s was a cold first load (Tailwind CDN).
- All 15 table boxes labelled and at least 44px; no sideways page scroll on desktop or phone; no page errors; keyboard reaches the first box in 6 Tab presses.
- Phone: Level and Grade now fit on screen in Your Subjects after tightening cell padding; Raw Mark and Delete still scroll sideways.

## Regression

- **Entry effort went up for students who enter marks (15 → 21 interactions).** Heuristic: shortest path. The separate tick step is the cost. It is cheap (a tap on a checkbox) and removes the empty-grade error case, but it is still six more actions.

## Chronic (2+ audits)

- The Action Plan sits 2,100px (desktop) / 3,100px (phone) down the page; the "See where you can go" button works around it.
- Requirement lines in "Why you qualify" / "Why not yet" read technically.

## Fixed this session

None yet. Proposed fixes are listed in the audit summary and wait for approval.
