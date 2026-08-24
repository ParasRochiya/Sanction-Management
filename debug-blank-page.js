// debug-blank-page.js
//
// Temporary diagnostic script for the "blank page" issue. It does not fix
// anything by itself, it only traces where the blank page comes from.
//
// USAGE (pick one):
//   A) Add this line right after the main.js script tag in index.html,
//      reload the page, then run window.debugSanction.runAll() in the
//      DevTools console:
//        <script type="module" src="./debug-blank-page.js"></script>
//
//   B) Paste this entire file into the DevTools console on the running
//      app page and press Enter, then run window.debugSanction.runAll().
//
// Remove the <script> tag (or just close the tab) once you're done —
// this is not meant to ship.

(async function setupDebugSanction() {
  let generateSingleOrMultiSanctionPdfBytes, appendSanctionsToExistingPdf;
  try {
    ({ generateSingleOrMultiSanctionPdfBytes, appendSanctionsToExistingPdf } = await import(
      './src/utils/pdfGenerator.js'
    ));
  } catch (e) {
    console.warn('[debug-sanction] could not import pdfGenerator.js, PDF tracing will be skipped:', e.message);
  }

  const log = (label, ...args) =>
    console.log(`%c[debug-sanction] ${label}`, 'color:#2563eb;font-weight:bold', ...args);
  const warn = (label, ...args) => console.warn(`[debug-sanction] ${label}`, ...args);

  // ---- 1. Inspect PDF bytes for blank/near-empty pages ----
  async function inspectPdfBytes(bytes, label = 'PDF') {
    if (!window.PDFLib || !window.PDFLib.PDFDocument) {
      warn('PDFLib not found on window; cannot inspect PDF bytes.');
      return;
    }
    const doc = await window.PDFLib.PDFDocument.load(bytes);
    const count = doc.getPageCount();
    log(`${label}: ${count} page(s)`);
    for (let i = 0; i < count; i++) {
      const page = doc.getPage(i);
      let contentLen = 'n/a';
      try {
        const contents = page.node.Contents();
        const streams = Array.isArray(contents) ? contents : contents ? [contents] : [];
        contentLen = streams.reduce((sum, s) => {
          const raw = typeof s.getContents === 'function' ? s.getContents() : null;
          return sum + (raw ? raw.length : 0);
        }, 0);
      } catch (e) {
        contentLen = `error reading contents: ${e.message}`;
      }
      const flag = typeof contentLen === 'number' && contentLen < 25 ? '  <-- LIKELY BLANK' : '';
      log(`  page ${i + 1}: content stream bytes = ${contentLen}${flag}`);
    }
    return count;
  }

  // ---- 2. Check whether print CSS actually reaches the key elements ----
  function inspectPrintCss() {
    let printRuleCount = 0;
    const targets = ['#doc-pages-container', '.doc-page-block', '.preview-wrap', '.main-layout'];
    const found = Object.fromEntries(targets.map((t) => [t, false]));

    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        warn(`cannot read rules from stylesheet (cross-origin): ${sheet.href}`);
        continue;
      }
      if (!rules) continue;
      for (const rule of rules) {
        if (rule.media && rule.media.mediaText && rule.media.mediaText.includes('print')) {
          printRuleCount++;
          for (const inner of rule.cssRules || []) {
            for (const t of targets) {
              if (inner.selectorText && inner.selectorText.includes(t)) found[t] = true;
            }
          }
        }
      }
    }

    log(`found ${printRuleCount} @media print rule block(s) in loaded stylesheets`);
    if (printRuleCount === 0) {
      warn('no @media print rules detected at all — the print stylesheet is missing or not loaded on this page.');
    }
    for (const t of targets) {
      log(`  ${t}: ${found[t] ? 'covered by a print rule' : 'NOT referenced in any @media print rule'}`);
    }

    for (const sel of ['#doc-pages-container', '.doc-page-block', '.preview-wrap']) {
      const el = document.querySelector(sel);
      if (!el) {
        warn(`  ${sel}: element not found in DOM`);
        continue;
      }
      const cs = getComputedStyle(el);
      log(
        `  ${sel} (screen layout) height=${cs.height} padding=${cs.padding} margin=${cs.margin} overflow=${cs.overflow} boxSizing=${cs.boxSizing}`
      );
    }
  }

  // ---- 3. Trace a fresh single-sanction PDF export ----
  async function traceExportPdf() {
    if (!generateSingleOrMultiSanctionPdfBytes) return;
    const app = window.sanctionApp;
    if (!app) {
      warn('window.sanctionApp not found — is bootstrapSanctionApp() still setting it?');
      return;
    }
    const snap = app.getSnapshot();
    log('generating a single-sanction PDF from the current form state...');
    const bytes = await generateSingleOrMultiSanctionPdfBytes([snap]);
    await inspectPdfBytes(bytes, 'fresh export (single snapshot)');
  }

  // ---- 4. Trace the attached PDF + append flow, if in use ----
  async function traceAppendPdf() {
    if (!appendSanctionsToExistingPdf) return;
    const app = window.sanctionApp;
    if (!app) return;
    if (!app.attachedPdfBytes) {
      log('no attached PDF in this session (append mode not active) — skipping append trace.');
      return;
    }
    log('inspecting the attached (existing) PDF before append...');
    await inspectPdfBytes(app.attachedPdfBytes, 'attached PDF (existing, before append)');

    const snap = app.getSnapshot();
    log('running appendSanctionsToExistingPdf()...');
    const merged = await appendSanctionsToExistingPdf(app.attachedPdfBytes, [snap]);
    await inspectPdfBytes(merged, 'merged PDF (after append)');
  }

  // ---- 5. Confirm which flow actually fires window.print() ----
  function traceWindowPrint() {
    const original = window.print;
    window.print = function (...args) {
      console.trace('[debug-sanction] window.print() called from:');
      return original.apply(window, args);
    };
    log('window.print() is now traced — click Print / Print Preview and read the call stack above.');
  }

  window.debugSanction = {
    inspectPdfBytes,
    inspectPrintCss,
    traceExportPdf,
    traceAppendPdf,
    traceWindowPrint,
    async runAll() {
      inspectPrintCss();
      await traceExportPdf();
      await traceAppendPdf();
      traceWindowPrint();
      log(
        'done. A page flagged LIKELY BLANK above is your source. If a selector shows NOT referenced, the print CSS fix is missing or not loaded on this page.'
      );
    },
  };

  log('ready — run window.debugSanction.runAll() to trace the blank-page issue.');
})();
