import { afterEach, describe, expect, it, vi } from "vitest";
import { createLatestDraftTask } from "./draftOptionalTask";
afterEach(() => vi.useRealTimers());
describe("optional work cannot publish older results", () => {
  it("starts no work until requested and runs only the latest queued request", async () => {
    vi.useFakeTimers(); const task = createLatestDraftTask(); const work = vi.fn(() => "old"); const publish = vi.fn();
    expect(work).not.toHaveBeenCalled(); task.start(work, publish, vi.fn()); task.start(() => "new", publish, vi.fn());
    await vi.runAllTimersAsync(); expect(work).not.toHaveBeenCalled(); expect(publish).toHaveBeenCalledExactlyOnceWith("new");
  });
  it("ignores an out-of-order completion", async () => {
    vi.useFakeTimers(); const task = createLatestDraftTask(); const publish = vi.fn();
    let release: (value: string) => void = () => { throw new Error("Not started"); };
    task.start(() => new Promise<string>(resolve => { release = resolve; }), publish, vi.fn());
    await vi.advanceTimersByTimeAsync(0); task.start(() => "new", publish, vi.fn());
    await vi.runAllTimersAsync(); release("old"); await Promise.resolve();
    expect(publish).toHaveBeenCalledExactlyOnceWith("new");
  });
  it("cancels on invalidation and scopes failures to optional work", async () => {
    vi.useFakeTimers(); const task = createLatestDraftTask(); const publish = vi.fn(); const fail = vi.fn();
    task.start(() => "never", publish, fail); task.cancel(); await vi.runAllTimersAsync(); expect(publish).not.toHaveBeenCalled();
    task.start(() => { throw new Error("Injected"); }, publish, fail); await vi.runAllTimersAsync();
    expect(fail).toHaveBeenCalledOnce(); expect(publish).not.toHaveBeenCalled();
  });
});
