import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";

describe("settings normalization", () => {
  it("returns safe defaults for missing or malformed data", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings("not-an-object")).toEqual(DEFAULT_SETTINGS);
    expect(
      normalizeSettings({
        title: 42,
        autoReplaceEmptyTabs: "yes",
        layoutDensity: "spacious",
        defaultPinRecentCount: 999,
        pinnedFiles: {}
      })
    ).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps supported values and normalizes text", () => {
    expect(
      normalizeSettings({
        title: "  Home  ",
        subtitle: "  Pick up where you left off.  ",
        autoReplaceEmptyTabs: false,
        layoutDensity: "compact",
        defaultPinRecentCount: 8,
        defaultPinnedFilesSeeded: true,
        recentFilesCollapsed: true,
        pinnedFiles: [
          {
            path: "  Projects/Plan.md  ",
            label: "  Plan  ",
            createdAt: 100
          }
        ]
      })
    ).toEqual({
      title: "Home",
      subtitle: "Pick up where you left off.",
      autoReplaceEmptyTabs: false,
      layoutDensity: "compact",
      defaultPinRecentCount: 8,
      defaultPinnedFilesSeeded: true,
      recentFilesCollapsed: true,
      pinnedFiles: [
        {
          path: "Projects/Plan.md",
          label: "Plan",
          createdAt: 100
        }
      ]
    });
  });

  it("drops invalid and duplicate pinned file records", () => {
    expect(
      normalizeSettings({
        pinnedFiles: [
          null,
          { path: "", createdAt: 1 },
          { path: "A.md", createdAt: Number.NaN },
          { path: "A.md", createdAt: 1 },
          { path: "A.md", createdAt: 2 },
          { path: "B.md", createdAt: 3, label: 42 }
        ]
      }).pinnedFiles
    ).toEqual([
      { path: "A.md", createdAt: 1 },
      { path: "B.md", createdAt: 3 }
    ]);
  });
});
