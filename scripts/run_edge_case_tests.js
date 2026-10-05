/**
 * Edge Case Test Suite — Student Pathway Dashboard
 * Phases 1–15
 *
 * Run: node scripts/run_edge_case_tests.js
 *
 * School A is used throughout (has all subjects; level restrictions noted below):
 *   G3-only: BIO, CHEM, PHY, DS, ECON, HMT, ...
 *   G2/G3:   AM, HIST, GEOG, POA, LIT_ENG, COMB_HUM
 *   G1/G3:   MUSIC          G1-only: MOB_ROBOTICS, EBS, SMART_ELEC_TECH
 *   G3/G2/G1: EL, MATH, MT, COMB_SCI, ART, COMP, DT, NFS
 *   (levels follow SEAB 2027 via SEAB_LEVELS; School A offers all of them)
 */

const { chromium } = require("playwright");

const FILE_URL = "file:///C:/Users/Admin/Documents/spdv4/index.html";

// ── Result tracking ──────────────────────────────────────────────────────────
let PASSED = 0,
  FAILED = 0;
const FAILURES = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function reset(page, bonus = 0) {
  await page.goto(FILE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.selectOption("#school", "School A");
  await page.waitForTimeout(300);
  await page.fill("#bonus", String(bonus));
}

async function add(page, subjectId, level, grade, raw) {
  // Tick the subject in the picker, add it (it lands at G3 A1), then set its
  // level, grade and raw mark in the Your Subjects table.
  if ((await page.getAttribute("#subjectPicker", "aria-expanded")) !== "true")
    await page.click("#subjectPicker");
  await page.check('[data-pick="' + subjectId + '"]');
  await page.click("#subjectMenuAdd");
  await page.waitForTimeout(350);
  const row = '[data-subject-row="' + subjectId + '"]';
  if ((await page.inputValue(row + " [data-row-level]")) !== level) {
    await page.selectOption(row + " [data-row-level]", level);
    await page.waitForTimeout(200);
  }
  if (grade && (await page.inputValue(row + " [data-row-grade]")) !== grade) {
    await page.selectOption(row + " [data-row-grade]", grade);
    await page.waitForTimeout(200);
  }
  if (raw !== undefined) {
    await page.fill(row + " [data-row-raw]", String(raw));
    await page.press(row + " [data-row-raw]", "Tab");
    await page.waitForTimeout(200);
  }
}

async function addMany(page, subjects) {
  for (const [id, lvl, grd] of subjects) await add(page, id, lvl, grd);
}

/** Extract eligibility status, gross, net, and aggregate scores for a named pathway card. */
async function getResult(page, nameSubstr) {
  return page.evaluate((ns) => {
    const container = document.getElementById("eligibilityResultsContainer");
    if (!container) return { found: false };
    for (const h3 of container.querySelectorAll("h3")) {
      if (h3.textContent.includes(ns)) {
        const card = h3.closest('[class*="p-5"]');
        if (!card) continue;
        const ps = Array.from(card.querySelectorAll("p"));
        const status =
          (ps.find((p) => p.textContent.includes("Status:")) || {})
            .textContent || "";
        const grossP =
          (ps.find((p) => p.textContent.includes("Gross Aggregate:")) || {})
            .textContent || "";
        const netP =
          (ps.find((p) => p.textContent.includes("Net Aggregate:")) || {})
            .textContent || "";
        const aggP =
          (
            ps.find((p) =>
              p.textContent.includes("Aggregate score for posting:"),
            ) || {}
          ).textContent || "";
        const num = (t) => {
          const m = t.match(/:\s*(\d+)/);
          return m ? +m[1] : null;
        };
        return {
          found: true,
          isEligible: status.includes("You qualify"),
          isCA: status.includes("Conditional Admission"),
          status: status.trim(),
          gross: num(grossP),
          net: num(netP),
          agg: num(aggP),
        };
      }
    }
    return { found: false };
  }, nameSubstr);
}

/** Return group names in the order they appear in the DOM (top → bottom). */
async function getGroupOrder(page) {
  return page.evaluate(() => {
    const container = document.getElementById("eligibilityResultsContainer");
    return Array.from(container.querySelectorAll(".col-span-full.mb-6"))
      .map((section) => {
        const h3 = section.querySelector("h3");
        return h3 ? h3.textContent.trim() : null;
      })
      .filter(Boolean);
  });
}

/** Extract quick-win suggestions (one-grade improvements) from the page. */
async function getSuggestions(page) {
  await page.waitForTimeout(600);
  return page.evaluate(() =>
    window.__spdTest.quickWins().map((w) => ({
      subject: w.subject,
      fromGrade: w.from,
      toGrade: w.to,
      pathways: w.unlocked,
    })),
  );
}

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

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    // ════════════════════════════════════════════════════════════════════════
    // PHASE 1 — Grade Conversion Accuracy (G3 → G2 in ELR2B2 B2 slot)
    // Base: EL G3 A1, MATH G3 A1, HIST G3 A1, GEOG G3 A1.
    // Score = 1+1+1+1 + B2_g2equiv. ELR2B2-B checks this.
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 1: Grade Conversion Accuracy ──");
    const base1 = [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ];

    // [id, b2Subj, b2Level, b2Grade, expectedGross]
    // Note: CHEM/BIO/PHY are G3-only in School A so cannot be added at G2.
    // C-09/C-10 use POA at G2 (unrestricted subject, can't become R2 since R2 pool is G3 only).
    for (const [id, subj, lvl, grd, expGross] of [
      ["C-01", "CHEM", "G3", "A1", 5],
      ["C-02", "CHEM", "G3", "A2", 5],
      ["C-03", "CHEM", "G3", "B3", 5],
      ["C-04", "CHEM", "G3", "B4", 6],
      ["C-05", "CHEM", "G3", "C5", 6],
      ["C-06", "CHEM", "G3", "C6", 6],
      ["C-07", "CHEM", "G3", "D7", 7],
      ["C-08", "CHEM", "G3", "E8", 8],
      ["C-09", "POA", "G2", "1", 5],
      ["C-10", "POA", "G2", "4", 8],
    ]) {
      await reset(page);
      await addMany(page, base1);
      await add(page, subj, lvl, grd);
      const r = await getResult(page, "Business & Management");
      if (!r.found) {
        ok(false, id, "ELR2B2-B card not found");
        continue;
      }
      ok(r.isEligible, id, `ELR2B2-B Eligible`);
      ok(r.gross === expGross, id, `gross=${r.gross} expected ${expGross}`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 2a — ELR2B2 B2: F9 and G2 5/6 excluded (Fix A2)
    // ════════════════════════════════════════════════════════════════════════
    console.log(
      "\n── Phase 2a: ELR2B2 B2 invalid grade exclusions (Fix A2) ──",
    );
    // I-02/I-03 use POA G2 5/6 instead of CHEM G2 (CHEM is G3-only).
    for (const [id, subj, lvl, grd] of [
      ["I-01", "CHEM", "G3", "F9"],
      ["I-02", "POA", "G2", "5"],
      ["I-03", "POA", "G2", "6"],
    ]) {
      await reset(page);
      await addMany(page, base1);
      await add(page, subj, lvl, grd);
      const r = await getResult(page, "Business & Management");
      if (!r.found) {
        ok(false, id, "ELR2B2-B card not found");
        continue;
      }
      ok(
        !r.isEligible,
        id,
        `ELR2B2-B Not Eligible (invalid B2 grade excluded, no valid B2 remains)`,
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 2b — PFP: F9 and G2 5/6 excluded from subject pool (Fix B)
    // After exclusion only 4 valid subjects remain → PFP can't form EL+MA+B1+B2+B3.
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 2b: PFP invalid grade exclusions (Fix B) ──");
    // Base: EL G3 A1, MATH G3 A1, [bad subject], GEOG G3 A1, BIO G3 A1
    for (const [id, badSubj, badLvl, badGrd] of [
      ["I-04", "HIST", "G3", "F9"],
      ["I-05", "HIST", "G2", "5"],
      ["I-06", "HIST", "G2", "6"],
    ]) {
      await reset(page);
      await addMany(page, [
        ["EL", "G3", "A1"],
        ["MATH", "G3", "A1"],
        [badSubj, badLvl, badGrd],
        ["GEOG", "G3", "A1"],
        ["BIO", "G3", "A1"],
      ]);
      const rHum = await getResult(page, "PFP) - Humanities");
      if (!rHum.found) {
        ok(false, id, "PFP-Hum card not found");
        continue;
      }
      ok(
        !rHum.isEligible,
        id,
        `PFP-Hum Not Eligible (${badGrd} excluded, only 4 valid subjects → can't form EL+MA+B1+B2+B3)`,
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 2c — ITE 3-Year: F9 → G1 C (3pts), G2 6 → G1 D (4pts) in aggregate (Fix C)
    // ════════════════════════════════════════════════════════════════════════
    console.log(
      "\n── Phase 2c: ITE 3-Year aggregate includes F9 and G2 6 (Fix C) ──",
    );

    // I-09: 4 x G3 F9 → each maps to G1 C → 3 pts. Best4 = 12.
    await reset(page);
    await addMany(page, [
      ["HIST", "G3", "F9"],
      ["GEOG", "G3", "F9"],
      ["BIO", "G3", "F9"],
      ["MATH", "G3", "F9"],
    ]);
    {
      const r = await getResult(page, "MER (Complete SEC)");
      if (!r.found) ok(false, "I-09", "MER (Complete SEC) card not found");
      else {
        ok(
          r.isEligible,
          "I-09",
          `ITE 3-Yr Complete SEC Eligible (4 subjects, no cutoff)`,
        );
        ok(
          r.agg === 12,
          "I-09",
          `aggregate=12 expected 12 (F9→G1C=3; actual: ${r.agg})`,
        );
      }
    }

    // I-10: 4 x G2 6 → each maps to G1 D → 4 pts. Best4 = 16.
    // Replace BIO G2 6 → ART G2 6 (BIO G2 not available).
    await reset(page);
    await addMany(page, [
      ["HIST", "G2", "6"],
      ["GEOG", "G2", "6"],
      ["ART", "G2", "6"],
      ["MATH", "G2", "6"],
    ]);
    {
      const r = await getResult(page, "MER (Complete SEC)");
      if (!r.found) ok(false, "I-10", "MER (Complete SEC) card not found");
      else {
        ok(
          r.isEligible,
          "I-10",
          `ITE 3-Yr Complete SEC Eligible (4 subjects, no cutoff)`,
        );
        ok(
          r.agg === 16,
          "I-10",
          `aggregate=16 expected 16 (G2 6→G1D=4; actual: ${r.agg})`,
        );
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 3 — JC / MI Score Boundaries (L1R4, gross only, CCA irrelevant)
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 3: JC/MI Score Boundaries ──");

    // J-01: score=16 exactly → JC Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "C6"],
      ["MT", "G3", "D7"],
    ]);
    {
      const r = await getResult(page, "Junior College");
      if (!r.found) ok(false, "J-01", "JC card not found");
      else {
        ok(r.isEligible, "J-01", "JC Eligible (score=16 ≤ 16)");
        ok(r.gross === 16, "J-01", `gross=16 expected 16 (actual:${r.gross})`);
      }
    }

    // J-02: score=17 → JC Not Eligible, MI Eligible
    // Uses GEOG D7 + MT D7 so MT MER ≤ D7 is met (MT E8 would fail MT MER for both JC and MI)
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "D7"],
      ["MT", "G3", "D7"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      const mi = await getResult(page, "Millennia Institute");
      ok(!jc.isEligible, "J-02", "JC Not Eligible (score=17 > 16)");
      ok(mi.isEligible, "J-02", "MI Eligible (score=17 ≤ 20, MT MER met)");
    }

    // J-03: score=20 exactly → MI Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "B4"],
      ["MATH", "G3", "B4"],
      ["HIST", "G3", "B4"],
      ["GEOG", "G3", "B4"],
      ["MT", "G3", "B4"],
    ]);
    {
      const mi = await getResult(page, "Millennia Institute");
      ok(mi.isEligible, "J-03", "MI Eligible (score=20 ≤ 20, exact boundary)");
      ok(mi.gross === 20, "J-03", `gross=20 expected 20 (actual:${mi.gross})`);
    }

    // J-04: score=21 → Both Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "B4"],
      ["MATH", "G3", "B4"],
      ["HIST", "G3", "B4"],
      ["GEOG", "G3", "B4"],
      ["MT", "G3", "C5"],
    ]);
    {
      const mi = await getResult(page, "Millennia Institute");
      ok(!mi.isEligible, "J-04", "MI Not Eligible (score=21 > 20)");
    }

    // J-05: score=16 with CCA=2 → JC still Eligible (gross used, CCA irrelevant for JC)
    await reset(page, 2);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "C6"],
      ["MT", "G3", "D7"],
    ]);
    {
      const r = await getResult(page, "Junior College");
      ok(
        r.isEligible,
        "J-05",
        "JC Eligible even with CCA=2 (gross=16, CCA does not affect JC)",
      );
      ok(r.gross === 16, "J-05", `gross remains 16 (actual:${r.gross})`);
    }

    // J-06: Only 4 G3 subjects + MT G2 5 → R4 missing → Ineligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["MT", "G2", "5"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(
        !jc.isEligible,
        "J-06",
        "JC Not Eligible (only 4 G3 subjects, MT G2 not in L1R4)",
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 4 — JC / MI MER Requirements
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 4: JC/MI MER Requirements ──");

    // M-01: EL exactly C6 (MER threshold) → JC Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "C6"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["MT", "G3", "D7"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(jc.isEligible, "M-01", "JC Eligible (EL=C6 meets MER ≤ C6)");
      ok(jc.gross === 16, "M-01", `gross=16 expected 16 (actual:${jc.gross})`);
    }

    // M-02: EL=D7 (one below C6 threshold) → MER fails → JC+MI Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["MT", "G3", "D7"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      const mi = await getResult(page, "Millennia Institute");
      ok(!jc.isEligible, "M-02", "JC Not Eligible (EL=D7 > C6, MER fails)");
      ok(!mi.isEligible, "M-02", "MI Not Eligible (EL MER fails for MI too)");
    }

    // M-03: MATH=D7 exactly (Math MER threshold ≤ D7) → JC Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "D7"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["MT", "G3", "A1"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(jc.isEligible, "M-03", "JC Eligible (MATH=D7 meets MER ≤ D7)");
      ok(jc.gross === 11, "M-03", `gross=11 expected 11 (actual:${jc.gross})`);
    }

    // M-04: MATH=E8 → MATH MER fails; score=12 ≤ 12 → JC CA (policy: MATH failure also qualifies for CA)
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "E8"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["MT", "G3", "A1"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(
        jc.isCA,
        "M-04",
        "JC CA (MATH=E8 > D7, MATH MER fails; score=12 ≤ 12 simple threshold)",
      );
    }

    // M-05: MT G3 D7 exactly (MT MER threshold) → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["MT", "G3", "D7"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(jc.isEligible, "M-05", "JC Eligible (MT G3 D7 meets MER ≤ D7)");
    }

    // M-06: MT G3 E8 → MT MER fails; score=5 ≤ 12 → JC CA (policy: MT failure also qualifies for CA)
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["MT", "G3", "E8"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(
        jc.isCA,
        "M-06",
        "JC CA (MT G3 E8 > D7, MT MER fails; score=5 ≤ 12 simple threshold)",
      );
    }

    // M-07: MT G2 5 exactly (MT G2 MER threshold ≤ 5) → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["MT", "G2", "5"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(jc.isEligible, "M-07", "JC Eligible (MT G2 5 meets MER ≤ G2:5)");
    }

    // M-08: MT G2 6 → MT MER fails; score=5 ≤ 12 → JC CA (policy: MT failure also qualifies for CA)
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["MT", "G2", "6"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(
        jc.isCA,
        "M-08",
        "JC CA (MT G2 6 > G2:5, MT MER fails; score=5 ≤ 12 simple threshold)",
      );
    }

    // M-09: MT G1 D exactly (MT G1 MER threshold ≤ G1:D) → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["MT", "G1", "D"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(jc.isEligible, "M-09", "JC Eligible (MT G1 D meets MER ≤ G1:D)");
    }

    // M-10: MT G1 E → MT MER fails; score=5 ≤ 12 → JC CA (policy: MT failure also qualifies for CA)
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["MT", "G1", "E"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(
        jc.isCA,
        "M-10",
        "JC CA (MT G1 E > G1:D, MT MER fails; score=5 ≤ 12 simple threshold)",
      );
    }

    // M-11: Higher MT G3 E8 exactly (HMT MER threshold ≤ E8) → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["HMT", "G3", "E8"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      ok(
        jc.isEligible,
        "M-11",
        "JC Eligible (HMT G3 E8 meets MT MER via HMT option ≤ E8)",
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 5 — Conditional Admission (CA) detection
    // Not validating right/wrong — recording what the app shows.
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 5: Conditional Admission (CA) Detection ──");

    // CA-01: EL D7 (MER fail), score=11 ≤ 12 → CA threshold → JC CA or Not Eligible?
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["MT", "G3", "A1"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      const mi = await getResult(page, "Millennia Institute");
      console.log(`    CA-01 observation: JC=${jc.status} (score=${jc.gross})`);
      console.log(`    CA-01 observation: MI=${mi.status} (score=${mi.gross})`);
      ok(
        true,
        "CA-01",
        "Observation recorded (CA detection, no right/wrong assertion)",
      );
    }

    // CA-03: EL D7 (MER fail), score=13 → MI CA (13 ≤ 15 threshold) or Not Eligible?
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["MT", "G3", "B3"],
    ]);
    {
      const jc = await getResult(page, "Junior College");
      const mi = await getResult(page, "Millennia Institute");
      console.log(`    CA-03 observation: JC=${jc.status} (score=${jc.gross})`);
      console.log(`    CA-03 observation: MI=${mi.status} (score=${mi.gross})`);
      ok(
        true,
        "CA-03",
        "Observation recorded (CA detection, no right/wrong assertion)",
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 6a — Poly ELR2B2-B Score Boundary at 22/23
    // Base score before B2: EL(6)+MATH(6)+HIST(6)+BIO(1) = 19.
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 6a: Poly ELR2B2-B Score Boundary ──");

    // P-01: CHEM G3 D7 → B2 G2-equiv=3 → gross=22 ≤ 22 → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "C6"],
      ["MATH", "G3", "C6"],
      ["HIST", "G3", "C6"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "D7"],
    ]);
    {
      const r = await getResult(page, "Business & Management");
      ok(r.isEligible, "P-01", "ELR2B2-B Eligible (gross=22 ≤ 22)");
      ok(r.gross === 22, "P-01", `gross=22 expected 22 (actual:${r.gross})`);
    }

    // P-02: CHEM G3 E8 → B2 G2-equiv=4 → gross=23 > 22 → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "C6"],
      ["MATH", "G3", "C6"],
      ["HIST", "G3", "C6"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "E8"],
    ]);
    {
      const r = await getResult(page, "Business & Management");
      ok(!r.isEligible, "P-02", "ELR2B2-B Not Eligible (gross=23 > 22)");
      ok(r.gross === 23, "P-02", `gross=23 expected 23 (actual:${r.gross})`);
    }

    // P-03: CHEM D7 + CCA=1 → net=21 ≤ 22 → Eligible
    await reset(page, 1);
    await addMany(page, [
      ["EL", "G3", "C6"],
      ["MATH", "G3", "C6"],
      ["HIST", "G3", "C6"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "D7"],
    ]);
    {
      const r = await getResult(page, "Business & Management");
      ok(
        r.isEligible,
        "P-03",
        "ELR2B2-B Eligible (gross=22, CCA=1 → net=21 ≤ 22)",
      );
      ok(r.net === 21, "P-03", `net=21 expected 21 (actual:${r.net})`);
    }

    // P-04: CHEM E8 + CCA=2 → gross=23 → net=21 ≤ 22 → Eligible (CCA saves it)
    await reset(page, 2);
    await addMany(page, [
      ["EL", "G3", "C6"],
      ["MATH", "G3", "C6"],
      ["HIST", "G3", "C6"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "E8"],
    ]);
    {
      const r = await getResult(page, "Business & Management");
      ok(
        r.isEligible,
        "P-04",
        "ELR2B2-B Eligible (gross=23, CCA=2 → net=21 ≤ 22)",
      );
      ok(r.net === 21, "P-04", `net=21 expected 21 (actual:${r.net})`);
    }

    // P-05: CHEM E8 + CCA=1 → gross=23 → net=22 ≤ 22 (exact boundary) → Eligible
    await reset(page, 1);
    await addMany(page, [
      ["EL", "G3", "C6"],
      ["MATH", "G3", "C6"],
      ["HIST", "G3", "C6"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "E8"],
    ]);
    {
      const r = await getResult(page, "Business & Management");
      ok(
        r.isEligible,
        "P-05",
        "ELR2B2-B Eligible (gross=23, CCA=1 → net=22 ≤ 22, exact boundary)",
      );
      ok(r.net === 22, "P-05", `net=22 expected 22 (actual:${r.net})`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 6b — Nursing Pathway (Fix D): separate card at net ≤ 24
    // EL G3 D7(7), MATH G3 C6(6), BIO G3 C6(6) [R2 for ELR2B2-C], + B1/B2 vary.
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 6b: Nursing Pathway Boundary (Fix D) ──");

    // P-06: gross=23 → General ELR2B2-C Not Eligible (>22), Nursing Eligible (≤24)
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "C6"],
      ["BIO", "G3", "C6"],
      ["HIST", "G3", "B3"],
      ["GEOG", "G3", "B3"],
    ]);
    {
      const gen = await getResult(page, "Sciences, Engineering");
      const nur = await getResult(page, "Nursing courses only");
      ok(
        !gen.isEligible,
        "P-06",
        "ELR2B2-C General Not Eligible (gross=23 > 22)",
      );
      ok(
        nur.isEligible,
        "P-06",
        "Nursing Eligible (gross=23 ≤ 24, Fix D — separate card)",
      );
      ok(
        nur.gross === 23,
        "P-06",
        `Nursing gross=23 expected 23 (actual:${nur.gross})`,
      );
    }

    // P-07: gross=24 → Nursing Eligible (exact boundary)
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "C6"],
      ["BIO", "G3", "C6"],
      ["HIST", "G3", "B3"],
      ["GEOG", "G3", "B4"],
    ]);
    {
      const nur = await getResult(page, "Nursing courses only");
      ok(
        nur.isEligible,
        "P-07",
        "Nursing Eligible (gross=24 ≤ 24, exact boundary)",
      );
      ok(
        nur.gross === 24,
        "P-07",
        `Nursing gross=24 expected 24 (actual:${nur.gross})`,
      );
    }

    // P-08: gross=25 → Nursing Not Eligible (>24)
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "C6"],
      ["BIO", "G3", "C6"],
      ["HIST", "G3", "B4"],
      ["GEOG", "G3", "B4"],
    ]);
    {
      const nur = await getResult(page, "Nursing courses only");
      ok(!nur.isEligible, "P-08", "Nursing Not Eligible (gross=25 > 24)");
      ok(
        nur.gross === 25,
        "P-08",
        `Nursing gross=25 expected 25 (actual:${nur.gross})`,
      );
    }

    // P-09: GEOG G2 5 as B2 → excluded by Fix A2 → no valid B2 → Ineligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "C6"],
      ["BIO", "G3", "C6"],
      ["HIST", "G3", "B3"],
      ["GEOG", "G2", "5"],
    ]);
    {
      const nur = await getResult(page, "Nursing courses only");
      ok(
        !nur.isEligible,
        "P-09",
        "Nursing Not Eligible (GEOG G2 5 excluded from B2 pool, Fix A2 applies to Nursing too)",
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 7 — ELR2B2 Subject Role / MER Edge Cases
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 7: ELR2B2 Subject Role Edge Cases ──");

    // R-03: ELR2B2-D normal pass
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "Design & Built");
      ok(r.isEligible, "R-03", "ELR2B2-D Eligible (normal pass)");
    }

    // R-04: MATH G3 D7 → ELR2B2-B R1 MER ≤ C6 fails (7>6), but ELR2B2-D R1 MER ≤ D7 passes
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "D7"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
    ]);
    {
      const rb = await getResult(page, "Business & Management");
      const rd = await getResult(page, "Design & Built");
      ok(
        !rb.isEligible,
        "R-04",
        "ELR2B2-B Not Eligible (R1 MATH D7 > C6, MER fails)",
      );
      ok(rd.isEligible, "R-04", "ELR2B2-D Eligible (R1 MATH D7 ≤ D7, MER met)");
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 8 — PFP ELMAB3 Edge Cases
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 8: PFP ELMAB3 Edge Cases ──");

    // F-01: PFP-Hum boundary at 12 → Eligible
    // EL G3 D7(→G2:3) + MATH G3 D7(→G2:3) + GEOG G3 B4(→G2:2, B1 relevant) + BIO G3 B4(→G2:2) + CHEM G3 B4(→G2:2)
    // Score = 3+3+2+2+2 = 12
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "D7"],
      ["GEOG", "G3", "B4"],
      ["BIO", "G3", "B4"],
      ["CHEM", "G3", "B4"],
    ]);
    {
      const r = await getResult(page, "PFP) - Humanities");
      if (!r.found) ok(false, "F-01", "PFP-Hum card not found");
      else {
        ok(r.isEligible, "F-01", "PFP-Hum Eligible (score=12 ≤ 12)");
        ok(r.gross === 12, "F-01", `gross=12 expected 12 (actual:${r.gross})`);
      }
    }

    // F-02: PFP-Hum score=13 → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "D7"],
      ["GEOG", "G3", "B4"],
      ["BIO", "G3", "B4"],
      ["CHEM", "G3", "D7"],
    ]);
    {
      const r = await getResult(page, "PFP) - Humanities");
      if (!r.found) ok(false, "F-02", "PFP-Hum card not found");
      else {
        ok(!r.isEligible, "F-02", "PFP-Hum Not Eligible (score=13 > 12)");
        ok(r.gross === 13, "F-02", `gross=13 expected 13 (actual:${r.gross})`);
      }
    }

    // F-05: HIST as relevant B1 for PFP-Hum → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "PFP) - Humanities");
      ok(
        r.isEligible,
        "F-05",
        "PFP-Hum Eligible (HIST as relevant B1, score=5)",
      );
    }

    // F-06: DT as relevant B1 for PFP-SciTech → SciTech Eligible; PFP-Hum DT not relevant → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["DT", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "A1"],
    ]);
    {
      const sci = await getResult(page, "PFP) - Science");
      const hum = await getResult(page, "PFP) - Humanities");
      ok(sci.isEligible, "F-06", "PFP-SciTech Eligible (DT is relevant)");
      ok(
        !hum.isEligible,
        "F-06",
        "PFP-Hum Not Eligible (DT not in Hum relevant list → no relevant B1)",
      );
    }

    // F-07: BIO+CHEM+PHY only (no relevant subject for either cluster) → Both Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "A1"],
      ["PHY", "G3", "A1"],
    ]);
    {
      const sci = await getResult(page, "PFP) - Science");
      const hum = await getResult(page, "PFP) - Humanities");
      ok(
        !sci.isEligible,
        "F-07",
        "PFP-SciTech Not Eligible (no DT/NFS/COMB_SCI)",
      );
      ok(
        !hum.isEligible,
        "F-07",
        "PFP-Hum Not Eligible (no Hum relevant subject)",
      );
    }

    // F-08: DT G3 E8 (→G2:4 > 3) → relevant_subj MER fails for PFP-SciTech → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["DT", "G3", "E8"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "A1"],
    ]);
    {
      const sci = await getResult(page, "PFP) - Science");
      ok(
        !sci.isEligible,
        "F-08",
        "PFP-SciTech Not Eligible (DT E8→G2:4 > MER threshold G2:3 for relevant_subj)",
      );
    }

    // F-12: HIST G3 F9 excluded but 5 other valid subjects remain → PFP-Hum Eligible
    // EL G3 A1, MATH G3 A1, GEOG G3 A1, BIO G3 A1, CHEM G3 A1, HIST G3 F9
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "A1"],
      ["HIST", "G3", "F9"],
    ]);
    {
      const r = await getResult(page, "PFP) - Humanities");
      ok(
        r.isEligible,
        "F-12",
        "PFP-Hum Eligible (HIST F9 excluded but 5 valid remain; B1=GEOG, B2=BIO, B3=CHEM; score=5)",
      );
      ok(r.gross === 5, "F-12", `gross=5 expected 5 (actual:${r.gross})`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 9 — ITE 3-Year Higher Nitec Pathways
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 9: ITE 3-Year Higher Nitec Pathway MER ──");

    // BS2-1: 4 subjects → Complete SEC MER met → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Complete SEC)");
      ok(r.isEligible, "BS2-1", "ITE Complete SEC Eligible (4 subjects ≥ 4)");
    }

    // BS2-2: only 3 subjects → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Complete SEC)");
      ok(
        !r.isEligible,
        "BS2-2",
        "ITE Complete SEC Not Eligible (3 subjects < 4)",
      );
    }

    // BS2-3: 4 x G3 F9 → MER met (count=4), aggregate=12
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "F9"],
      ["MATH", "G3", "F9"],
      ["HIST", "G3", "F9"],
      ["GEOG", "G3", "F9"],
    ]);
    {
      const r = await getResult(page, "MER (Complete SEC)");
      ok(
        r.isEligible,
        "BS2-3",
        "ITE Complete SEC Eligible (4 F9 subjects, count MER met)",
      );
      ok(r.agg === 12, "BS2-3", `aggregate=12 (4×G3F9→G1C=3; actual:${r.agg})`);
    }

    // BS1-1: EL pass → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass EL)");
      ok(r.isEligible, "BS1-1", "ITE Pass EL Eligible");
    }

    // BS1-2: EL G3 F9 → fails EL pass → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "F9"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass EL)");
      ok(
        !r.isEligible,
        "BS1-2",
        "ITE Pass EL Not Eligible (EL G3 F9 fails pass)",
      );
    }

    // BS1-3: EL G2 5 → G2 ≤ 5 = pass → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G2", "5"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass EL)");
      ok(r.isEligible, "BS1-3", "ITE Pass EL Eligible (EL G2 5 = pass ≤ 5)");
    }

    // ENG-1: MATH pass → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass Math)");
      ok(r.isEligible, "ENG-1", "ITE Pass Math Eligible");
    }

    // ENG-2: MATH G3 F9 → fails → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "F9"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass Math)");
      ok(
        !r.isEligible,
        "ENG-2",
        "ITE Pass Math Not Eligible (MATH G3 F9 fails pass)",
      );
    }

    // ENG-3: MATH G2 5 → pass → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G2", "5"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass Math)");
      ok(
        r.isEligible,
        "ENG-3",
        "ITE Pass Math Eligible (MATH G2 5 = pass ≤ 5)",
      );
    }

    // HS1-1: MATH satisfies Math/Sci → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass Math or Science)");
      ok(r.isEligible, "HS1-1", "ITE Pass Math/Sci Eligible (MATH satisfies)");
    }

    // HS1-2: BIO satisfies Science → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass Math or Science)");
      ok(
        r.isEligible,
        "HS1-2",
        "ITE Pass Math/Sci Eligible (BIO satisfies science)",
      );
    }

    // HS1-3: MOB_ROBOTICS G1 A (science-in-lieu) → satisfies Math/Sci → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MOB_ROBOTICS", "G1", "A"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass Math or Science)");
      ok(
        r.isEligible,
        "HS1-3",
        "ITE Pass Math/Sci Eligible (MOB_ROBOTICS G1 A as science-in-lieu)",
      );
    }

    // HS1-4: Only humanities, no Math/Sci → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["COMB_HUM", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass Math or Science)");
      ok(
        !r.isEligible,
        "HS1-4",
        "ITE Pass Math/Sci Not Eligible (no Math/Sci subject)",
      );
    }

    // HS2-1: EL and MATH both pass → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass EL & Math)");
      ok(r.isEligible, "HS2-1", "ITE Pass EL & Math Eligible");
    }

    // HS2-2: EL G3 F9 fails → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "F9"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass EL & Math)");
      ok(
        !r.isEligible,
        "HS2-2",
        "ITE Pass EL & Math Not Eligible (EL F9 fails)",
      );
    }

    // HS2-3: MATH G3 F9 fails → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "F9"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
    ]);
    {
      const r = await getResult(page, "MER (Pass EL & Math)");
      ok(
        !r.isEligible,
        "HS2-3",
        "ITE Pass EL & Math Not Eligible (MATH F9 fails)",
      );
    }

    // HOSP-1: 2 G3 subjects ≤ E8 → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "E8"],
      ["MATH", "G3", "E8"],
      ["ART", "G1", "A"],
      ["COMP", "G1", "A"],
    ]);
    {
      const r = await getResult(page, "MER (Pass 2G3)");
      ok(
        r.isEligible,
        "HOSP-1",
        "ITE Pass 2G3 Eligible (EL E8 + MATH E8 = 2 G3 passes)",
      );
    }

    // HOSP-2: MATH G3 F9 fails, but EL E8 + HIST E8 = 2 valid G3 passes → Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "E8"],
      ["MATH", "G3", "F9"],
      ["HIST", "G3", "E8"],
      ["COMP", "G1", "A"],
    ]);
    {
      const r = await getResult(page, "MER (Pass 2G3)");
      ok(
        r.isEligible,
        "HOSP-2",
        "ITE Pass 2G3 Eligible (EL E8 + HIST E8 = 2 G3 passes despite MATH F9)",
      );
    }

    // HOSP-3: Only 1 G3 ≤ E8 → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "E8"],
      ["MATH", "G1", "A"],
      ["ART", "G1", "A"],
      ["COMP", "G1", "A"],
    ]);
    {
      const r = await getResult(page, "MER (Pass 2G3)");
      ok(!r.isEligible, "HOSP-3", "ITE Pass 2G3 Not Eligible (only 1 G3 ≤ E8)");
    }

    // HOSP-4: All G3 F9 → 0 valid G3 passes → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "F9"],
      ["MATH", "G3", "F9"],
      ["HIST", "G3", "F9"],
      ["GEOG", "G3", "F9"],
    ]);
    {
      const r = await getResult(page, "MER (Pass 2G3)");
      ok(
        !r.isEligible,
        "HOSP-4",
        "ITE Pass 2G3 Not Eligible (all G3 F9, 0 G3 passes)",
      );
    }

    // G1E-1: 4 x G1 E → Best4 = 4×5 = 20 (G1 E allowed in ITE 3-Yr aggregate)
    // BIO G1 not available → use NFS G1 E (HIST/GEOG/ECON are not assessed at G1)
    await reset(page);
    await addMany(page, [
      ["ART", "G1", "E"],
      ["COMP", "G1", "E"],
      ["NFS", "G1", "E"],
      ["MATH", "G1", "E"],
    ]);
    {
      const r = await getResult(page, "MER (Complete SEC)");
      ok(r.isEligible, "G1E-1", "ITE Complete SEC Eligible (4 G1 E subjects)");
      ok(
        r.agg === 20,
        "G1E-1",
        `aggregate=20 expected 20 (G1E=5pts; actual:${r.agg})`,
      );
    }

    // G1E-2: HIST G1 D + 3 x G1 E → Best4 = 4+5+5+5 = 19
    // BIO G1 not available → use NFS G1 E (HIST/GEOG/ECON are not assessed at G1)
    await reset(page);
    await addMany(page, [
      ["ART", "G1", "D"],
      ["COMP", "G1", "E"],
      ["NFS", "G1", "E"],
      ["MATH", "G1", "E"],
    ]);
    {
      const r = await getResult(page, "MER (Complete SEC)");
      ok(r.isEligible, "G1E-2", "ITE Complete SEC Eligible");
      ok(
        r.agg === 19,
        "G1E-2",
        `aggregate=19 expected 19 (D=4,E=5; actual:${r.agg})`,
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 10 — ITE Year 2 Higher Nitec
    // Two clusters: Applied Science/Eng/ICT (EL MER ≤ G2:4) and Biz/Services/Hosp (EL MER ≤ G2:3).
    // Same ELMAB3 exclusions as PFP: G3 grade 9 and G2 grades 5–6 cannot be used.
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 10: ITE Year 2 Higher Nitec ──");

    // ITE2-01: Score=19 boundary → Applied Sci Eligible; Biz Not Eligible (EL G2:4 > Biz MER ≤ 3)
    // EL G3 E8(→G2:4) + MA G3 E8(→G2:4) + HIST G3 E8(→G2:4) + GEOG G3 E8(→G2:4) + CHEM G3 D7(→G2:3)
    // Score = 4+4+4+4+3 = 19
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "E8"],
      ["MATH", "G3", "E8"],
      ["HIST", "G3", "E8"],
      ["GEOG", "G3", "E8"],
      ["CHEM", "G3", "D7"],
    ]);
    {
      const applied = await getResult(page, "Applied Science, Engineering");
      const biz = await getResult(page, "Business, Services");
      ok(
        applied.isEligible,
        "ITE2-01",
        `Applied Sci Eligible at score=19 boundary (actual:${applied.gross})`,
      );
      ok(
        applied.gross === 19,
        "ITE2-01",
        `Applied Sci gross=19 expected 19 (actual:${applied.gross})`,
      );
      ok(
        !biz.isEligible,
        "ITE2-01",
        "Biz Not Eligible (EL G2:4 > Biz MER threshold G2:3)",
      );
    }

    // ITE2-02: Score=20 → Both pathways Not Eligible (score > 19)
    // EL G3 E8(→G2:4) × 5 = 20
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "E8"],
      ["MATH", "G3", "E8"],
      ["HIST", "G3", "E8"],
      ["GEOG", "G3", "E8"],
      ["CHEM", "G3", "E8"],
    ]);
    {
      const applied = await getResult(page, "Applied Science, Engineering");
      const biz = await getResult(page, "Business, Services");
      ok(
        !applied.isEligible,
        "ITE2-02",
        `Applied Sci Not Eligible (score=20 > 19; actual:${applied.gross})`,
      );
      ok(
        !biz.isEligible,
        "ITE2-02",
        `Biz Not Eligible (score=20 > 19; actual:${biz.gross})`,
      );
    }

    // ITE2-03: G3 F9 is excluded from ELMAB3 computation for ITE Year 2 and PFP alike
    // EL G3 A1 + MA G3 A1 + HIST G3 F9 (excluded) + GEOG G3 D7 + BIO G3 D7
    // Only 2 valid B subjects remain → ITE Year 2 needs 3 → Not Eligible
    // PFP-Hum: only 4 valid subjects → insufficient B subjects → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "F9"],
      ["GEOG", "G3", "D7"],
      ["BIO", "G3", "D7"],
    ]);
    {
      const applied = await getResult(page, "Applied Science, Engineering");
      const pfp = await getResult(page, "PFP) - Humanities");
      ok(
        !applied.isEligible,
        "ITE2-03",
        `Applied Sci Not Eligible (HIST G3 F9 excluded → <3 B subjects; gross=${applied.gross})`,
      );
      ok(
        !pfp.isEligible,
        "ITE2-03",
        "PFP-Hum Not Eligible (G3 F9 excluded from PFP → insufficient B subjects)",
      );
    }

    // ITE2-04: EL G2 5 fails MER for both clusters
    // EL G2 5 + MA G3 A1(→G2:1) + HIST/GEOG/BIO G3 A1(→G2:1 each) → Score=5+1+1+1+1=9 ≤ 19
    // Applied Sci: EL G2:5 > 4 → Not Eligible; Biz: EL G2:5 > 3 → Not Eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G2", "5"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
    ]);
    {
      const applied = await getResult(page, "Applied Science, Engineering");
      const biz = await getResult(page, "Business, Services");
      ok(
        !applied.isEligible,
        "ITE2-04",
        "Applied Sci Not Eligible (EL G2:5 > MER threshold G2:4)",
      );
      ok(
        !biz.isEligible,
        "ITE2-04",
        "Biz Not Eligible (EL G2:5 > MER threshold G2:3)",
      );
    }

    // ITE2-05: EL G3 E8(→G2:4) passes Applied Sci MER (≤4) but fails Biz MER (≤3)
    // EL G3 E8(→G2:4) + MA G3 A1 + HIST/GEOG/BIO G3 A1 → Score=4+1+1+1+1=8 ≤ 19
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "E8"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
    ]);
    {
      const applied = await getResult(page, "Applied Science, Engineering");
      const biz = await getResult(page, "Business, Services");
      ok(
        applied.isEligible,
        "ITE2-05",
        "Applied Sci Eligible (EL G2:4 ≤ MER threshold G2:4)",
      );
      ok(
        !biz.isEligible,
        "ITE2-05",
        "Biz Not Eligible (EL G2:4 > Biz MER threshold G2:3)",
      );
    }

    // ITE2-06: G2 grade 5 is excluded from the aggregate; next-best subject used instead
    // EL G3 A1 + MA G3 A1 + [HIST G2 5 excluded] + GEOG/BIO/CHEM G3 D7 (G2:3 each) → 1+1+9 = 11
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G2", "5"],
      ["GEOG", "G3", "D7"],
      ["BIO", "G3", "D7"],
      ["CHEM", "G3", "D7"],
    ]);
    {
      const applied = await getResult(page, "Applied Science, Engineering");
      ok(
        applied.isEligible && applied.gross === 11,
        "ITE2-06",
        `Applied Sci gross=11 with HIST G2 5 excluded (actual:${applied.gross})`,
      );
    }

    // ITE2-07: B subjects ranked on G2-equivalent grade (G3 C5 = G2:2 beats G2 4)
    // EL G3 A1 + MA G3 A1 + GEOG/BIO/CHEM G3 C5 (G2:2 each) + HIST G2 4 unused → 1+1+6 = 8
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G2", "4"],
      ["GEOG", "G3", "C5"],
      ["BIO", "G3", "C5"],
      ["CHEM", "G3", "C5"],
    ]);
    {
      const applied = await getResult(page, "Applied Science, Engineering");
      ok(
        applied.gross === 8,
        "ITE2-07",
        `Applied Sci gross=8 (G3 C5 ranked as G2:2; actual:${applied.gross})`,
      );
    }

    // MER-F9: EL G3 F9 / EL G2 6 can neither be computed nor fulfil a MER → all ELMAB3 Not Eligible
    for (const [lvl, gr] of [
      ["G3", "F9"],
      ["G2", "6"],
    ]) {
      await reset(page);
      await addMany(page, [
        ["EL", lvl, gr],
        ["MATH", "G3", "A1"],
        ["HIST", "G3", "A1"],
        ["GEOG", "G3", "A1"],
        ["BIO", "G3", "A1"],
      ]);
      const applied = await getResult(page, "Applied Science, Engineering");
      const biz = await getResult(page, "Business, Services");
      const pfp = await getResult(page, "PFP) - Humanities");
      ok(
        !applied.isEligible && !biz.isEligible && !pfp.isEligible,
        "MER-F9",
        `EL ${lvl} ${gr} → ITE Yr2 + PFP Not Eligible`,
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 11 — CCA Bonus Points
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 11: CCA Bonus Points ──");

    // CCA-01: ELR2B2-B gross=22, CCA=2 → net=20 → Eligible
    await reset(page, 2);
    await addMany(page, [
      ["EL", "G3", "C6"],
      ["MATH", "G3", "C6"],
      ["HIST", "G3", "C6"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "D7"],
    ]);
    {
      const r = await getResult(page, "Business & Management");
      ok(
        r.isEligible,
        "CCA-01",
        "ELR2B2-B Eligible (gross=22, CCA=2 → net=20 ≤ 22)",
      );
      ok(
        r.gross === 22 && r.net === 20,
        "CCA-01",
        `gross=22/net=20 (actual: ${r.gross}/${r.net})`,
      );
    }

    // CCA-02: ELR2B2-B gross=23, CCA=1 → net=22 → Eligible
    await reset(page, 1);
    await addMany(page, [
      ["EL", "G3", "C6"],
      ["MATH", "G3", "C6"],
      ["HIST", "G3", "C6"],
      ["BIO", "G3", "A1"],
      ["CHEM", "G3", "E8"],
    ]);
    {
      const r = await getResult(page, "Business & Management");
      ok(
        r.isEligible,
        "CCA-02",
        "ELR2B2-B Eligible (gross=23, CCA=1 → net=22 ≤ 22)",
      );
      ok(r.net === 22, "CCA-02", `net=22 (actual:${r.net})`);
    }

    // CCA-03: JC gross=16, CCA=2 → JC still Eligible (CCA does NOT affect JC gross threshold)
    await reset(page, 2);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "C6"],
      ["MT", "G3", "D7"],
    ]);
    {
      const r = await getResult(page, "Junior College");
      ok(
        r.isEligible,
        "CCA-03",
        "JC Eligible (gross=16, CCA=2 irrelevant — JC uses gross threshold)",
      );
      ok(r.gross === 16, "CCA-03", `gross=16 unchanged (actual:${r.gross})`);
    }

    // CCA-04: PFP gross=12, CCA=2 → PFP still Eligible (CCA does NOT affect PFP gross threshold)
    await reset(page, 2);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "D7"],
      ["GEOG", "G3", "B4"],
      ["BIO", "G3", "B4"],
      ["CHEM", "G3", "B4"],
    ]);
    {
      const r = await getResult(page, "PFP) - Humanities");
      ok(
        r.isEligible,
        "CCA-04",
        "PFP-Hum Eligible (gross=12, CCA=2 irrelevant — PFP uses gross threshold)",
      );
      ok(r.gross === 12, "CCA-04", `gross=12 unchanged (actual:${r.gross})`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 12 — G1 Mother Tongue Exclusion from PFP ELMAB3
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 12: G1 Mother Tongue Exclusion ──");

    // MT-01: G1 MT only adds 4 subjects (EL+MATH+HIST+GEOG valid, MT G1 excluded)
    // PFP-Hum: need EL+MA+B1(relevant)+B2+B3 but only B1(HIST/GEOG) + 1 other → Ineligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["MT", "G1", "A"],
    ]);
    {
      const r = await getResult(page, "PFP) - Humanities");
      ok(
        !r.isEligible,
        "MT-01",
        "PFP-Hum Not Eligible (G1 MT excluded → only 4 valid subjects, need 2 B-others but only 1 remains)",
      );
    }

    // MT-03: G1 MT + 5 valid → score=5 (MT G1 not counted)
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["BIO", "G3", "A1"],
      ["MT", "G1", "A"],
    ]);
    {
      const r = await getResult(page, "PFP) - Humanities");
      ok(
        r.isEligible,
        "MT-03",
        "PFP-Hum Eligible (MT G1 excluded; 5 valid subjects remain; score=5)",
      );
      ok(
        r.gross === 5,
        "MT-03",
        `gross=5 expected 5 (G1 MT not counted; actual:${r.gross})`,
      );
    }

    // MT-04: ITE 2-Yr: G1 MT excluded → 4 subjects remain, need EL+MA+3others but only 2 others → Ineligible
    await reset(page);
    await addMany(page, [
      ["EL", "G2", "1"],
      ["MATH", "G2", "1"],
      ["HIST", "G2", "1"],
      ["GEOG", "G2", "1"],
      ["MT", "G1", "A"],
    ]);
    {
      const r = await getResult(page, "Applied Science");
      ok(
        !r.isEligible,
        "MT-04",
        "ITE 2-Yr Not Eligible (G1 MT excluded → only 2 B-others, need 3)",
      );
    }

    // ════════════════════════════════════════════════════════════════════════
    // PHASE 13 — Improvement Suggestions
    // Tests that single-grade improvements produce correct suggestion cards.
    // Only suggestions that unlock NEW pathways appear in the UI.
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 13: Improvement Suggestions ──");

    // SUG-01: EL D7 drag score to 17 → JC/MI not eligible.
    // Improving EL D7→C6 drops score to 16 and fixes EL MER → unlocks JC (and MI).
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "A1"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["MT", "G3", "D7"],
    ]);
    {
      const sugs = await getSuggestions(page);
      const elSug = sugs.find(
        (s) =>
          s.subject === "English Language" &&
          s.fromGrade.includes("D7") &&
          s.toGrade.includes("C6"),
      );
      ok(
        !!elSug,
        "SUG-01",
        `Suggestion to improve English Language D7→C6 exists (found ${sugs.length} suggestions)`,
      );
      ok(
        !!(elSug && elSug.pathways.some((p) => p.includes("Junior College"))),
        "SUG-01",
        "EL D7→C6 suggestion lists Junior College (JC) as unlocked pathway",
      );
    }

    // SUG-02: MATH E8 fails MER → MI not eligible (score=18 ≤ 20 but MATH MER fails).
    // Improving MATH E8→D7 fixes MATH MER → unlocks Millennia Institute.
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "A1"],
      ["MATH", "G3", "E8"],
      ["HIST", "G3", "A1"],
      ["GEOG", "G3", "A1"],
      ["MT", "G3", "D7"],
    ]);
    {
      const sugs = await getSuggestions(page);
      const mathSug = sugs.find(
        (s) =>
          s.subject === "Mathematics" &&
          s.fromGrade.includes("E8") &&
          s.toGrade.includes("D7"),
      );
      ok(
        !!mathSug,
        "SUG-02",
        `Suggestion to improve Mathematics E8→D7 exists (found ${sugs.length} suggestions)`,
      );
      ok(
        !!(
          mathSug &&
          mathSug.pathways.some((p) => p.includes("Millennia Institute"))
        ),
        "SUG-02",
        "MATH E8→D7 suggestion lists Millennia Institute (MI) as unlocked pathway",
      );
    }

    // SUG-03: PFP-Hum score=13 > 12 → not eligible.
    // Improving any of EL/MATH/HIST by 1 grade drops score to 12 → PFP-Hum eligible.
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "D7"],
      ["HIST", "G3", "D7"],
      ["GEOG", "G3", "C6"],
      ["CHEM", "G3", "C6"],
    ]);
    {
      const sugs = await getSuggestions(page);
      const pfpSug = sugs.find((s) =>
        s.pathways.some((p) => p.includes("Foundation Programme")),
      );
      ok(
        !!pfpSug,
        "SUG-03",
        `At least one suggestion unlocks PFP pathway (found ${sugs.length} suggestions)`,
      );
      if (pfpSug) {
        ok(
          pfpSug.pathways.some((p) => p.includes("Humanities")),
          "SUG-03",
          `PFP-Hum listed in suggestion for subject "${pfpSug.subject}" (${pfpSug.fromGrade}→${pfpSug.toGrade})`,
        );
      } else {
        ok(false, "SUG-03", "PFP-Hum not found in any suggestion pathways");
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // Phase 14: Fixed group order, collapsed not-eligible cards
    // Groups always run JC/MI → Polytechnic → PFP → ITE Year 2 → ITE 3-Year,
    // whatever is eligible. Eligible cards start open; others start collapsed
    // to their header (name + status) and open on click.
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 14: Fixed track order, collapsible tracks ──");
    const FIXED_ORDER = [
      "JC/MI",
      "Polytechnic Year 1",
      "PFP",
      "ITE Year 2 Higher Nitec",
      "ITE 3-Year Higher Nitec",
    ];
    const trackStates = (page) =>
      page.evaluate(() =>
        Array.from(
          document.querySelectorAll(
            "#eligibilityResultsContainer > details[data-track]",
          ),
        ).map((d) => {
          const cards = Array.from(d.querySelectorAll('[class*="p-5"]'));
          return {
            track: d.dataset.track,
            open: d.open,
            cards: cards.length,
            eligibleCards: cards.filter((c) =>
              c.textContent.includes("Status: You qualify"),
            ).length,
            status: d.querySelector("[data-track-status]").textContent.trim(),
          };
        }),
      );

    // SORT-01: JC/MI stays first although only ITE is eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "E8"],
      ["MATH", "G3", "C6"],
      ["BIO", "G3", "C6"],
      ["HIST", "G3", "B4"],
      ["GEOG", "G3", "B4"],
    ]);
    {
      const order = await getGroupOrder(page);
      const jc = await getResult(page, "Junior College");
      const ite = await getResult(page, "MER (Complete SEC)");
      ok(
        order.join("|") === FIXED_ORDER.join("|") &&
          !jc.isEligible &&
          ite.isEligible,
        "SORT-01",
        `Order stays JC/MI → ITE 3-Year even though only ITE is eligible (${order.join(" > ")})`,
      );
    }
    // SORT-02: another mix of eligible groups, same fixed order
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "C6"],
      ["BIO", "G3", "C6"],
      ["HIST", "G3", "B4"],
      ["GEOG", "G3", "B4"],
    ]);
    {
      const order = await getGroupOrder(page);
      ok(
        order.join("|") === FIXED_ORDER.join("|"),
        "SORT-02",
        "Order is unchanged when PFP and ITE are the eligible groups",
      );
    }
    // SORT-03: nothing but ITE 3-Year eligible
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "E8"],
      ["MATH", "G3", "E8"],
      ["HIST", "G3", "E8"],
      ["GEOG", "G3", "E8"],
      ["CHEM", "G3", "E8"],
    ]);
    {
      const order = await getGroupOrder(page);
      ok(
        order.join("|") === FIXED_ORDER.join("|"),
        "SORT-03",
        "Order is unchanged when ITE 3-Year is the only eligible group",
      );
    }

    // CARD-01: a track with something eligible starts open; the rest start collapsed
    await page.click("#eligShowAll");
    const states = await trackStates(page);
    ok(
      states.length === 5 &&
        states.some((s) => s.open) &&
        states.some((s) => !s.open) &&
        states.every((s) =>
          s.eligibleCards > 0
            ? s.open &&
              s.status ===
                "You qualify for " + s.eligibleCards + " of " + s.cards
            : !s.open && s.status === "Not yet",
        ),
      "CARD-01",
      "A track with an eligible pathway starts open and says how many; a track with none starts collapsed and says 'Not yet' (" +
        states
          .map((s) => s.track + ":" + (s.open ? "open" : "closed"))
          .join(", ") +
        ")",
    );
    // CARD-02: a collapsed track still shows its name and status, but not its cards
    const closed = states.find((s) => !s.open);
    const tsel =
      '#eligibilityResultsContainer > details[data-track="' +
      closed.track +
      '"]';
    ok(
      (await page.isVisible(tsel + " > summary h3")) &&
        (await page.isVisible(tsel + " > summary [data-track-status]")) &&
        !(await page.isVisible(tsel + ' [class*="p-5"] h3')),
      "CARD-02",
      "A collapsed track shows its name and status; its description and cards are hidden",
    );
    // CARD-03: clicking the header opens the track
    await page.click(tsel + " > summary");
    ok(
      (await page.$eval(tsel, (d) => d.open)) &&
        (await page.isVisible(tsel + ' [class*="p-5"] h3')),
      "CARD-03",
      "Clicking the track header opens it and shows its cards",
    );
    // CARD-04: the student's choice survives adding a subject
    const openTrack = states.find((s) => s.open);
    const tsel2 =
      '#eligibilityResultsContainer > details[data-track="' +
      openTrack.track +
      '"]';
    await page.click(tsel2 + " > summary");
    await add(page, "PHY", "G3", "B4");
    ok(
      (await page.$eval(tsel, (d) => d.open)) &&
        !(await page.$eval(tsel2, (d) => d.open)),
      "CARD-04",
      "A track opened by hand stays open, and one closed by hand stays closed, after another subject is added",
    );
    // CARD-05: every track heading is shown, in order
    ok(
      (
        await page.$$eval(
          "#eligibilityResultsContainer > details[data-track] > summary h3",
          (hs) => hs.map((h) => h.textContent.trim()),
        )
      ).join("|") === FIXED_ORDER.join("|"),
      "CARD-05",
      "All five track headings are shown in order, collapsed or not",
    );
    // CARD-06: inside an open track every card is shown (cards are not collapsed one by one)
    await page.evaluate(() =>
      document
        .querySelectorAll("#eligibilityResultsContainer > details[data-track]")
        .forEach((d) => (d.open = true)),
    );
    {
      const ite =
        '#eligibilityResultsContainer > details[data-track="ITE 3-Year Higher Nitec"]';
      const shown = await page.$$eval(
        ite + ' [class*="p-5"] > h3',
        (hs) => hs.filter((h) => h.getBoundingClientRect().height > 0).length,
      );
      const cardTags = await page.$$eval(ite + ' [class*="p-5"]', (cs) =>
        cs.map((c) => c.tagName),
      );
      ok(
        shown === 6 && cardTags.every((tag) => tag === "DIV"),
        "CARD-06",
        "Inside an open track every pathway card shows its name, status and scores",
      );
    }
    // ════════════════════════════════════════════════════════════════════════
    // Eligibility table, audience tabs, optional raw mark
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 14b: Pathway table, tabs, optional raw mark ──");
    await reset(page);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "C6"],
      ["BIO", "G3", "C6"],
      ["HIST", "G3", "B4"],
      ["GEOG", "G3", "B4"],
    ]);
    const trackVisible = (g) =>
      page.isVisible(
        '#eligibilityResultsContainer > details[data-track="' + g + '"]',
      );
    // RAW-OPT-01
    ok(
      (await page.textContent("#studentSubjectsTableContainer thead")).includes(
        "(optional)",
      ) &&
        (await page.getAttribute("[data-row-raw]", "aria-label")) ===
          "Raw mark (optional)",
      "RAW-OPT-01",
      "The Raw Mark column and each raw mark box say it is optional",
    );
    // TAB-01
    await page.evaluate(() => localStorage.removeItem("spd.view"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.selectOption("#school", "School A");
    await page.waitForTimeout(300);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "C6"],
      ["BIO", "G3", "C6"],
      ["HIST", "G3", "B4"],
      ["GEOG", "G3", "B4"],
    ]);
    const exploreFirst =
      (await page.isVisible("#panelExplore")) &&
      (await page.isHidden("#panelPlan"));
    await page.click("#tabPlan");
    const planThen =
      (await page.isHidden("#panelExplore")) &&
      (await page.isVisible("#panelPlan")) &&
      (await page.isVisible("#fsbbTable"));
    ok(
      exploreFirst && planThen,
      "TAB-01",
      "Explore shows first; the Plan tab swaps the panels and shows the Action Plan table",
    );
    // TAB-02
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    ok(
      (await page.getAttribute("#tabPlan", "aria-selected")) === "true" &&
        !(await page.$eval("#panelPlan", (d) => d.classList.contains("hidden"))),
      "TAB-02",
      "The chosen tab is remembered after a reload",
    );
    await page.click("#tabExplore");
    await page.selectOption("#school", "School A");
    await page.waitForTimeout(300);
    await addMany(page, [
      ["EL", "G3", "D7"],
      ["MATH", "G3", "C6"],
      ["BIO", "G3", "C6"],
      ["HIST", "G3", "B4"],
      ["GEOG", "G3", "B4"],
    ]);
    // ETBL-01: boxes show status and count; nothing selected hides the cards
    {
      const boxes = await page.$$eval("[data-elig-cell]", (bs) =>
        bs.map((b) => b.dataset.status + ":" + b.textContent.trim()),
      );
      ok(
        boxes.length === 6 &&
          boxes.some((b) => b.startsWith("open:")) &&
          boxes.some((b) => b.startsWith("further:")) &&
          !(await trackVisible("PFP")),
        "ETBL-01",
        "The table has six boxes with status and course counts; with nothing selected no pathway cards show (" +
          boxes.join(" | ") +
          ")",
      );
    }
    // ETBL-02: PFP box shows only the PFP track, opened
    await page.click('[data-elig-cell="2"]');
    ok(
      (await trackVisible("PFP")) &&
        !(await trackVisible("JC/MI")) &&
        (await page.$eval(
          '#eligibilityResultsContainer > details[data-track="PFP"]',
          (d) => d.open,
        )),
      "ETBL-02",
      "Selecting the PFP box shows only the PFP track, open",
    );
    // ETBL-03: MI box shows only the MI card
    await page.click('[data-elig-cell="4"]');
    {
      const shown = await page.$$eval(
        "#eligibilityResultsContainer [data-pathway-id]",
        (cs) =>
          cs
            .filter((c) => !c.hidden && c.closest("details").hidden === false)
            .map((c) => c.dataset.pathwayId),
      );
      ok(
        shown.join() === "mi",
        "ETBL-03",
        "Selecting the Millennia Institute box shows only the MI card (" +
          shown.join() +
          ")",
      );
    }
    // ETBL-04: tapping again clears; Show every pathway shows all five tracks
    await page.click('[data-elig-cell="4"]');
    const cleared = !(await trackVisible("JC/MI"));
    await page.click("#eligShowAll");
    ok(
      cleared &&
        (await page.$$eval(
          "#eligibilityResultsContainer > details[data-track]",
          (ds) => ds.filter((d) => !d.hidden).length,
        )) === 5,
      "ETBL-04",
      "Tapping the same box again clears the selection; Show every pathway shows all five tracks",
    );
    // ════════════════════════════════════════════════════════════════════════
    // Phase 15: Subject picker
    // The Subjects dropdown lists the school's subjects with tick boxes; one
    // click adds every ticked subject to "Your Subjects" at the top grade
    // (G3 A1), and level, grade and raw mark are then set in that table.
    // ════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase 15: Subject picker ──");
    const pickOpen = async () => {
      if (
        (await page.getAttribute("#subjectPicker", "aria-expanded")) !== "true"
      )
        await page.click("#subjectPicker");
    };
    const pickTick = async (ids) => {
      await pickOpen();
      for (const id of ids) await page.check('[data-pick="' + id + '"]');
    };
    const rowSel = (id, part) =>
      '[data-subject-row="' + id + '"] [data-row-' + part + "]";
    const setRow = async (id, level, grade, raw) => {
      if (level && (await page.inputValue(rowSel(id, "level"))) !== level) {
        await page.selectOption(rowSel(id, "level"), level);
        await page.waitForTimeout(200);
      }
      if (grade) {
        await page.selectOption(rowSel(id, "grade"), grade);
        await page.waitForTimeout(200);
      }
      if (raw !== undefined) {
        await page.fill(rowSel(id, "raw"), String(raw));
        await page.press(rowSel(id, "raw"), "Tab");
        await page.waitForTimeout(200);
      }
    };
    const tableRows = () =>
      page.$$eval("#studentSubjectsTableBody tr", (r) => r.length);
    const PROFILE15 = [
      ["EL", "D7"],
      ["MATH", "C6"],
      ["BIO", "C6"],
      ["HIST", "B4"],
      ["GEOG", "B4"],
    ];
    const NAMES15 = [
      "Junior College",
      "Millennia",
      "MER (Complete SEC)",
      "MER (Pass Math)",
      "Humanities, Media",
      "Foundation Programme (PFP) - Science",
    ];

    await reset(page);
    {
      const gone = await page.evaluate(() =>
        ["bulkAdd", "bulkJump", "subject", "level", "grade", "rawMark"].every(
          (id) => !document.getElementById(id),
        ),
      );
      ok(
        gone &&
          (await page.isHidden("#subjectMenu")) &&
          (await page.isDisabled("#addUpdateSubjectBtn")),
        "PICK-01",
        "The old 'add several' panel and the level/grade/raw-mark boxes are gone; the menu starts closed and Add is disabled until something is ticked",
      );
    }
    // PICK-02: tick several, add once
    await pickTick(PROFILE15.map(([id]) => id));
    {
      const trigger = (await page.textContent("#subjectPickerLabel")).trim();
      const menuLabel = (await page.textContent("#subjectMenuAdd")).trim();
      const formLabel = (await page.textContent("#addUpdateBtnText")).trim();
      await page.click("#subjectMenuAdd");
      await page.waitForTimeout(500);
      const start = await page.$$eval("#studentSubjectsTableBody tr", (rs) =>
        rs.map((r) => {
          const sels = r.querySelectorAll("select");
          return sels[0].value + " " + sels[1].value;
        }),
      );
      ok(
        trigger === "5 selected" &&
          menuLabel === "Add 5 selected subjects" &&
          formLabel === "Add 5 subjects" &&
          (await tableRows()) === 5 &&
          start.every((v) => v === "G3 A1") &&
          (await page.isHidden("#subjectMenu")) &&
          (await page.textContent("#addMsg")).includes("Added 5 subjects") &&
          (await page.$("#fsbbTable")) !== null,
        "PICK-02",
        "Ticking five subjects and adding puts all five in the table at G3 A1; the buttons count them, the menu closes, a message shows and the Action Plan appears (" +
          start.join(", ") +
          ")",
      );
    }
    // PICK-03: same results as adding one at a time
    ok(
      await page.$$eval("#studentSubjectsTableBody tr", (rs) =>
        rs.every((r) => !r.innerText.includes("Set grade")),
      ),
      "PICK-03",
      "New rows carry no 'Set grade' tag",
    );
    for (const [id, g] of PROFILE15) await setRow(id, "G3", g);
    const viaPicker = [];
    for (const n of NAMES15) viaPicker.push(await getResult(page, n));
    await reset(page);
    await addMany(
      page,
      PROFILE15.map(([id, g]) => [id, "G3", g]),
    );
    const viaSingle = [];
    for (const n of NAMES15) viaSingle.push(await getResult(page, n));
    ok(
      JSON.stringify(viaPicker) === JSON.stringify(viaSingle) &&
        viaPicker.every((r) => r.found),
      "PICK-04",
      "Adding subjects together and then setting grades in the table gives exactly the same eligibility results as adding them one by one",
    );
    // PICK-05: added subjects are locked in the menu
    await pickOpen();
    ok(
      (await page.isDisabled('[data-pick="EL"]')) &&
        (await page.isChecked('[data-pick="EL"]')) &&
        (await page.textContent('[data-pick-row="EL"]')).includes("Added") &&
        (await page.isDisabled("#subjectMenuAdd")) &&
        (await page.isDisabled("#addUpdateSubjectBtn")),
      "PICK-05",
      "Subjects already in the table show as ticked and 'Added' and are locked, so nothing can be added twice",
    );
    // PICK-06: search keeps ticked rows visible
    await reset(page);
    await pickTick(["EL"]);
    await page.fill("#subjectSearch", "chem");
    {
      const visible = await page.$$eval("[data-pick-row]", (rs) =>
        rs
          .filter((r) => !r.classList.contains("hidden"))
          .map((r) => r.dataset.pickRow),
      );
      ok(
        visible.includes("CHEM") &&
          visible.includes("EL") &&
          visible.length < 6,
        "PICK-06",
        "Searching narrows the list to matches plus anything already ticked (" +
          visible.join(", ") +
          ")",
      );
    }
    await page.fill("#subjectSearch", "");
    ok(
      (await page.$$eval("[data-pick-row].hidden", (r) => r.length)) === 0,
      "PICK-07",
      "Clearing the search brings every subject back",
    );
    // PICK-08: Escape and outside click close the menu but keep the ticks
    await page.keyboard.press("Escape");
    {
      const afterEsc = await page.isHidden("#subjectMenu");
      const label = (await page.textContent("#subjectPickerLabel")).trim();
      await page.click("#subjectPicker");
      await page.click("h2");
      ok(
        afterEsc &&
          label === "1 selected" &&
          (await page.isHidden("#subjectMenu")) &&
          (await page.getAttribute("#subjectPicker", "aria-expanded")) ===
            "false",
        "PICK-08",
        "Escape and a click outside both close the menu, and the ticks are kept ('" +
          label +
          "')",
      );
    }
    // PICK-09: Enter in the search box adds the ticked subjects
    await pickOpen();
    await page.fill("#subjectSearch", "math");
    await page.press("#subjectSearch", "Enter");
    await page.waitForTimeout(400);
    ok(
      (await tableRows()) === 1 &&
        (await page.isVisible(rowSel("EL", "level"))),
      "PICK-09",
      "Pressing Enter in the search box adds what is ticked (only English, which stayed ticked while searching)",
    );
    // PICK-10: starting level and grade follow what the subject allows
    await reset(page);
    await pickTick(["BIO", "DT", "MOB_ROBOTICS"]);
    await page.click("#subjectMenuAdd");
    await page.waitForTimeout(500);
    {
      const bio = await page.inputValue(rowSel("BIO", "level"));
      const dtLevel = await page.inputValue(rowSel("DT", "level"));
      const dtGrade = await page.inputValue(rowSel("DT", "grade"));
      const mobLevel = await page.inputValue(rowSel("MOB_ROBOTICS", "level"));
      const mobGrade = await page.inputValue(rowSel("MOB_ROBOTICS", "grade"));
      const mobRawBoxes = await page.$$(rowSel("MOB_ROBOTICS", "raw"));
      ok(
        bio === "G3" &&
          dtLevel === "G3" &&
          dtGrade === "A1" &&
          mobLevel === "G1" &&
          mobGrade === "A" &&
          mobRawBoxes.length === 0,
        "PICK-10",
        "Each subject starts at its own top grade: BIO and DT at G3 A1, Mobile Robotics (G1 only) at G1 A with no raw mark (" +
          [bio, dtLevel, dtGrade, mobLevel, mobGrade].join(" ") +
          ")",
      );
    }
    // PICK-10b: the level choices follow SEAB's 2027 lists and the school
    {
      const levelsOf = async (ids) => {
        await pickTick(ids);
        await page.click("#subjectMenuAdd");
        await page.waitForTimeout(500);
        const out = {};
        for (const id of ids)
          out[id] = (
            await page.$$eval(rowSel(id, "level") + " option", (o) =>
              o.map((x) => x.value),
            )
          )
            .sort()
            .join("/");
        return out;
      };
      await reset(page);
      const a = await levelsOf([
        "AM",
        "DT",
        "NFS",
        "MUSIC",
        "POA",
        "HMT",
        "COMB_HUM",
        "SMART_ELEC_TECH",
        "HA",
        "GEOG",
        "COMB_SCI",
      ]);
      await reset(page);
      await page.selectOption("#school", "Yuhua Secondary School");
      await page.waitForTimeout(300);
      const y = await levelsOf([
        "POA",
        "HMT",
        "DT",
        "MUSIC",
        "COMB_HUM",
        "COMP",
        "MOB_ROBOTICS",
      ]);
      ok(
        a.AM === "G2/G3" &&
          a.DT === "G1/G2/G3" &&
          a.NFS === "G1/G2/G3" &&
          a.MUSIC === "G1/G3" &&
          a.POA === "G2/G3" &&
          a.HMT === "G3" &&
          a.COMB_HUM === "G2/G3" &&
          a.SMART_ELEC_TECH === "G1" &&
          a.HA === "G3" &&
          a.GEOG === "G2/G3" &&
          a.COMB_SCI === "G1/G2/G3" &&
          y.POA === "G2/G3" &&
          y.HMT === "G3" &&
          y.DT === "G2/G3" &&
          y.MUSIC === "G3" &&
          y.COMB_HUM === "G2/G3" &&
          y.COMP === "G1/G2/G3" &&
          y.MOB_ROBOTICS === "G1",
        "PICK-10b",
        "Level choices follow SEAB 2027 (no G1 Combined Humanities, Principles of Accounts, Higher or Humanities subjects; Music G1/G3; Smart Electrical Technology G1) and Yuhua keeps its own narrower DT and Music (" +
          JSON.stringify({ a, y }) +
          ")",
      );
    }
    // PICK-11: the 'Set grade' tag and note clear as the student edits
    await reset(page);
    await pickTick(["EL", "MATH"]);
    await page.click("#subjectMenuAdd");
    await page.waitForTimeout(500);
    await setRow("EL", "G3", "B3");
    {
      const elTag = (
        await page.textContent('[data-subject-row="EL"]')
      ).includes("Set grade");
      const mathTag = (
        await page.textContent('[data-subject-row="MATH"]')
      ).includes("Set grade");
      await setRow("MATH", "G3", "C6");
      ok(
        !elTag &&
          !mathTag &&
          !(await page.textContent('[data-subject-row="MATH"]')).includes(
            "Set grade",
          ) &&
          (await page.$("#defaultGradeNote")) === null,
        "PICK-11",
        "No row shows a 'Set grade' tag, before or after its grade is changed, and there is no note above the table",
      );
    }
    // PICK-12: the grade follows the raw mark; a mark that does not fit a
    // grade picked by hand is still flagged.
    {
      const elSel = '[data-subject-row="EL"]';
      const gradeOf = () => page.inputValue(elSel + " [data-row-grade]");
      const typeMark = async (v) => {
        await page.fill(elSel + " [data-row-raw]", String(v));
        await page.press(elSel + " [data-row-raw]", "Tab");
        await page.waitForTimeout(200);
      };
      await setRow("EL", "G3", "B3");
      await typeMark(10);
      const lowGrade = await gradeOf();
      await typeMark(68);
      const midGrade = await gradeOf();
      await typeMark(75);
      const topGrade = await gradeOf();
      const noFlag = !(await page.textContent(elSel)).includes("Mark ignored");
      await page.selectOption(elSel + " [data-row-grade]", "C6");
      await page.waitForTimeout(200);
      const flagged = (await page.textContent(elSel)).includes("Mark ignored");
      await typeMark(150);
      const rangeHint = (await page.textContent(elSel)).includes(
        "Enter a mark from 0 to 100",
      );
      ok(
        lowGrade === "F9" &&
          midGrade === "B3" &&
          topGrade === "A1" &&
          noFlag &&
          flagged &&
          rangeHint,
        "PICK-12",
        `The grade follows the raw mark (10 → ${lowGrade}, 68 → ${midGrade}, 75 → ${topGrade}); a grade picked by hand that does not fit the mark is flagged; a mark above 100 asks for 0 to 100`,
      );
      // G2 bands and the 'Set grade' tag
      await reset(page);
      await pickTick(["MATH"]);
      await page.click("#subjectMenuAdd");
      await page.waitForTimeout(500);
      const tagBefore = (
        await page.textContent('[data-subject-row="MATH"]')
      ).includes("Set grade");
      await setRow("MATH", "G2", "1");
      await page.fill('[data-subject-row="MATH"] [data-row-raw]', "72");
      await page.press('[data-subject-row="MATH"] [data-row-raw]', "Tab");
      await page.waitForTimeout(200);
      ok(
        !tagBefore &&
          (await page.inputValue(
            '[data-subject-row="MATH"] [data-row-grade]',
          )) === "2" &&
          !(await page.textContent('[data-subject-row="MATH"]')).includes(
            "Set grade",
          ),
        "PICK-12b",
        "At G2 a mark of 72 sets grade 2, with no 'Set grade' tag",
      );
    }
    // PICK-13: ticks survive a school change
    await reset(page);
    await pickTick(["EL"]);
    await page.selectOption("#school", "Yuhua Secondary School");
    await page.waitForTimeout(300);
    ok(
      (await page.isChecked('[data-pick="EL"]')) &&
        (await page.textContent("#subjectPickerLabel")).trim() ===
          "1 selected" &&
        (await page.$$eval("[data-pick-row]", (r) => r.length)) > 5,
      "PICK-13",
      "Changing school rebuilds the list but keeps ticks for subjects both schools offer",
    );
    // PICK-14: phone width
    await page.setViewportSize({ width: 390, height: 844 });
    await reset(page);
    await pickOpen();
    {
      const noScroll = !(await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ));
      const trig = await page.$eval(
        "#subjectPicker",
        (b) => b.getBoundingClientRect().height,
      );
      await page.check('[data-pick="EL"]');
      const menu = await page.$eval("#subjectMenuAdd", (b) => {
        const r = b.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, h: window.innerHeight };
      });
      ok(
        noScroll && trig >= 44 && menu.top >= 0 && menu.bottom <= menu.h,
        "PICK-14",
        "At 390px wide, with the menu open, there is no sideways scroll, the trigger is at least 44px tall and the Add button is on screen",
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
  } catch (err) {
    // A thrown error mid-run must fail the suite, not print "All checks passed!".
    console.log(`
  ✗ RUNNER CRASHED: ${err && err.stack ? err.stack : err}`);
    FAILED++;
    FAILURES.push(`runner crashed: ${err && err.message ? err.message : err}`);
  } finally {
    await browser.close();

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════════");
    console.log(`Final Results: ${PASSED} PASSED / ${FAILED} FAILED`);
    if (FAILURES.length) {
      console.log("\nFailures:");
      FAILURES.forEach((f) => console.log(`  ✗ ${f}`));
    } else {
      console.log("All checks passed!");
    }
    console.log("══════════════════════════════════════════════════════");
    process.exit(FAILED > 0 ? 1 : 0);
  }
})();
