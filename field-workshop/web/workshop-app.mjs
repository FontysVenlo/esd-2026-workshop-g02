import {
  STORAGE_KEY, buildRecord, challenges, currentChallengeIndex, emptyProgress, isUnlocked,
  normalizeProgress, saveDraft, submitChallenge, submittedCount
} from './workshop-state.mjs';

const nav = document.querySelector('#challenge-nav');
const home = document.querySelector('#home-page');
const detail = document.querySelector('#challenge-detail');
const homeLink = document.querySelector('#home-link');
const progressLabel = document.querySelector('#progress-label');
const progressFill = document.querySelector('#progress-fill');
const storageWarning = document.querySelector('#storage-warning');
const announcement = document.querySelector('#unlock-announcement');
const unlockToast = document.querySelector('#unlock-toast');
const unlockToastTitle = document.querySelector('#unlock-toast-title');
const unlockToastLink = document.querySelector('#unlock-toast-link');

let progress = emptyProgress();
let justUnlockedIndex = -1;
let navAnimationTimer;
let toastTimer;
try {
  progress = normalizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)));
} catch {
  storageWarning.textContent = 'Browser storage is unavailable. Download your notes before leaving.';
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    storageWarning.textContent = 'Notes are saved in this browser.';
  } catch {
    storageWarning.textContent = 'Browser storage is unavailable. Download your notes before leaving.';
  }
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function externalLink(label, href, description) {
  const item = element('a', undefined, 'tool-card');
  item.href = href;
  item.target = '_blank';
  item.rel = 'noopener';
  item.append(element('strong', label), element('span', description));
  return item;
}

function icon(kind) {
  const wrapper = element('span', undefined, `nav-icon ${kind}`);
  wrapper.setAttribute('aria-hidden', 'true');
  if (kind === 'completed') {
    wrapper.innerHTML = '<svg viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7"/></svg>';
  } else {
    wrapper.innerHTML = '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path class="lock-shackle" d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15" r="1"/></svg>';
  }
  return wrapper;
}

function hideUnlockToast() {
  clearTimeout(toastTimer);
  unlockToast.classList.remove('is-visible');
  unlockToast.hidden = true;
}

function showUnlockToast(index) {
  clearTimeout(toastTimer);
  unlockToastTitle.textContent = `Challenge ${index + 1} unlocked`;
  unlockToastLink.href = `#${challenges[index].id}`;
  unlockToast.hidden = false;
  unlockToast.classList.remove('is-visible');
  // Restart the entrance animation even when two submissions happen quickly.
  void unlockToast.offsetWidth;
  unlockToast.classList.add('is-visible');
  toastTimer = setTimeout(hideUnlockToast, 5000);
}

function currentPage() {
  const requested = window.location.hash.slice(1);
  if (!requested || requested === 'home') return 'home';
  const index = challenges.findIndex(challenge => challenge.id === requested);
  if (index >= 0 && isUnlocked(progress, index)) return requested;
  history.replaceState(null, '', `${location.pathname}${location.search}#home`);
  return 'home';
}

function renderNav(page) {
  nav.replaceChildren();
  const count = submittedCount(progress);
  progressLabel.textContent = `${count} of ${challenges.length} submitted`;
  progressFill.style.width = `${(count / challenges.length) * 100}%`;
  if (page === 'home') homeLink.setAttribute('aria-current', 'page');
  else homeLink.removeAttribute('aria-current');

  challenges.forEach((challenge, index) => {
    const unlocked = isUnlocked(progress, index);
    const submitted = Boolean(progress.submissions[challenge.id]?.submittedAt);
    const item = element(unlocked ? 'a' : 'button', undefined, `challenge-link ${submitted ? 'is-complete' : unlocked ? 'is-available' : 'is-locked'}`);
    if (unlocked) item.href = `#${challenge.id}`;
    else {
      item.type = 'button';
      item.disabled = true;
    }
    if (page === challenge.id) item.setAttribute('aria-current', 'page');
    if (index === justUnlockedIndex) item.classList.add('just-unlocked');
    item.append(icon(submitted ? 'completed' : unlocked ? 'unlocked' : 'locked'));
    const label = element('span', undefined, 'challenge-link-label');
    label.append(element('span', `Challenge ${challenge.number}`, 'challenge-number'));
    label.append(element('strong', challenge.title));
    const state = submitted ? 'Submitted' : unlocked ? index === justUnlockedIndex ? 'Just unlocked' : 'Available' : 'Locked';
    label.append(element('span', page === challenge.id ? `Viewing · ${state}` : state, 'challenge-state'));
    item.append(label);
    nav.append(item);
  });
}

