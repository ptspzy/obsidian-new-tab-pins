import { ItemView, setIcon, TFile, WorkspaceLeaf } from "obsidian";
import { getDisplayName, isMarkdownFile } from "./file-utils";
import { VIEW_TYPE_NEW_TAB_PINS } from "./settings";
import type NewTabPinsPlugin from "./main";

export class NewTabPinsView extends ItemView {
  private searchInput: HTMLInputElement | null = null;
  private draggedFilePath: string | null = null;
  private draggedPinnedPath: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: NewTabPinsPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_NEW_TAB_PINS;
  }

  getDisplayText(): string {
    return "New Tab Pins";
  }

  getIcon(): string {
    return "pin";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  refresh(): void {
    this.render();
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("ntp-view-root");
    root.toggleClass("is-compact", this.plugin.settings.layoutDensity === "compact");

    const shell = root.createDiv({ cls: "ntp-shell" });
    this.renderHeader(shell);

    const workspace = shell.createDiv({ cls: "ntp-workspace" });
    this.renderPinned(workspace);
    this.renderRecent(workspace);
  }

  private renderHeader(parent: HTMLElement): void {
    const header = parent.createEl("header", { cls: "ntp-header" });
    const headerTop = header.createDiv({ cls: "ntp-header-top" });
    const titleGroup = headerTop.createDiv({ cls: "ntp-title-group" });
    titleGroup.createEl("p", { cls: "ntp-kicker", text: "Vault launcher" });
    titleGroup.createEl("h1", { cls: "ntp-title", text: this.plugin.settings.title });
    titleGroup.createEl("p", { cls: "ntp-subtitle", text: this.plugin.settings.subtitle });

    const modeGroup = headerTop.createDiv({
      cls: "ntp-mode-group",
      attr: {
        "aria-label": "Search mode"
      }
    });
    modeGroup.createSpan({
      cls: "ntp-mode-label is-active",
      text: "Search"
    });

    const searchWrap = header.createDiv({ cls: "ntp-search-wrap" });
    const searchBox = searchWrap.createDiv({ cls: "ntp-search-box" });
    const searchIcon = searchBox.createSpan({
      cls: "ntp-search-icon",
      attr: {
        "aria-hidden": "true"
      }
    });
    setIcon(searchIcon, "search");
    this.searchInput = searchBox.createEl("input", {
      cls: "ntp-search",
      attr: {
        type: "text",
        name: "new-tab-pins-search",
        autocomplete: "off",
        enterkeyhint: "search",
        role: "searchbox",
        spellcheck: "false",
        placeholder: "Search files...",
        "aria-label": "Search files"
      }
    });

    const results = searchWrap.createDiv({
      cls: "ntp-search-results",
      attr: {
        "aria-live": "polite"
      }
    });

    this.searchInput.addEventListener("input", () => {
      this.renderSearchResults(results, this.searchInput?.value ?? "");
    });
  }

  private renderSearchResults(parent: HTMLElement, query: string): void {
    parent.empty();
    const results = this.plugin.getSearchResults(query);

    if (!query.trim()) {
      return;
    }

    if (results.length === 0) {
      parent.createDiv({ cls: "ntp-empty-inline", text: "No matching files." });
      return;
    }

    for (const file of results) {
      this.createFileRow(parent, "ntp-search-result", file);
    }
  }

  private renderPinned(parent: HTMLElement): void {
    const section = this.createSection(parent, "Pinned files", "Files you want one click away.");
    const grid = section.createDiv({
      cls: "ntp-grid ntp-pinned-grid",
      attr: {
        "aria-label": "Pinned files drop zone"
      }
    });
    this.bindPinnedGridDrop(grid);

    if (this.plugin.settings.pinnedFiles.length === 0) {
      grid.createDiv({
        cls: "ntp-empty-card ntp-drop-zone",
        text: "Drop Markdown files here, or pin from search and recent files."
      });
      return;
    }

    this.plugin.settings.pinnedFiles.forEach((pin) => {
      const file = this.plugin.app.vault.getAbstractFileByPath(pin.path);
      const exists = file instanceof TFile;
      const card = grid.createDiv({
        cls: "ntp-card",
        attr: {
          draggable: exists ? "true" : "false"
        }
      });

      card.toggleClass("is-missing", !exists);

      const grip = card.createSpan({
        cls: "ntp-card-grip",
        attr: {
          "aria-hidden": "true"
        }
      });
      setIcon(grip, "grip-vertical");

      const openButton = card.createEl("button", {
        cls: "ntp-card-open",
        attr: {
          type: "button",
          "aria-label": exists ? `Open ${pin.label ?? getDisplayName(pin.path)}` : pin.path
        }
      });
      openButton.disabled = !exists;

      const body = openButton.createDiv({ cls: "ntp-card-body" });
      body.createDiv({ cls: "ntp-card-title", text: pin.label ?? getDisplayName(pin.path) });
      body.createDiv({
        cls: "ntp-card-path",
        text: exists ? pin.path : `${pin.path} is missing`
      });

      this.createAction(card, "pin-off", "Unpin", () => {
        void this.plugin.unpinFile(pin.path);
      }).addClass("ntp-card-unpin");

      if (!exists) {
        return;
      }

      openButton.addEventListener("click", () => {
        void this.plugin.openFile(pin.path, this.leaf);
      });
      card.addEventListener("dragstart", (event) => {
        this.draggedPinnedPath = pin.path;
        this.draggedFilePath = pin.path;
        card.addClass("is-dragging");
        this.contentEl.addClass("is-reordering");
        this.writeDragData(event, pin.path);

        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
        }
      });
      card.addEventListener("dragover", (event) => {
        const file = this.getDraggedMarkdownFile(event);

        if (!file || file.path === pin.path) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        card.addClass("is-drop-target");

        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = this.isPinned(file.path) ? "move" : "copy";
        }
      });
      card.addEventListener("dragleave", () => {
        card.removeClass("is-drop-target");
      });
      card.addEventListener("drop", (event) => {
        const file = this.getDraggedMarkdownFile(event);
        event.preventDefault();
        event.stopPropagation();
        this.clearDragState();

        if (!file || file.path === pin.path) {
          return;
        }

        if (this.isPinned(file.path)) {
          void this.plugin.reorderPinned(file.path, pin.path);
          return;
        }

        void this.plugin.pinFile(file, pin.path);
      });
      card.addEventListener("dragend", () => {
        this.clearDragState();
      });
    });
  }

  private renderRecent(parent: HTMLElement): void {
    const section = this.createSection(
      parent,
      "Recent modified files",
      "Sorted by file modified time."
    );
    const collapsed = this.plugin.settings.recentFilesCollapsed;
    section.addClass("ntp-collapsible-section");
    section.toggleClass("is-collapsed", collapsed);

    const heading = section.querySelector<HTMLElement>(".ntp-section-heading");
    const toggle = heading?.createEl("button", {
      cls: "ntp-section-toggle",
      attr: {
        type: "button",
        "aria-expanded": collapsed ? "false" : "true",
        "aria-label": collapsed ? "Show recent modified files" : "Hide recent modified files",
        title: collapsed ? "Show recent modified files" : "Hide recent modified files"
      }
    });

    if (toggle) {
      setIcon(toggle, collapsed ? "chevron-down" : "chevron-up");
      toggle.addEventListener("click", () => {
        void this.plugin.setRecentFilesCollapsed(!collapsed);
      });
    }

    if (collapsed) {
      return;
    }

    const list = section.createDiv({ cls: "ntp-list" });
    const files = this.plugin.getRecentModifiedFiles();

    if (files.length === 0) {
      list.createDiv({ cls: "ntp-empty-card", text: "No recent Markdown files found." });
      return;
    }

    for (const file of files) {
      this.createFileRow(list, "ntp-list-row", file);
    }
  }

  private createSection(parent: HTMLElement, title: string, subtitle: string): HTMLElement {
    const section = parent.createEl("section", { cls: "ntp-section" });
    const heading = section.createDiv({ cls: "ntp-section-heading" });
    heading.createEl("h2", { text: title });
    heading.createEl("p", { text: subtitle });
    return section;
  }

  private createAction(
    parent: HTMLElement,
    icon: string,
    label: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = parent.createEl("button", {
      cls: "ntp-action",
      attr: {
        type: "button",
        "aria-label": label,
        title: label
      }
    });
    setIcon(button, icon);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    button.addEventListener("keydown", (event) => {
      event.stopPropagation();
    });
    return button;
  }

  private bindPinnedGridDrop(grid: HTMLElement): void {
    grid.addEventListener("dragover", (event) => {
      const canDrop = this.canDropMarkdownFile(event);

      if (!canDrop) {
        return;
      }

      event.preventDefault();
      grid.addClass("is-drop-target");
      this.contentEl.addClass("is-pinning");

      if (event.dataTransfer) {
        const file = this.getDraggedMarkdownFile(event);
        event.dataTransfer.dropEffect = file && this.isPinned(file.path) ? "move" : "copy";
      }
    });

    grid.addEventListener("dragleave", (event) => {
      if (event.relatedTarget instanceof Node && grid.contains(event.relatedTarget)) {
        return;
      }

      grid.removeClass("is-drop-target");
      this.contentEl.removeClass("is-pinning");
    });

    grid.addEventListener("drop", (event) => {
      const file = this.getDraggedMarkdownFile(event);
      event.preventDefault();
      this.clearDragState();

      if (!file) {
        return;
      }

      if (this.isPinned(file.path)) {
        void this.plugin.movePinnedToEnd(file.path);
        return;
      }

      void this.plugin.pinFile(file);
    });
  }

  private canDropMarkdownFile(event: DragEvent): boolean {
    if (this.getDraggedMarkdownFile(event)) {
      return true;
    }

    const types = event.dataTransfer ? Array.from(event.dataTransfer.types) : [];
    return types.includes("text/plain") || types.includes("text/uri-list");
  }

  private getDraggedMarkdownFile(event: DragEvent): TFile | null {
    const fileExplorerFile = this.plugin.getFileExplorerDraggedFile();
    if (fileExplorerFile) {
      return fileExplorerFile;
    }

    const values = [this.draggedFilePath, this.draggedPinnedPath];

    if (event.dataTransfer) {
      values.push(event.dataTransfer.getData("application/x-new-tab-pins-path"));
      values.push(event.dataTransfer.getData("text/plain"));
      values.push(event.dataTransfer.getData("text/uri-list"));
    }

    return this.plugin.getMarkdownFileFromDragData(values);
  }

  private writeDragData(event: DragEvent, path: string): void {
    if (!event.dataTransfer) {
      return;
    }

    event.dataTransfer.setData("application/x-new-tab-pins-path", path);
    event.dataTransfer.setData("text/plain", path);
  }

  private clearDragState(): void {
    this.draggedFilePath = null;
    this.draggedPinnedPath = null;
    this.contentEl.removeClass("is-reordering");
    this.contentEl.removeClass("is-pinning");
    this.contentEl
      .querySelectorAll(".is-dragging, .is-drop-target")
      .forEach((element) => {
        element.classList.remove("is-dragging", "is-drop-target");
      });
  }

  private createFileRow(parent: HTMLElement, cls: string, file: TFile): HTMLElement {
    const isPinned = this.isPinned(file.path);
    const canPin = isMarkdownFile(file);
    const displayName = getDisplayName(file.path);
    const row = parent.createDiv({
      cls: `${cls} ntp-file-row`,
      attr: {
        draggable: canPin ? "true" : "false"
      }
    });
    row.toggleClass("is-pinned", isPinned);

    const icon = row.createSpan({ cls: "ntp-file-icon" });
    setIcon(icon, canPin ? "file-text" : "file");

    const openButton = row.createEl("button", {
      cls: "ntp-file-open",
      attr: {
        type: "button",
        "aria-label": `Open ${displayName}`
      }
    });
    const body = openButton.createDiv({ cls: "ntp-file-body" });
    body.createSpan({ cls: "ntp-file-title", text: displayName });
    body.createSpan({ cls: "ntp-file-path", text: file.path });

    if (canPin) {
      const actions = row.createDiv({ cls: "ntp-row-actions" });
      this.createAction(actions, isPinned ? "pin-off" : "pin", isPinned ? "Unpin" : "Pin", () => {
        if (this.isPinned(file.path)) {
          void this.plugin.unpinFile(file.path);
          return;
        }

        void this.plugin.pinFile(file);
      }).addClass("ntp-pin-action");
    }

    openButton.addEventListener("click", () => {
      void this.plugin.openFile(file.path, this.leaf);
    });
    row.addEventListener("dragstart", (event) => {
      if (!canPin) {
        event.preventDefault();
        return;
      }

      this.draggedFilePath = file.path;
      row.addClass("is-dragging");
      this.contentEl.addClass("is-pinning");
      this.writeDragData(event, file.path);

      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = isPinned ? "move" : "copyMove";
      }
    });
    row.addEventListener("dragend", () => {
      this.clearDragState();
    });

    return row;
  }

  private isPinned(path: string): boolean {
    return this.plugin.settings.pinnedFiles.some((item) => item.path === path);
  }
}
