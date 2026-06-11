/**
 * CA (Conditional Admission) tests for JC/MI pathways.
 * Verifies the four-quadrant behaviour introduced in the CA implementation.
 */

const { chromium } = require("playwright");

const FILE_URL = "file:///C:/Users/Admin/Documents/spdv4/index.html";
let passed = 0,
  failed = 0,
  failures = [];

function ok(cond, id, label) {
  if (cond) {
    console.log(`  ✓ ${id}: ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${id}: FAILED — ${label}`);
    failed++;
    failures.push(`${id}: ${label}`);
  }
}

async function reset(page, bonus = 0) {
  await page.goto(FILE_URL, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.selectOption("#school", "School A");
  await page.waitForTimeout(300);
  await page.fill("#bonus", String(bonus));
}

async function add(page, subjectId, level, grade) {
  await page.selectOption("#subject", subjectId);
  await page.waitForTimeout(200);
  await page.selectOption("#level", level);
  await page.waitForTimeout(200);
  await page.selectOption("#grade", grade);
  await page.waitForTimeout(50);
  await page.click("#addUpdateSubjectBtn");
  await page.waitForTimeout(350);
}

async function getResult(page, nameSubstr) {
  return page.evaluate((ns) => {
    const container = document.getElementById("eligibilityResultsContainer");
    for (const h3 of container.querySelectorAll("h3")) {
      if (h3.textContent.includes(ns)) {
        const card = h3.closest('[class*="p-5"]');
        const ps = Array.from(card.querySelectorAll("p"));
        const status =
          (ps.find((p) => p.textContent.includes("Status:")) || {})
            .textContent || "";
        const grossP =
          (ps.find((p) => p.textContent.includes("Gross Aggregate:")) || {})
            .textContent || "";
        const num = (t) => {
          const m = t.match(/:\s*(\d+)/);
          return m ? +m[1] : null;
        };
        return {
          found: true,
          isEligible:
            status.includes("Eligible") && !status.includes("Not Eligible"),
          isCA: status.includes("Conditional Admission"),
          status: status.trim(),
          gross: num(grossP),
        };
      }
    }
    return { found: false };
  }, nameSubstr);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  console.log("\n── CA Tests: Conditional Admission for JC/MI ──");

  // ── CA-01 ─────────────────────────────────────────────────────────────────
  // Score=11 (EL D7 fails MER). 11≤12 simple threshold → JC CA + MI CA.
  await reset(page);
  for (const [id, lv, gr] of [
    ["EL", "G3", "D7"],
    ["MATH", "G3", "A1"],
    ["HIST", "G3", "A1"],
    ["GEOG", "G3", "A1"],
    ["MT", "G3", "A1"],
  ])
    await add(page, id, lv, gr);
  {
    const jc = await getResult(page, "Junior College");
    const mi = await getResult(page, "Millennia Institute");
    ok(jc.found, "CA-01", "JC card found");
    ok(jc.gross === 11, "CA-01", `JC gross=11 (actual: ${jc.gross})`);
    ok(
      jc.isCA,
      "CA-01",
      "JC shows Eligible (Conditional Admission) — score 11 ≤ 12 simple threshold",
    );
    ok(
      mi.isCA,
      "CA-01",
      "MI shows Eligible (Conditional Admission) — score 11 ≤ 15 simple threshold",
    );
  }

  // ── CA-02 ─────────────────────────────────────────────────────────────────
  // Score=17 (EL D7 fails MER). 17>16 → JC scoreMet=false. 17>15 + MT R4=D7(7)>2 → no MI CA.
  // Both Not Eligible.
  await reset(page);
  for (const [id, lv, gr] of [
    ["EL", "G3", "D7"],
    ["MATH", "G3", "A1"],
    ["HIST", "G3", "A1"],
    ["GEOG", "G3", "A1"],
    ["MT", "G3", "D7"],
  ])
    await add(page, id, lv, gr);
  {
    const jc = await getResult(page, "Junior College");
    const mi = await getResult(page, "Millennia Institute");
    ok(
      !jc.isEligible,
      "CA-02",
      "JC Not Eligible — score 17 > 16, CA cannot apply",
    );
    ok(
      !mi.isEligible,
      "CA-02",
      "MI Not Eligible — score 17>15 AND MT R4=D7>A1/A2, no CA",
    );
  }

  // ── CA-03 ─────────────────────────────────────────────────────────────────
  // Score=13 (EL D7 fails MER, MT B3=3>2 so not all R at A1/A2).
  // JC: 13>12 + R4=B3 → no CA. MI: 13≤15 simple threshold → MI CA.
  await reset(page);
  for (const [id, lv, gr] of [
    ["EL", "G3", "D7"],
    ["MATH", "G3", "A1"],
    ["HIST", "G3", "A1"],
    ["GEOG", "G3", "A1"],
    ["MT", "G3", "B3"],
  ])
    await add(page, id, lv, gr);
  {
    const jc = await getResult(page, "Junior College");
    const mi = await getResult(page, "Millennia Institute");
    ok(
      !jc.isCA && !jc.isEligible,
      "CA-03",
      "JC Not Eligible — 13>12 + MT B3>A2, no JC CA",
    );
    ok(
      mi.isCA,
      "CA-03",
      "MI Eligible (Conditional Admission) — 13 ≤ 15 simple threshold",
    );
    ok(mi.gross === 13, "CA-03", `MI gross=13 (actual: ${mi.gross})`);
  }

  // ── CA-04 ─────────────────────────────────────────────────────────────────
  // All 4 R-subjects at A2, EL D7 fails MER. Score=7+2+2+2+2=15.
  // JC: 15>12, but all R at A2(≤2) AND 15≤16 → JC CA.
  // MI: 15≤15 simple threshold → MI CA.
  await reset(page);
  for (const [id, lv, gr] of [
    ["EL", "G3", "D7"],
    ["MATH", "G3", "A2"],
    ["HIST", "G3", "A2"],
    ["GEOG", "G3", "A2"],
    ["MT", "G3", "A2"],
  ])
    await add(page, id, lv, gr);
  {
    const jc = await getResult(page, "Junior College");
    const mi = await getResult(page, "Millennia Institute");
    ok(jc.gross === 15, "CA-04", `JC gross=15 (actual: ${jc.gross})`);
    ok(
      jc.isCA,
      "CA-04",
      "JC Eligible (Conditional Admission) — 15≤16 + all R at A2",
    );
    ok(
      mi.isCA,
      "CA-04",
      "MI Eligible (Conditional Admission) — 15 ≤ 15 simple threshold",
    );
  }

  // ── CA-05 ─────────────────────────────────────────────────────────────────
  // EL D7, MT B4 (B4=4>2 so R4 NOT at A1/A2). Score=7+1+1+1+4=14.
  // JC: 14>12, R4=B4>2 → no JC CA. MI: 14≤15 → MI CA.
  await reset(page);
  for (const [id, lv, gr] of [
    ["EL", "G3", "D7"],
    ["MATH", "G3", "A1"],
    ["HIST", "G3", "A1"],
    ["GEOG", "G3", "A1"],
    ["MT", "G3", "B4"],
  ])
    await add(page, id, lv, gr);
  {
    const jc = await getResult(page, "Junior College");
    const mi = await getResult(page, "Millennia Institute");
    ok(
      !jc.isCA && !jc.isEligible,
      "CA-05",
      "JC Not Eligible — 14>12 + MT B4>A2, no JC CA",
    );
    ok(
      mi.isCA,
      "CA-05",
      "MI Eligible (Conditional Admission) — 14 ≤ 15 simple threshold",
    );
  }

  // ── CA-06 ─────────────────────────────────────────────────────────────────
  // MATH fails MER (E8 > D7). EL C6 OK. Score=6+8+1+1+1=17>16 → JC scoreMet=false.
  // MI: 17≤20, MATH fails MER. CA: 17>15, R2=MATH(8)>2 → no CA. Both Not Eligible.
  await reset(page);
  for (const [id, lv, gr] of [
    ["EL", "G3", "C6"],
    ["MATH", "G3", "E8"],
    ["HIST", "G3", "A1"],
    ["GEOG", "G3", "A1"],
    ["MT", "G3", "A1"],
  ])
    await add(page, id, lv, gr);
  {
    const jc = await getResult(page, "Junior College");
    const mi = await getResult(page, "Millennia Institute");
    ok(!jc.isEligible, "CA-06", "JC Not Eligible — score 17>16");
    ok(
      !mi.isEligible,
      "CA-06",
      "MI Not Eligible — 17>15 + MATH E8 in R2>A1/A2, no CA",
    );
  }

  // ── CA-07 ─────────────────────────────────────────────────────────────────
  // All MER met (EL C6, MATH D7, MT D7). Score=6+7+1+1+7=22>20 → scoreMet=false.
  // Verify regular Not Eligible (no CA — score doesn't qualify).
  await reset(page);
  for (const [id, lv, gr] of [
    ["EL", "G3", "C6"],
    ["MATH", "G3", "D7"],
    ["HIST", "G3", "A1"],
    ["GEOG", "G3", "A1"],
    ["MT", "G3", "D7"],
  ])
    await add(page, id, lv, gr);
  {
    const jc = await getResult(page, "Junior College");
    const mi = await getResult(page, "Millennia Institute");
    ok(
      !jc.isEligible && !jc.isCA,
      "CA-07",
      "JC Not Eligible — score 22>16, no CA",
    );
    ok(
      !mi.isEligible && !mi.isCA,
      "CA-07",
      "MI Not Eligible — score 22>20, no CA",
    );
  }

  await browser.close();

  console.log(
    `\n${"═".repeat(54)}\nFinal Results: ${passed} PASSED / ${failed} FAILED`,
  );
  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  ✗ ${f}`));
  } else {
    console.log("All CA checks passed!");
  }
  console.log("═".repeat(54));
  process.exit(failed > 0 ? 1 : 0);
})();
