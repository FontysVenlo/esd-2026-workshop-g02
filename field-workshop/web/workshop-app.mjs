import { copy as text } from './copy.mjs';
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
  storageWarning.textContent = text('workshop', 'browser_storage_is_unavailable_download_your_notes_before_leaving');
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    storageWarning.textContent = text('workshop', 'notes_are_saved_in_this_browser');
  } catch {
    storageWarning.textContent = text('workshop', 'browser_storage_is_unavailable_download_your_notes_before_leaving');
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
  unlockToastTitle.textContent = text('workshop', 'challenge_unlocked_2', { number: index + 1 });
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
  progressLabel.textContent = text('workshop', 'of_submitted', { count: count, total: challenges.length });
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
    label.append(element('span', text('workshop', 'challenge', { number: challenge.number }), 'challenge-number'));
    label.append(element('strong', challenge.title));
    const state = submitted ? text('workshop', 'submitted') : unlocked ? index === justUnlockedIndex ? text('workshop', 'just_unlocked') : text('workshop', 'available') : text('workshop', 'locked');
    label.append(element('span', page === challenge.id ? text('workshop', 'viewing', { state: state }) : state, 'challenge-state'));
    item.append(label);
    nav.append(item);
  });
}

function renderHome() {
  home.replaceChildren();

  const hero = element('section', undefined, 'home-hero');
  hero.append(element('div', text('workshop', 'welcome'), 'eyebrow'));
  hero.append(element('h1', text('workshop', 'northstar_supply'), 'home-title'));
  hero.querySelector('h1').id = 'welcome-title';
  hero.append(element('p', text('workshop', 'investigate_a_small_storefront_through_four_reliability_challenges_measure'), 'home-lead'));
  const nextIndex = currentChallengeIndex(progress);
  const next = element('a', submittedCount(progress) === challenges.length ? text('workshop', 'review_your_challenges') : text('workshop', 'continue_with_challenge', { number: nextIndex + 1 }), 'primary home-cta');
  next.href = `#${challenges[nextIndex].id}`;
  const actions = element('div', undefined, 'home-actions');
  const reset = element('button', text('workshop', 'reset_all_answers'), 'secondary home-cta');
  reset.type = 'button';
  reset.id = 'reset-answers';
  reset.addEventListener('click', resetProgress);
  actions.append(next, reset);
  hero.append(actions);
  home.append(hero);

  const purpose = element('section', undefined, 'home-section');
  purpose.append(element('div', text('workshop', 'your_role'), 'eyebrow'));
  purpose.append(element('h2', text('workshop', 'make_a_working_shop_fail_then_improve_its_response')));
  purpose.append(element('p', text('workshop', 'you_are_the_engineer_responsible_for_a_lamp_shop')));
  purpose.append(element('p', text('workshop', 'the_shop_normally_starts_healthy_in_challenges_1_2')));
  purpose.append(element('p', text('workshop', 'for_each_experiment_compare_three_runs_of_the_same')));
  const journey = element('ul', undefined, 'workshop-journey');
  for (const { overview: { title, description: copy } } of challenges) {
    const item = element('li');
    item.append(element('strong', title), element('span', copy));
    journey.append(item);
  }
  purpose.append(journey);
  home.append(purpose);

  const start = element('section', undefined, 'home-section');
  start.append(element('div', text('workshop', 'get_started'), 'eyebrow'));
  start.append(element('h2', text('workshop', 'quick_start')));
  const steps = element('ol', undefined, 'quick-start');
  for (const [title, copy] of [
    [text('workshop', 'start_the_stack'), text('workshop', 'extract_the_zip_start_docker_desktop_then_double_click')],
    [text('workshop', 'read_the_customer_problem'), text('workshop', 'open_challenge_1_in_the_sidebar_its_brief_explains')],
    [text('workshop', 'run_it_then_record_it'), text('workshop', 'use_storefront_network_faults_and_grafana_fill_the_notes')]
  ]) {
    const item = element('li');
    item.append(element('strong', title), element('span', copy));
    steps.append(item);
  }
  start.append(steps);
  start.append(element('p', text('workshop', 'windows_start_bat_stop_bat_mac_start_command_stop'), 'meta'));
  home.append(start);

  const tools = element('section', undefined, 'home-section');
  tools.append(element('div', text('workshop', 'workspace'), 'eyebrow'));
  tools.append(element('h2', text('workshop', 'tools')));
  const grid = element('div', undefined, 'home-tools');
  grid.append(
    externalLink(text('workshop', 'storefront_test_as_a_customer'), '/storefront', text('workshop', 'click_check_availability_and_order_preview_read_the_result')),
    externalLink(text('workshop', 'network_faults_create_the_problem_and_test_a_response'), 'http://localhost:8089', text('workshop', 'inject_a_fault_then_use_the_fallbacks_timeouts_tab')),
    externalLink(text('workshop', 'grafana_see_the_effect'), 'http://localhost:3008/d/field-workshop/field-workshop', text('workshop', 'read_charts_of_response_times_failures_and_fallback_use')),
    externalLink(text('workshop', 'prometheus_inspect_the_measurements'), 'http://localhost:9098', text('workshop', 'collects_service_metrics_every_five_seconds_and_supplies_grafana')),
    externalLink(text('workshop', 'commands_optional_reference'), '/tools', text('workshop', 'optional_api_and_terminal_examples_the_workshop_can_be'))
  );
  tools.append(grid);
  home.append(tools);
  home.append(renderExperimentHelp());
}

