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
