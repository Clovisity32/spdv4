/**
 * Invariant Test Suite — Student Pathway Dashboard
 *
 * Phase I: ELMAB3_G2 systematic boundary sweep (PFP + ITE Year 2).
 *   For each pathway, sweeps (EL grade, MATH grade, target score) around the
 *   MER and threshold boundaries and asserts:
 *     isEligible === (score ≤ threshold) AND (el ≤ merEl) AND (math ≤ merMath)
 *
 * Phase II: L1R4 spot boundary checks (JC + MI).
 *   Seven hand-crafted profiles cover: at-threshold, over-threshold, EL/MATH/MTL
 *   MER failures, and the MI-only zone.
 *
 * Requires window.__spdTest to be exposed in index.html (no UI interaction needed).
 * Run: node scripts/run_invariant_tests.js
 */

const { chromium } = require("playwright");

const FILE_URL = "file:///C:/Users/Admin/Documents/spdv4/index.html";

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

async function calc(page, subjects) {
  return page.evaluate((s) => window.__spdTest.calculate(s), subjects);
}

// ── Profile Builders ─────────────────────────────────────────────────────────

/**
 * Build a PFP G2 profile:
 *   EL(elG2) + MATH(mathG2) + relevant(grade 1) + B2 + B3
 * relevant is always grade 1 so it always passes the relevant_subj MER (≤ 3).
 * Returns null when the target score is not achievable with maxG2=4 per B subject.
 */
function buildPFPProfile(elG2, mathG2, relevantId, otherIds, targetScore) {
  const relG2 = 1;
  const remaining = targetScore - elG2 - mathG2 - relG2;
  if (remaining < 2 || remaining > 8) return null; // B2+B3 ∈ [2,8] for maxG2=4
  const b2 = Math.min(4, remaining - 1);
  const b3 = remaining - b2;
  if (b3 < 1 || b3 > 4) return null;
  return [
    { subjectId: "EL", level: "G2", grade: String(elG2) },
    { subjectId: "MATH", level: "G2", grade: String(mathG2) },
    { subjectId: relevantId, level: "G2", grade: String(relG2) },
    { subjectId: otherIds[0], level: "G2", grade: String(b2) },
    { subjectId: otherIds[1], level: "G2", grade: String(b3) },
  ];
}

/**
 * Build an ITE Year 2 G2 profile:
 *   EL(elG2) + MATH(mathG2) + HIST(b1) + GEOG(b2) + ECON(b3)
 * Returns null when the target score is not achievable with maxG2=5 per B subject.
 */