function renderMitigationGuide(help) {
  const guide = element('div', undefined, 'mitigation-guide');
  guide.append(element('p', help.description), element('p', help.instruction));
  const link = element('a', text('workshop', 'open_fallbacks_timeouts'), 'secondary next-link');
  link.href = 'http://localhost:8089/#mitigations';
  link.target = '_blank';
  link.rel = 'noopener';
  guide.append(link);
  guide.append(element('p', text('workshop', 'settings_apply_immediately_on_windows_and_mac_no_terminal'), 'meta'));
  return guide;
}

function renderExperimentHelp() {
  const help = element('details', undefined, 'experiment-help');
  help.append(element('summary', text('workshop', 'what_do_baseline_timeout_fallback_and_the_monitoring_tools')));
  const glossary = element('dl', undefined, 'experiment-glossary');
  for (const [term, meaning] of [
    [text('workshop', 'baseline'), text('workshop', 'your_measurements_with_normal_service_before_you_inject_a')],
    [text('workshop', 'fault'), text('workshop', 'the_problem_you_introduce_in_network_faults_a_slower')],
    [text('workshop', 'timeout'), text('workshop', 'how_long_storefront_will_wait_for_a_dependency_a')],
    [text('workshop', 'fallback'), text('workshop', 'the_useful_response_storefront_returns_when_a_dependency_cannot')],
    [text('workshop', 'prometheus'), text('workshop', 'the_measurement_collector_it_asks_the_services_for_their')],
    [text('workshop', 'grafana'), text('workshop', 'the_charts_you_read_during_the_experiment_customer_facing')],
    [text('workshop', 'observation_window'), text('workshop', 'the_period_you_measure_in_each_phase_use_comparable')],
    [text('workshop', 'blast_radius_and_abort_condition'), text('workshop', 'blast_radius_means_which_customer_actions_are_affected_an')]
  ]) glossary.append(element('dt', term), element('dd', meaning));
  help.append(glossary);
  const cleanup = element('details', undefined, 'command-help');
  cleanup.append(element('summary', text('workshop', 'how_to_restore_default_behavior_after_an_experiment')));
  cleanup.append(element('p', text('workshop', 'in_network_faults_click_clear_all_faults_in_the')));
  cleanup.append(element('p', text('workshop', 'verify_both_storefront_actions_work_again_and_live_stock')));
  help.append(cleanup);
  return help;
}

