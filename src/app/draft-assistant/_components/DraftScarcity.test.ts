import { describe, expect, it } from "vitest";
import { remainingPositionValue } from "./DraftScarcity";
describe("remaining position value", () => {
  it("counts actual drafted value, excluding negative and missing values", () => {
    expect(remainingPositionValue([{value:80,drafted:true},{value:20,drafted:false},{value:-50,drafted:false},{value:null,drafted:false}])).toBe(20);
    expect(remainingPositionValue([{value:80,drafted:false},{value:20,drafted:false}])).toBe(100);
  });
  it("distinguishes exhausted value from an unavailable positive baseline", () => {
    expect(remainingPositionValue([{value:20,drafted:true}])).toBe(0);
    expect(remainingPositionValue([{value:-10,drafted:false}])).toBeNull();
  });
});