function renderHome() {
  home.replaceChildren();

  const hero = element('section', undefined, 'home-hero');
  hero.append(element('div', 'WELCOME', 'eyebrow'));
  hero.append(element('h1', 'Northstar Supply', 'home-title'));
  hero.querySelector('h1').id = 'welcome-title';
  hero.append(element('p', 'Investigate a small storefront through four reliability challenges. Measure, introduce a fault, and compare what changes.', 'home-lead'));
  const nextIndex = currentChallengeIndex(progress);
  const next = element('a', submittedCount(progress) === challenges.length ? 'Review your challenges' : `Continue with Challenge ${nextIndex + 1}`, 'primary home-cta');
  next.href = `#${challenges[nextIndex].id}`;
  const actions = element('div', undefined, 'home-actions');
  const reset = element('button', 'Reset all answers', 'secondary home-cta');
  reset.type = 'button';
  reset.id = 'reset-answers';
  reset.addEventListener('click', resetProgress);
  actions.append(next, reset);
  hero.append(actions);
  home.append(hero);

  const purpose = element('section', undefined, 'home-section');
  purpose.append(element('div', 'YOUR ROLE', 'eyebrow'));
  purpose.append(element('h2', 'Make a working shop fail, then improve its response'));
  purpose.append(element('p', 'You are the engineer responsible for a lamp shop. Customers use “Check availability” to ask Inventory for stock, and “Order preview” to ask Inventory and Shipping for stock and a delivery quote.'));
  purpose.append(element('p', 'The shop normally starts healthy. In Challenges 1, 2, and 4, you deliberately add a local network fault to reproduce a customer problem. In Challenge 3, a facilitator or teammate adds a hidden fault for you to investigate. Opening a challenge or submitting answers does not change the running shop.'));
  purpose.append(element('p', 'For each experiment, compare three runs of the same customer action: normal service → fault active → the same fault with a mitigation. A mitigation changes how the shop handles the problem. Finish by removing the fault and restoring normal settings.'));
  const journey = element('ul', undefined, 'workshop-journey');
  for (const [title, copy] of [
    ['1 · Slow stock check', 'Add a 1.5-second Inventory delay. Can the shop respond sooner while saying stock is unconfirmed?'],
    ['2 · Missing delivery quote', 'Disconnect Shipping. Can stock checking and a useful order preview survive the outage?'],
    ['3 · Unknown incident', 'A partner introduces a fault. Can you identify it from customer symptoms and charts?'],
    ['4 · Your own experiment', 'Choose one customer risk, reproduce it, and support a mitigation with your own measurements.']
  ]) {
    const item = element('li');
    item.append(element('strong', title), element('span', copy));
    journey.append(item);
  }
  purpose.append(journey);
  home.append(purpose);

  const start = element('section', undefined, 'home-section');
  start.append(element('div', 'GET STARTED', 'eyebrow'));
  start.append(element('h2', 'Quick start'));
  const steps = element('ol', undefined, 'quick-start');
  for (const [title, copy] of [
    ['Start the stack', 'Extract the ZIP, start Docker Desktop, then double-click start.bat (Windows) or start.command (Mac).'],
    ['Read the customer problem', 'Open Challenge 1 in the sidebar. Its brief explains what to reproduce, why it matters, and the five actions to take.'],
    ['Run it, then record it', 'Use Storefront, Network Faults, and Grafana. Fill the notes with your own results; “Submit notes” reveals an example and unlocks the next challenge.']
  ]) {
    const item = element('li');
    item.append(element('strong', title), element('span', copy));
    steps.append(item);
  }
  start.append(steps);
  start.append(element('p', 'Windows: start.bat / stop.bat · Mac: start.command / stop.command. In a source checkout, these files are at the repository root.', 'meta'));
  home.append(start);

  const tools = element('section', undefined, 'home-section');
  tools.append(element('div', 'WORKSPACE', 'eyebrow'));
  tools.append(element('h2', 'Tools'));
  const grid = element('div', undefined, 'home-tools');
  grid.append(
    externalLink('Storefront · test as a customer', '/storefront', 'Click Check availability and Order preview; read the result and request time.'),
    externalLink('Network Faults · create the problem and test a response', 'http://localhost:8089', 'Inject a fault, then use the Fallbacks & timeouts tab to enable a mitigation. All controls work on Windows and Mac.'),
    externalLink('Grafana · see the effect', 'http://localhost:3008/d/field-workshop/field-workshop', 'Read charts of response times, failures, and fallback use.'),
    externalLink('Prometheus · inspect the measurements', 'http://localhost:9098', 'Collects service metrics every five seconds and supplies Grafana. Optional for raw queries; no input needed for the guided challenges.'),
    externalLink('Commands · optional reference', '/tools', 'Optional API and terminal examples. The workshop can be completed with the browser controls.')
  );
  tools.append(grid);
  home.append(tools);
  home.append(renderExperimentHelp());
}

