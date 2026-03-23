import { describe, it, expect } from "vitest";
import { getPhysicalMeasure } from "@/lib/score/math";

describe("getPhysicalMeasure – anchor-based interpolation", () => {
  it("returns latent when no measureMap", () => {
    expect(getPhysicalMeasure(5)).toBe(5);
    expect(getPhysicalMeasure(5, undefined)).toBe(5);
  });

  it("returns latent when measureMap is empty", () => {
    expect(getPhysicalMeasure(5, {})).toBe(5);
  });

  it("returns direct hit from measureMap", () => {
    expect(getPhysicalMeasure(21, { 21: 5 })).toBe(5);
  });

  it("interpolates from nearest lower anchor", () => {
    // anchor: 21→5, so 22→6, 23→7, ..., 35→19
    const map = { 21: 5 };
    expect(getPhysicalMeasure(22, map)).toBe(6);
    expect(getPhysicalMeasure(23, map)).toBe(7);
    expect(getPhysicalMeasure(35, map)).toBe(19);
  });

  it("uses identity for measures before any anchor", () => {
    const map = { 21: 5, 36: 21 };
    expect(getPhysicalMeasure(1, map)).toBe(1);
    expect(getPhysicalMeasure(10, map)).toBe(10);
    expect(getPhysicalMeasure(20, map)).toBe(20);
  });

  it("picks nearest lower anchor among multiple", () => {
    const map = { 21: 5, 36: 21, 53: 22, 68: 38 };
    // Before first anchor → identity
    expect(getPhysicalMeasure(15, map)).toBe(15);
    // In first range (21-35, anchored at 21→5)
    expect(getPhysicalMeasure(21, map)).toBe(5);
    expect(getPhysicalMeasure(30, map)).toBe(14); // 5 + (30-21) = 14
    // At second anchor (36→21)
    expect(getPhysicalMeasure(36, map)).toBe(21);
    expect(getPhysicalMeasure(40, map)).toBe(25); // 21 + (40-36) = 25
    // At third anchor (53→22)
    expect(getPhysicalMeasure(53, map)).toBe(22);
    expect(getPhysicalMeasure(60, map)).toBe(29); // 22 + (60-53) = 29
    // At fourth anchor (68→38)
    expect(getPhysicalMeasure(68, map)).toBe(38);
    expect(getPhysicalMeasure(70, map)).toBe(40); // 38 + (70-68) = 40
  });

  it("handles single-measure anchor ranges", () => {
    // anchor 5→10, anchor 6→1 — one-measure range
    const map = { 5: 10, 6: 1 };
    expect(getPhysicalMeasure(5, map)).toBe(10);
    expect(getPhysicalMeasure(6, map)).toBe(1);
    expect(getPhysicalMeasure(7, map)).toBe(2); // interpolate from 6→1
  });
});
