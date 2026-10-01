import {
  Menu,
  Notice,
  Plugin,
  TAbstractFile,
  TFile,
  WorkspaceLeaf
} from "obsidian";
import type { Editor, MarkdownView } from "obsidian";
import {
  addPinnedFile,
  createDefaultPinnedFiles,
  filterFiles,
  getDisplayName,
  getDragPathCandidates,
  getRecentModifiedFiles as selectRecentModifiedFiles,
  movePinnedFile,
  movePinnedFileToEnd,
  normalizeDragPath,
  removePinnedFile,
  reorderPinnedFile,
  restorePinnedFile,
  type RemovedPinnedFile
} from "./file-utils";
import { NewTabPinsSettingTab } from "./SettingsTab";
import { NewTabPinsView } from "./NewTabPinsView";
import {
  DEFAULT_SETTINGS,
  NewTabPinsSettings,
  normalizeSettings,
  VIEW_TYPE_NEW_TAB_PINS
} from "./settings";

export default class NewTabPinsPlugin extends Plugin {
  settings: NewTabPinsSettings = { ...DEFAULT_SETTINGS };
  private replacingEmptyLeaf = false;
  private unloaded = false;
  private replaceTimer: number | null = null;
  private fileExplorerDraggedPath: string | null = null;

  async onload(): Promise<void> {
    this.unloaded = false;
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_NEW_TAB_PINS,
      (leaf) => new NewTabPinsView(leaf, this)
    );

    this.addSettingTab(new NewTabPinsSettingTab(this));
    this.registerCommands();
    this.registerFileMenu();
    this.registerEditorMenu();
    this.registerFileExplorerDragTracking();
    this.registerAutoReplaceEmptyTabs();

