import { describe, expect, it } from "vitest";
import type { TFile } from "obsidian";
import {
  addPinnedFile,
  createDefaultPinnedFiles,
  filterMarkdownFiles,
  getDisplayName,
  getDragPathCandidates,
  getRecentModifiedFiles,
  isMarkdownFile,
  movePinnedFile,
  movePinnedFileToEnd,
  normalizeDragPath,
  removePinnedFile,
  reorderPinnedFile,
  restorePinnedFile
} from "./file-utils";
import type { PinnedFile } from "./settings";

function file(path: string, mtime: number): TFile {
  return {
    path,
    name: path.split("/").pop() ?? path,
    basename: (path.split("/").pop() ?? path).replace(/\.md$/i, ""),
    extension: path.split(".").pop() ?? "",
    stat: {
      ctime: mtime - 100,
      mtime,
      size: 100
    }
  } as TFile;
}

describe("file helpers", () => {
  it("detects Markdown files", () => {
    expect(isMarkdownFile(file("Projects/Plan.md", 3))).toBe(true);
    expect(isMarkdownFile(file("Assets/logo.png", 3))).toBe(false);
  });

  it("creates readable display names from paths", () => {
    expect(getDisplayName("Projects/New Tab Pins.md")).toBe("New Tab Pins");
    expect(getDisplayName("Daily/2026-06-03.MD")).toBe("2026-06-03");
  });

  it("filters Markdown files by name and path", () => {
    const files = [
      file("Projects/New Tab Pins.md", 3),
      file("Areas/Obsidian Plugins.md", 2),
      file("Assets/New Tab Screenshot.png", 1)
    ];

    expect(filterMarkdownFiles(files, "tab").map((item) => item.path)).toEqual([
      "Projects/New Tab Pins.md"
    ]);
    expect(filterMarkdownFiles(files, "areas").map((item) => item.path)).toEqual([
      "Areas/Obsidian Plugins.md"
    ]);
  });

  it("returns recent modified Markdown files and excludes pinned paths", () => {
    const files = [
      file("A.md", 10),
      file("B.md", 30),
      file("C.md", 20),
      file("D.png", 40)
    ];

    expect(getRecentModifiedFiles(files, new Set(["B.md"]), 2).map((item) => item.path)).toEqual([
      "C.md",
      "A.md"
    ]);
  });

  it("extracts vault Markdown paths from drag payloads", () => {
    expect(getDragPathCandidates("[[Projects/Plan|Plan]]").map(normalizeDragPath)).toContain(
      "Projects/Plan"
    );
    expect(
      normalizeDragPath("obsidian://open?vault=Dev&file=Projects%2FPlan.md")
    ).toBe("Projects/Plan.md");
  });

  it("adds pinned files before a target without creating duplicates", () => {
    const pinned: PinnedFile[] = [
      { path: "A.md", createdAt: 1 },
      { path: "C.md", createdAt: 3 }
    ];

    const inserted = addPinnedFile(pinned, "B.md", 2, "C.md");
    const duplicate = addPinnedFile(inserted.pinnedFiles, "B.md", 4);

    expect(inserted.added).toBe(true);
    expect(inserted.pinnedFiles.map((item) => item.path)).toEqual(["A.md", "B.md", "C.md"]);
    expect(duplicate.added).toBe(false);
    expect(duplicate.pinnedFiles.map((item) => item.path)).toEqual(["A.md", "B.md", "C.md"]);
    expect(pinned.map((item) => item.path)).toEqual(["A.md", "C.md"]);
  });

  it("creates starter pins from the most recently modified Markdown files", () => {
    const files = [
      file("A.md", 10),
      file("B.md", 30),
      file("C.md", 20),
      file("D.png", 40)
    ];

    expect(createDefaultPinnedFiles(files, 2, 100)).toEqual([
      { path: "B.md", createdAt: 100 },
      { path: "C.md", createdAt: 101 }
    ]);
    expect(createDefaultPinnedFiles(files, 0, 100)).toEqual([]);
  });

  it("moves pinned files within bounds without mutating the input", () => {
    const pinned: PinnedFile[] = [
      { path: "A.md", createdAt: 1 },
      { path: "B.md", createdAt: 2 },
      { path: "C.md", createdAt: 3 }
    ];

    expect(movePinnedFile(pinned, "B.md", -1).map((item) => item.path)).toEqual([
      "B.md",
      "A.md",
      "C.md"
    ]);
    expect(movePinnedFile(pinned, "A.md", -1).map((item) => item.path)).toEqual([
      "A.md",
      "B.md",
      "C.md"
    ]);
    expect(pinned.map((item) => item.path)).toEqual(["A.md", "B.md", "C.md"]);
  });

  it("moves a pinned file to the end when dropped on the pinned area", () => {
    const pinned: PinnedFile[] = [
      { path: "A.md", createdAt: 1 },
      { path: "B.md", createdAt: 2 },
      { path: "C.md", createdAt: 3 }
    ];

    expect(movePinnedFileToEnd(pinned, "A.md").map((item) => item.path)).toEqual([
      "B.md",
      "C.md",
      "A.md"
    ]);
    expect(movePinnedFileToEnd(pinned, "C.md").map((item) => item.path)).toEqual([
      "A.md",
      "B.md",
      "C.md"
    ]);
    expect(movePinnedFileToEnd(pinned, "Missing.md")).toEqual(pinned);
    expect(pinned.map((item) => item.path)).toEqual(["A.md", "B.md", "C.md"]);
  });

  it("removes a pinned file with enough state to restore its original index", () => {
    const pinned: PinnedFile[] = [
      { path: "A.md", createdAt: 1 },
      { path: "B.md", createdAt: 2 },
      { path: "C.md", createdAt: 3 }
    ];

    const result = removePinnedFile(pinned, "B.md");

    expect(result.pinnedFiles.map((item) => item.path)).toEqual(["A.md", "C.md"]);
    expect(result.removed).toEqual({
      item: { path: "B.md", createdAt: 2 },
      index: 1
    });
    expect(restorePinnedFile(result.pinnedFiles, result.removed!).map((item) => item.path)).toEqual([
      "A.md",
      "B.md",
      "C.md"
    ]);
    expect(pinned.map((item) => item.path)).toEqual(["A.md", "B.md", "C.md"]);
  });

  it("does not duplicate a restored pinned file that already exists", () => {
    const pinned: PinnedFile[] = [
      { path: "A.md", createdAt: 1 },
      { path: "B.md", createdAt: 2 }
    ];
    const removed = {
      item: { path: "B.md", createdAt: 2 },
      index: 1
    };

    expect(restorePinnedFile(pinned, removed).map((item) => item.path)).toEqual(["A.md", "B.md"]);
  });

  it("returns a copy and no undo state when removing a missing pinned path", () => {
    const pinned: PinnedFile[] = [
      { path: "A.md", createdAt: 1 },
      { path: "B.md", createdAt: 2 }
    ];

    const result = removePinnedFile(pinned, "Missing.md");

    expect(result.pinnedFiles).toEqual(pinned);
    expect(result.pinnedFiles).not.toBe(pinned);
    expect(result.removed).toBeNull();
  });

  it("reorders pinned files by dragging one item before another", () => {
    const pinned: PinnedFile[] = [
      { path: "Projects/Launch.md", createdAt: 1 },
      { path: "Areas/Obsidian.md", createdAt: 2 },
      { path: "Resources/Search.md", createdAt: 3 },
      { path: "Daily/2026-06-04.md", createdAt: 4 }
    ];

    expect(
      reorderPinnedFile(
        pinned,
        "Daily/2026-06-04.md",
        "Areas/Obsidian.md"
      ).map((item) => item.path)
    ).toEqual([
      "Projects/Launch.md",
      "Daily/2026-06-04.md",
      "Areas/Obsidian.md",
      "Resources/Search.md"
    ]);
    expect(reorderPinnedFile(pinned, "Missing.md", "Areas/Obsidian.md")).toEqual(pinned);
    expect(reorderPinnedFile(pinned, "Projects/Launch.md", "Projects/Launch.md")).toEqual(pinned);
    expect(pinned.map((item) => item.path)).toEqual([
      "Projects/Launch.md",
      "Areas/Obsidian.md",
      "Resources/Search.md",
      "Daily/2026-06-04.md"
    ]);
  });
});
