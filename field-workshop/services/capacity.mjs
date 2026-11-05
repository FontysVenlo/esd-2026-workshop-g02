// A deliberately small, real worker pool shared by all customer product requests.
// Monitoring, health checks and operator controls never consume these workers.
export function createCapacity({ limit = 2, maxQueue = 12, queueTimeoutMs = 1000 } = {}) {
  let active = 0;
  let rejected = 0;
  const queue = [];
  function release() {
    const next = queue.shift();
    if (next) { clearTimeout(next.timer); next.resolve(release); }
    else active--;
  }
  return {
    snapshot: () => ({ active, queued: queue.length, rejected, limit }),
    acquire() {
      if (active < limit) { active++; return Promise.resolve(release); }
      const error = () => Object.assign(new Error('capacity'), { outcome: 'capacity' });
      if (queue.length >= maxQueue) { rejected++; return Promise.reject(error()); }
      return new Promise((resolve, reject) => {
        const entry = { resolve };
        entry.timer = setTimeout(() => {
          queue.splice(queue.indexOf(entry), 1);
          rejected++;
          reject(error());
        }, queueTimeoutMs);
        queue.push(entry);
      });
    }
  };
}