function renderMitigationGuide(dependency) {
  const guide = element('div', undefined, 'mitigation-guide');
  guide.append(element('p', dependency === 'inventory'
    ? 'The fallback is already implemented. Enable it with these settings: wait at most 400 ms for Inventory, then return “Stock unconfirmed” if it cannot answer. The delay itself remains a separate setting in Network Faults.'
    : 'The fallback is already implemented. Enable it to keep the preview useful if Shipping cannot answer: show the available stock and say “Shipping quote unavailable”, without inventing a price or delivery date.'));
  guide.append(element('p', dependency === 'inventory'
    ? 'In Network Faults, open “Fallbacks & timeouts” and click “Use Challenge 1 settings”. Or set Inventory timeout to 400, check “Enable Inventory fallback”, and click “Apply Inventory settings”.'
    : 'In Network Faults, open “Fallbacks & timeouts” and click “Use Challenge 2 settings”. Or leave Shipping timeout at 3000, check “Enable Shipping fallback”, and click “Apply Shipping settings”.'));
  const link = element('a', 'Open Fallbacks & timeouts ↗', 'secondary next-link');
  link.href = 'http://localhost:8089/#mitigations';
  link.target = '_blank';
  link.rel = 'noopener';
  guide.append(link);
  guide.append(element('p', 'Settings apply immediately on Windows and Mac; no terminal or container restart is needed. Enabling a fallback alone does not trigger it: repeat the same fault and customer action to test it.', 'meta'));
  return guide;
}

function renderExperimentHelp() {
  const help = element('details', undefined, 'experiment-help');
  help.append(element('summary', 'What do baseline, timeout, fallback, and the monitoring tools mean?'));
  const glossary = element('dl', undefined, 'experiment-glossary');
  for (const [term, meaning] of [
    ['Baseline', 'Your measurements with normal service, before you inject a fault. Compare later runs against these numbers.'],
    ['Fault', 'The problem you introduce in Network Faults: a slower reply or a disconnected dependency. It affects the real local request path.'],
    ['Timeout', 'How long Storefront will wait for a dependency. A shorter timeout bounds the wait, but without a fallback the customer request can still fail.'],
    ['Fallback', 'The useful response Storefront returns when a dependency cannot answer. Enable it in the Network Faults console’s “Fallbacks & timeouts” tab and click Apply. Inventory fallback says “Stock unconfirmed”; Shipping fallback says the quote is unavailable. No terminal is needed.'],
    ['Prometheus', 'The measurement collector. It asks the services for their counters and timing measurements every five seconds, stores those time series, and supplies data to Grafana. Its website lets you inspect raw measurements or run queries; the guided tasks do not require you to type queries there.'],
    ['Grafana', 'The charts you read during the experiment. “Customer-facing p95 latency” shows a response-time estimate that 95% of requests fall at or below; “Dependency p95 latency” helps identify the slow provider. A chart in seconds uses 1.5 s for 1500 ms.'],
    ['Observation window', 'The period you measure in each phase. Use comparable fresh windows, such as 60–90 seconds. Grafana uses one-minute rates, so allow the previous phase to leave the calculation before interpreting a new phase.'],
    ['Blast radius and abort condition', 'Blast radius means which customer actions are affected. An abort condition is an unexpected result at which you stop and remove the fault, for example failure of a route you expected to stay healthy.']
  ]) glossary.append(element('dt', term), element('dd', meaning));
  help.append(glossary);
  const cleanup = element('details', undefined, 'command-help');
  cleanup.append(element('summary', 'How to restore default behavior after an experiment'));
  cleanup.append(element('p', 'In Network Faults, click “Clear all faults” in the Fault injection tab. Then open “Fallbacks & timeouts” and click “Restore default settings”. This turns both fallbacks off and sets both timeouts to 3000 ms. Clearing answers or network faults alone does not undo mitigation settings.'));
  cleanup.append(element('p', 'Verify both Storefront actions work again and live stock and shipping information return.'));
  help.append(cleanup);
  return help;
}