    this.app.workspace.onLayoutReady(() => {
      void this.ensureDefaultPinnedFiles().then(() => {
        // Inspect the restored layout without creating a navigable leaf.
        this.scheduleAutoReplace(this.app.workspace.getMostRecentLeaf());
      });
    });
  }

  onunload(): void {
    this.unloaded = true;
    if (this.replaceTimer !== null) {
      window.clearTimeout(this.replaceTimer);
      this.replaceTimer = null;
    }
  }

  async loadSettings(): Promise<void> {
    const storedData: unknown = await this.loadData();
    this.settings = normalizeSettings(storedData);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async openHomeTab(): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NEW_TAB_PINS);

    if (leaves.length > 0) {
      this.app.workspace.setActiveLeaf(leaves[0], { focus: true });
      return;
    }

    const leaf = this.app.workspace.getLeaf("tab");
    await this.setLeafToHome(leaf, true);
  }

  async replaceCurrentTabWithHome(): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await this.setLeafToHome(leaf, true);
  }

  async ensureDefaultPinnedFiles(): Promise<boolean> {
    const defaultCount = Math.max(
      0,
      Math.floor(this.settings.defaultPinRecentCount ?? DEFAULT_SETTINGS.defaultPinRecentCount)
    );

    if (defaultCount === 0 || this.settings.defaultPinnedFilesSeeded) {
      return false;
    }

    if (this.settings.pinnedFiles.length > 0) {
      this.settings.defaultPinnedFilesSeeded = true;
      await this.saveSettings();
      return false;
    }

    const pinnedFiles = createDefaultPinnedFiles(
      this.app.vault.getMarkdownFiles(),
      defaultCount,
      Date.now()
    );

    if (pinnedFiles.length === 0) {
      return false;
    }

    this.settings.pinnedFiles = pinnedFiles;
    this.settings.defaultPinnedFilesSeeded = true;
    await this.saveSettings();
    this.refreshViews();
    return true;
  }

  async pinFile(file: TFile, beforePath?: string): Promise<void> {
    if (file.extension.toLowerCase() !== "md") {
      new Notice("New Tab Pins only supports Markdown files.");
      return;
    }

    const result = addPinnedFile(
      this.settings.pinnedFiles,
      file.path,
      Date.now(),
      beforePath
    );

    if (!result.added) {
      new Notice("File is already pinned.");
      return;
    }

    this.settings.pinnedFiles = result.pinnedFiles;
    this.settings.defaultPinnedFilesSeeded = true;
    await this.saveSettings();
    this.refreshViews();
    new Notice(`Pinned ${file.basename}.`);
  }

  async unpinFile(path: string): Promise<void> {
    const result = removePinnedFile(this.settings.pinnedFiles, path);

    if (!result.removed) {
      return;
    }

    this.settings.pinnedFiles = result.pinnedFiles;
    await this.saveSettings();
    this.refreshViews();
    this.showUnpinUndoNotice(result.removed);
  }

  async movePinned(path: string, direction: -1 | 1): Promise<void> {
    this.settings.pinnedFiles = movePinnedFile(this.settings.pinnedFiles, path, direction);
    await this.saveSettings();
    this.refreshViews();
  }

  async movePinnedToEnd(path: string): Promise<void> {
    const nextPinnedFiles = movePinnedFileToEnd(this.settings.pinnedFiles, path);
    const currentOrder = this.settings.pinnedFiles.map((item) => item.path).join("\n");
    const nextOrder = nextPinnedFiles.map((item) => item.path).join("\n");

    if (nextOrder === currentOrder) {
      return;
    }

    this.settings.pinnedFiles = nextPinnedFiles;
    await this.saveSettings();
    this.refreshViews();
  }

  async reorderPinned(draggedPath: string, targetPath: string): Promise<void> {
    const nextPinnedFiles = reorderPinnedFile(
      this.settings.pinnedFiles,
      draggedPath,
      targetPath
    );
    const currentOrder = this.settings.pinnedFiles.map((item) => item.path).join("\n");
    const nextOrder = nextPinnedFiles.map((item) => item.path).join("\n");

    if (nextOrder === currentOrder) {
      return;
    }

    this.settings.pinnedFiles = nextPinnedFiles;
    await this.saveSettings();
    this.refreshViews();
  }

  async setRecentFilesCollapsed(collapsed: boolean): Promise<void> {
    if (this.settings.recentFilesCollapsed === collapsed) {
      return;
    }

    this.settings.recentFilesCollapsed = collapsed;
    await this.saveSettings();
    this.refreshViews();
  }

  getSearchResults(query: string): TFile[] {
    return filterFiles(this.app.vault.getFiles(), query);
  }

  getRecentModifiedFiles(): TFile[] {
    const pinnedPaths = new Set(this.settings.pinnedFiles.map((item) => item.path));
    return selectRecentModifiedFiles(this.app.vault.getMarkdownFiles(), pinnedPaths);
  }

  getMarkdownFileFromDragData(values: Array<string | null | undefined>): TFile | null {
    for (const value of values) {
      for (const candidate of getDragPathCandidates(value)) {
        const file = this.getMarkdownFile(candidate);

        if (file) {
          return file;
        }
      }
    }

    return null;
  }

  getFileExplorerDraggedFile(): TFile | null {
    return this.fileExplorerDraggedPath ? this.getMarkdownFile(this.fileExplorerDraggedPath) : null;
  }

  getMarkdownFile(path: string): TFile | null {
    const normalizedPath = normalizeDragPath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);

    if (file instanceof TFile && file.extension.toLowerCase() === "md") {
      return file;
    }

    const linkPath = normalizedPath.replace(/\.md$/i, "");
    const linkedFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, "");

    if (linkedFile instanceof TFile && linkedFile.extension.toLowerCase() === "md") {
      return linkedFile;
    }

    return null;
  }

  async openFile(path: string, leaf: WorkspaceLeaf = this.app.workspace.getLeaf(false)): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);

    if (!(file instanceof TFile)) {
      new Notice("Pinned file no longer exists.");
      return;
    }

    await leaf.openFile(file);
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_NEW_TAB_PINS)) {
      const view = leaf.view;
      if (view instanceof NewTabPinsView) {
        view.refresh();
      }
    }
  }

  private showUnpinUndoNotice(removed: RemovedPinnedFile): void {
    const fragment = createFragment();
    fragment.createSpan({
      text: `Removed ${getDisplayName(removed.item.path)}. `
    });
    const undo = fragment.createEl("button", {
      cls: "ntp-notice-action",
      text: "Undo",
      attr: {
        type: "button"
      }
    });

    const notice = new Notice(fragment, 8000);
    undo.addEventListener("click", () => {
      notice.hide();

      if (this.settings.pinnedFiles.some((item) => item.path === removed.item.path)) {
        return;
      }

      this.settings.pinnedFiles = restorePinnedFile(this.settings.pinnedFiles, removed);
      void this.saveSettings().then(() => {
        this.refreshViews();
      });
    });
  }

  private registerCommands(): void {
    this.addCommand({
      id: "open-home-tab",
      name: "Open home tab",
      callback: () => {
        void this.openHomeTab();
      }
    });

    this.addCommand({
      id: "replace-current-tab-with-home",
      name: "Replace current tab with home",
      callback: () => {
        void this.replaceCurrentTabWithHome();
      }
    });

    this.addCommand({
      id: "pin-current-file",
      name: "Pin current file",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const canPin = file instanceof TFile && file.extension.toLowerCase() === "md";

        if (!canPin) {
          return false;
        }

        if (!checking) {
          void this.pinFile(file);
        }

        return true;
      }
    });

    this.addCommand({
      id: "unpin-current-file",
      name: "Unpin current file",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const canUnpin =
          file instanceof TFile &&
          this.settings.pinnedFiles.some((item) => item.path === file.path);

        if (!canUnpin) {
          return false;
        }

        if (!checking) {
          void this.unpinFile(file.path);
        }

        return true;
      }
    });
  }

  private registerFileMenu(): void {
    this.registerEvent(
      this.app.workspace.on(
        "file-menu",
        (menu: Menu, file: TAbstractFile, _source: string) => {
          if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md") {
            return;
          }

          const isPinned = this.settings.pinnedFiles.some((item) => item.path === file.path);
          this.addPinToggleMenuItem(menu, file, isPinned);
        }
      )
    );
  }

  private registerEditorMenu(): void {
    this.registerEvent(
      this.app.workspace.on(
        "editor-menu",
        (menu: Menu, _editor: Editor, view: MarkdownView) => {
          const file = view.file;

          if (!(file instanceof TFile) || file.extension.toLowerCase() !== "md") {
            return;
          }

          const isPinned = this.settings.pinnedFiles.some((item) => item.path === file.path);
          this.addPinToggleMenuItem(menu, file, isPinned);
        }
      )
    );
  }

  private addPinToggleMenuItem(menu: Menu, file: TFile, isPinned: boolean): void {
    menu.addItem((item) => {
      item
        .setTitle(isPinned ? "Unpin from New Tab Pins" : "Pin to New Tab Pins")
        .setIcon(isPinned ? "pin-off" : "pin")
        .onClick(() => {
          if (isPinned) {
            void this.unpinFile(file.path);
          } else {
            void this.pinFile(file);
          }
        });
    });
  }

  private registerFileExplorerDragTracking(): void {
    this.registerDomEvent(
      document,
      "dragstart",
      (event: DragEvent) => {
        this.fileExplorerDraggedPath = this.getFileExplorerDragPath(event.target);
      },
      true
    );

    this.registerDomEvent(
      document,
      "dragend",
      () => {
        this.fileExplorerDraggedPath = null;
      },
      true
    );
  }

  private getFileExplorerDragPath(target: EventTarget | null): string | null {
    if (!(target instanceof HTMLElement)) {
      return null;
    }

    const fileEl = target.closest<HTMLElement>(".nav-file-title[data-path]");
    return fileEl?.getAttribute("data-path") ?? null;
  }

  private registerAutoReplaceEmptyTabs(): void {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        this.scheduleAutoReplace(leaf);
      })
    );
  }

  private scheduleAutoReplace(leaf: WorkspaceLeaf | null): void {
    if (this.replaceTimer !== null) {
      window.clearTimeout(this.replaceTimer);
      this.replaceTimer = null;
    }

    if (!leaf || !this.canReplaceEmptyLeaf(leaf)) {
      return;
    }

    this.replaceTimer = window.setTimeout(() => {
      this.replaceTimer = null;
      void this.replaceEmptyLeaf(leaf);
    }, 75);
  }

  private canReplaceEmptyLeaf(leaf: WorkspaceLeaf): boolean {
    return !this.unloaded &&
      this.app.workspace.layoutReady &&
      this.settings.autoReplaceEmptyTabs &&
      !this.replacingEmptyLeaf &&
      this.app.workspace.getMostRecentLeaf() === leaf &&
      leaf.view.getViewType() === "empty";
  }

  private async replaceEmptyLeaf(leaf: WorkspaceLeaf): Promise<void> {
    // Focus, view state, or plugin settings may change during the debounce.
    if (!this.canReplaceEmptyLeaf(leaf)) {
      return;
    }

    this.replacingEmptyLeaf = true;

    try {
      await this.setLeafToHome(leaf, true);
    } catch {
      new Notice("New Tab Pins could not replace the empty tab.");
    } finally {
      this.replacingEmptyLeaf = false;
    }
  }

  private async setLeafToHome(leaf: WorkspaceLeaf, active: boolean): Promise<void> {
    await leaf.setViewState({
      type: VIEW_TYPE_NEW_TAB_PINS,
      active
    });
  }
}