function renderChallenge(challenge) {
  const index = challenges.indexOf(challenge);
  const submission = progress.submissions[challenge.id];
  const draft = progress.drafts[challenge.id] ?? submission?.answers ?? {};
  detail.replaceChildren();

  const intro = element('section', undefined, 'challenge-intro');
  intro.append(element('div', text('workshop', 'challenge_of', { number: challenge.number, total: challenges.length, level: challenge.level }), 'eyebrow'));
  intro.append(element('h1', challenge.title));
  intro.append(element('h2', text('workshop', 'the_customer_problem')));
  intro.append(element('p', challenge.scenario, 'challenge-scenario'));
  const brief = element('div', undefined, 'challenge-brief');
  for (const [label, copy] of [[text('workshop', 'why_this_matters'), challenge.why], [text('workshop', 'the_issue_to_reproduce'), challenge.reproduce]]) {
    const section = element('section');
    section.append(element('h3', label), element('p', copy));
    brief.append(section);
  }
  intro.append(brief);
  intro.append(element('p', challenge.assignment, 'challenge-assignment'));
  const ready = element('aside', undefined, 'challenge-ready');
  ready.append(element('strong', text('workshop', 'before_you_start')), element('p', challenge.ready));
  intro.append(ready);
  intro.append(element('h2', text('workshop', 'your_five_steps')));
  const steps = element('ol', undefined, 'challenge-steps');
  challenge.tasks.forEach((task, taskIndex) => {
    const item = element('li');
    item.append(element('h3', task.title), element('p', task.instruction));
    if (taskIndex === 3 && challenge.mitigationGuide) item.append(renderMitigationGuide(challenge.mitigationHelp));
    steps.append(item);
  });
  intro.append(steps);
  const done = element('section', undefined, 'challenge-done');
  done.append(element('h2', text('workshop', 'you_are_finished_when')));
  const checklist = element('ul');
  challenge.done.forEach(criterion => checklist.append(element('li', criterion)));
  done.append(checklist);
  intro.append(done, renderExperimentHelp());
  const links = element('div', undefined, 'tool-links');
  for (const [label, href] of [
    [text('workshop', 'storefront'), '/storefront'],
    [text('workshop', 'network_faults'), 'http://localhost:8089'],
    [text('workshop', 'grafana'), 'http://localhost:3008/d/field-workshop/field-workshop'],
    [text('workshop', 'fallbacks_timeouts'), 'http://localhost:8089/#mitigations']
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
  notes.append(element('div', text('workshop', 'your_work'), 'eyebrow'));
  notes.append(element('h2', text('workshop', 'experiment_notes')));
  notes.append(element('p', text('workshop', 'fill_these_fields_as_you_run_the_experiment_above'), 'meta'));
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
  const submit = element('button', submission ? text('workshop', 'update_submission') : text('workshop', 'submit_notes'), 'primary');
  submit.type = 'submit';
  const hint = element('span', submission ? text('workshop', 'your_solution_is_shown_alongside_your_notes') : index + 1 < challenges.length ? text('workshop', 'submitting_unlocks_challenge', { number: index + 2 }) : text('workshop', 'submitting_completes_the_workshop'), 'meta');
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
        announcement.textContent = text('workshop', 'challenge_unlocked', { number: index + 2 });
        navAnimationTimer = setTimeout(() => {
          justUnlockedIndex = -1;
          renderNav(currentPage());
        }, 2200);
      } else if (index === challenges.length - 1 && !submission) {
        announcement.textContent = text('workshop', 'all_four_challenges_submitted');
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
    solution.append(element('div', text('workshop', 'after_submission'), 'eyebrow'));
    solution.append(element('h2', text('workshop', 'possible_solution')));
    solution.append(element('p', text('workshop', 'compare_the_reasoning_with_your_notes_exact_timings_vary'), 'meta'));
    const list = element('ol', undefined, 'solution-list');
    challenge.solution.forEach(step => list.append(element('li', step)));
    solution.append(list);
    if (index + 1 < challenges.length) {
      const next = element('a', text('workshop', 'open_challenge', { number: index + 2 }), 'secondary next-link');
      next.href = `#${challenges[index + 1].id}`;
      solution.append(next);
    } else {
      solution.append(element('p', text('workshop', 'all_four_challenges_are_submitted_download_your_notes_from'), 'status-line'));
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
  if (!window.confirm(text('workshop', 'reset_all_answers_this_clears_every_draft_and_submitted'))) return;
  progress = emptyProgress();
  justUnlockedIndex = -1;
  clearTimeout(navAnimationTimer);
  hideUnlockToast();
  announcement.textContent = text('workshop', 'all_answers_reset_challenge_1_is_available');
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