function renderChallenge(challenge) {
  const index = challenges.indexOf(challenge);
  const submission = progress.submissions[challenge.id];
  const draft = progress.drafts[challenge.id] ?? submission?.answers ?? {};
  detail.replaceChildren();

  const intro = element('section', undefined, 'challenge-intro');
  intro.append(element('div', `CHALLENGE ${challenge.number} OF ${challenges.length} · ${challenge.level}`, 'eyebrow'));
  intro.append(element('h1', challenge.title));
  intro.append(element('h2', 'The customer problem'));
  intro.append(element('p', challenge.scenario, 'challenge-scenario'));
  const brief = element('div', undefined, 'challenge-brief');
  for (const [label, copy] of [['Why this matters', challenge.why], ['The issue to reproduce', challenge.reproduce]]) {
    const section = element('section');
    section.append(element('h3', label), element('p', copy));
    brief.append(section);
  }
  intro.append(brief);
  intro.append(element('p', challenge.assignment, 'challenge-assignment'));
  const ready = element('aside', undefined, 'challenge-ready');
  ready.append(element('strong', 'Before you start'), element('p', challenge.ready));
  intro.append(ready);
  intro.append(element('h2', 'Your five steps'));
  const steps = element('ol', undefined, 'challenge-steps');
  challenge.tasks.forEach((task, taskIndex) => {
    const item = element('li');
    item.append(element('h3', task.title), element('p', task.instruction));
    if (taskIndex === 3 && challenge.mitigationGuide) item.append(renderMitigationGuide(challenge.mitigationGuide));
    steps.append(item);
  });
  intro.append(steps);
  const done = element('section', undefined, 'challenge-done');
  done.append(element('h2', 'You are finished when…'));
  const checklist = element('ul');
  challenge.done.forEach(criterion => checklist.append(element('li', criterion)));
  done.append(checklist);
  intro.append(done, renderExperimentHelp());
  const links = element('div', undefined, 'tool-links');
  for (const [label, href] of [
    ['Storefront', '/storefront'],
    ['Network Faults', 'http://localhost:8089'],
    ['Grafana', 'http://localhost:3008/d/field-workshop/field-workshop'],
    ['Fallbacks & timeouts', 'http://localhost:8089/#mitigations']
  ]) {
    const anchor = element('a', `${label} ↗`);
    anchor.href = href;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    links.append(anchor);
  }
  intro.append(links);
  detail.append(intro);

  const columns = element('div', undefined, submission ? 'challenge-columns has-solution' : 'challenge-columns');
  const notes = element('section', undefined, 'notes-panel');
  notes.append(element('div', 'YOUR WORK', 'eyebrow'));
  notes.append(element('h2', 'Experiment notes'));
  notes.append(element('p', 'Fill these fields as you run the experiment above. Use your own observed results; short, specific notes are enough. Submitting saves your record and unlocks the next challenge; it does not run the experiment for you.', 'meta'));
  const form = element('form');
  form.id = 'challenge-form';
  for (const field of challenge.fields) {
    const row = element('div', undefined, 'field-row');
    const label = element('label', field.label);
    const textarea = element('textarea');
    textarea.name = field.key;
    textarea.id = `${challenge.id}-${field.key}`;
    textarea.required = true;
    textarea.placeholder = field.prompt;
    textarea.value = draft[field.key] ?? '';
    label.htmlFor = textarea.id;
    label.append(element('small', field.prompt));
    textarea.addEventListener('input', () => {
      const answers = Object.fromEntries(challenge.fields.map(item => [item.key, form.elements[item.key].value]));
      progress = saveDraft(progress, challenge.id, answers);
      persist();
    });
    row.append(label, textarea);
    form.append(row);
  }
  const footer = element('div', undefined, 'form-footer');
  const submit = element('button', submission ? 'Update submission' : 'Submit notes', 'primary');
  submit.type = 'submit';
  const hint = element('span', submission ? 'Your solution is shown alongside your notes.' : index + 1 < challenges.length ? `Submitting unlocks Challenge ${index + 2}.` : 'Submitting completes the workshop.', 'meta');
  footer.append(submit, hint);
  const feedback = element('p', '', 'feedback');
  feedback.setAttribute('role', 'status');
  form.append(footer, feedback);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const answers = Object.fromEntries(challenge.fields.map(field => [field.key, form.elements[field.key].value]));
    const nextWasLocked = index + 1 < challenges.length && !isUnlocked(progress, index + 1);
    try {
      progress = submitChallenge(progress, challenge.id, answers);
      persist();
      if (nextWasLocked) {
        clearTimeout(navAnimationTimer);
        justUnlockedIndex = index + 1;
        announcement.textContent = `Challenge ${index + 2} unlocked.`;
        navAnimationTimer = setTimeout(() => {
          justUnlockedIndex = -1;
          renderNav(currentPage());
        }, 2200);
      } else if (index === challenges.length - 1 && !submission) {
        announcement.textContent = 'All four challenges submitted.';
      }
      renderAll();
      if (nextWasLocked) showUnlockToast(index + 1);
      detail.querySelector('#solution')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      feedback.className = 'feedback error';
      feedback.textContent = error.message;
    }
  });
  notes.append(form);
  columns.append(notes);

  if (submission) {
    const solution = element('aside', undefined, 'solution-panel');
    solution.id = 'solution';
    solution.append(element('div', 'AFTER SUBMISSION', 'eyebrow'));
    solution.append(element('h2', 'Possible solution'));
    solution.append(element('p', 'Compare the reasoning with your notes. Exact timings vary; this is not graded.', 'meta'));
    const list = element('ol', undefined, 'solution-list');
    challenge.solution.forEach(step => list.append(element('li', step)));
    solution.append(list);
    if (index + 1 < challenges.length) {
      const next = element('a', `Open Challenge ${index + 2} →`, 'secondary next-link');
      next.href = `#${challenges[index + 1].id}`;
      solution.append(next);
    } else {
      solution.append(element('p', 'All four challenges are submitted. Download your notes from the sidebar.', 'status-line'));
    }
    columns.append(solution);
  }
  detail.append(columns);
}

function renderAll() {
  const page = currentPage();
  renderNav(page);
  if (page === 'home') {
    detail.hidden = true;
    home.hidden = false;
    renderHome();
  } else {
    home.hidden = true;
    detail.hidden = false;
    renderChallenge(challenges.find(challenge => challenge.id === page));
  }
}

document.querySelector('#export-record').addEventListener('click', () => {
  const record = buildRecord(progress);
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  const download = element('a');
  download.href = url;
  download.download = 'northstar-experiment-record.json';
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function resetProgress() {
  if (!window.confirm('Reset all answers? This clears every draft and submitted answer in this browser and locks Challenges 2–4 again. Download your notes first if needed. This does not reset Docker, network faults, or mitigations.')) return;
  progress = emptyProgress();
  justUnlockedIndex = -1;
  clearTimeout(navAnimationTimer);
  hideUnlockToast();
  announcement.textContent = 'All answers reset. Challenge 1 is available.';
  persist();
  window.location.hash = 'home';
  renderAll();
}

document.querySelector('#reset-progress').addEventListener('click', resetProgress);

window.addEventListener('hashchange', () => {
  hideUnlockToast();
  renderAll();
  window.scrollTo(0, 0);
});

renderAll();
persist();
