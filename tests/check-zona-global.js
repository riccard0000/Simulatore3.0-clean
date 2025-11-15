const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

(async () => {
  try {
    const root = process.cwd();
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable' });
    const { window } = dom;

  // Inject data.js and script.js into the DOM so definitions are available
  const dataCode = fs.readFileSync(path.join(root, 'data.js'), 'utf8');
  const dataEl = window.document.createElement('script');
  dataEl.textContent = dataCode + '\n//# sourceURL=data.js';
  window.document.body.appendChild(dataEl);

  const scriptCode = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = scriptCode + '\n//# sourceURL=script.js';
  window.document.body.appendChild(scriptEl);

    // Wait a tick, then call initCalculator if present
    await new Promise(r => setTimeout(r, 50));

    if (typeof window.initCalculator !== 'function') {
      console.error('initCalculator not found in script.js');
      process.exit(2);
    }

    await window.initCalculator();
    // Simulate a user selection of subject to trigger subject-specific rendering
    const subjectSel = window.document.getElementById('subject-type');
    if (subjectSel) {
      // pick the first non-empty option if available
      const opt = Array.from(subjectSel.options).find(o => o.value && o.value !== '');
      if (opt) {
        subjectSel.value = opt.value;
        subjectSel.dispatchEvent(new window.Event('change', { bubbles: true }));
        // give event handlers a tick
        await new Promise(r => setTimeout(r, 50));
      }
    }

    // After initialization, the global zona wrapper must exist
    const globalZona = window.document.getElementById('global-zona-climatica-wrapper');
    if (!globalZona) {
      console.error('Global zona wrapper not found');
      process.exit(3);
    }

    const select = window.document.getElementById('global-zona-climatica');
    if (!select) {
      console.error('Global zona select not found');
      process.exit(4);
    }

    console.log('OK: global zona selector present');
    process.exit(0);
  } catch (e) {
    console.error('Exception during test:', e);
    process.exit(1);
  }
})();
