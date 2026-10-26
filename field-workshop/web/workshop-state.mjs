export const STORAGE_KEY = 'northstar-field-workshop-v1';

export const challenges = [
  {
    id: 'challenge-1',
    number: 1,
    title: 'Slow stock information',
    level: 'Guided entry',
    scenario: 'Customers report a slow product page. Stock comes from Inventory.',
    assignment: 'Add 1500 ms Inventory latency, measure the customer impact, then test a timeout and fallback.',
    tasks: [
      'Measure the healthy product page. Write a hypothesis and abort condition.',
      'Add 1500 ms Inventory latency. Compare customer and dependency latency.',
      'Remove the fault. Set a shorter timeout and an honest fallback.',
      'Repeat the same fault. Compare results, then restore the system.'
    ],
    solution: [
      'Healthy: product requests succeed with low local latency. Record your own baseline; exact numbers vary.',
      'With +1500 ms Inventory latency and the default 3000 ms timeout, product latency should rise by roughly 1500 ms. Inventory call latency rises too; requests normally still succeed.',
      'Example mitigation: INVENTORY_TIMEOUT_MS=400 and INVENTORY_FALLBACK=true, then recreate Storefront. Under the same fault, the page should return sooner with stock marked unconfirmed. Fallback counts rise.',
      'Trade-off: a fast HTTP 200 is not confirmed stock. Remove the fault, clear the two environment variables, recreate Storefront, and check that normal stock returns.'
    ],
    fields: [
      { key: 'steadyState', label: 'Healthy baseline and metric', prompt: 'Which route and metric did you choose? Include your measured baseline.' },
      { key: 'hypothesis', label: 'Hypothesis and abort condition', prompt: 'What did you expect from +1500 ms Inventory latency, and when would you stop?' },
      { key: 'faultEvidence', label: 'Fault evidence', prompt: 'Record the same route under fault: latency, success rate, Inventory signal, and time window.' },
      { key: 'mitigation', label: 'Mitigation and reason', prompt: 'What timeout/fallback did you use, and why is it safe for a product page?' },
      { key: 'validation', label: 'Same-fault validation', prompt: 'What happened when you applied the identical fault after mitigation?' },
      { key: 'conclusion', label: 'Conclusion and cleanup', prompt: 'Did resilience improve? What information is now uncertain? Confirm that the fault was removed.' }
    ]
  },
  {
    id: 'challenge-2',
    number: 2,
    title: 'Shipping is unavailable',
    level: 'Intermediate',
    scenario: 'Shipping becomes unavailable. Product and stock data are still available.',
    assignment: 'Find the affected customer route, then test whether an order preview can remain useful.',
    tasks: [
      'Measure the product and order-preview routes. Set an abort condition.',
      'Disconnect Shipping. Compare both routes and Shipping errors.',
      'Reconnect, apply a mitigation, then repeat the outage.',
      'Restore Shipping and explain the remaining uncertainty.'
    ],
    solution: [
      'With Shipping disconnected, /api/product should still work. /api/order-preview fails by default because it needs a quote.',
      'Example mitigation: set SHIPPING_FALLBACK=true and recreate Storefront. Repeat the same outage. The preview should return, but the shipping price and delivery time must be unavailable—not guessed.',
      'The blast radius shrinks to missing quote information. Reconnect Shipping, remove the environment variable, recreate Storefront, and verify both routes.'
    ],
    fields: [
      { key: 'steadyState', label: 'Healthy baseline', prompt: 'Record product and order-preview behavior before the outage.' },
      { key: 'hypothesis', label: 'Hypothesis, blast radius, and abort condition', prompt: 'Which customer functions do you expect to fail? When would you stop?' },
      { key: 'faultEvidence', label: 'Outage evidence', prompt: 'Compare both routes and the Shipping dependency. Include statuses and a time window.' },
      { key: 'mitigation', label: 'Mitigation and reason', prompt: 'Should an unavailable quote block an informational preview? Explain your choice.' },
      { key: 'validation', label: 'Same-outage validation', prompt: 'Record the route outcomes and fallback signal under the identical outage.' },
      { key: 'conclusion', label: 'Blast-radius conclusion and cleanup', prompt: 'Did the blast radius shrink? What information remains unavailable? Confirm restoration.' }
    ]
  },
  {
    id: 'challenge-3',
    number: 3,
    title: 'Investigate an unknown incident',
    level: 'Advanced',
    scenario: 'A facilitator has introduced an unknown fault. Customers report a slow or unreliable Storefront.',
    assignment: 'Diagnose it from measurements before inspecting the fault state.',
    tasks: [
      'Ask the facilitator to seed the incident after a reset.',
      'Check customer routes and dependency signals. Write your hypothesis.',
      'Inspect fault state, mitigate, and compare the same incident.',
      'Ask for the reveal and restore the system.'
    ],
    solution: [
      'If Inventory was slowed: product and preview latency rise together, and Inventory call latency rises. A short Inventory timeout with an unconfirmed-stock fallback can bound the wait.',
      'If Shipping was disconnected: product stays healthy while order preview fails; Shipping failures rise. A Shipping fallback can preserve an informational preview without a quote.',
      'Your diagnosis should identify the affected route, dependency, time window, and evidence before the facilitator reveals the fault. Compare the same route under the same incident after mitigation.',
      'Ask the facilitator which scenario was seeded. Remove that fault and restore default mitigation settings.'
    ],
    fields: [
      { key: 'symptom', label: 'Customer symptom and time window', prompt: 'Which customer route is slow or failing? When did you observe it?' },
      { key: 'signals', label: 'Grafana / Prometheus evidence', prompt: 'Which dependency and signals changed? Include panel names or a query.' },
      { key: 'diagnosis', label: 'Hypothesis and uncertainty', prompt: 'What is the likely fault? What else could explain the evidence?' },
      { key: 'mitigation', label: 'Mitigation and reason', prompt: 'What did you change, and why does it address this symptom?' },
      { key: 'validation', label: 'Validation under the same incident', prompt: 'Compare the same route and signals before and after the change.' },
      { key: 'conclusion', label: 'Conclusion and cleanup', prompt: 'What was confirmed? What trade-off remains? Confirm the facilitator removed the incident.' }
    ]
  },
  {
    id: 'challenge-4',
    number: 4,
    title: 'Your Mini GameDay',
    level: 'Capstone',
    scenario: 'You own the Storefront and have a short window for one controlled failure test.',
    assignment: 'Design the experiment, improve the service, and repeat the same fault.',
    tasks: [
      'Choose a route, dependency, fault, metric, blast radius, and abort condition.',
      'Measure baseline and write a hypothesis.',
      'Inject one fault, observe it, remove it, and apply a mitigation.',
      'Repeat the identical fault. Record the comparison and rollback.'
    ],
    solution: [
      'There is no single correct experiment. A valid record has a baseline, written hypothesis, limited fault, abort condition, measured outcome, mitigation, identical retest, and rollback.',
      'Worked example: test /api/product with +1500 ms Inventory latency. Expect roughly +1500 ms customer latency before mitigation. Use a 400 ms timeout and unconfirmed-stock fallback, then repeat +1500 ms; the response should be faster but stock uncertain.',
      'Check comparable time windows and the same route. Report request count, latency, success/failure, and fallback activity. Remove the fault and mitigation after the test.'
    ],
    fields: [
      { key: 'plan', label: 'Experiment plan', prompt: 'State route, dependency, fault, magnitude, expected blast radius, and abort condition.' },
      { key: 'steadyState', label: 'Steady state and hypothesis', prompt: 'What did you measure before the fault, and what do you predict?' },
      { key: 'faultEvidence', label: 'Fault result', prompt: 'Record your actual fault commands, time window, customer effect, and dependency signals.' },
      { key: 'mitigation', label: 'Mitigation and reason', prompt: 'What configuration or code changed, and why?' },
      { key: 'validation', label: 'Identical-fault validation', prompt: 'Reapply the same fault and compare route latency, success, and fallback behavior.' },
      { key: 'conclusion', label: 'Conclusion, trade-off, and rollback', prompt: 'Did resilience improve? What risk remains? How did you restore the clean state?' }
    ]
  }
];

