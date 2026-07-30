export const VIEW_TYPE_NEW_TAB_PINS = "new-tab-pins-view";

export type LayoutDensity = "comfortable" | "compact";

export type PinnedFile = {
  path: string;
  label?: string;
  createdAt: number;
};

export type NewTabPinsSettings = {
  title: string;
  subtitle: string;
  autoReplaceEmptyTabs: boolean;
  layoutDensity: LayoutDensity;
  defaultPinRecentCount: number;
  defaultPinnedFilesSeeded: boolean;
  recentFilesCollapsed: boolean;
  pinnedFiles: PinnedFile[];
};

export const DEFAULT_SETTINGS: NewTabPinsSettings = {
  title: "Start here",
  subtitle: "Pinned notes and recent work from this vault.",
  autoReplaceEmptyTabs: true,
  layoutDensity: "comfortable",
  defaultPinRecentCount: 4,
  defaultPinnedFilesSeeded: false,
  recentFilesCollapsed: false,
  pinnedFiles: []
};

const STARTER_PIN_COUNTS = new Set([0, 2, 4, 6, 8]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizePinnedFiles(value: unknown): PinnedFile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenPaths = new Set<string>();
  const pinnedFiles: PinnedFile[] = [];

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const path = typeof item.path === "string" ? item.path.trim() : "";
    const createdAt =
      typeof item.createdAt === "number" && Number.isFinite(item.createdAt)
        ? item.createdAt
        : null;

    if (!path || createdAt === null || seenPaths.has(path)) {
      continue;
    }

    const pinnedFile: PinnedFile = { path, createdAt };
    if (typeof item.label === "string" && item.label.trim()) {
      pinnedFile.label = item.label.trim();
    }

    seenPaths.add(path);
    pinnedFiles.push(pinnedFile);
  }

  return pinnedFiles;
}

export function normalizeSettings(value: unknown): NewTabPinsSettings {
  const data = isRecord(value) ? value : {};
  const defaultPinRecentCount =
    typeof data.defaultPinRecentCount === "number" &&
    STARTER_PIN_COUNTS.has(data.defaultPinRecentCount)
      ? data.defaultPinRecentCount
      : DEFAULT_SETTINGS.defaultPinRecentCount;

  return {
    title: normalizeText(data.title, DEFAULT_SETTINGS.title),
    subtitle: normalizeText(data.subtitle, DEFAULT_SETTINGS.subtitle),
    autoReplaceEmptyTabs:
      typeof data.autoReplaceEmptyTabs === "boolean"
        ? data.autoReplaceEmptyTabs
        : DEFAULT_SETTINGS.autoReplaceEmptyTabs,
    layoutDensity:
      data.layoutDensity === "compact" || data.layoutDensity === "comfortable"
        ? data.layoutDensity
        : DEFAULT_SETTINGS.layoutDensity,
    defaultPinRecentCount,
    defaultPinnedFilesSeeded:
      typeof data.defaultPinnedFilesSeeded === "boolean"
        ? data.defaultPinnedFilesSeeded
        : DEFAULT_SETTINGS.defaultPinnedFilesSeeded,
    recentFilesCollapsed:
      typeof data.recentFilesCollapsed === "boolean"
        ? data.recentFilesCollapsed
        : DEFAULT_SETTINGS.recentFilesCollapsed,
    pinnedFiles: normalizePinnedFiles(data.pinnedFiles)
  };
}
