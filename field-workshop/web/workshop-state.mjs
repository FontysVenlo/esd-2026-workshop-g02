export const STORAGE_KEY = 'northstar-field-workshop-v1';

export const challenges = [
  {
    id: 'challenge-1',
    number: 1,
    title: 'Slow stock information',
    level: 'Guided entry',
    scenario: 'You maintain an online shop that sells a desk lamp. A customer clicks “Check availability” before deciding to buy, but the stock check keeps them waiting. The lamp description and price are already visible; the shop is waiting for a separate Inventory service to confirm stock.',
    why: 'A slow dependency can make a working shop feel unresponsive. You need to decide how long the customer should wait and what the shop can honestly show when it cannot confirm stock.',
    reproduce: 'Make Inventory replies 1500 ms (1.5 seconds) slower in Network Faults. Then click “Check availability” in Storefront. You are reproducing a slow stock check, not a complete outage.',
    ready: 'The stack starts healthy. Before this experiment, use “Clear all faults” in Network Faults and “Restore default settings” in the Fallbacks & timeouts tab if you changed mitigation settings earlier. Confirm that “Check availability” shows live stock. Opening this challenge does not apply a fault.',
    assignment: 'Can the shop respond sooner during a slow stock check without pretending the lamp is in stock?',
    mitigationGuide: 'inventory',
    tasks: [
      { title: 'Try the healthy customer journey', instruction: 'Open Storefront and click “Check availability” a few times. Record the displayed milliseconds and stock result. In Grafana, find /api/product under “Customer-facing p95 latency”. Write what you expect a 1.5-second Inventory delay to do and when you would stop the test.' },
      { title: 'Reproduce the customer complaint', instruction: 'Open Network Faults, choose Inventory, set “Response delay (ms)” to 1500, and click “Apply delay”. Return to Storefront and click “Check availability” again. Look for the longer wait; with default settings, the request should normally still succeed.' },
      { title: 'Find evidence of the cause', instruction: 'Record the new request times and compare them with your healthy measurements. In Grafana, compare /api/product in “Customer-facing p95 latency” with inventory in “Dependency p95 latency”. Use a fresh 60–90-second window per phase so old data does not dominate the comparison.' },
      { title: 'Change how the shop handles the delay', instruction: 'Remove the Inventory delay first. In Network Faults, open “Fallbacks & timeouts” and click “Use Challenge 1 settings”. This enables Inventory fallback with a 400 ms timeout immediately. The timeout limits the wait; the fallback lets the shop return “Stock unconfirmed”. No source-code edit is required.' },
      { title: 'Repeat, compare, and clean up', instruction: 'Apply the same 1500 ms Inventory delay again. Repeat “Check availability” and record the response time, displayed stock message, and “Fallback activity” in Grafana. Explain the speed-versus-certainty trade-off. Clear faults, click “Restore default settings” in Fallbacks & timeouts, check live stock returns, then submit your notes below.' }
    ],
    done: [
      'You recorded the same customer action in three states: healthy, delayed, and delayed with mitigation.',
      'You explained whether the response became faster and why “Stock unconfirmed” is different from confirmed availability.',
      'You removed the fault, restored the defaults, and submitted your own measurements.'
    ],
    solution: [
      'Healthy: product requests succeed with low local latency. Record your own baseline; exact numbers vary.',
      'With +1500 ms Inventory latency and the default 3000 ms timeout, product latency should rise by roughly 1500 ms. Inventory call latency rises too; requests normally still succeed.',
      'Example mitigation: in Fallbacks & timeouts, apply a 400 ms Inventory timeout with Inventory fallback enabled. Under the same fault, the page should return sooner with stock marked unconfirmed. Fallback counts rise.',
      'Trade-off: a fast HTTP 200 is not confirmed stock. Clear the fault, click “Restore default settings”, and check that normal stock returns.'
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
    scenario: 'A customer can check that the desk lamp is in stock, but clicks “Order preview” to see delivery cost and time. The external shipping provider is unavailable. The shop currently treats that missing quote as a failure of the whole preview.',
    why: 'A shipping outage should have a limited effect on the customer journey. You need to decide whether an informational preview is still useful when it can show stock but cannot promise a delivery price or date.',
    reproduce: 'Choose Shipping in Network Faults and click “Disconnect”. In Storefront, try both “Check availability” and “Order preview”. Compare which customer action still works and which fails.',
    ready: 'Clear all faults and click “Restore default settings” in Fallbacks & timeouts. Verify that both Storefront buttons work before disconnecting Shipping. This is an order preview only; no purchase is made.',
    assignment: 'Can a shipping outage be limited to missing delivery information instead of a failed preview?',
    mitigationGuide: 'shipping',
    tasks: [
      { title: 'Check both healthy actions', instruction: 'Click “Check availability” and “Order preview” in Storefront. Record the stock result, shipping quote, and timings. These actions call /api/product and /api/order-preview respectively. Predict which action needs Shipping and set an abort condition.' },
      { title: 'Reproduce the provider outage', instruction: 'In Network Faults, choose Shipping and click “Disconnect”. Return to Storefront and try both buttons. Record which action succeeds, which fails, and any error status shown.' },
      { title: 'Measure the affected part of the shop', instruction: 'Use “Customer request rate” in Grafana to compare route/status outcomes and “Dependency outcomes” to inspect shipping failures. Observe comparable 60–90-second windows. Describe the blast radius: the customer functions affected by this one dependency outage.' },
      { title: 'Keep the preview useful', instruction: 'Reconnect Shipping first. In Network Faults, open “Fallbacks & timeouts” and click “Use Challenge 2 settings” to enable Shipping fallback immediately. This permits a preview without a shipping quote; it must not invent a price or delivery date.' },
      { title: 'Repeat the outage and check the trade-off', instruction: 'Disconnect Shipping again and repeat both customer actions. Record whether the preview is now useful, which information is missing, and the “Fallback activity” signal. Reconnect Shipping, restore defaults, verify both actions, and submit your notes.' }
    ],
    done: [
      'You compared both customer actions before the outage, during the outage, and during the same outage with mitigation.',
      'You identified the affected customer function and explained why an unavailable quote must not become a made-up delivery promise.',
      'You restored Shipping and the default settings and submitted your evidence.'
    ],
    solution: [
      'With Shipping disconnected, /api/product should still work. /api/order-preview fails by default because it needs a quote.',
      'Example mitigation: enable Shipping fallback in the Fallbacks & timeouts tab. Repeat the same outage. The preview should return, but the shipping price and delivery time must be unavailable—not guessed.',
      'The blast radius shrinks to missing quote information. Reconnect Shipping, click “Restore default settings”, and verify both routes.'
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
    scenario: 'You are the engineer on call. A support ticket says: “Something is wrong with the lamp shop: checking stock or previewing delivery is slow or fails.” A facilitator or teammate introduces one hidden dependency fault. You must find the likely cause from the customer symptoms and monitoring.',
    why: 'During a real incident, the customer reports a symptom, not the broken dependency. This challenge practices using evidence to choose a fix instead of changing settings at random.',
    reproduce: 'Ask a facilitator or teammate to seed exactly one incident using the facilitator notes. They keep the chosen fault secret. You do not inject your own known fault in this challenge.',
    ready: 'This challenge needs another person to prepare the incident. Before they seed it, clear old faults, restore default settings, and record healthy behavior. If working alone, arrange a partner or facilitator before starting; an unchanged, healthy stack has no mystery incident to diagnose. Do not clear faults after the incident has been seeded.',
    assignment: 'Which customer action is affected, which dependency is responsible, and what evidence supports your diagnosis?',
    tasks: [
      { title: 'Prepare the incident with a partner', instruction: 'Start from the clean baseline described above. Ask the facilitator or teammate to use the “Seed Assignment 3” instructions in docs/facilitator.md without showing you their choice. Once they confirm the incident is active, begin your investigation.' },
      { title: 'Reproduce the reported symptom', instruction: 'Try “Check availability” and “Order preview”. Record which one is slow or failing, the displayed time/status, and when you observed it. Leave the fault controls and their current-state display unopened for now.' },
      { title: 'Write a diagnosis from monitoring', instruction: 'In Grafana, compare customer latency and route/status outcomes with “Dependency p95 latency” and “Dependency outcomes”. Write the likely dependency, whether the symptom suggests delay or unavailability, and an alternative explanation before inspecting Network Faults.' },
      { title: 'Confirm and mitigate', instruction: 'After recording your hypothesis, inspect Network Faults with the facilitator. Choose a timeout/fallback change supported by your evidence and apply it in Fallbacks & timeouts. Keep the same incident active, or have the facilitator reapply it exactly, so the comparison remains fair.' },
      { title: 'Validate and ask for the reveal', instruction: 'Repeat the same customer actions and compare fresh observation windows before and after mitigation. Ask the facilitator to reveal the fault and compare it with your diagnosis. Clear the incident, restore defaults, verify recovery, and submit the timeline and evidence.' }
    ],
    done: [
      'You recorded a diagnosis with supporting signals before looking at the fault state.',
      'You compared the same incident before and after a justified mitigation and checked your diagnosis against the reveal.',
      'You and the facilitator restored the clean system and you submitted your findings.'
    ],
    solution: [
      'If Inventory was slowed: product and preview latency rise together, and Inventory call latency rises. A short Inventory timeout with an unconfirmed-stock fallback can bound the wait.',
      'If Shipping was disconnected: product stays healthy while order preview fails; Shipping failures rise. A Shipping fallback can preserve an informational preview without a quote.',
      'Your diagnosis should identify the affected route, dependency, time window, and evidence before the facilitator reveals the fault. Compare the same route under the same incident after mitigation.',
      'Ask the facilitator which scenario was seeded. Remove that fault and restore default mitigation settings.'
    ],
    fields: [
      { key: 'symptom', label: 'Customer symptom and time window', prompt: 'Which customer route is slow or failing? When did you observe it?' },
      { key: 'signals', label: 'Grafana evidence', prompt: 'Which dependency and signals changed? Include panel names and your observations. A Prometheus query is optional.' },
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
    scenario: 'Your team owns the lamp shop and is preparing a release. The team lead asks: “If one of our providers becomes slow or unavailable, can customers still get useful information?” You have time to test one concrete failure in this local Docker shop and recommend a response.',
    why: 'The earlier challenges gave you an incident and a path to follow. Now you turn a customer risk into your own repeatable experiment that a teammate could run from your notes.',
    reproduce: 'Choose one dependency and one fault: an Inventory or Shipping response delay, or a disconnection. Choose the customer action you want to protect. For example, investigate slow Shipping replies during “Order preview”; record your chosen delay before applying it.',
    ready: 'Clear old faults and restore default settings. Use only the two local dependency paths and keep the supplied light traffic. Choose one fault, not a combination, so you can explain what caused the result.',
    assignment: 'Design and run one test that answers a specific customer-facing reliability question, then recommend a mitigation with evidence.',
    tasks: [
      { title: 'Write a customer question and a test plan', instruction: 'Name the Storefront button/API route, the dependency, the exact fault and magnitude, and the metric you will watch. Predict the customer effect. State an abort condition: a specific unexpected result that means you will remove the fault immediately.' },
      { title: 'Measure normal behavior', instruction: 'Run the chosen customer action and record a healthy baseline. Choose a consistent observation window, for example 60–90 seconds, for every phase. Keep the supplied traffic unchanged.' },
      { title: 'Run your chosen failure', instruction: 'Use Network Faults to apply only the planned delay or disconnection. Repeat the customer action and record timings, route/status outcomes, and the relevant dependency signals. Decide whether your original prediction matched the evidence.' },
      { title: 'Make a justified change', instruction: 'Remove the fault first. Choose and apply a timeout/fallback change in the Fallbacks & timeouts tab. You can complete this experiment entirely in the browser. Explain what customer behavior it protects and what information or certainty may be lost.' },
      { title: 'Repeat the exact test and recommend a response', instruction: 'Apply the same fault to the same dependency at the same magnitude. Repeat the action and compare equivalent windows. State whether your change helped, document its trade-off and exact reproduction steps, then remove the fault, undo the mitigation, verify recovery, and submit your record.' }
    ],
    done: [
      'A teammate can reproduce your chosen customer action, fault, mitigation, and rollback from the submitted record.',
      'Your recommendation compares healthy, faulted, and mitigated results under the identical fault.',
      'You explained the remaining risk and restored the clean system.'
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
      { key: 'mitigation', label: 'Mitigation and reason', prompt: 'Which timeout/fallback settings did you change, and why?' },
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
