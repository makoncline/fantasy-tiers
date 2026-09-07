/** Latest-request scheduling for OPTIONAL work. It never owns active draft state. */
export function createLatestDraftTask() {
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    generation += 1;
    if (timer != null) clearTimeout(timer);
    timer = null;
  };
  return {
    cancel,
    start<T>(work: () => T | Promise<T>, publish: (result: T) => void, fail: () => void) {
      cancel();
      const ticket = generation;
      // Explicit user action schedules one calculation. This is NOT a worker:
      // expensive synchronous code still needs target-device latency testing.
      timer = setTimeout(() => {
        timer = null;
        if (ticket !== generation) return;
        const run = async () => {
          if (ticket !== generation) return;
          try {
            const result = await work();
            if (ticket === generation) publish(result);
          } catch {
            if (ticket === generation) fail();
          }
        };
        void run();
      }, 0);
    },
  };
}
