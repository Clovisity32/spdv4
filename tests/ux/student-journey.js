/**
 * Student UX journey — Student Pathway Dashboard
 *
 * Walks the core task flow (add subjects → read the FSBB table → tap a box →
 * compare a lower row) at desktop and phone width. It saves screenshots to
 * debug/ux-student-*.png and prints measurements the audit scores from.
 *
 * Enters the same six subjects two ways: one at a time (the single form) and
 * all at once (the "Add several subjects at once" panel), and counts the
 * interactions and time each takes.
 *
 * Run: node tests/ux/student-journey.js
 */
const { chromium } = require("playwright");

const FILE_URL = "file:///C:/Users/Admin/Documents/spdv4/index.html";
const SUBJECTS = [
  ["EL", "G3", "B3", "69"],
  ["MT", "G3", "C6", "50"],
  ["MATH", "G3", "F9", "31"],
  ["COMB_SCI", "G3", "D7", "47"],
  ["COMB_HUM", "G3", "E8", "43"],
  ["POA", "G3", "F9", "38"],
];

async function run(name, viewport, mode = "single") {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport });
  const out = { name, steps: [] };
  const step = (s, data) => out.steps.push({ step: s, ...data });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const t0 = Date.now();
  await page.goto(FILE_URL, { waitUntil: "load" });
  step("load", { ms: Date.now() - t0 });
  await page.screenshot({ path: `debug/ux-student-${name}-1-landing.png` });

  let clicks = 0;
  await page.selectOption("#school", "School A");
  clicks++;
  await page.waitForTimeout(300);
  let addMs = 0;
  const entryStart = Date.now();
  if (mode === "single") {
    for (const [id, lvl, grd, raw] of SUBJECTS) {
      await page.selectOption("#subject", id);
      await page.waitForTimeout(150);
      await page.selectOption("#level", lvl);
      await page.waitForTimeout(150);
      await page.selectOption("#grade", grd);
      await page.fill("#rawMark", raw);
      const tAdd = Date.now();
      await page.click("#addUpdateSubjectBtn");
      await page
        .waitForSelector("#fsbbTable", { timeout: 5000 })
        .catch(() => {});
      addMs = Date.now() - tAdd;
      clicks += 4; // subject, grade, mark, add (level stays at its G3 default)
      await page.waitForTimeout(250);
    }
  } else {
    await page.click("#bulkAdd > summary");
    clicks++;
    for (const [id, , grd, raw] of SUBJECTS) {
      await page.selectOption(
        '[data-bulk-row="' + id + '"] [data-bulk-grade]',
        grd,
      );
      await page.fill('[data-bulk-row="' + id + '"] [data-bulk-raw]', raw);
      clicks += 2; // grade, mark
    }
    const tAdd = Date.now();
    await page.click("#bulkAddBtn");
    clicks++;
    await page.waitForSelector("#fsbbTable", { timeout: 5000 }).catch(() => {});
    addMs = Date.now() - tAdd;
    await page.waitForTimeout(250);
  }
  step("entry", {
    mode,
    interactions: clicks,
    entryMs: Date.now() - entryStart,
  });
  step("after-6-subjects", { lastAddMs: addMs, clicks });

  // Where does the table sit? (distance from the top of the page)
  const place = await page.evaluate(() => {
    const el = document.querySelector("#resultsAdviceSection");
    const r = el.getBoundingClientRect();
    return {
      topFromPageTop: Math.round(r.top + window.scrollY),
      viewportH: window.innerHeight,
      cardsBefore: document.querySelectorAll("#eligibilityResultsContainer > *")
        .length,
    };
  });
  step("table-position", place);
  await page.locator("#resultsAdviceSection").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `debug/ux-student-${name}-2-table.png` });

  // Tap targets and accessibility of the table
  const targets = await page.evaluate(() => {
    const cells = [...document.querySelectorAll("[data-fsbb-cell]")];
    const heads = [...document.querySelectorAll("[data-fsbb-col]")];
    const small = [...cells, ...heads].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.height < 44 || r.width < 44;
    });
    return {
      cells: cells.length,
      smallTargets: small.length,
      unlabelled: cells.filter((b) => !b.getAttribute("aria-label")).length,
    };
  });
  step("tap-targets", targets);

  // Every string a student reads in the table, for the wording check
  const words = await page.evaluate(() => {
    const t = document.querySelector("#fsbbTable");
    return [
      ...new Set(
        [...t.querySelectorAll("[data-fsbb-cell], [data-row-route]")]
          .map((n) => n.innerText.replace(/\s+/g, " ").trim())
          .filter(Boolean),
      ),
    ];
  });
  step("table-words", { words });

  // Tap a box on your row → details
  const tap = Date.now();
  await page.click('[data-fsbb-cell][data-row="0"][data-col="3"]');
  await page.waitForSelector("#fsbbDetails:not(.hidden)");
  await page.waitForTimeout(900); // let the smooth scroll finish
  step("tap-your-row", { ms: Date.now() - tap, clicksToAnswer: clicks + 1 });
  const detailWords = await page.evaluate(() => ({
    headline: document.querySelector("[data-fsbb-headline]").innerText,
    advice: [...document.querySelectorAll("#fsbbDetails [data-advice]")].map(
      (n) => n.innerText.replace(/\s+/g, " ").trim(),
    ),
    warnings: [...document.querySelectorAll("[data-warnings] li")].map(
      (n) => n.innerText,
    ),
    visibleInViewport: (() => {
      const r = document.querySelector("#fsbbDetails").getBoundingClientRect();
      return r.top >= 0 && r.top < window.innerHeight;
    })(),
  }));
  step("details-your-row", detailWords);
  await page.screenshot({ path: `debug/ux-student-${name}-3-details.png` });

  // Tap a lower row (the "what if I move down" question)
  const tap2 = Date.now();
  await page
    .click('[data-fsbb-cell][data-row="2"][data-col="2"]')
    .catch(() => {});
  step("tap-lower-row", { ms: Date.now() - tap2 });
  step("details-lower-row", {
    headline: await page
      .innerText("[data-fsbb-headline]")
      .catch(() => "(none)"),
  });
  await page.screenshot({ path: `debug/ux-student-${name}-4-lower.png` });

  // Keyboard: can a student reach a box without a mouse?
  await page.keyboard.press("Escape");
  await page.focus("[data-fsbb-col]");
  let tabs = 0;
  for (; tabs < 12; tabs++) {
    await page.keyboard.press("Tab");
    const on = await page.evaluate(() =>
      document.activeElement.hasAttribute("data-fsbb-cell"),
    );
    if (on) break;
  }
  step("keyboard", { tabsToFirstBox: tabs + 1 });

  step("horizontal-page-scroll", {
    scrolls: await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  });
  step("page-errors", { errors });
  await browser.close();
  return out;
}

(async () => {
  const results = [];
  results.push(
    await run("desktop-single", { width: 1200, height: 900 }, "single"),
  );
  results.push(await run("desktop-bulk", { width: 1200, height: 900 }, "bulk"));
  results.push(await run("mobile-bulk", { width: 390, height: 844 }, "bulk"));
  console.log(JSON.stringify(results, null, 2));
})();
