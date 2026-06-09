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
  recentFilesCollapsed: boolean;
  pinnedFiles: PinnedFile[];
};

export const DEFAULT_SETTINGS: NewTabPinsSettings = {
  title: "Start here",
  subtitle: "Pinned notes and recent work from this vault.",
  autoReplaceEmptyTabs: true,
  layoutDensity: "comfortable",
  recentFilesCollapsed: false,
  pinnedFiles: []
};
