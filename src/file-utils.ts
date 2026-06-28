import type { TFile } from "obsidian";
import type { PinnedFile } from "./settings";

export const DEFAULT_SEARCH_LIMIT = 30;
export const DEFAULT_RECENT_LIMIT = 12;

export type RemovedPinnedFile = {
  item: PinnedFile;
  index: number;
};

export function isMarkdownFile(file: TFile): boolean {
  return file.extension.toLowerCase() === "md";
}

export function getDisplayName(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.md$/i, "");
}

export function filterMarkdownFiles(
  files: TFile[],
  query: string,
  limit = DEFAULT_SEARCH_LIMIT
): TFile[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  return files
    .filter(isMarkdownFile)
    .filter((file) => {
      const searchable = `${file.basename} ${file.path}`.toLowerCase();
      return searchable.includes(normalizedQuery);
    })
    .slice(0, limit);
}

export function getRecentModifiedFiles(
  files: TFile[],
  excludedPaths: Set<string>,
  limit = DEFAULT_RECENT_LIMIT
): TFile[] {
  return files
    .filter(isMarkdownFile)
    .filter((file) => !excludedPaths.has(file.path))
    .sort((left, right) => right.stat.mtime - left.stat.mtime)
    .slice(0, limit);
}

export function getDragPathCandidates(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  const candidates = new Set<string>();
  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  candidates.add(trimmed);

  for (const line of trimmed.split(/\r?\n/)) {
    if (line.trim()) {
      candidates.add(line.trim());
    }
  }

  const wikiLinkPattern = /!?\[\[([^#|\]]+)/g;
  for (const match of trimmed.matchAll(wikiLinkPattern)) {
    candidates.add(match[1].trim());
  }

  const markdownLinkPattern = /\]\(([^)]+)\)/g;
  for (const match of trimmed.matchAll(markdownLinkPattern)) {
    candidates.add(match[1].trim());
  }

  return Array.from(candidates);
}

export function normalizeDragPath(path: string): string {
  let normalized = path.trim().replace(/^["']|["']$/g, "");

  if (normalized.startsWith("<") && normalized.endsWith(">")) {
    normalized = normalized.slice(1, -1);
  }

  const obsidianPath = getObsidianUriFilePath(normalized);
  if (obsidianPath) {
    normalized = obsidianPath;
  }

  if (normalized.startsWith("file://")) {
    normalized = normalized.replace(/^file:\/+/, "");
  }

  try {
    normalized = decodeURIComponent(normalized);
  } catch {
    // Keep the original text when it is not URL encoded.
  }

  return normalized.replace(/^\/+/, "");
}

function getObsidianUriFilePath(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "obsidian:") {
      return null;
    }

    return url.searchParams.get("file") ?? url.searchParams.get("path");
  } catch {
    return null;
  }
}

export function addPinnedFile(
  pinnedFiles: PinnedFile[],
  path: string,
  createdAt: number,
  beforePath?: string
): { pinnedFiles: PinnedFile[]; added: boolean } {
  if (pinnedFiles.some((item) => item.path === path)) {
    return {
      pinnedFiles: [...pinnedFiles],
      added: false
    };
  }

  const next = [...pinnedFiles];
  const insertIndex = beforePath
    ? next.findIndex((item) => item.path === beforePath)
    : -1;
  const normalizedIndex = insertIndex >= 0 ? insertIndex : next.length;
  next.splice(normalizedIndex, 0, {
    path,
    createdAt
  });

  return {
    pinnedFiles: next,
    added: true
  };
}

export function createDefaultPinnedFiles(
  files: TFile[],
  count: number,
  createdAt: number
): PinnedFile[] {
  if (count <= 0) {
    return [];
  }

  return getRecentModifiedFiles(files, new Set(), count).map((file, index) => ({
    path: file.path,
    createdAt: createdAt + index
  }));
}

export function movePinnedFile(
  pinnedFiles: PinnedFile[],
  path: string,
  direction: -1 | 1
): PinnedFile[] {
  const next = [...pinnedFiles];
  const currentIndex = next.findIndex((item) => item.path === path);

  if (currentIndex < 0) {
    return next;
  }

  const targetIndex = currentIndex + direction;

  if (targetIndex < 0 || targetIndex >= next.length) {
    return next;
  }

  const [item] = next.splice(currentIndex, 1);
  next.splice(targetIndex, 0, item);
  return next;
}

export function movePinnedFileToEnd(
  pinnedFiles: PinnedFile[],
  path: string
): PinnedFile[] {
  const currentIndex = pinnedFiles.findIndex((item) => item.path === path);

  if (currentIndex < 0 || currentIndex === pinnedFiles.length - 1) {
    return [...pinnedFiles];
  }

  const next = [...pinnedFiles];
  const [item] = next.splice(currentIndex, 1);
  next.push(item);
  return next;
}

export function removePinnedFile(
  pinnedFiles: PinnedFile[],
  path: string
): { pinnedFiles: PinnedFile[]; removed: RemovedPinnedFile | null } {
  const index = pinnedFiles.findIndex((item) => item.path === path);

  if (index < 0) {
    return {
      pinnedFiles: [...pinnedFiles],
      removed: null
    };
  }

  return {
    pinnedFiles: pinnedFiles.filter((item) => item.path !== path),
    removed: {
      item: pinnedFiles[index],
      index
    }
  };
}

export function restorePinnedFile(
  pinnedFiles: PinnedFile[],
  removed: RemovedPinnedFile
): PinnedFile[] {
  if (pinnedFiles.some((item) => item.path === removed.item.path)) {
    return [...pinnedFiles];
  }

  const next = [...pinnedFiles];
  const index = Math.min(removed.index, next.length);
  next.splice(index, 0, removed.item);
  return next;
}

export function reorderPinnedFile(
  pinnedFiles: PinnedFile[],
  draggedPath: string,
  targetPath: string
): PinnedFile[] {
  if (draggedPath === targetPath) {
    return [...pinnedFiles];
  }

  const currentIndex = pinnedFiles.findIndex((item) => item.path === draggedPath);
  const targetIndex = pinnedFiles.findIndex((item) => item.path === targetPath);

  if (currentIndex < 0 || targetIndex < 0) {
    return [...pinnedFiles];
  }

  const next = [...pinnedFiles];
  const [item] = next.splice(currentIndex, 1);
  const adjustedTargetIndex = next.findIndex((candidate) => candidate.path === targetPath);
  next.splice(adjustedTargetIndex, 0, item);
  return next;
}