export function emptyProgress() {
  return { drafts: {}, submissions: {} };
}

export function normalizeProgress(value) {
  if (!value || typeof value !== 'object') return emptyProgress();
  return {
    drafts: value.drafts && typeof value.drafts === 'object' ? value.drafts : {},
    submissions: value.submissions && typeof value.submissions === 'object' ? value.submissions : {}
  };
}

export function isUnlocked(progress, index) {
  return index === 0 || Boolean(progress.submissions[challenges[index - 1]?.id]?.submittedAt);
}

export function currentChallengeIndex(progress) {
  const index = challenges.findIndex(challenge => !progress.submissions[challenge.id]?.submittedAt);
  return index < 0 ? challenges.length - 1 : index;
}

export function submittedCount(progress) {
  return challenges.filter(challenge => Boolean(progress.submissions[challenge.id]?.submittedAt)).length;
}

export function saveDraft(progress, id, answers) {
  return { ...progress, drafts: { ...progress.drafts, [id]: { ...answers } } };
}

export function submitChallenge(progress, id, answers, submittedAt = new Date().toISOString()) {
  const index = challenges.findIndex(challenge => challenge.id === id);
  if (index < 0 || !isUnlocked(progress, index)) throw new Error('This challenge is locked.');
  const cleaned = {};
  for (const field of challenges[index].fields) {
    const answer = String(answers[field.key] ?? '').trim();
    if (!answer) throw new Error(`Please fill in: ${field.label}`);
    cleaned[field.key] = answer;
  }
  // Submission checks presence only. There is no grading or answer evaluation.
  return {
    ...progress,
    drafts: { ...progress.drafts, [id]: cleaned },
    submissions: { ...progress.submissions, [id]: { ...progress.submissions[id], answers: cleaned, submittedAt } }
  };
}

export function buildRecord(progress, exportedAt = new Date().toISOString()) {
  return {
    workshop: 'Northstar Supply Reliability Workshop',
    exportedAt,
    challenges: challenges.map(challenge => ({
      number: challenge.number,
      title: challenge.title,
      submittedAt: progress.submissions[challenge.id]?.submittedAt ?? null,
      answers: progress.submissions[challenge.id]?.answers ?? {},
      draftAnswers: progress.drafts[challenge.id] ?? {}
    }))
  };
}
