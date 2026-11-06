import { format, home } from './copy.js';
export const STORAGE_KEY = 'northstar-field-workshop-v1';

export { challenges } from './challenges.js';
import { challenges } from './challenges.js';

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
  if (index < 0 || !isUnlocked(progress, index)) throw new Error(challenges[Math.max(0, index)].validation.locked);
  const cleaned = {};
  for (const field of challenges[index].fields) {
    const answer = String(answers[field.key] ?? '').trim();
    if (!answer) throw new Error(format(challenges[index].validation.required, { label: field.label }));
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
    workshop: home.exportTitle,
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
