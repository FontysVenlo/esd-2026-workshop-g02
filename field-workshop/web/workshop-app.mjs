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
  hero.append(next);
  home.append(hero);

  const start = element('section', undefined, 'home-section');
  start.append(element('div', 'GET STARTED', 'eyebrow'));
  start.append(element('h2', 'Quick start'));
  const steps = element('ol', undefined, 'quick-start');
  for (const [title, copy] of [
    ['Start the stack', 'Extract the ZIP, start Docker Desktop, then double-click the Start Workshop file for your laptop.'],
    ['Open the tools', 'Use the Storefront, Network Faults and Grafana links below to run your experiment.'],
    ['Record your work', 'Open Challenge 1 in the sidebar. Submit your notes to reveal an example solution and unlock Challenge 2.']
  ]) {
    const item = element('li');
    item.append(element('strong', title), element('span', copy));
    steps.append(item);
  }
  start.append(steps);
  start.append(element('p', 'Windows: Start Workshop.bat · Mac: Start Workshop.command. Use the matching Stop Workshop file when finished.', 'meta'));
  home.append(start);

  const tools = element('section', undefined, 'home-section');
  tools.append(element('div', 'WORKSPACE', 'eyebrow'));
  tools.append(element('h2', 'Tools'));
  const grid = element('div', undefined, 'home-tools');
  grid.append(
    externalLink('Storefront', '/storefront', 'Try the customer journey'),
    externalLink('Network Faults', 'http://localhost:8089', 'Add delay or disconnect a dependency'),
    externalLink('Grafana', 'http://localhost:3008/d/field-workshop/field-workshop', 'Watch latency, failures and fallbacks'),
    externalLink('Prometheus', 'http://localhost:9098', 'Explore raw metrics'),
    externalLink('Commands', '/tools', 'Windows and Mac configuration examples')
  );
  tools.append(grid);
  home.append(tools);
}

function renderChallenge(challenge) {
  const index = challenges.indexOf(challenge);
  const submission = progress.submissions[challenge.id];
  const draft = progress.drafts[challenge.id] ?? submission?.answers ?? {};
  detail.replaceChildren();

  const intro = element('section', undefined, 'challenge-intro');
  intro.append(element('div', `CHALLENGE ${challenge.number} OF ${challenges.length} · ${challenge.level}`, 'eyebrow'));
  intro.append(element('h1', challenge.title));
  intro.append(element('p', challenge.scenario, 'challenge-scenario'));
  intro.append(element('p', challenge.assignment, 'challenge-assignment'));
  const steps = element('ol', undefined, 'challenge-steps');
  challenge.tasks.forEach(task => steps.append(element('li', task)));
  intro.append(steps);
  const links = element('div', undefined, 'tool-links');
  for (const [label, href] of [
    ['Storefront', '/storefront'],
    ['Network Faults', 'http://localhost:8089'],
    ['Grafana', 'http://localhost:3008/d/field-workshop/field-workshop'],
    ['Commands', '/tools']
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
  notes.append(element('p', 'Your draft saves in this browser. Fill every field before submitting.', 'meta'));
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

document.querySelector('#reset-progress').addEventListener('click', () => {
  if (!window.confirm('Clear drafts and submissions saved in this browser? Download your notes first if needed. This does not reset Docker, network faults, or mitigations.')) return;
  progress = emptyProgress();
  justUnlockedIndex = -1;
  clearTimeout(navAnimationTimer);
  hideUnlockToast();
  announcement.textContent = 'Notes cleared. Challenge 1 is available.';
  persist();
  window.location.hash = 'home';
  renderAll();
});

window.addEventListener('hashchange', () => {
  hideUnlockToast();
  renderAll();
  window.scrollTo(0, 0);
});

renderAll();
persist();
