/** @vitest-environment jsdom */
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useDraftPreference, draftSourcePreference } from "./useDraftPreference";

it("restores validated preferences and remains usable with invalid or blocked storage", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const key = "fantasy-tiers:draft:test-source";
  function Test() {
    const [source, setSource] = useDraftPreference("test-source", draftSourcePreference, "sleeper");
    return <button onClick={() => setSource("fp")}>{source}</button>;
  }
  try {
    localStorage.setItem(key, '"fp"');
    act(() => root.render(<Test key="first" />));
    expect(host.textContent).toBe("fp");
    localStorage.setItem(key, '"invalid-source"');
    act(() => root.render(<Test key="invalid" />));
    expect(host.textContent).toBe("sleeper");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    act(() => host.querySelector("button")!.click());
    expect(host.textContent).toBe("fp");
  } finally {act(() => root.unmount()); host.remove(); vi.restoreAllMocks();localStorage.removeItem(key); vi.unstubAllGlobals();}
});
