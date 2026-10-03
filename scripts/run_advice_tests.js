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

    console.log("\nPhase 8: Action Plan UI (explorer filters, rows, mobile)");
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
      await page.selectOption("#subject", id);
      await page.waitForTimeout(200);
      await page.selectOption("#level", lvl);
      await page.waitForTimeout(200);
      await page.selectOption("#grade", grd);
      await page.fill("#rawMark", raw);
      await page.click("#addUpdateSubjectBtn");
      await page.waitForTimeout(350);
    }
    const ROWS = "#resultsExplorerContainer details[data-pw]";
    const visible = () =>
      page.$$eval(ROWS, (rs) =>
        rs
          .filter((r) => !r.classList.contains("hidden"))
          .map((r) => ({ g: r.dataset.group, s: r.dataset.status })),
      );
    const pick = (filter, value) =>
      page.click(`[data-filter="${filter}"][data-value="${value}"]`);
    ok(
      (await page.$$(ROWS)).length === 17,
      "P8-1",
      "Explorer lists all 17 pathways, open or not",
    );
    await pick("status", "further");
    let vis = await visible();
    ok(
      vis.length === 11 && vis.every((r) => r.s === "further"),
      "P8-2",
      `Status filter "Needs more work" shows only those rows (${vis.length})`,
    );
    await pick("status", "all");
    await pick("group", "JC/MI");
    vis = await visible();
    ok(
      vis.length === 2 && vis.every((r) => r.g === "JC/MI"),
      "P8-3",
      `Group filter JC/MI shows only JC and MI (${vis.length})`,
    );
    ok(
      (await page.$$eval(
        "#resultsExplorerContainer [data-gblock]",
        (bs) => bs.filter((b) => !b.classList.contains("hidden")).length,
      )) === 1,
      "P8-3b",
      "Filtering to one group hides the other stair steps",
    );
    await pick("group", "all");
    const groupSeq = await page.$$eval(ROWS, (rs) => [
      ...new Set(rs.map((r) => r.dataset.group)),
    ]);
    ok(
      groupSeq[0] === "JC/MI" &&
        groupSeq[groupSeq.length - 1] === "ITE 3-Year Higher Nitec" &&
        groupSeq.length === 5,
      "P8-3c",
      `Cards run in pathway order, JC/MI first and ITE 3-Year last (${groupSeq.join(" > ")})`,
    );
    await pick("group", "JC/MI");
    await pick("status", "open");
    ok(
      (await visible()).length === 0 &&
        (await page.isVisible("#explorerEmpty")),
      "P8-4",
      "Filters with no match show a friendly empty message",
    );
    await pick("group", "all");
    await pick("status", "all");
    await page
      .locator(`${ROWS}[data-group="JC/MI"]`)
      .first()
      .locator("summary")
      .click();
    const jcBody = await page
      .locator(`${ROWS}[data-group="JC/MI"]`)
      .first()
      .innerText();
    ok(
      /subject/i.test(jcBody) && /need/i.test(jcBody) && /marks/i.test(jcBody),
      "P8-5",
      "An out-of-reach pathway expands to a Subject / Now / Need / Marks table",
    );
    await pick("status", "quick");
    vis = await visible();
    ok(
      vis.length > 0 &&
        (await page.$$eval(`${ROWS}:not(.hidden)`, (rs) =>
          rs.every(
            (r) => r.dataset.quick === "1" && r.querySelector("[data-qw]"),
          ),
        )),
      "P8-6",
      `Quick wins filter shows only rows a single grade can open, each naming the grade change (${vis.length})`,
    );
    ok(
      (await page.$("#improvementSuggestionsSection")) === null,
      "P8-6b",
      "No separate Improvement Suggestions block remains",
    );
    await pick("status", "all");
    ok(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )),
      "P8-7",
      "No horizontal page scroll at 390px wide",
    );

    console.log(
      "\nPhase 9: Suggested plan choices, practical check, coherence",
    );
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

    // ---- UI: choices, selection, custom mix, badges ----
    const recKey = a6.recommended.key;
    const pressed = () =>
      page.$$eval("#resultsAdviceContainer [data-choice]", (bs) =>
        bs
          .filter((b) => b.getAttribute("aria-pressed") === "true")
          .map((b) => b.dataset.choice),
      );
    const panelText = () => page.textContent("#planPanel");
    const applicable = a6.choices.filter((c) => c.applicable);
    ok(
      (await page.$$("#resultsAdviceContainer [data-choice]")).length ===
        applicable.length &&
        (await page.$$("#resultsAdviceContainer [data-choice-na]")).length ===
          4 - applicable.length,
      "P9-U1",
      "Applicable choices are buttons; the others are shown greyed with a reason",
    );
    ok(
      (await pressed()).join() === recKey &&
        (await panelText()).includes(`Choice ${recKey}`) &&
        (await panelText()).includes("Does this plan make sense?") &&
        (await page.$("[data-before]")) !== null,
      "P9-U2",
      `The suggested choice (${recKey}) is pre-selected, with next steps, practical check and 'Before you decide'`,
    );
    let badgesOk = true;
    for (const c of applicable) {
      await page.click(`[data-choice="${c.key}"]`);
      const got = await page.$$eval(ROWS, (rs) => ({
        gain: rs
          .filter((r) => r.dataset.plan === "gain")
          .map((r) => r.dataset.id),
        lose: rs
          .filter((r) => r.dataset.plan === "lose")
          .map((r) => r.dataset.id),
      }));
      const same = (x, y) => [...x].sort().join() === [...y].sort().join();
      if (
        (await pressed()).join() !== c.key ||
        !(await panelText()).includes(`Choice ${c.key}`) ||
        !same(got.gain, c.gainedIds) ||
        !same(got.lose, c.lostIds)
      )
        badgesOk = false;
    }
    ok(
      badgesOk,
      "P9-U3",
      "Selecting each choice swaps the panel, and explorer badges match exactly what it opens / closes",
    );
    const dChoice = a6.choices[3];
    await page.click('[data-choice="D"]');
    const stepItems = await page.$$eval("#planPanel ol > li", (ls) =>
      ls.map((l) => l.firstChild.textContent),
    );
    ok(
      dChoice.stepList.length > 1 &&
        (await page.$$eval(
          "#planPanel [data-step-list] li",
          (l) => l.length,
        )) === dChoice.stepList.length &&
        stepItems.every((t) => t.split(/\s+/).length <= 12),
      "P9-U3b",
      `Choice D lists each lowered subject on its own line (${dChoice.stepList.length}); every step lead-in is 12 words or fewer`,
    );
    // Try your own mix
    await page.click("#customDetails summary");
    await page.click('[data-seg="MATH"][data-mode="lower"]');
    const cm = await page.evaluate(
      ([s]) => window.__spdTest.evalCustom(s, { MATH: "lower" }, "School A"),
      [W6],
    );
    const live = await page.innerText("#customLive");
    ok(
      live.startsWith(`${cm.count} pathway`) &&
        (await panelText()).includes("Your own mix"),
      "P9-U4",
      `Lowering one subject updates the live count (${live}) and the panel`,
    );
    await page.click('[data-seg="POA"][data-mode="drop"]');
    const dropDisabled = await page.$eval(
      '[data-seg="EL"][data-mode="drop"]',
      (b) => b.disabled,
    );
    await page.click('[data-seg="POA"][data-mode="keep"]');
    const dropBack = await page.$eval(
      '[data-seg="EL"][data-mode="drop"]',
      (b) => b.disabled,
    );
    ok(
      dropDisabled && !dropBack,
      "P9-U5",
      "Drop is disabled once only 5 subjects remain, and re-enabled when one is kept",
    );
    await page.click("[data-reset]");
    ok(
      (await pressed()).join() === recKey &&
        (await page.innerText("#customLive")).startsWith("Pick Keep") &&
        (await page.$("[data-reset]")) === null,
      "P9-U6",
      "'Reset to suggested' restores the suggested choice and clears the mix",
    );
    const notes = await page.$$eval("[data-plan-note]", (ns) =>
      ns.map((n) => ({ k: n.dataset.planNote, t: n.textContent })),
    );
    ok(
      notes.length > 0 &&
        notes.every(
          (n) =>
            ["part", "different", "not"].includes(n.k) &&
            (n.k !== "part" || n.t.includes(`choice ${recKey}`)) &&
            (n.k !== "different" || n.t.includes("instead of")),
        ),
      "P9-U7",
      `Level-change pathways say how they relate to the suggested plan (${notes.length} notes)`,
    );
    await page.click(
      `[data-choice="${applicable[applicable.length - 1].key}"]`,
    );
    await page.locator("[data-before] summary").click();
    ok(
      !(await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )),
      "P9-U8",
      "No horizontal scroll at 390px with the last choice and 'Before you decide' open",
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
