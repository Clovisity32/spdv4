/**
 * Student UX journey — Student Pathway Dashboard
 *
 * Walks the core task flow (add subjects → read the FSBB table → tap a box →
 * compare a lower row) at desktop and phone width. It saves screenshots to
 * debug/ux-student-*.png and prints measurements the audit scores from.
 *
 * Enters six subjects through the subject picker (tick, add together, then set
 * each grade in the table) and counts the interactions and time it takes.
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

async function run(name, viewport, mode = "picker") {
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
  // Open the picker, tick all six, add them together (they land at G3 A1),
  // then set each grade and raw mark in the Your Subjects table.
  await page.click("#subjectPicker");
  clicks++;
  for (const [id] of SUBJECTS) {
    await page.check('[data-pick="' + id + '"]');
    clicks++;
  }
  const tAdd = Date.now();
  await page.click("#subjectMenuAdd");
  clicks++;
  await page.waitForSelector("#fsbbTable", { timeout: 5000 }).catch(() => {});
  addMs = Date.now() - tAdd;
  await page.waitForTimeout(250);
  for (const [id, lvl, grd, raw] of SUBJECTS) {
    const row = '[data-subject-row="' + id + '"]';
    if ((await page.inputValue(row + " [data-row-level]")) !== lvl) {
      await page.selectOption(row + " [data-row-level]", lvl);
      clicks++;
      await page.waitForTimeout(200);
    }
    await page.selectOption(row + " [data-row-grade]", grd);
    clicks++;
    await page.waitForTimeout(200);
    await page.fill(row + " [data-row-raw]", raw);
    await page.press(row + " [data-row-raw]", "Tab");
    clicks++;
    await page.waitForTimeout(200);
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

  // The requirements table inside the easiest course
  await page.$$eval("#fsbbCourses [data-pw]", (ds) =>
    ds.forEach((d, i) => (d.open = i === 0)),
  );
  const tapTip = Date.now();
  await page.click("#fsbbCourses [data-easiest] [data-slot-tip]");
  const tipInfo = await page.evaluate(() => {
    const t = document.querySelector(
      "#fsbbCourses [data-easiest] [data-slot-tip] [role=tooltip]",
    );
    const r = t.getBoundingClientRect();
    return {
      visible: t.offsetParent !== null,
      insideViewport: r.left >= 0 && r.right <= window.innerWidth,
      text: t.textContent.slice(0, 80),
    };
  });
  await page.screenshot({
    path: `debug/ux-student-${name}-3b-course-table.png`,
  });
  step("course-table", {
    tooltipOnTapMs: Date.now() - tapTip,
    tooltip: tipInfo,
    ...(await page.evaluate(() => {
      const tb = document.querySelector(
        "#fsbbCourses [data-easiest] [data-slot-table]",
      );
      const rows = [...tb.querySelectorAll("[data-slot-row]")];
      const cells = [...tb.querySelectorAll("td")];
      return {
        slotRows: rows.length,
        orRows: tb.querySelectorAll("[data-slot-or]").length,
        extraRows: tb.querySelectorAll("[data-slot-extra]").length,
        clippedCells: cells.filter((c) => c.scrollWidth > c.clientWidth + 1)
          .length,
        minFontPx: Math.min(
          ...cells.map((c) => parseFloat(getComputedStyle(c).fontSize)),
        ),
        tableHeightPx: Math.round(tb.getBoundingClientRect().height),
        needs: rows.map((r) => r.children[3].innerText.trim()),
        total: (tb.querySelector("[data-slot-total]") || {}).innerText || "",
      };
    })),
  });

  // The "what if I move down" question: LDL options under the table
  const opts = await page.evaluate(() =>
    [...document.querySelectorAll("[data-fsbb-opt]")].map((b) => ({
      key: b.dataset.fsbbOpt,
      text: b.innerText.replace(/\s+/g, " ").slice(0, 160),
    })),
  );
  step("ldl-options", { count: opts.length, options: opts });
  if (opts.length) {
    const tapOpt = Date.now();
    await page.click(`[data-fsbb-opt="${opts[0].key}"]`);
    await page.waitForSelector("#fsbbPreviewBar", { timeout: 5000 });
    await page.waitForTimeout(900);
    step("preview-option", {
      ms: Date.now() - tapOpt,
      bar: (await page.innerText("#fsbbPreviewBar")).replace(/\s+/g, " "),
      rowLabel: (await page.innerText("#fsbbTable tbody th")).replace(/\s+/g, " "),
      barInViewport: await page.evaluate(() => {
        const r = document.querySelector("#fsbbPreviewBar").getBoundingClientRect();
        return r.top >= 0 && r.top < window.innerHeight;
      }),
    });
    await page.screenshot({ path: `debug/ux-student-${name}-4-preview.png` });
    await page.click("[data-opt-clear]");
  }

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
  results.push(await run("desktop-picker", { width: 1200, height: 900 }));
  results.push(await run("mobile-picker", { width: 390, height: 844 }));
  console.log(JSON.stringify(results, null, 2));
})();