function buildITEYr2Profile(elG2, mathG2, targetScore) {
  const remaining = targetScore - elG2 - mathG2;
  if (remaining < 3 || remaining > 15) return null; // B1+B2+B3 ∈ [3,15] for maxG2=5
  const b1 = Math.min(5, remaining - 2);
  const rem2 = remaining - b1;
  const b2 = Math.min(5, rem2 - 1);
  const b3 = rem2 - b2;
  if (b3 < 1 || b3 > 5) return null;
  return [
    { subjectId: "EL", level: "G2", grade: String(elG2) },
    { subjectId: "MATH", level: "G2", grade: String(mathG2) },
    { subjectId: "HIST", level: "G2", grade: String(b1) },
    { subjectId: "GEOG", level: "G2", grade: String(b2) },
    { subjectId: "ECON", level: "G2", grade: String(b3) },
  ];
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(FILE_URL, { waitUntil: "networkidle" });

  const PATHWAYS = await page.evaluate(() => window.__spdTest.pathways);

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // Phase I: ELMAB3_G2 Boundary Sweep
    //
    // For each combination of (EL grade, MATH grade, target score):
    //   expectedEligible = score ≤ threshold  AND  el ≤ merEl  AND  math ≤ merMath
    //
    // EL/MATH grades tested: 1 (best), merX (exactly at MER), merX+1 (just failing MER)
    // Scores tested: threshold−1, threshold, threshold+1
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase I: ELMAB3_G2 Boundary Sweep ──");

    for (const pathway of PATHWAYS.filter((p) => p.calcType === "ELMAB3_G2")) {
      const { id, name, group, mer, requirements } = pathway;
      const threshold = requirements.grossELMAB3;
      const maxG2 = pathway.calcOptions?.maxG2GradeForCalc ?? 4;
      const merEl = parseInt(mer.el_g2);
      const merMath = parseInt(mer.math_am_g2);
      const isPFP = group === "PFP";

      // For PFP, pick a relevant subject that exists in the relevant_subj_ids list
      // and is easily addable at G2. Use a different pool depending on cluster.
      let relevantId, otherIds;
      if (isPFP) {
        const preferred = [
          "HIST",
          "GEOG",
          "ECON",
          "DT",
          "NFS",
          "LIT_ENG",
          "ART",
          "POA",
        ];
        relevantId =
          preferred.find((sid) => mer.relevant_subj_ids.includes(sid)) ??
          mer.relevant_subj_ids[0];
        otherIds = ["HIST", "GEOG", "ECON"]
          .filter((sid) => sid !== relevantId)
          .slice(0, 2);
      }

      // Grade values to sweep:
      //   1        → well-passing MER
      //   merX     → exactly at the MER boundary (last passing grade)
      //   merX+1   → first failing grade (only included when ≤ maxG2+1)
      const elValues = [...new Set([1, merEl, merEl + 1])].filter(
        (g) => g >= 1 && g <= maxG2 + 1,
      );
      const mathValues = [...new Set([1, merMath, merMath + 1])].filter(
        (g) => g >= 1 && g <= maxG2 + 1,
      );
      const scoreValues = [threshold - 1, threshold, threshold + 1];

      let cases = 0;

      for (const el of elValues) {
        for (const math of mathValues) {
          for (const target of scoreValues) {
            const subjects = isPFP
              ? buildPFPProfile(el, math, relevantId, otherIds, target)
              : buildITEYr2Profile(el, math, target);

            if (!subjects) continue; // skip profiles that can't be constructed

            // Invariant: eligible iff score ≤ threshold AND both MERs met
            const expectedEligible =
              target <= threshold && el <= merEl && math <= merMath;

            const results = await calc(page, subjects);
            const r = results.find((p) => p.id === id);

            const caseId = `${id.slice(0, 14)}_el${el}_m${math}_s${target}`;
            ok(
              r?.isEligible === expectedEligible,
              caseId,
              `el=${el} math=${math} score=${target} → ${expectedEligible ? "Eligible" : "NotEligible"} (actual:${r?.isEligible})`,
            );
            cases++;
          }
        }
      }

      console.log(`  → ${name}: ${cases} cases`);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Phase II: L1R4 Spot Boundary Checks (JC threshold=16, MI threshold=20)
    //
    // All profiles use 5 subjects with predictable role assignment:
    //   EL  → L1   (only EL/HMT candidate; EL grade wins)
    //   HIST → R1  (only Humanities subject with low grade)
    //   MATH → R2  (only Math/Science subject)
    //   GEOG → R3  (only remaining Humanities subject)
    //   MT   → R4  (Mother Tongue is not H/M/S, goes to R4)
    //
    // L1R4 gross = EL_num + HIST_num + MATH_num + GEOG_num + MT_num
    // Profile from CCA-03 test (verified gross=16): EL(1)+HIST(1)+MATH(1)+GEOG(6)+MT(7)=16
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase II: L1R4 Spot Boundary Checks ──");

    async function checkL1R4(profileKey, subjects, expectJC, expectMI) {
      const results = await calc(page, subjects);
      const jc = results.find((p) => p.id === "jc");
      const mi = results.find((p) => p.id === "mi");
      ok(
        jc?.isEligible === expectJC,
        `L1R4_${profileKey}_jc`,
        `JC ${expectJC ? "Eligible" : "NotEligible"} (actual:${jc?.isEligible}, gross:${jc?.grossScore})`,
      );
      ok(
        mi?.isEligible === expectMI,
        `L1R4_${profileKey}_mi`,
        `MI ${expectMI ? "Eligible" : "NotEligible"} (actual:${mi?.isEligible}, gross:${mi?.grossScore})`,
      );
    }

    // Score=16 (JC threshold): EL(1)+HIST(1)+MATH(1)+GEOG(6)+MT(7)=16 → JC ✓ MI ✓
    await checkL1R4(
      "score16",
      [
        { subjectId: "EL", level: "G3", grade: "A1" },
        { subjectId: "HIST", level: "G3", grade: "A1" },
        { subjectId: "MATH", level: "G3", grade: "A1" },
        { subjectId: "GEOG", level: "G3", grade: "C6" },
        { subjectId: "MT", level: "G3", grade: "D7" },
      ],
      true,
      true,
    );

    // Score=17 (JC+1): GEOG(7)+MT(7) → 1+1+1+7+7=17 → JC ✗ MI ✓
    await checkL1R4(
      "score17",
      [
        { subjectId: "EL", level: "G3", grade: "A1" },
        { subjectId: "HIST", level: "G3", grade: "A1" },
        { subjectId: "MATH", level: "G3", grade: "A1" },
        { subjectId: "GEOG", level: "G3", grade: "D7" },
        { subjectId: "MT", level: "G3", grade: "D7" },
      ],
      false,
      true,
    );

    // Score=20 (MI threshold): MATH→B4(4) → 1+1+4+7+7=20 → JC ✗ MI ✓
    await checkL1R4(
      "score20",
      [
        { subjectId: "EL", level: "G3", grade: "A1" },
        { subjectId: "HIST", level: "G3", grade: "A1" },
        { subjectId: "MATH", level: "G3", grade: "B4" },
        { subjectId: "GEOG", level: "G3", grade: "D7" },
        { subjectId: "MT", level: "G3", grade: "D7" },
      ],
      false,
      true,
    );

    // Score=21 (MI+1): MATH→C5(5) → 1+1+5+7+7=21 → JC ✗ MI ✗
    await checkL1R4(
      "score21",
      [
        { subjectId: "EL", level: "G3", grade: "A1" },
        { subjectId: "HIST", level: "G3", grade: "A1" },
        { subjectId: "MATH", level: "G3", grade: "C5" },
        { subjectId: "GEOG", level: "G3", grade: "D7" },
        { subjectId: "MT", level: "G3", grade: "D7" },
      ],
      false,
      false,
    );

    // EL MER failure: EL G3 D7(7) > C6(6) → MER fails; gross=16 > CA thresholds (12/15)
    // L1R4 = 7+1+1+4+3 = 16 ≤ 16, EL MER fails, no CA → JC ✗ MI ✗
    // (gross=11 with all-A1 would trigger conditionalAdmission ≤ 12 — use gross=16 to avoid CA)
    await checkL1R4(
      "el_mer_fail",
      [
        { subjectId: "EL", level: "G3", grade: "D7" },
        { subjectId: "HIST", level: "G3", grade: "A1" },
        { subjectId: "MATH", level: "G3", grade: "A1" },
        { subjectId: "GEOG", level: "G3", grade: "B4" },
        { subjectId: "MT", level: "G3", grade: "B3" },
      ],
      false,
      false,
    );

    // MATH MER failure: MATH G3 E8(8) > D7(7) → MER fails; gross=16 > CA thresholds (12/15)
    // L1R4 = 1+1+8+3+3 = 16 ≤ 16, MATH MER fails, no CA → JC ✗ MI ✗
    // (gross=12 with all-A1 would trigger conditionalAdmission ≤ 12 — use gross=16 to avoid CA)
    await checkL1R4(
      "math_mer_fail",
      [
        { subjectId: "EL", level: "G3", grade: "A1" },
        { subjectId: "HIST", level: "G3", grade: "A1" },
        { subjectId: "MATH", level: "G3", grade: "E8" },
        { subjectId: "GEOG", level: "G3", grade: "B3" },
        { subjectId: "MT", level: "G3", grade: "B3" },
      ],
      false,
      false,
    );

    // MTL MER failure: no MT/HMT subject → MER fails despite score ≤ 16
    // L1R4 = 1+1+1+6+7 = 16, ECON takes R4, but MTL check fails → JC ✗ MI ✗
    await checkL1R4(
      "mtl_mer_fail",
      [
        { subjectId: "EL", level: "G3", grade: "A1" },
        { subjectId: "HIST", level: "G3", grade: "A1" },
        { subjectId: "MATH", level: "G3", grade: "A1" },
        { subjectId: "GEOG", level: "G3", grade: "C6" },
        { subjectId: "ECON", level: "G3", grade: "D7" },
      ],
      false,
      false,
    );

    // ══════════════════════════════════════════════════════════════════════════
    // Phase III: Conditional Admission Spot Checks
    //
    // CA fires when: merMet=false AND grossScore ≤ grossThreshold AND
    //   (gross ≤ simpleCaThreshold  OR  all 4 R-subjects numericGrade ≤ 2)
    // simpleCaThreshold: 12 for JC (threshold ≤ 16), 15 for MI (threshold > 16)
    //
    // isCA = scoreMet && !merMet && conditionalAdmission
    // isEligible = scoreMet && (merMet || conditionalAdmission)
    // ══════════════════════════════════════════════════════════════════════════
    console.log("\n── Phase III: Conditional Admission Spot Checks ──");

    async function checkCA(
      profileKey,
      subjects,
      expectJCElig,
      expectJCCA,
      expectMIElig,
      expectMICA,
    ) {
      const results = await calc(page, subjects);
      const jc = results.find((p) => p.id === "jc");
      const mi = results.find((p) => p.id === "mi");
      ok(
        jc?.isEligible === expectJCElig,
        `CA_${profileKey}_jc_elig`,
        `JC ${expectJCElig ? "Eligible" : "NotEligible"} (actual:${jc?.isEligible}, gross:${jc?.grossScore})`,
      );
      ok(
        jc?.isCA === expectJCCA,
        `CA_${profileKey}_jc_isca`,
        `JC isCA=${expectJCCA} (actual:${jc?.isCA})`,
      );
      ok(
        mi?.isEligible === expectMIElig,
        `CA_${profileKey}_mi_elig`,
        `MI ${expectMIElig ? "Eligible" : "NotEligible"} (actual:${mi?.isEligible}, gross:${mi?.grossScore})`,
      );
      ok(
        mi?.isCA === expectMICA,
        `CA_${profileKey}_mi_isca`,
        `MI isCA=${expectMICA} (actual:${mi?.isCA})`,
      );
    }

    // gross=11, EL D7 fails MER: 11 ≤ 12 (JC CA threshold) and 11 ≤ 15 (MI CA threshold)
    // EL(7)+HIST(1)+MATH(1)+GEOG(1)+MT(1) = 11 → JC CA ✓  MI CA ✓
    await checkCA(
      "gross11_el_fail",
      [
        { subjectId: "EL", level: "G3", grade: "D7" },
        { subjectId: "HIST", level: "G3", grade: "A1" },
        { subjectId: "MATH", level: "G3", grade: "A1" },
        { subjectId: "GEOG", level: "G3", grade: "A1" },
        { subjectId: "MT", level: "G3", grade: "A1" },
      ],
      true,
      true, // JC: Eligible via CA
      true,
      true, // MI: Eligible via CA
    );

    // gross=13, EL D7 fails MER: 13 > 12 and GEOG(B3=3) prevents "all R ≤ 2" JC CA path
    // but 13 ≤ 15 still triggers MI CA
    // EL(7)+HIST(1)+MATH(1)+GEOG(3)+MT(1) = 13 → JC Not Eligible  MI CA ✓
    await checkCA(
      "gross13_el_fail",
      [
        { subjectId: "EL", level: "G3", grade: "D7" },
        { subjectId: "HIST", level: "G3", grade: "A1" },
        { subjectId: "MATH", level: "G3", grade: "A1" },
        { subjectId: "GEOG", level: "G3", grade: "B3" },
        { subjectId: "MT", level: "G3", grade: "A1" },
      ],
      false,
      false, // JC: NotEligible (above JC CA threshold, R not all ≤ 2)
      true,
      true, // MI: Eligible via CA (13 ≤ 15)
    );
  } finally {
    await browser.close();

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
