/**
 * Results Action Plan tests — Student Pathway Dashboard
 *
 * Exercises window.__spdTest.advise (buildResultsAdvice) with School A
 * (every subject offered at the levels SEAB assesses; BIO/CHEM/PHY are G3-only).
 *
 * Run: node scripts/run_advice_tests.js
 */

const { chromium } = require("playwright");

const FILE_URL = "file:///C:/Users/Admin/Documents/spdv4/index.html";
const SCHOOL = "School A";

let PASSED = 0,
  FAILED = 0;
const FAILURES = [];

function ok(cond, id, msg) {
  if (cond) {
    console.log(`  ✓ ${id}: ${msg}`);
    PASSED++;
  } else {
    console.log(`  ✗ ${id}: FAILED — ${msg}`);
    FAILED++;
    FAILURES.push(`${id}: ${msg}`);
  }
}

const S = (subjectId, level, grade, rawMark = null) => ({
  subjectId,
  level,
  grade,
  rawMark,
});

async function advise(page, subjects) {
  return page.evaluate(
    ([s, school]) => window.__spdTest.advise(s, 0, school),
    [subjects, SCHOOL],
  );
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(FILE_URL);

  try {
    console.log("\nPhase 1: Step 3 compulsory lower level");
    // 5 subjects → nothing can be dropped, so the Step 3 projection is visible.
    let a = await advise(page, [
      S("EL", "G3", "B3"),
      S("MATH", "G3", "B3"),
      S("HIST", "G3", "B3"),
      S("MT", "G3", "B3"),
      S("COMB_SCI", "G3", "E8"),
    ]);
    let m = a.options[2].moves.find((s) => s.subjectId === "COMB_SCI");
    ok(
      m && m.level === "G2" && m.grade === "4",
      "P1-1",
      "G3 E8 Combined Science → G2 4",
    );

    a = await advise(page, [
      S("EL", "G3", "B3"),
      S("MATH", "G3", "B3"),
      S("HIST", "G3", "B3"),
      S("MT", "G3", "B3"),
      S("COMB_SCI", "G2", "6"),
    ]);
    m = a.options[2].moves.find((s) => s.subjectId === "COMB_SCI");
    ok(
      m && m.level === "G1" && m.grade === "D",
      "P1-2",
      "G2 6 Combined Science → G1 D",
    );

    a = await advise(page, [
      S("EL", "G3", "B3"),
      S("MATH", "G3", "B3"),
      S("HIST", "G3", "B3"),
      S("MT", "G3", "B3"),
      S("PHY", "G3", "E8"),
    ]);
    ok(
      a.options[2].moves.length === 0 &&
        a.options[2].blocked.some((s) => s.subjectId === "PHY"),
      "P1-3",
      "Physics is G3-only (SEAB), so it is flagged, not moved",
    );

    console.log("\nPhase 2: Step 1 drops");
    a = await advise(page, [
      S("EL", "G3", "B3"),
      S("MATH", "G3", "B4"),
      S("PHY", "G3", "B4"),
      S("HIST", "G3", "B3"),
      S("MT", "G3", "B4"),
      S("POA", "G3", "F9", 10),
    ]);
    const dropIds = a.options[0].drops.map((d) => d.subject.subjectId);
    ok(dropIds.includes("POA"), "P2-1", "Unneeded F9 POA is dropped");
    ok(
      !dropIds.includes("EL") && !dropIds.includes("MATH"),
      "P2-2",
      "EL and Math are never dropped",
    );
    ok(a.options[0].subjects.length >= 5, "P2-3", "At least 5 subjects remain");

    console.log("\nPhase 3: reach check and raw-mark validation");
    a = await advise(page, [
      S("EL", "G3", "F9", 20),
      S("MATH", "G3", "F9", 36),
      S("HIST", "G3", "E8", 60),
      S("MT", "G3", "B3"),
      S("PHY", "G3", "B3"),
    ]);
    const byName = (n) => a.reach.find((r) => r.name === n);
    ok(
      byName("English Language").status === "stretch",
      "P3-1",
      "F9 at 20 → stretch",
    );
    ok(
      byName("Mathematics").status === "reachable" &&
        byName("Mathematics").needed === 4,
      "P3-2",
      "F9 at 36 → reachable (needs 4 marks)",
    );
    ok(
      byName("History").status === "unknown" &&
        byName("History").why === "invalid",
      "P3-3",
      "E8 with raw mark 60 is ignored",
    );

    console.log("\nPhase 4: move-everything-down");
    a = await advise(page, [
      S("EL", "G3", "E8", 41),
      S("MATH", "G3", "F9", 10),
      S("HIST", "G3", "E8", 40),
      S("MT", "G3", "F9", 12),
      S("COMB_SCI", "G3", "F9", 15),
    ]);
    ok(
      a.options[2].mode === "all",
      "P4-1",
      "Weak across the board → move ALL down",
    );

    // Real student profiles (G2 stream). A tie between "all down" and the
    // selective plan must keep the strong English subject where it is.
    a = await advise(page, [
      S("EL", "G2", "5", 55),
      S("MATH", "G2", "6", 33),
      S("COMB_SCI", "G2", "6", 36),
      S("COMB_HUM", "G2", "6", 45),
      S("POA", "G2", "6", 34),
    ]);
    ok(
      a.recommended.id === 3 &&
        a.options[2].mode === "selective" &&
        !a.options[2].moves.some((s) => s.subjectId === "EL"),
      "P4-2",
      "G2 profile D: grade-6 subjects → G1, English stays at G2",
    );
    ok(
      a.before.realistic === 1 && a.after.realistic === 5,
      "P4-3",
      "G2 profile D: realistic pathways 1 → 5",
    );
    a = await advise(page, [
      S("EL", "G3", "B3", 69),
      S("MT", "G3", "C6", 50),
      S("MATH", "G3", "F9", 31),
      S("COMB_SCI", "G3", "D7", 47),
      S("COMB_HUM", "G3", "E8", 43),
      S("POA", "G3", "F9", 38),
    ]);
    ok(
      a.after.realistic > a.before.realistic &&
        a.options[2].conflicts.some((c) => c.id === "C5"),
      "P4-4",
      "G3 profile A: plan improves pathways; move-all flagged as not better",
    );
    ok(
      a.options.filter((o) => o.isRecommended).length === 1 &&
        a.recommended.id === 2,
      "P4-5",
      "G3 profile A: exactly one option recommended, the least disruptive tie (Option 2)",
    );

    console.log(
      "\nPhase 4b: raw-mark guard on drops and the 5-subject warning",
    );
    // Profile B: every droppable subject is within 5 marks of the next grade,
    // so nothing may be dropped (Option 1 not applicable).
    a = await advise(page, [
      S("EL", "G3", "D7", 47),
      S("MT", "G3", "D7", 46),
      S("MATH", "G3", "F9", 35),
      S("COMB_SCI", "G3", "E8", 42),
      S("COMB_HUM", "G3", "D7", 49),
      S("DT", "G3", "F9", 35),
    ]);
    ok(
      !a.options[0].applicable,
      "P4b-1",
      "Subjects within reach of the next grade are never advised to be dropped",
    );
    ok(
      a.recommended.id === 4 &&
        a.after.realistic === a.before.realistic &&
        a.after.realistic === 8 &&
        a.options.find((o) => o.id === 3).realistic === 6,
      "P4b-4",
      "Profile B: keeping 8 realistic pathways beats the compulsory moves (6); D&T is lowered for free",
    );
    ok(
      a.freeMoves.length === 1 &&
        /Design & Technology at G2 \(G3 F9 → projected G2 5\)/.test(
          a.freeMoves[0].text,
        ) &&
        /costs you no pathway/.test(a.freeMoves[0].reason),
      "P4b-6",
      "D&T is the free move: no pathway uses it, so lowering it costs nothing",
    );
    ok(
      a.recommended.conflicts.some((c) => c.id === "C6") &&
        !/Design & Technology/.test(
          a.recommended.conflicts.find((c) => c.id === "C6").text,
        ),
      "P4b-5",
      "Option 4 still flags Maths and Science as normally moving down, but not the free-moved D&T",
    );
    a = await advise(page, [
      S("EL", "G3", "B3", 69),
      S("MT", "G3", "C6", 50),
      S("MATH", "G3", "F9", 31),
      S("COMB_SCI", "G3", "D7", 47),
      S("COMB_HUM", "G3", "E8", 43),
      S("POA", "G3", "F9", 38),
    ]);
    ok(
      !a.freeMoves.some((f) => /Mathematics/.test(f.name)),
      "P4b-7",
      "Profile A: Maths is not a free move because pathways use it",
    );
    a = await advise(page, [
      S("EL", "G3", "B3"),
      S("MATH", "G3", "B4"),
      S("PHY", "G3", "B4"),
      S("HIST", "G3", "B3"),
      S("MT", "G3", "B4"),
      S("POA", "G3", "F9", 10),
    ]);
    ok(
      a.options[0].applicable &&
        a.options[0].drops[0].subject.subjectId === "POA" &&
        /stretch/.test(a.options[0].drops[0].reason),
      "P4b-2",
      "F9 at 10 marks is dropped, and the reason states how far it is from E8",
    );
    ok(
      a.recommended.warnings.some((w) => w.id === "W1"),
      "P4b-3",
      "Plan that leaves 5 subjects shows the all-eggs warning",
    );

    console.log("\nPhase 5: conflicts");
    a = await advise(page, [
      S("EL", "G3", "D7"),
      S("MATH", "G3", "E8", 42),
      S("MT", "G3", "B4"),
      S("HIST", "G3", "C6", 51),
      S("GEOG", "G3", "C6", 53),
    ]);
    const ids = a.options[2].conflicts.map((c) => c.id);
    ok(ids.includes("C3"), "P5-1", "C3: compulsory move costs pathways");
    ok(ids.includes("C4"), "P5-2", "C4: E8 at 42 is close to passing");

    a = await advise(page, [
      S("EL", "G3", "B4", 61),
      S("MATH", "G3", "D7", 45),
      S("MT", "G3", "A1", 76),
      S("PHY", "G3", "A2", 73),
      S("COMB_SCI", "G3", "F9"),
      S("COMB_HUM", "G3", "E8"),
    ]);
    ok(
      a.options[0].conflicts.some((c) => c.id === "C2"),
      "P5-3",
      "C2: usual drop order overridden by data",
    );

    a = await advise(page, [
      S("EL", "G3", "B3", 65),
      S("MATH", "G2", "6"),
      S("MT", "G3", "F9", 29),
      S("CHEM", "G3", "B4", 63),
      S("ECON", "G2", "6"),
    ]);
    ok(
      a.options[1].conflicts.some((c) => c.id === "C1"),
      "P5-4",
      "C1: a lower-priority move beats the tier-order pick",
    );

    console.log("\nPhase 5b: decision aid (move now vs stay and push)");
    a = await advise(page, [
      S("EL", "G3", "B3", 69),
      S("MT", "G3", "C6", 50),
      S("MATH", "G3", "F9", 31),
      S("COMB_SCI", "G3", "D7", 47),
      S("COMB_HUM", "G3", "E8", 43),
      S("POA", "G3", "F9", 38),
    ]);
    const be = a.decision.breakEvens.find((b) => b.name === "Mathematics");
    ok(
      be &&
        be.movedCount === 6 &&
        be.hit.grade === "E8" &&
        be.hit.markNeeded === 40 &&
        be.hit.gap === 9 &&
        be.hit.difficulty === "stretch",
      "P5b-1",
      "Profile A: moving Maths secures 6; staying matches it at E8 = 40 marks (+9, stretch)",
    );
    ok(
      be.onlyIfStay.length > 0,
      "P5b-2",
      "Pathways only available by staying at G3 are listed",
    );
    ok(
      a.decision.ladder.some(
        (r) => r.name === "Mathematics" && r.grade === "C6" && r.gap === 19,
      ),
      "P5b-3",
      "Unlock ladder lists Maths C6 = 50 marks (+19, remote)",
    );

    console.log(
      "\nPhase 5c: pathway levels (today → realistic → bigger improvements)",
    );
    const lv = a.levels;
    ok(
      lv.length === 4 && lv.map((L) => L.count).join(",") === "4,6,8,9",
      "P5c-1",
      "Profile A: levels open 4 → 6 → 8 → 9 pathways",
    );
    ok(
      /Mathematics at G2/.test(lv[0].nextStep) &&
        /E8: needs 40 marks \(\+9 from now, stretch\)/.test(lv[1].nextStep) &&
        /C6: needs 50 marks \(\+19 from now, remote\)/.test(lv[2].nextStep) &&
        lv[3].nextStep === null,
      "P5c-2",
      "Each level states the easiest path to the next level",
    );
    ok(
      lv[2].unlocks.length === 2 && lv[3].unlocks.length === 1,
      "P5c-3",
      "Levels 3 and 4 name what each improvement unlocks",
    );
    a = await advise(page, [
      S("EL", "G3", "D7", 47),
      S("MT", "G3", "D7", 46),
      S("MATH", "G3", "F9", 35),
      S("COMB_SCI", "G3", "E8", 42),
      S("COMB_HUM", "G3", "D7", 49),
      S("DT", "G3", "F9", 35),
    ]);
    ok(
      a.levels[0].count === 4 &&
        a.levels[1].count === 8 &&
        /Mathematics G3 F9 → E8 \(\+5 marks\)/.test(a.levels[0].nextStep),
      "P5c-4",
      "Profile B: Level 1 points to the easiest within-reach improvement",
    );

    console.log("\nPhase 5d: pathway staircase");
    a = await advise(page, [
      S("EL", "G3", "B3", 69),
      S("MT", "G3", "C6", 50),
      S("MATH", "G3", "F9", 31),
      S("COMB_SCI", "G3", "D7", 47),
      S("COMB_HUM", "G3", "E8", 43),
      S("POA", "G3", "F9", 38),
    ]);
    const tiers = Object.fromEntries(
      a.staircase.map((tr) => [tr.tier, tr.steps]),
    );
    const total = a.staircase.reduce((n, tr) => n + tr.steps.length, 0);
    ok(
      total === 17 &&
        tiers[0].length === 4 &&
        tiers[1].length === 2 &&
        tiers[3].length === 6 &&
        tiers[4].length === 3 &&
        tiers[5].length === 2,
      "P5d-1",
      "Profile A: all 17 pathways on the staircase (4 open, 2 immediate, 6 stretch, 3 remote, 2 out of reach); routes no longer ask for marks in subjects a pathway does not count",
    );
    ok(
      tiers[5].every(
        (s) =>
          (s.rows && s.rows.length > 0) ||
          (s.needs &&
            s.needs.length > 0 &&
            s.needs.every((n) => n.label && n.target)),
      ),
      "P5d-1b",
      "Profile A: every out-of-reach pathway names what it needs (a mark route, or requirement + target)",
    );
    ok(
      tiers[3].every(
        (s) =>
          s.rows &&
          s.rows.length === s.parts.length &&
          s.rows.every((r) => r.subject && r.now && r.need && r.marks),
      ),
      "P5d-1c",
      "Profile A: stretch pathways carry structured Subject / Now / Need / Marks rows",
    );
    const ite2 = tiers[3].filter((s) => /ITE Year 2/.test(s.name));
    ok(
      tiers[1].every((s) => /Mathematics at G2/.test(s.detail)) &&
        ite2.length === 2 &&
        ite2.every(
          (s) =>
            s.parts.length === 1 &&
            /Mathematics G3 F9 → E8 \(reach 40 marks, \+9 marks\)/.test(
              s.parts[0],
            ) &&
            s.totalMarks === 9,
        ),
      "P5d-2",
      "Each step names the subject, the raw mark to reach and the marks needed",
    );
    const multi = tiers[3].find((s) => s.subjects > 1);
    ok(
      multi &&
        multi.parts.length === multi.subjects &&
        multi.totalMarks ===
          multi.parts.reduce(
            (n, x) => n + Number(/\+(\d+) mark/.exec(x)[1]),
            0,
          ),
      "P5d-5",
      "Pathways needing several subjects name every subject and the total marks add up",
    );
    const jc = tiers[5].find((s) => /Junior College/.test(s.name));
    ok(
      jc &&
        jc.farOff === true &&
        jc.totalMarks > 60 &&
        tiers[5].every((s) => !/<|Infinity/.test(s.detail)),
      "P5d-3",
      "JC is out of reach (route would need over 60 marks) and details carry no raw markup",
    );
    ok(
      a.staircase.map((tr) => tr.tier).join("") ===
        [...a.staircase.map((tr) => tr.tier)].sort().join(""),
      "P5d-4",
      "Staircase tiers run from open today up to out of reach",
    );

    console.log(
      "\nPhase 5e: second route on immediate steps (maintain and improve)",
    );
    const immediate = (adv) => adv.staircase.find((tr) => tr.tier === 1).steps;
    // Profile A: both immediate steps can alternatively be reached by Maths F9 -> E8.
    const altA = immediate(a);
    ok(
      altA.length === 2 &&
        altA.every(
          (s) =>
            s.alt &&
            s.alt.totalMarks === 9 &&
            s.alt.difficulty === "stretch" &&
            /Mathematics G3 F9 → E8 \(reach 40 marks, \+9 marks\)/.test(
              s.alt.parts[0],
            ),
        ),
      "P5e-1",
      "Profile A: each immediate step also shows Maths F9 → E8 (+9, stretch) as the keep-your-levels route",
    );
    a = await advise(page, [
      S("EL", "G2", "5", 55),
      S("MATH", "G2", "6", 33),
      S("COMB_SCI", "G2", "6", 36),
      S("COMB_HUM", "G2", "6", 45),
      S("POA", "G2", "6", 34),
    ]);
    const dSteps = immediate(a);
    const passEl = dSteps.find((s) => s.name === "MER (Pass EL)");
    const passElMath = dSteps.find((s) => s.name === "MER (Pass EL & Math)");
    ok(
      passEl &&
        passEl.alt.totalMarks === 19 &&
        passEl.alt.subjects === 2 &&
        passEl.alt.parts.some((x) =>
          /Combined Science G2 6 → 5 \(reach 50 marks, \+14 marks\)/.test(x),
        ) &&
        passEl.alt.parts.some((x) =>
          /Combined Humanities G2 6 → 5 \(reach 50 marks, \+5 marks\)/.test(x),
        ),
      "P5e-2",
      "Profile D: Pass EL can also be reached by keeping G2 with Science +14 and Humanities +5",
    );
    ok(
      passElMath &&
        passElMath.alt.totalMarks === 22 &&
        passElMath.alt.parts.some((x) =>
          /Mathematics G2 6 → 5 \(reach 50 marks, \+17 marks\)/.test(x),
        ),
      "P5e-3",
      "Profile D: Pass EL & Math needs Maths +17 and Humanities +5 if the levels are kept",
    );
    ok(
      a.staircase
        .filter((tr) => tr.tier !== 1)
        .every((tr) => tr.steps.every((s) => !s.alt)),
      "P5e-4",
      "Only immediate level-move steps carry an alternative route",
    );

    console.log("\nPhase 6: randomized invariants (400 profiles)");
    const result = await page.evaluate((school) => {
      const G3 = ["A1", "A2", "B3", "B4", "C5", "C6", "D7", "E8", "F9"];
      const pool = [
        "HIST",
        "GEOG",
        "COMB_HUM",
        "PHY",
        "CHEM",
        "BIO",
        "COMB_SCI",
        "POA",
        "DT",
        "NFS",
        "COMP",
        "ART",
        "ECON",
        "AM",
      ];
      let seed = 987654;
      const rnd = () =>
        (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
      const bad = [];
      for (let k = 0; k < 400; k++) {
        const subs = [];
        const mk = (id) =>
          subs.push({
            subjectId: id,
            level: "G3",
            grade: G3[Math.floor(rnd() * 9)],
            rawMark: null,
          });
        mk("EL");
        mk("MATH");
        mk("MT");
        [...pool]
          .sort(() => rnd() - 0.5)
          .slice(0, 2 + Math.floor(rnd() * 5))
          .forEach(mk);
        const a = window.__spdTest.advise(subs, 0, school);
        const dropped = a.options[0].drops.map((d) => d.subject.subjectId);
        if (dropped.includes("EL") || dropped.includes("MATH"))
          bad.push("EL/MATH dropped");
        if (a.final.length < 5) bad.push("fewer than 5 subjects");
        if (a.options[0].drops.length > 1) bad.push("more than 1 drop");
        if (
          a.recommended.id === 1 &&
          a.final.some((s) => dropped.includes(s.subjectId))
        )
          bad.push("dropped subject still final");
        const flagged = a.options.filter((o) => o.isRecommended);
        const applicable = a.options.filter((o) => o.applicable);
        if (flagged.length !== (applicable.length ? 1 : 0))
          bad.push("not exactly one recommendation");
        if (
          flagged.length &&
          applicable.some((o) => o.realistic > flagged[0].realistic)
        )
          bad.push("recommended option is not the best");
        if (a.options[2].moves.some((s) => s.subjectId === "PHY"))
          bad.push("PHY moved down");
      }
      return bad;
    }, SCHOOL);
    ok(
      result.length === 0,
      "P6-1",
      `invariants hold (${result.slice(0, 3).join("; ") || "none violated"})`,
    );

    console.log("\nPhase 9: Advice engine choices, practical check, coherence");
    const W6 = [
      S("EL", "G3", "B3", 69),
      S("MT", "G3", "C6", 50),
      S("MATH", "G3", "F9", 31),
      S("COMB_SCI", "G3", "D7", 47),
      S("COMB_HUM", "G3", "E8", 43),
      S("POA", "G3", "F9", 38),
    ];
    const STRONG = [
      S("EL", "G3", "A2", 85),
      S("MATH", "G3", "A2", 85),
      S("MT", "G3", "B3", 70),
      S("COMB_SCI", "G3", "B3", 70),
      S("COMB_HUM", "G3", "B3", 70),
      S("POA", "G3", "B4", 65),
    ];
    const WEAK3_OF_5 = [
      S("EL", "G3", "D7", 52),
      S("MATH", "G3", "E8", 40),
      S("HIST", "G3", "E8", 41),
      S("MT", "G3", "F9", 30),
      S("COMB_SCI", "G3", "E8", 42),
    ];
    const THREE_FAIL_5 = [
      S("EL", "G3", "D7", 50),
      S("MATH", "G3", "D7", 52),
      S("HIST", "G3", "F9", 30),
      S("MT", "G3", "F9", 30),
      S("COMB_SCI", "G3", "F9", 30),
    ];
    const WEAK_UNUSED = [
      S("EL", "G3", "B3", 70),
      S("MATH", "G3", "B3", 70),
      S("HIST", "G3", "D7", 47),
      S("COMB_SCI", "G3", "F9", 30),
      S("POA", "G3", "F9", 30),
      S("MT", "G3", "F9", 30),
    ];
    const profiles9 = [W6, STRONG, WEAK3_OF_5, THREE_FAIL_5, WEAK_UNUSED];
    const adv9 = [];
    for (const p of profiles9) adv9.push(await advise(page, p));
    const [a6, aStrong, aWeak, a3f] = adv9;

    ok(
      adv9.every(
        (x) =>
          x.choices.length === 4 &&
          x.choices.map((c) => c.key).join("") === "ABCD",
      ),
      "P9-1",
      "Four choices A-D, always in that order",
    );
    ok(
      adv9.every(
        (x) =>
          x.choices.filter((c) => c.isRecommended).length === 1 &&
          x.choices.filter((c) => !c.applicable).every((c) => c.na),
      ),
      "P9-2",
      "Exactly one suggested choice; inapplicable choices say why",
    );
    ok(
      aStrong.standing.level === "coping" &&
        aStrong.recommended.key === "A" &&
        aStrong.choices[0].isRecommended,
      "P9-3",
      "A student coping everywhere is told to keep and improve, not to drop a subject",
    );
    ok(
      adv9.every((x) =>
        x.choices
          .filter((c) => c.applicable)
          .every(
            (c) =>
              c.count ===
              x.before.realistic - c.lostIds.length + c.gainedIds.length,
          ),
      ),
      "P9-4",
      "Each choice's pathway count = today's realistic - given up + opened",
    );
    const flat = (x) => x.staircase.flatMap((t) => t.steps);
    ok(
      adv9.every((x) => {
        const st = flat(x);
        const n = (k) => st.filter((s) => s.status === k).length;
        return (
          x.summary.open === x.before.eligible &&
          x.summary.open + x.summary.close === x.before.realistic &&
          ["open", "close", "lower", "further"].every(
            (k) => x.summary[k] === n(k),
          )
        );
      }),
      "P9-5",
      "Tiles = staircase statuses, and Open + Within reach = choice A's pathway count",
    );
    ok(
      adv9.every((x) =>
        flat(x)
          .filter((s) => s.tier === 1 && s.status === "close")
          .every((s) => s.alt && s.alt.rows),
      ),
      "P9-6",
      "A level-change pathway is only 'within reach' when a keep-your-levels route exists",
    );
    ok(
      adv9.every((x) =>
        x.choices.every(
          (c) =>
            c.steps.length <= 3 &&
            (!c.check ||
              ["P1", "P2", "P3", "P5"].every(
                (r) => c.check.items.filter((i) => i.rule === r).length <= 1,
              )),
        ),
      ),
      "P9-7",
      "At most 3 steps per choice and one line per practical-check rule",
    );
    // Practical check: majority lowered → look at the rest.
    const wu = await page.evaluate(
      ([s, sel]) => window.__spdTest.evalCustom(s, sel, "School A"),
      [WEAK_UNUSED, { COMB_SCI: "lower", POA: "lower", MT: "lower" }],
    );
    const p1 = wu.check.items.find((i) => i.rule === "P1");
    ok(
      p1 &&
        p1.rows.find((r) => r.subject === "History").suggestion ===
          "Consider lowering too" &&
        p1.rows
          .filter((r) => r.subject !== "History")
          .every((r) => r.suggestion === "Keep at current level"),
      "P9-8",
      "3 of 6 lowered: a weak subject no pathway uses is flagged 'Consider lowering too', strong ones stay",
    );
    const d3 = a3f.choices[3].check.items.find((i) => i.rule === "P1");
    ok(
      d3 &&
        d3.rows.length === 2 &&
        d3.rows.every(
          (r) => r.helps !== "No" && r.suggestion === "Keep at current level",
        ),
      "P9-9",
      "A subject a pathway needs is kept and the pathway is named",
    );
    ok(
      aWeak.choices[3].check.items.some(
        (i) => i.rule === "P2" && i.text.includes("Mathematics (+5 to D7)"),
      ),
      "P9-10",
      "A lowered subject within 5 marks of the next grade is flagged (one merged line)",
    );
    ok(
      aStrong.choices[0].check.items.length === 0 &&
        aStrong.choices[0].check.passed === 5,
      "P9-11",
      "A strong student's plan passes every check with nothing flagged",
    );
    const ec0 = await page.evaluate(
      ([s]) => window.__spdTest.evalCustom(s, {}, "School A"),
      [W6],
    );
    ok(
      ec0.count === a6.before.realistic && ec0.lost.length === 0,
      "P9-12",
      "Try-your-own-mix with no changes matches today's pathways",
    );

    const pushText = (x) =>
      x.choices
        .filter((c) => c.applicable)
        .flatMap((c) => [
          ...c.steps,
          ...c.improve.map((i) => `${i.name} +${i.marks} to ${i.to}`),
        ])
        .join(" | ");
    ok(
      !pushText(a6).includes("English Language"),
      "P9-13",
      "No 'push' advice for a strong subject that changes nothing (English B3 → A2)",
    );
    ok(
      pushText(a6).includes("Combined Science +3 to C6") &&
        pushText(a6).includes("Combined Humanities +2 to D7"),
      "P9-14",
      "Weak subjects within a few marks of the next grade are still suggested",
    );

    console.log("\nPhase 10: FSBB table (rows, colours, details, drop rules)");
    const fsbbOf = (subs) =>
      page.evaluate(
        ([s, school]) => window.__spdTest.fsbb(s, school),
        [subs, SCHOOL],
      );
    const explainOf = (subs, row, col) =>
      page.evaluate(
        ([s, r, c, school]) => window.__spdTest.fsbbExplain(s, r, c, school),
        [subs, row, col, SCHOOL],
      );
    const rowOf = (subs) =>
      page.evaluate((s) => window.__spdTest.fsbbRow(s), subs);
    const g1 = (id) => S(id, "G1", "B");
    ok(
      (await rowOf([...W6])) === 0 &&
        (await rowOf([
          S("EL", "G3", "B3"),
          S("MATH", "G3", "B3"),
          S("MT", "G3", "B3"),
          S("HIST", "G3", "B3"),
          S("BIO", "G2", "2"),
          S("POA", "G2", "2"),
        ])) === 1 &&
        (await rowOf([
          S("EL", "G2", "2"),
          S("MATH", "G2", "2"),
          S("MT", "G2", "2"),
          S("HIST", "G2", "2"),
          S("POA", "G2", "2"),
        ])) === 2 &&
        (await rowOf([g1("EL"), g1("MATH"), g1("MT"), g1("HIST")])) === 3 &&
        (await rowOf([S("EL", "G3", "B3"), S("MATH", "G3", "B3")])) === null,
      "P10-1",
      "A student's row: 5+ G3 → 5 G3; 4 G3 + a 5th at G3/G2 → 4 G3 + 1 G2; 5 at G2 or above → 5 G2; 4 subjects → 4 G1; fewer than 4 → none",
    );

    const gW6 = await fsbbOf(W6);
    const flatSteps = (x) => x.staircase.flatMap((t) => t.steps);
    const stW6 = flatSteps(a6);
    const COLS_IDS = gW6.rows[0].map((c) => c.ids);
    ok(
      gW6.r0 === 0 &&
        gW6.rows[0].every((c, ci) => {
          const steps = stW6.filter((s) => COLS_IDS[ci].includes(s.id));
          return (
            (c.status === "open") === steps.some((s) => s.status === "open")
          );
        }),
      "P10-2",
      "Your row's ✓ boxes match the pathways open today (same engine as before)",
    );

    // soundness: every ✓ on a changed mix is truly eligible for that mix
    let sound = true;
    let soundDetail = "";
    const profiles10 = [W6, STRONG, WEAK3_OF_5, THREE_FAIL_5, WEAK_UNUSED];
    const grids10 = [];
    for (const p of profiles10) grids10.push(await fsbbOf(p));
    for (const g of grids10) {
      for (const row of g.rows)
        for (const c of row) {
          if (c.status !== "open" || c.mirror || !c.subjects) continue;
          const res = await page.evaluate(
            (s) => window.__spdTest.calculate(s, 0),
            c.subjects,
          );
          if (!res.some((p) => p.isEligible && c.ids.includes(p.id))) {
            sound = false;
            soundDetail = `${c.key} row ${c.row}`;
          }
        }
    }
    ok(
      sound,
      "P10-3",
      `No ✓ box is wrong: each one is eligible under the mix it describes (${soundDetail || "all checked"})`,
    );
    const MATRIX10 = [
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 0, 0],
      [1, 1, 1, 0, 0, 0],
      [1, 1, 0, 0, 0, 0],
    ];
    ok(
      grids10.every(
        (g) =>
          g.rows.every((row, r) =>
            row.every(
              (c, ci) => (c.status === "na") === (MATRIX10[r][ci] === 0),
            ),
          ) && g.rows[3][1].mirror === true,
      ),
      "P10-4",
      "Grey boxes are exactly the poster's grey boxes; 2-Year at 4 G1 is the 3-Year route (mirror)",
    );
    ok(
      grids10.every((g) =>
        g.rows
          .flat()
          .filter((c) => c.status !== "na" && c.status !== "info")
          .every(
            (c) =>
              !/Long-term|Open now|Lower |lower /.test(
                `${c.line1} ${c.line2}`,
              ) &&
              (c.line2 === "" ||
                c.row === g.r0 ||
                /G[123]→G[123]|Drop|3-Year/.test(c.line2) ||
                c.mirror),
          ),
      ),
      "P10-5",
      "Box text never says 'Long-term', 'Open now' or 'lower POA'; level changes read like 'POA G3→G2'",
    );

    // drop rules
    const dropsOk = (g, n) =>
      g.rows
        .flat()
        .every(
          (c) => c.dropped.length <= 1 && (n > 5 || c.dropped.length === 0),
        );
    ok(
      dropsOk(grids10[2], WEAK3_OF_5.length) &&
        dropsOk(grids10[3], THREE_FAIL_5.length) &&
        dropsOk(grids10[0], W6.length) &&
        dropsOk(grids10[4], WEAK_UNUSED.length),
      "P10-6",
      "At most one drop, and never when the student has only 5 subjects",
    );
    const ex5 = [];
    for (const r of [0, 1, 2, 3])
      for (const c of [0, 1]) {
        const e = await explainOf(WEAK3_OF_5, r, c);
        ex5.push(...e.advice.map((a) => a.action));
      }
    const ex6 = await explainOf(WEAK_UNUSED, 0, 0);
    ok(
      !ex5.includes("DROP") &&
        ex6.advice.filter((a) => a.action === "DROP").length <= 1 &&
        (ex6.advice.filter((a) => a.action === "DROP").length === 0 ||
          ex6.advice
            .filter((a) => a.action === "DROP")
            .every((a) => a.id !== "EL" && a.id !== "MATH")),
      "P10-7",
      "Advice never says DROP with 5 subjects; with 6 it drops at most one, and never English or Maths",
    );
    // close-to-next-grade warning (every subject sits 5 marks below the next grade)
    // Same grades and marks as the weak profile (so a real route exists), with
    // every mark except Maths placed exactly 5 below the next grade. Maths
    // (9 short) is the one subject that must NOT trigger the warning.
    const NEAR = [
      S("EL", "G3", "B3", 65),
      S("MT", "G3", "C6", 50),
      S("MATH", "G3", "F9", 31),
      S("COMB_SCI", "G3", "D7", 45),
      S("COMB_HUM", "G3", "E8", 40),
      S("POA", "G3", "F9", 35),
    ];
    const gNear = await fsbbOf(NEAR);
    let warnOk = true;
    let warnChecked = 0;
    for (const row of gNear.rows.slice(1))
      for (const c of row) {
        if (
          c.status !== "open" &&
          c.status !== "later" &&
          c.status !== "close" &&
          c.status !== "further"
        )
          continue;
        const downIds = [
          ...c.moves.filter((m) => !m.up).map((m) => m.subjectId),
          ...c.dropped,
        ];
        if (!downIds.length) continue;
        const near = downIds.filter((id) => id !== "MATH").length;
        const e = await explainOf(NEAR, c.row, c.col);
        warnChecked++;
        if (e.warnings.filter((w) => /marks? from/.test(w)).length !== near)
          warnOk = false;
      }
    ok(
      warnOk && warnChecked > 0,
      "P10-8",
      `A subject within 5 marks of the next grade gets a 'staying may be realistic' warning when a route moves or drops it (${warnChecked} routes)`,
    );
    const MIXED = [
      S("EL", "G3", "C5", 55),
      S("MATH", "G3", "C6", 52),
      S("MT", "G3", "C6", 50),
      S("COMB_SCI", "G3", "D7", 47),
      S("COMB_HUM", "G2", "2", 72),
      S("POA", "G2", "3", 66),
    ];
    const gMixed = await fsbbOf(MIXED);
    ok(
      gMixed.r0 === 1 &&
        gMixed.rows[0].every(
          (c) => c.status === "na" || c.status === "info" || c.est === true,
        ),
      "P10-9",
      "A student on 4 G3 + 1 G2 sees the 5 G3 row marked as an estimate",
    );
    ok(
      gW6.ms < 2500,
      "P10-10",
      `The table builds quickly (${Math.round(gW6.ms)} ms including the advice engine)`,
    );

    // ---- Moving down is only suggested when it opens something ----
    const A1x6 = ["EL", "MATH", "MT", "COMB_SCI", "COMB_HUM", "POA"].map((id) =>
      S(id, "G3", "A1", 90),
    );
    const gA1 = await fsbbOf(A1x6);
    ok(
      gA1.r0 === 0 &&
        gA1.rows.every((row, r) =>
          row.every(
            (c) =>
              r === 0 ||
              c.status === "na" ||
              (c.status === "have" &&
                c.moves.length === 0 &&
                c.dropped.length === 0),
          ),
        ),
      "P10-11",
      "A student with six G3 A1s already has every pathway: every lower box says 'already open' and suggests no move and no drop",
    );
    const exA1 = [];
    for (const [r, c] of [
      [0, 0],
      [0, 3],
      [0, 5],
    ])
      exA1.push(...(await explainOf(A1x6, r, c)).advice.map((a) => a.action));
    ok(
      exA1.length > 0 && exA1.every((a) => a === "KEEP" || a === "EITHER"),
      "P10-12",
      "For that student the subject advice is only keep / either: no MOVE, no RAISE, no DROP",
    );
    // For every profile: a box with a level change or drop must beat the rows above it
    const RANK10 = {
      open: 0,
      have: 0,
      later: 1,
      close: 1,
      further: 2,
      nobetter: 2,
    };
    let pointless = "";
    for (const g of [...grids10, gA1, gNear, gMixed]) {
      for (let r = g.r0 + 1; r < 4; r++)
        g.rows[r].forEach((c, ci) => {
          if (RANK10[c.status] === undefined) return;
          if (c.moves.length === 0 && c.dropped.length === 0) return;
          let above = 9;
          for (let k = g.r0; k < r; k++)
            if (RANK10[g.rows[k][ci].status] !== undefined)
              above = Math.min(above, RANK10[g.rows[k][ci].status]);
          if (!(RANK10[c.status] < above)) pointless = c.key + " row " + r;
        });
    }
    ok(
      pointless === "",
      "P10-13",
      "A lower box only carries a level change or drop when it opens or improves a pathway (" +
        (pointless || "all checked") +
        ")",
    );
    ok(
      gW6.rows[3][1].status === "later" &&
        gW6.rows[3][1].line1 === "Possible after Year 1" &&
        gW6.rows[1][1].status === "nobetter" &&
        gW6.rows[1][0].status === "have",
      "P10-14",
      "Weak student: 3-Year is 'already open' lower down, 2-Year at 4 G1 reads 'Possible after Year 1' (not a course count), and boxes that gain nothing say so",
    );

    // ---- Free-time hint: separate from the routes, never for strong students ----
    const exW6 = await explainOf(W6, 0, 0);
    const exW6poly = await explainOf(W6, 0, 3);
    const exA1b = await explainOf(A1x6, 0, 3);
    const ex5b = await explainOf(WEAK3_OF_5, 0, 0);
    ok(
      exW6.free &&
        exW6.free.names.length >= 1 &&
        exW6.free.names.every(
          (n) => !n.startsWith("English") && !n.startsWith("Mathematics"),
        ) &&
        exW6.free.left === 5 &&
        exW6.warnings.some((w) => w.includes("only 5 subjects")),
      "P10-15",
      "Weak student with 6 subjects: subjects no pathway needs are offered as a free-time option, with the 5-subject warning (" +
        (exW6.free ? exW6.free.names.join(", ") : "none") +
        ")",
    );
    ok(
      !exW6poly.free ||
        !exW6poly.free.names.some((n) => n.startsWith("Combined Humanities")),
      "P10-15b",
      "The free-time hint never lists a subject that the column's own improvement routes ask you to raise (Humanities for Polytechnic)",
    );
    ok(
      exA1b.free === null && ex5b.free === null,
      "P10-16",
      "No free-time option for a strong student, or for a student who already has only 5 subjects",
    );

    console.log(
      "\nPhase 11: generic subjects stand for their specific versions",
    );
    {
      const calcPoly = (subs) =>
        page.evaluate(
          (s) =>
            window.__spdTest
              .calculate(s, 0)
              .filter((p) => p.id.startsWith("poly_yr1_elr2b2_"))
              .map((p) => ({
                id: p.id,
                net: p.netScore === Infinity ? "inf" : p.netScore,
                elig: p.isEligible,
                roles: (p.subjectsUsed || []).map(
                  (u) => `${u.role}=${u.subjectId}`,
                ),
              })),
          subs,
        );
      const core = [
        S("EL", "G3", "B3"),
        S("COMB_HUM", "G3", "B3"),
        S("COMB_SCI", "G3", "B3"),
        S("PHY", "G3", "B3"),
      ];
      const noRole = (r) => r.roles.map((q) => q.split("=")[0]);
      const pairs = [
        [
          "Mother Tongue = Chinese",
          [...core, S("MT", "G3", "B3")],
          [...core, S("CHI", "G3", "B3")],
        ],
        [
          "Higher Mother Tongue = Higher Chinese",
          [...core, S("HMT", "G3", "B3")],
          [...core, S("HCHI", "G3", "B3")],
        ],
        [
          "Media Studies = Media Studies (English)",
          [
            S("EL", "G3", "B3"),
            S("MS", "G3", "B3"),
            S("COMB_SCI", "G3", "B3"),
            S("PHY", "G3", "B3"),
            S("MT", "G3", "B3"),
          ],
          [
            S("EL", "G3", "B3"),
            S("MS_ENG", "G3", "B3"),
            S("COMB_SCI", "G3", "B3"),
            S("PHY", "G3", "B3"),
            S("MT", "G3", "B3"),
          ],
        ],
      ];
      for (const [label, generic, specific] of pairs) {
        const g = await calcPoly(generic);
        const sp = await calcPoly(specific);
        const a = (r) => r.find((p) => p.id === "poly_yr1_elr2b2_a");
        ok(
          a(g).net === a(sp).net &&
            a(g).elig === a(sp).elig &&
            a(g).net !== "inf" &&
            noRole(a(g)).join() === noRole(a(sp)).join(),
          "P11-" +
            label.split(" ")[0] +
            (label.includes("Higher")
              ? "H"
              : label.includes("Media")
                ? "M"
                : ""),
          `${label}: the Humanities, Media & Communications course gives the same net score, eligibility and slots (net ${a(g).net})`,
        );
      }
      // Tamil exists as a subject, so a Tamil student fills R2 like Chinese or Malay
      const tam = await calcPoly([...core, S("TAM", "G3", "B3")]);
      const mal = await calcPoly([...core, S("MAL", "G3", "B3")]);
      const aT = tam.find((p) => p.id === "poly_yr1_elr2b2_a");
      const aM = mal.find((p) => p.id === "poly_yr1_elr2b2_a");
      ok(
        aT.net !== "inf" &&
          aT.net === aM.net &&
          aT.roles.includes("R2=TAM") &&
          aM.roles.includes("R2=MAL"),
        "P11-T",
        `Tamil (TAM) is a selectable subject and fills R2 in the Humanities, Media & Communications course exactly like Malay (net ${aT.net})`,
      );
      // Where a list is not language-specific, a generic subject is not aliased
      const g = await calcPoly([...core, S("MT", "G3", "B3")]);
      ok(
        g
          .filter((p) => p.id !== "poly_yr1_elr2b2_a")
          .every((p) => !p.roles.some((r) => /^R[12]=(MT|HMT|MS)$/.test(r))),
        "P11-N",
        "Other polytechnic courses (whose lists do not name languages) never use a generic Mother Tongue as R1 or R2",
      );
    }

    // ---- UI ----
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FILE_URL, { waitUntil: "domcontentloaded" });
    await page.selectOption("#school", SCHOOL);
    await page.waitForTimeout(300);
    for (const [id, lvl, grd, raw] of [
      ["EL", "G3", "B3", "69"],
      ["MT", "G3", "C6", "50"],
      ["MATH", "G3", "F9", "31"],
      ["COMB_SCI", "G3", "D7", "47"],
      ["COMB_HUM", "G3", "E8", "43"],
      ["POA", "G3", "F9", "38"],
    ]) {
      if (
        (await page.getAttribute("#subjectPicker", "aria-expanded")) !== "true"
      )
        await page.click("#subjectPicker");
      await page.check('[data-pick="' + id + '"]');
      await page.click("#subjectMenuAdd");
      await page.waitForTimeout(350);
      const row = '[data-subject-row="' + id + '"]';
      if ((await page.inputValue(row + " [data-row-level]")) !== lvl) {
        await page.selectOption(row + " [data-row-level]", lvl);
        await page.waitForTimeout(200);
      }
      await page.selectOption(row + " [data-row-grade]", grd);
      await page.waitForTimeout(200);
      await page.fill(row + " [data-row-raw]", raw);
      await page.press(row + " [data-row-raw]", "Tab");
      await page.waitForTimeout(250);
    }
    const heads = await page.$$eval("[data-fsbb-col]", (bs) =>
      bs.map((b) => b.innerText.trim().replace(/\s+/g, " ")),
    );
    const tableText = await page.textContent("#resultsAdviceSection");
    ok(
      heads.length === 6 &&
        heads[0].startsWith("3-Year") &&
        heads[1].startsWith("2-Year") &&
        heads[2].startsWith("Polytechnic Foundation") &&
        heads[3] === "Polytechnic Year 1" &&
        heads[4] === "Millennia Institute" &&
        heads[5] === "Junior College" &&
        !/NAFA|Arts Institution/i.test(tableText),
      "P10-U1",
      `Six pathway columns in poster order, no NAFA or Arts Institutions (${heads.join(" | ")})`,
    );
    ok(
      (await page.$$eval("[data-fsbb-na]", (ns) =>
        ns.every((n) => n.textContent.trim() === ""),
      )) && (await page.$$("#fsbbTable tbody tr")).length === 1,
      "P10-U2",
      "The table shows one row (the student's own combination), and its poster-grey boxes are plain grey with no text",
    );
    {
      const sizes = await page.evaluate(() => {
        const h = (sel) =>
          [...document.querySelectorAll(sel)].map((n) =>
            Math.round(n.getBoundingClientRect().height),
          );
        return {
          boxes: h(
            "#fsbbTable tbody [data-fsbb-cell], #fsbbTable tbody [data-fsbb-na], #fsbbTable tbody [data-fsbb-none]",
          ),
          heads: h("#fsbbTable [data-fsbb-col]"),
        };
      });
      const same = (a) => a.length > 0 && Math.max(...a) - Math.min(...a) <= 1;
      ok(
        same(sizes.boxes) && same(sizes.heads),
        "P10-U2b",
        `All boxes in the table row are the same height (${[...new Set(sizes.boxes)].join("/")}px) and all column headings match (${[...new Set(sizes.heads)].join("/")}px), so no box looks highlighted by size`,
      );
    }
    ok(
      (
        await page.$$eval("[data-you]", (ns) =>
          ns.map((n) => n.closest("tr").rowIndex),
        )
      ).join() === "2" && // thead has 2 rows → first body row is index 2
        (await page.$eval("[data-you]", (n) => n.textContent)).includes(
          "You are here",
        ),
      "P10-U3",
      "'You are here' sits on the student's own row (5 G3)",
    );
    ok(
      (await page.$$eval(
        '#fsbbTable tbody tr:first-child [data-fsbb-cell][data-status="open"]',
        (b) => b.length,
      )) === gW6.rows[0].filter((c) => c.status === "open").length &&
        (await page.$$eval("[data-fsbb-cell]", (bs) =>
          bs.every((b) =>
            ["open", "close", "further", "have", "nobetter", "later"].includes(
              b.dataset.status,
            ),
          ),
        )),
      "P10-U4",
      "Eligible / almost there / needs more work boxes are colour-coded by status and match the engine",
    );
    ok(
      !(await page.isVisible("#fsbbDetails")),
      "P10-U5",
      "Details stay hidden until a box is tapped",
    );
    await page.click('[data-fsbb-cell][data-row="0"][data-col="3"]');
    const det = await page.textContent("#fsbbDetails");
    ok(
      (await page.isVisible("#fsbbDetails")) &&
        (await page.getAttribute(
          '[data-fsbb-cell][data-row="0"][data-col="3"]',
          "aria-expanded",
        )) === "true" &&
        (await page.$$("#fsbbDetails [data-slot-table]")).length >= 1 &&
        (await page.$$("#fsbbCourses [data-pw]")).length === 5 &&
        !det.includes("What to do with your subjects") &&
        !det.includes("Free up study time") &&
        (await page.$("#fsbbCourses [data-easiest]")) !== null &&
        /Your subject/i.test(det) &&
        /Need/i.test(det) &&
        /Marks/i.test(det) &&
        /Easiest way in/.test(det),
      "P10-U6",
      "Tapping Polytechnic Year 1 lists its 5 courses with the easiest first, and the easiest opens a requirements table (no KEEP/MOVE list, no free-time option)",
    );
    await page.keyboard.press("Escape");
    ok(
      !(await page.isVisible("#fsbbDetails")) &&
        (await page.getAttribute(
          '[data-fsbb-cell][data-row="0"][data-col="3"]',
          "aria-expanded",
        )) === "false",
      "P10-U7",
      "Escape closes the details",
    );
    await page.click('[data-fsbb-col="5"]');
    ok(
      (await page.textContent("#fsbbDetails")).includes("Junior College") &&
        (await page.$$("#fsbbCourses [data-pw]")).length === 1,
      "P10-U8",
      "Tapping a column heading opens that pathway for your row",
    );
    // the table shows only the student's own row, with no 'LDL does not increase' boxes
    ok(
      (
        await page.$$(
          "[data-fsbb-cell][data-row='1'], [data-fsbb-cell][data-row='2'], [data-fsbb-cell][data-row='3']",
        )
      ).length === 0 &&
        !(await page.textContent("#resultsAdviceSection")).includes(
          "LDL does not increase",
        ),
      "P10-U9",
      "Lower rows and the 'LDL does not increase eligibility' boxes are gone from the table",
    );
    // quick-win lines, plain ITE names
    const winCount = await page.evaluate(
      () => window.__spdTest.quickWins().length,
    );
    let winsSeen = 0;
    let iteText = "";
    let iteNames = [];
    for (let ci = 0; ci < 6; ci++) {
      await page.click(`[data-fsbb-col="${ci}"]`);
      winsSeen += (await page.$$("#fsbbCourses [data-qw]")).length;
      if (ci === 0) {
        iteText = await page.$$eval("#fsbbCourses summary", (s) =>
          s.map((x) => x.textContent).join(" "),
        );
        iteNames = await page.$$eval("#fsbbCourses [data-pw]", (rs) =>
          rs.map((x) => x.dataset.name),
        );
      }
    }
    ok(
      winCount === 0 || winsSeen > 0,
      "P10-U10",
      `Quick-win lines still appear on your row's courses (${winCount} wins, ${winsSeen} lines)`,
    );
    ok(
      !iteText.includes("MER (") &&
        iteText.includes("ITE Higher Nitec: pass") &&
        iteNames.some((n) => n.startsWith("MER (")),
      "P10-U11",
      "ITE courses show plain names while data names stay unchanged",
    );
    await page.click('[data-fsbb-cell][data-row="0"][data-col="0"]');
    ok(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )),
      "P10-U12",
      "No horizontal page scroll at 390px with the details open",
    );
    // Far-off boxes: marks route filled in after the first draw
    await page
      .waitForFunction(() => !document.querySelector("[data-pending]"), null, {
        timeout: 15000,
      })
      .catch(() => {});
    const farTexts = await page.$$eval(
      '[data-fsbb-cell][data-status="further"]',
      (bs) => bs.map((b) => b.innerText.replace(/\s+/g, " ").trim()),
    );
    ok(
      (await page.$$("[data-pending]")).length === 0 &&
        farTexts.length > 0 &&
        farTexts.every(
          (t) =>
            /\+\d+ marks?/.test(t) ||
            /Marks alone won't be enough/.test(t) ||
            /Aggregate \d+/.test(t),
        ) &&
        !farTexts.some((t) => /different subjects or levels/.test(t)),
      "P10-U16",
      `Every 'needs more work' box names the marks it needs, or says marks alone won't be enough (${farTexts.length} boxes, e.g. ${farTexts[farTexts.length - 1]})`,
    );
    // ---- Why: courses say what they need ----
    // Slots counted at G2 show the G2 equivalent of a G3 grade, in Now and Need
    await page.click('[data-fsbb-cell][data-row="0"][data-col="2"]');
    {
      const rows = await page.$$eval(
        "#fsbbCourses [data-easiest] [data-slot-row]",
        (rs) =>
          rs.map((r) => ({
            now: r.children[2].textContent.trim(),
            need: r.children[3].textContent.trim(),
          })),
      );
      ok(
        rows.length > 0 &&
          rows
            .filter((r) => r.now.startsWith("G3"))
            .every((r) => /→ G2 [1-6]/.test(r.now)) &&
          rows.some((r) => /\d\+ → G2 [1-6]/.test(r.need)),
        "P10-T5",
        "PFP slots are counted at G2, so a G3 grade shows its G2 equivalent in Now, and the target shows its G2 equivalent in Need (" +
          rows
            .slice(0, 2)
            .map((r) => r.now + " / " + r.need)
            .join("; ") +
          ")",
      );
    }
    // The table's rows add up to its total, and an empty slot is never silent
    {
      let checked = 0;
      let bad = [];
      let unnamed = [];
      for (let ci = 0; ci < 6; ci++) {
        await page.click(`[data-fsbb-col="${ci}"]`);
        await page.$$eval("#fsbbCourses [data-pw]", (ds) =>
          ds.forEach((d) => (d.open = true)),
        );
        const res = await page.$$eval("#fsbbCourses [data-pw]", (ds) =>
          ds.map((d) => {
            const tot = d.querySelector("[data-slot-total]");
            const m = tot && /Total \+(\d+) marks/.exec(tot.textContent);
            const sum = [...d.querySelectorAll("[data-slot-row]")].reduce(
              (a, r) => {
                const q = /^\+(\d+)/.exec(r.children[4].textContent.trim());
                return a + (q ? Number(q[1]) : 0);
              },
              0,
            );
            const empty = [...d.querySelectorAll("[data-slot-row]")]
              .filter((r) => /No subject yet/.test(r.textContent))
              .map((r) => r.children[3].textContent.trim());
            return {
              name: d.dataset.name,
              total: m ? Number(m[1]) : null,
              sum,
              empty,
            };
          }),
        );
        res.forEach((r) => {
          if (r.total !== null) {
            checked++;
            if (r.total !== r.sum) bad.push(`${r.name} ${r.total}≠${r.sum}`);
          }
          r.empty.forEach((e) => {
            if (!/^Needs /.test(e) || e === "Needs a matching subject")
              unnamed.push(r.name);
          });
        });
      }
      ok(
        checked > 0 && bad.length === 0 && unnamed.length === 0,
        "P10-T8",
        `Each course table's marks add up to its total (${checked} courses checked) and an empty slot says what would fit${bad.length ? " — " + bad.join("; ") : ""}`,
      );
    }
    // ITE courses: tables follow each course's own rule (no G1 aggregate)
    await page.click('[data-fsbb-cell][data-row="0"][data-col="0"]');
    await page.$$eval("#fsbbCourses [data-pw]", (ds) =>
      ds.forEach((d) => (d.open = true)),
    );
    {
      const byCourse = await page.$$eval("#fsbbCourses [data-pw]", (ds) =>
        Object.fromEntries(
          ds.map((d) => [
            d.dataset.name,
            [...d.querySelectorAll("[data-slot-row]")].map((r) => ({
              label: r
                .querySelector("[data-slot-tip]")
                .firstChild.textContent.trim(),
              now: r.children[2].textContent.trim(),
            })),
          ]),
        ),
      );
      const two = byCourse["MER (Pass 2G3)"] || [];
      const elmath = byCourse["MER (Pass EL & Math)"] || [];
      const labels = Object.values(byCourse)
        .flat()
        .map((r) => r.label);
      ok(
        two.map((r) => r.label).join() === "#1,#2" &&
          elmath
            .map((r) => r.label)
            .slice(0, 2)
            .join() === "EL,MA" &&
          !Object.values(byCourse)
            .flat()
            .some((r) => /G1/.test(r.now)),
        "P10-T6",
        "ITE tables follow the course rule: 2 G3 passes show #1 and #2, English and Math show EL and MA, and no G1 figures appear",
      );
      ok(
        labels.every((l) => l.length <= 4),
        "P10-T7",
        "First-column labels are at most 4 characters, so they cannot spill into the subject column on a phone (" +
          [...new Set(labels)].join(", ") +
          ")",
      );
    }
    // LDL options: only LDL (no 'improve' cards); the table transforms to the previewed combination
    {
      const cards = await page.$$eval("[data-fsbb-opt]", (b) =>
        b.map((x) => ({
          key: x.dataset.fsbbOpt,
          text: x.innerText.replace(/\s+/g, " "),
        })),
      );
      const data = await page.evaluate(() =>
        window.__spdTest.options(
          [
            { subjectId: "EL", level: "G3", grade: "B3" },
            { subjectId: "MATH", level: "G3", grade: "F9" },
            { subjectId: "MT", level: "G3", grade: "C6" },
            { subjectId: "COMB_SCI", level: "G3", grade: "D7" },
            { subjectId: "COMB_HUM", level: "G3", grade: "E8" },
          ],
          "School A",
        ),
      );
      const single = data.find((o) => o.key === "MATH>G2");
      ok(
        cards.length >= 2 &&
          cards.every((c) => c.text.startsWith("LDL ")) &&
          !cards.some((c) => /improve|Keep G3/i.test(c.text)) &&
          single &&
          single.opens.length === 2 &&
          single.closes.length === 0 &&
          data.some((o) => o.row >= 1),
        "P10-O1",
        "The strip offers LDL options only: Maths to G2 opens the 2 Maths courses and closes none, and bigger mixes land on lower rows (" +
          cards.map((c) => c.key).join(" | ") +
          ")",
      );
      const eligBefore = await page.textContent("#eligibilityResultsContainer");
      const before3 = await page.textContent(
        '[data-fsbb-cell][data-row="0"][data-col="0"]',
      );
      await page.click('[data-fsbb-opt="MATH>G2"]');
      const bar = await page.textContent("#fsbbPreviewBar");
      const after3 = await page.textContent(
        '[data-fsbb-cell][data-row="0"][data-col="0"]',
      );
      ok(
        /Previewing LDL 1 subject/.test(bar) &&
          (await page.$eval("[data-you]", (n) => n.textContent)).includes(
            "Previewing",
          ) &&
          (await page.$$("#fsbbTable tbody tr")).length === 1 &&
          before3.includes("4 of 6") &&
          after3.includes("6 of 6") &&
          (await page.getAttribute(
            '[data-fsbb-opt="MATH>G2"]',
            "aria-pressed",
          )) === "true" &&
          (await page.textContent("#eligibilityResultsContainer")) ===
            eligBefore &&
          (await page.$$("[data-col-delta]")).length === 0,
        "P10-O2",
        "Previewing Maths at G2 rebuilds the table as that combination (3-Year goes from 4 to 6 of 6), shows a Previewing bar, no comparison badges, and leaves the eligibility cards on the real grades",
      );
      await page.click('[data-fsbb-cell][data-row="0"][data-col="0"]');
      await page.$$eval("#fsbbCourses [data-pw]", (ds) =>
        ds.forEach((d) => (d.open = true)),
      );
      const mathRow = await page.$$eval("#fsbbCourses [data-slot-row]", (rs) =>
        rs
          .map((r) => r.children[2].textContent.trim())
          .filter((t) => /was G3 F9/.test(t)),
      );
      ok(
        mathRow.length > 0 &&
          mathRow.every((t) => /^G2 5 \(was G3 F9\)/.test(t)),
        "P10-O3",
        "In a preview the course tables show the moved subject with its real grade: " +
          (mathRow[0] || "none"),
      );
      await page.click("[data-opt-clear]");
      ok(
        (await page.$("#fsbbPreviewBar")) === null &&
          (await page.$eval("[data-you]", (n) => n.textContent)).includes(
            "You are here",
          ) &&
          (await page.textContent(
            '[data-fsbb-cell][data-row="0"][data-col="0"]',
          )) === before3,
        "P10-O4",
        "'Back to my grades' returns the table to the real combination",
      );
    }
    await page.click('[data-fsbb-cell][data-row="0"][data-col="0"]');
    {
      const head = await page.textContent("[data-fsbb-headline]");
      const needs = await page.$$eval(
        "#fsbbCourses [data-easiest] [data-slot-row] td:nth-child(4)",
        (tds) => tds.map((t) => t.textContent.trim()),
      );
      ok(
        head.includes("You qualify") &&
          needs.length > 0 &&
          needs.every((n) => n === "OK"),
        "P10-U18",
        "An eligible box opens a table where every requirement reads OK (" +
          needs.length +
          " rows)",
      );
    }
    await page.click('[data-fsbb-cell][data-row="0"][data-col="3"]');
    {
      const needs = await page.$$eval(
        "#fsbbCourses [data-easiest] [data-slot-row] td:nth-child(4)",
        (tds) => tds.map((t) => t.textContent.trim()),
      );
      const total = await page.textContent(
        "#fsbbCourses [data-easiest] [data-slot-total]",
      );
      ok(
        needs.some((n) => n !== "OK" && n !== "—") &&
          /Total \+\d+ marks/.test(total),
        "P10-U19",
        "A course you do not qualify for yet shows the grade each slot needs, and a total of marks",
      );
    }
    // Table anatomy: extras, tooltips, plain wording
    {
      const labels = await page.$$eval(
        "#fsbbCourses [data-easiest] [data-slot-row] td:first-child",
        (t) =>
          t.map((x) =>
            x.querySelector("[data-slot-tip]").firstChild.textContent.trim(),
          ),
      );
      const extras = await page.$$(
        "#fsbbCourses [data-easiest] [data-slot-extra]",
      );
      ok(
        labels.length >= 4 && labels.includes("EL"),
        "P10-T1",
        "Slot rows are named by requirement (" + labels.join(", ") + ")",
      );
      await page.hover(
        "#fsbbCourses [data-easiest] [data-slot-row] [data-slot-tip]",
      );
      const tipText = await page.$eval(
        "#fsbbCourses [data-easiest] [data-slot-row] [role=tooltip]",
        (e) => (e.offsetParent !== null ? e.textContent : ""),
      );
      ok(
        tipText.length > 20 && /English|minimum|Minimum|best/i.test(tipText),
        "P10-T2",
        "Hovering a requirement name shows its rule (" +
          tipText.slice(0, 50) +
          "…)",
      );
      await page.mouse.move(0, 0);
      await page.focus(
        "#fsbbCourses [data-easiest] [data-slot-row] [data-slot-tip]",
      );
      ok(
        await page.$eval(
          "#fsbbCourses [data-easiest] [data-slot-row] [role=tooltip]",
          (e) => e.offsetParent !== null,
        ),
        "P10-T3",
        "The same rule opens on tap or keyboard focus (phones have no hover)",
      );
      ok(
        extras.length >= 1 &&
          (await page.$$eval(
            "#fsbbCourses [data-easiest] [data-slot-extra]",
            (rs) =>
              rs.every(
                (r) =>
                  ["backup", "unused"].includes(r.dataset.kind) &&
                  !/^Extra/.test(r.children[0].textContent.trim()),
              ),
          )),
        "P10-T4",
        "A subject the course does not use is listed last as an extra (" +
          extras.length +
          ")",
      );
    }
    {
      const key4g1 = await page.$$eval("[data-fsbb-opt]", (bs) =>
        bs.map((b) => b.dataset.fsbbOpt),
      );
      const g1Key = await page.evaluate(() => {
        const bs = [...document.querySelectorAll("[data-fsbb-opt]")];
        const hit = bs.find((b) => /4 G1 subjects/.test(b.innerText));
        return hit ? hit.dataset.fsbbOpt : null;
      });
      let head = "";
      let courses = 0;
      let rowLabel = "";
      if (g1Key) {
        await page.click(`[data-fsbb-opt="${g1Key}"]`);
        rowLabel = await page.$eval("#fsbbTable tbody th", (e) =>
          e.innerText.replace(/\s+/g, " "),
        );
        await page
          .click('[data-fsbb-cell][data-col="1"]:not([data-status="na"])')
          .catch(() => {});
        head = await page.textContent("[data-fsbb-headline]").catch(() => "");
        courses = (await page.$$("#fsbbCourses [data-pw]")).length;
        await page.click("[data-opt-clear]");
      }
      ok(
        g1Key &&
          /4 G1/.test(rowLabel) &&
          head.includes("join Year 1 of the 3-Year Higher Nitec") &&
          courses === 6,
        "P10-U20",
        "Previewing a 4 G1 option moves the table to the 4 G1 row; 2-Year there explains you join Year 1 of the 3-Year course and lists the 3-Year courses (" +
          key4g1.length +
          " options)",
      );
    }
    // "See where you can go" jump button under the subject list
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click("#jumpToPlan");
    await page.waitForTimeout(900);
    ok(
      (await page.evaluate(() => {
        const r = document
          .querySelector("#resultsAdviceSection")
          .getBoundingClientRect();
        return r.top < window.innerHeight * 0.5 && r.bottom > 0;
      })) &&
        (await page.evaluate(
          () => document.activeElement && document.activeElement.id,
        )) === "actionPlanTitle",
      "P10-U14",
      "The 'See where you can go' button scrolls to Your Action Plan and moves focus there",
    );
    ok(
      (await page.$("[data-fsbb-est]")) === null,
      "P10-U15",
      "No estimate note when the student is on the top row",
    );
    ok(
      (await page.$("#resultsExplorerContainer")) === null &&
        (await page.$("#improvementSuggestionsSection")) === null &&
        (await page.$("[data-choice]")) === null,
      "P10-U13",
      "The old choice cards, custom mix and separate explorer are gone",
    );

    ok(
      pageErrors.length === 0,
      "P7-1",
      `no page errors (${pageErrors[0] || "none"})`,
    );
  } catch (err) {
    // A thrown error mid-run must fail the suite, not print "All checks passed!".
    console.log(`
  ✗ RUNNER CRASHED: ${err && err.stack ? err.stack : err}`);
    FAILED++;
    FAILURES.push(`runner crashed: ${err && err.message ? err.message : err}`);
  } finally {
    await browser.close();
    console.log("\n══════════════════════════════════════════════════════");
    console.log(`Final Results: ${PASSED} PASSED / ${FAILED} FAILED`);
    if (FAILURES.length) FAILURES.forEach((f) => console.log(`  ✗ ${f}`));
    else console.log("All checks passed!");
    console.log("══════════════════════════════════════════════════════");
    process.exit(FAILED > 0 ? 1 : 0);
  }
})();
