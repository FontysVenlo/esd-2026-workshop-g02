import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { format, home } from '/copy.mjs';
import {
  STORAGE_KEY,
  challenges,
  emptyProgress,
  normalizeProgress,
  submittedCount,
  currentChallengeIndex,
  isUnlocked,
  needsFreshStart,
  markStarted,
  saveDraft,
  submitChallenge,
  buildRecord,
} from '/workshop-state.mjs';

const WorkshopCopy = createContext(home);
function workshopCopy(page) {
  return {
    page,
    w: (key, values) => format(page.text[key], values),
    p: (key) => format(page.navigation[key]),
  };
}
function useWorkshopCopy() {
  return workshopCopy(useContext(WorkshopCopy));
}
const toolLinks = [
  ['storefront', '/storefront'],
  ['network_faults', 'http://localhost:8089'],
  ['grafana', 'http://localhost:3008/d/field-workshop/field-workshop'],
  ['fallbacks_timeouts', 'http://localhost:8089/#mitigations'],
];
function Link({ href, children, ...props }) {
  return (
    <a href={href} target="_blank" rel="noopener" {...props}>
      {children}
    </a>
  );
}
function Help() {
  const { w, page } = useWorkshopCopy();
  const glossary = [
    ['baseline', 'your_measurements_with_normal_service_before_you_inject_a'],
    ['fault', 'the_problem_you_introduce_in_network_faults_a_slower'],
    ['timeout', 'how_long_storefront_will_wait_for_a_dependency_a'],
    ['fallback', 'the_useful_response_storefront_returns_when_a_dependency_cannot'],
    ['prometheus', 'the_measurement_collector_it_asks_the_services_for_their'],
    ['grafana', 'the_charts_you_read_during_the_experiment_customer_facing'],
    ['observation_window', 'the_period_you_measure_in_each_phase_use_comparable'],
    [
      'blast_radius_and_abort_condition',
      'blast_radius_means_which_customer_actions_are_affected_an',
    ],
  ];
  return (
    <details className="experiment-help">
      <summary>{w('what_do_baseline_timeout_fallback_and_the_monitoring_tools')}</summary>
      <dl className="experiment-glossary">
        {glossary.map(([term, meaning]) => (
          <React.Fragment key={term}>
            <dt>{w(term)}</dt>
            <dd>{w(meaning)}</dd>
          </React.Fragment>
        ))}
      </dl>
      <details className="command-help">
        <summary>{w('how_to_restore_default_behavior_after_an_experiment')}</summary>
        <p>{w('in_network_faults_click_clear_all_faults_in_the')}</p>
        <p>{w('verify_both_storefront_actions_work_again_and_live_stock')}</p>
      </details>
    </details>
  );
}
function ExperimentGuide() {
  const { page } = useWorkshopCopy();
  return (
    <details className="experiment-help experiment-guide">
      <summary>{page.guide.title}</summary>
      <p>{page.guide.description}</p>
      <ol className="challenge-steps">
        {page.guide.steps.map((step, i) => (
          <li key={i}>
            <h3>{step.title}</h3>
            <p>{step.instruction}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
function Home({ progress, reset }) {
  const { w, page } = useWorkshopCopy();
  const next = currentChallengeIndex(progress);
  const tools = [
    [
      'storefront_test_as_a_customer',
      '/storefront',
      'click_check_availability_and_order_preview_read_the_result',
    ],
    [
      'network_faults_create_the_problem_and_test_a_response',
      'http://localhost:8089',
      'inject_a_fault_then_use_the_fallbacks_timeouts_tab',
    ],
    [
      'grafana_see_the_effect',
      'http://localhost:3008/d/field-workshop/field-workshop',
      'read_charts_of_response_times_failures_and_fallback_use',
    ],
    [
      'prometheus_inspect_the_measurements',
      'http://localhost:9098',
      'collects_service_metrics_every_five_seconds_and_supplies_grafana',
    ],
    [
      'commands_optional_reference',
      '/tools',
      'optional_api_and_terminal_examples_the_workshop_can_be',
    ],
  ];
  return (
    <section id="home-page" className="home-page" aria-labelledby="welcome-title">
      <section className="home-hero">
        <div className="eyebrow">{w('welcome')}</div>
        <h1 id="welcome-title" className="home-title">
          {w('northstar_supply')}
        </h1>
        <p className="home-lead">
          {w('investigate_a_small_storefront_through_four_reliability_challenges_measure')}
        </p>
        <div className="home-actions">
          <a className="primary home-cta" href={`#${challenges[next].id}`}>
            {submittedCount(progress) === challenges.length
              ? w('review_your_challenges')
              : w('continue_with_challenge', { number: next + 1 })}
          </a>
          <button type="button" className="secondary home-cta" onClick={reset}>
            {w('reset_all_answers')}
          </button>
        </div>
      </section>
      <ExperimentGuide />
      <section className="home-section">
        <div className="eyebrow">{w('your_role')}</div>
        <h2>{w('make_a_working_shop_fail_then_improve_its_response')}</h2>
        {[
          'you_are_the_engineer_responsible_for_a_lamp_shop',
          'the_shop_normally_starts_healthy_in_challenges_1_2',
        ].map((key) => (
          <p key={key}>{w(key)}</p>
        ))}
        <ul className="workshop-journey">
          {page.challengeSummaries.map((c) => (
            <li key={c.id}>
              <strong>{c.title}</strong>
              <span>{c.description}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="home-section">
        <div className="eyebrow">{w('get_started')}</div>
        <h2>{w('quick_start')}</h2>
        <ol className="quick-start">
          {[
            ['start_the_stack', 'extract_the_zip_start_docker_desktop_then_double_click'],
            ['read_the_customer_problem', 'open_challenge_1_in_the_sidebar_its_brief_explains'],
            ['run_it_then_record_it', 'use_storefront_network_faults_and_grafana_fill_the_notes'],
          ].map(([title, copy]) => (
            <li key={title}>
              <strong>{w(title)}</strong>
              <span>{w(copy)}</span>
            </li>
          ))}
        </ol>
        <p className="meta">{w('windows_start_bat_stop_bat_mac_start_command_stop')}</p>
      </section>
      <section className="home-section">
        <div className="eyebrow">{w('workspace')}</div>
        <h2>{w('tools')}</h2>
        <div className="home-tools">
          {tools.map(([title, href, copy]) => (
            <Link className="tool-card" key={href} href={href}>
              <strong>{w(title)}</strong>
              <span>{w(copy)}</span>
            </Link>
          ))}
        </div>
      </section>
      <Help />
    </section>
  );
}
function FreshStartToast({ status, retry }) {
  const { w } = useWorkshopCopy();
  if (!status) return null;
  return (
    <div
      id="fresh-start"
      className={`unlock-toast is-visible fresh-start-toast${status.state === 'error' ? ' is-error' : ''}`}
      role="status"
    >
      <span className="unlock-toast-symbol" aria-hidden="true">
        {status.state === 'error' ? '!' : status.state === 'done' ? '✓' : '…'}
      </span>
      <span className="unlock-toast-copy">
        {status.state === 'pending' && (
          <>
            <strong>{w('fresh_start')}</strong>
            <span>{w('preparing_a_fresh_start')}</span>
          </>
        )}
        {status.state === 'done' && (
          <>
            <strong>{w('fresh_start')}</strong>
            <span>{w('all_network_faults_were_cleared_and_timeouts_and_fallbacks')}</span>
          </>
        )}
        {status.state === 'error' && (
          <>
            <strong>{w('fresh_start_failed')}</strong>
            <span>{w('the_environment_could_not_be_reset', { error: status.error })}</span>
          </>
        )}
      </span>
      {status.state === 'error' && (
        <button type="button" onClick={retry}>
          {w('try_again')}
        </button>
      )}
    </div>
  );
}
function ChallengeInstructions({ challenge: c }) {
  const { w } = useWorkshopCopy();
  return (
    <section className="sidebar-instructions">
      <details className="challenge-ready">
        <summary>{w('before_you_start')}</summary>
        <p>{c.ready}</p>
      </details>
      <h2>{w('your_five_steps')}</h2>
      <ol className="challenge-steps">
        {c.tasks.map((task, i) => (
          <li key={i}>
            <details>
              <summary>
                <h3>{task.title}</h3>
              </summary>
              <p>{task.instruction}</p>
              {i === 3 && c.mitigationHelp && (
                <div className="mitigation-guide">
                  <p>{c.mitigationHelp.description}</p>
                  <p>{c.mitigationHelp.instruction}</p>
                  <Link className="secondary next-link" href="http://localhost:8089/#mitigations">
                    {w('open_fallbacks_timeouts')}
                  </Link>
                </div>
              )}
            </details>
          </li>
        ))}
      </ol>
      <details className="challenge-done">
        <summary>{w('you_are_finished_when')}</summary>
        <ul>
          {c.done.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
function Challenge({ challenge: c, progress, update, submit }) {
  const { w, page } = useWorkshopCopy();
  const [error, setError] = useState('');
  const solutionRef = useRef(null);
  const submission = progress.submissions[c.id];
  const answers = progress.drafts[c.id] ?? submission?.answers ?? {};
  const index = challenges.indexOf(c);
  return (
    <article id="challenge-detail" className="challenge-page">
      <section className="challenge-intro">
        <div className="eyebrow">
          {w('challenge_of', { number: c.number, total: challenges.length, level: c.level })}
        </div>
        <h1>{c.title}</h1>
        <h2>{w('the_customer_problem')}</h2>
        <p className="challenge-scenario">{c.scenario}</p>
        <div className="challenge-brief">
          {[
            ['why_this_matters', c.why],
            ['the_issue_to_reproduce', c.reproduce],
          ].map(([key, copy]) => (
            <section key={key}>
              <h3>{w(key)}</h3>
              <p>{copy}</p>
            </section>
          ))}
        </div>
        <p className="challenge-assignment">{c.assignment}</p>
        <a className="text-button" href="#home">
          {w('review_experiment_guide')}
        </a>
        <div className="tool-links">
          {toolLinks.map(([label, href]) => (
            <Link key={href} href={href}>
              {w(label)} ↗
            </Link>
          ))}
        </div>
      </section>
      <div className={`challenge-columns${submission ? ' has-solution' : ''}`}>
        <section className="notes-panel">
          <div className="eyebrow">{w('your_work')}</div>
          <h2>{w('experiment_notes')}</h2>
          <p className="meta">{w('fill_these_fields_as_you_run_the_experiment_above')}</p>
          <form
            id="challenge-form"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                submit(c.id, answers);
                setError('');
                requestAnimationFrame(() =>
                  solutionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
                );
              } catch (error) {
                setError(error.message);
              }
            }}
          >
            {c.fields.map((field) => (
              <div key={field.key} className="field-row">
                <label htmlFor={`${c.id}-${field.key}`}>
                  {field.label}
                  <small>{field.prompt}</small>
                </label>
                <textarea
                  id={`${c.id}-${field.key}`}
                  name={field.key}
                  required
                  value={answers[field.key] ?? ''}
                  onChange={(event) =>
                    update(c.id, { ...answers, [field.key]: event.target.value })
                  }
                />
              </div>
            ))}
            <div className="form-footer">
              <button className="primary" type="submit">
                {w(submission ? 'update_submission' : 'submit_notes')}
              </button>
              <span className="meta">
                {submission
                  ? w('your_solution_is_shown_alongside_your_notes')
                  : index < challenges.length - 1
                    ? w('submitting_unlocks_challenge', { number: index + 2 })
                    : w('submitting_completes_the_workshop')}
              </span>
            </div>
            <p className="feedback error" role="status">
              {error}
            </p>
          </form>
        </section>
        {submission && (
          <aside id="solution" ref={solutionRef} className="solution-panel">
            <div className="eyebrow">{w('after_submission')}</div>
            <h2>{w('possible_solution')}</h2>
            <p className="meta">{w('compare_the_reasoning_with_your_notes_exact_timings_vary')}</p>
            <ol className="solution-list">
              {c.solution.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
            {index < challenges.length - 1 ? (
              <a className="secondary next-link" href={`#${challenges[index + 1].id}`}>
                {w('open_challenge', { number: index + 2 })}
              </a>
            ) : (
              <p>{w('all_four_challenges_are_submitted_download_your_notes_from')}</p>
            )}
          </aside>
        )}
      </div>
    </article>
  );
}
function Workshop() {
  const [progress, setProgress] = useState(() => {
    try {
      return normalizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch {
      return emptyProgress();
    }
  });
  const [storage, setStorage] = useState('');
  const [hash, setHash] = useState(location.hash.slice(1));
  const [unlocked, setUnlocked] = useState(-1);
  const [announcement, setAnnouncement] = useState('');
  const downloadRef = useRef(null);
  const [download, setDownload] = useState('');
  const [freshStart, setFreshStart] = useState(null);
  const [freshStartAttempt, setFreshStartAttempt] = useState(0);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      setStorage(w('notes_are_saved_in_this_browser'));
    } catch {
      setStorage(w('browser_storage_is_unavailable_download_your_notes_before_leaving'));
    }
  }, [progress, hash]);
  useEffect(() => {
    const change = () => {
      setHash(location.hash.slice(1));
      setUnlocked(-1);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (unlocked < 0) return;
    const timer = setTimeout(() => setUnlocked(-1), 5000);
    return () => clearTimeout(timer);
  }, [unlocked]);
  useEffect(() => {
    if (freshStart?.state !== 'done') return;
    const timer = setTimeout(() => setFreshStart(null), 6000);
    return () => clearTimeout(timer);
  }, [freshStart]);
  useEffect(() => {
    if (!download) return;
    downloadRef.current.click();
    return () => URL.revokeObjectURL(download);
  }, [download]);
  const index = challenges.findIndex((c) => c.id === hash);
  const current = index >= 0 && isUnlocked(progress, index) ? challenges[index] : null;
  const page = current ?? home;
  const { w, p } = workshopCopy(page);
  useEffect(() => {
    document.title = page.pageTitle;
  }, [page]);
  useEffect(() => {
    setFreshStart(null);
    if (!current || !needsFreshStart(progress, index)) return;
    // Record a successful reset even if the participant has already moved on,
    // so returning to this challenge never wipes an experiment in progress.
    let visible = true;
    const id = current.id;
    setFreshStart({ state: 'pending' });
    fetch('/api/workshop/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? response.status);
      })
      .then(() => {
        setProgress((previous) => markStarted(previous, id));
        if (visible) {
          setFreshStart({ state: 'done' });
          setAnnouncement(w('fresh_start_announcement'));
        }
      })
      .catch((error) => {
        if (visible) setFreshStart({ state: 'error', error: error.message });
      });
    return () => {
      visible = false;
    };
  }, [current?.id, freshStartAttempt]);
  useEffect(() => {
    if (hash && hash !== 'home' && !current) {
      history.replaceState(null, '', `${location.pathname}${location.search}#home`);
      setHash('home');
    }
  }, [hash, current]);
  function reset() {
    if (!window.confirm(w('reset_all_answers_this_clears_every_draft_and_submitted'))) return;
    setProgress(emptyProgress());
    setUnlocked(-1);
    setAnnouncement(w('all_answers_reset_challenge_1_is_available'));
    location.hash = 'home';
  }
  function submit(id, answers) {
    const index = challenges.findIndex((c) => c.id === id);
    const next = submitChallenge(progress, id, answers);
    if (index < challenges.length - 1 && !isUnlocked(progress, index + 1)) {
      setUnlocked(index + 1);
      setAnnouncement(w('challenge_unlocked', { number: index + 2 }));
    } else if (index === challenges.length - 1) setAnnouncement(w('all_four_challenges_submitted'));
    setProgress(next);
  }
  const count = submittedCount(progress);
  return (
    <WorkshopCopy.Provider value={page}>
      <header>
        <div className="header-inner workshop-header">
          <a className="brand" href="#home">
            {p('northstar_supply')} <span>{p('workshop')}</span>
          </a>
          <span className="header-note">{p('reliability_workshop')}</span>
        </div>
      </header>
      <main className="workshop-shell">
        <aside className="workshop-sidebar" aria-label={p('workshop_navigation')}>
          <a
            id="home-link"
            className="home-link"
            href="#home"
            aria-current={!current ? 'page' : undefined}
          >
            {p('home')} <span>{p('welcome_setup')}</span>
          </a>
          <div className="sidebar-heading">{p('challenges')}</div>
          <nav id="challenge-nav" className="challenge-nav" aria-label={p('challenges')}>
            {challenges.map((c, i) => {
              const submitted = Boolean(progress.submissions[c.id]?.submittedAt),
                available = isUnlocked(progress, i);
              const state = w(
                submitted
                  ? 'submitted'
                  : available
                    ? i === unlocked
                      ? 'just_unlocked'
                      : 'available'
                    : 'locked',
              );
              const Tag = available ? 'a' : 'button';
              return (
                <Tag
                  key={c.id}
                  href={available ? `#${c.id}` : undefined}
                  disabled={!available}
                  type={available ? undefined : 'button'}
                  aria-current={current?.id === c.id ? 'page' : undefined}
                  className={`challenge-link ${submitted ? 'is-complete' : available ? 'is-available' : 'is-locked'} ${i === unlocked ? 'just-unlocked' : ''}`}
                >
                  <span
                    className={`nav-icon ${submitted ? 'completed' : available ? 'unlocked' : 'locked'}`}
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24">
                      {submitted ? (
                        <path d="m5 12 4.5 4.5L19 7" />
                      ) : (
                        <>
                          <rect x="5" y="10" width="14" height="11" rx="2" />
                          <path className="lock-shackle" d="M8 10V7a4 4 0 0 1 8 0v3" />
                          <circle cx="12" cy="15" r="1" />
                        </>
                      )}
                    </svg>
                  </span>
                  <span className="challenge-link-label">
                    <span className="challenge-number">{w('challenge', { number: c.number })}</span>
                    <strong>{page.navigation.challengeTitles[c.id]}</strong>
                    <span className="challenge-state">
                      {current?.id === c.id ? w('viewing', { state }) : state}
                    </span>
                  </span>
                </Tag>
              );
            })}
          </nav>
          {current && <ChallengeInstructions key={current.id} challenge={current} />}
          <div className="sidebar-progress">
            <strong id="progress-label">
              {w('of_submitted', { count, total: challenges.length })}
            </strong>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${(count / challenges.length) * 100}%` }} />
            </div>
            <div className="sidebar-actions">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setDownload(
                    URL.createObjectURL(
                      new Blob([JSON.stringify(buildRecord(progress), null, 2)], {
                        type: 'application/json',
                      }),
                    ),
                  )
                }
              >
                {p('download_notes')}
              </button>
              <button type="button" className="text-button" onClick={reset}>
                {p('clear_notes')}
              </button>
            </div>
            <span className="meta" role="status">
              {storage}
            </span>
          </div>
        </aside>
        <div className="workshop-main">
          <div className="visually-hidden" role="status" aria-live="polite">
            {announcement}
          </div>
          {current ? (
            <Challenge
              key={current.id}
              challenge={current}
              progress={progress}
              update={(id, answers) => setProgress((previous) => saveDraft(previous, id, answers))}
              submit={submit}
            />
          ) : (
            <Home progress={progress} reset={reset} />
          )}
        </div>
      </main>
      {unlocked >= 0 && (
        <div id="unlock-toast" className="unlock-toast is-visible">
          <span className="unlock-toast-symbol" aria-hidden="true">
            {p('text')}
          </span>
          <span className="unlock-toast-copy">
            <strong>{w('challenge_unlocked_2', { number: unlocked + 1 })}</strong>
            <span>{p('ready_in_your_sidebar')}</span>
          </span>
          <a href={`#${challenges[unlocked].id}`}>{p('open')}</a>
        </div>
      )}
      {unlocked < 0 && (
        <FreshStartToast status={freshStart} retry={() => setFreshStartAttempt((n) => n + 1)} />
      )}
      <a
        ref={downloadRef}
        href={download || undefined}
        download="northstar-experiment-record.json"
        hidden
      />
    </WorkshopCopy.Provider>
  );
}
createRoot(document.getElementById('workshop-root')).render(<Workshop />);
