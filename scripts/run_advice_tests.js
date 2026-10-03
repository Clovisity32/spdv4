/**
 * Results Action Plan tests — Student Pathway Dashboard
 *
 * Exercises window.__spdTest.advise (buildResultsAdvice) with School A
 * (every subject offered; AM/BIO/CHEM/PHY/MUSIC are G3-only).
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
      S("AM", "G3", "E8"),
    ]);
    ok(
      a.options[2].moves.length === 0 &&
        a.options[2].blocked.some((s) => s.subjectId === "AM"),
      "P1-3",
      "AM is G3-only at the school, so it is flagged, not moved",
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
        tiers[4].length === 2 &&
        tiers[5].length === 3,
      "P5d-1",
      "Profile A: all 17 pathways on the staircase (4 open, 2 immediate, 6 stretch, 2 remote, 3 out of reach)",
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
        if (a.options[2].moves.some((s) => s.subjectId === "AM"))
          bad.push("AM moved down");
      }
      return bad;
    }, SCHOOL);
    ok(
      result.length === 0,
      "P6-1",
      `invariants hold (${result.slice(0, 3).join("; ") || "none violated"})`,
    );

    ok(
      pageErrors.length === 0,
      "P7-1",
      `no page errors (${pageErrors[0] || "none"})`,
    );
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
