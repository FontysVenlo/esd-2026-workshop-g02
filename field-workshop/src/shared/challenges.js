import challenge1 from '../../content/challenge-1.json' with { type: 'json' };
import challenge2 from '../../content/challenge-2.json' with { type: 'json' };
import challenge3 from '../../content/challenge-3.json' with { type: 'json' };
import challenge4 from '../../content/challenge-4.json' with { type: 'json' };
import taskCopy from '../../content/tasks-shared.json' with { type: 'json' };

function resolveTaskCopy(value) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (typeof taskCopy[key] !== 'string') throw new Error(`Missing shared task copy: ${key}`);
      return taskCopy[key];
    });
  }
  if (Array.isArray(value)) return value.map(resolveTaskCopy);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveTaskCopy(item)]));
  }
  return value;
}

export const challenges = [challenge1, challenge2, challenge3, challenge4].map(resolveTaskCopy);
