import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { App, PluginManifest, TFile, WorkspaceLeaf } from "obsidian";
import NewTabPinsPlugin from "./main";
import { VIEW_TYPE_NEW_TAB_PINS } from "./settings";

// These tests model workspace lifecycle events; real Obsidian is verified separately.
vi.mock("obsidian", () => ({
  Plugin: class {
    constructor(readonly app: App) {}
    loadData = vi.fn().mockResolvedValue({ defaultPinRecentCount: 0 });
    saveData = vi.fn().mockResolvedValue(undefined);
    registerView = vi.fn();
    registerEvent = vi.fn();
    registerDomEvent = vi.fn();
    addSettingTab = vi.fn();
    addCommand = vi.fn();
  },
  TFile: class {},
  Notice: vi.fn()
}));
vi.mock("./NewTabPinsView", () => ({ NewTabPinsView: class {} }));
vi.mock("./SettingsTab", () => ({ NewTabPinsSettingTab: class {} }));

function createLeaf(initialType = "empty") {
  let type = initialType;
  const setViewState = vi.fn((state: { type: string }) => {
    type = state.type;
    return Promise.resolve();
  });
  const leaf = { view: { getViewType: () => type }, setViewState } as unknown as WorkspaceLeaf;
  return { leaf, setViewState };
}

async function setup(initialLeaf: WorkspaceLeaf | null) {
  let onReady = () => {};
  let onActiveChange = (_leaf: WorkspaceLeaf | null) => {};
  let recentLeaf = initialLeaf;
  const workspace = {
    layoutReady: false,
    getMostRecentLeaf: vi.fn(() => recentLeaf),
    // Calling this during startup could create a new tab in real Obsidian.
    getLeaf: vi.fn(() => {
      const type = recentLeaf?.view.getViewType();
      return recentLeaf && type !== VIEW_TYPE_NEW_TAB_PINS ? recentLeaf : createLeaf().leaf;
    }),
    getLeavesOfType: vi.fn(() => []),
    onLayoutReady: vi.fn((callback: () => void) => { onReady = callback; }),
    on: vi.fn((event: string, callback: (leaf: WorkspaceLeaf | null) => void) => {
      if (event === "active-leaf-change") onActiveChange = callback;
    })
  };
  const vault = { getFiles: vi.fn((): TFile[] => []), getMarkdownFiles: vi.fn((): TFile[] => []) };
  const app = { workspace, vault } as unknown as App;
  const plugin = new NewTabPinsPlugin(app, {} as PluginManifest);
  await plugin.onload();
  return {
    plugin, workspace, vault,
    ready: () => { workspace.layoutReady = true; onReady(); },
    focus: (leaf: WorkspaceLeaf | null) => { recentLeaf = leaf; onActiveChange(leaf); },
    setRecentLeaf: (leaf: WorkspaceLeaf | null) => { recentLeaf = leaf; }
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  vi.stubGlobal("document", {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("automatic home tab lifecycle", () => {
  it("waits for layout restoration and replaces the initial empty tab in place once", async () => {
    const { leaf, setViewState } = createLeaf();
    const h = await setup(leaf);
    h.focus(leaf);
    await vi.advanceTimersByTimeAsync(100);
    expect(setViewState).not.toHaveBeenCalled();
    h.ready();
    h.focus(leaf);
    h.focus(leaf);
    await vi.advanceTimersByTimeAsync(100);
    expect(setViewState).toHaveBeenCalledExactlyOnceWith({ type: VIEW_TYPE_NEW_TAB_PINS, active: true });
    expect(h.workspace.getLeaf).not.toHaveBeenCalled();
  });

  it.each([VIEW_TYPE_NEW_TAB_PINS, "markdown", "canvas", "bases"])(
    "preserves the restored %s view without creating a leaf on repeated loads", async (type) => {
      const { leaf, setViewState } = createLeaf(type);
      for (let i = 0; i < 3; i++) {
        const h = await setup(leaf);
        h.ready();
        await vi.advanceTimersByTimeAsync(100);
        expect(h.workspace.getLeaf).not.toHaveBeenCalled();
        h.plugin.onunload();
      }
      expect(setViewState).not.toHaveBeenCalled();
    }
  );

  it("does not create a tab when there is no restored leaf or auto-replace is off", async () => {
    const { leaf, setViewState } = createLeaf();
    const h = await setup(null);
    h.ready();
    await vi.advanceTimersByTimeAsync(100);
    h.plugin.settings.autoReplaceEmptyTabs = false;
    h.focus(leaf);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.workspace.getLeaf).not.toHaveBeenCalled();
    expect(setViewState).not.toHaveBeenCalled();
  });

  it("replaces a newly focused empty tab after startup", async () => {
    const h = await setup(createLeaf("markdown").leaf);
    h.ready();
    await vi.advanceTimersByTimeAsync(100);
    const { leaf, setViewState } = createLeaf();
    h.focus(leaf);
    await vi.advanceTimersByTimeAsync(100);
    expect(setViewState).toHaveBeenCalledOnce();
  });

  it.each(["focus", "null", "detached", "file-open", "disabled", "layout", "unloaded"])(
    "cancels a pending conversion after %s changes", async (change) => {
      const { leaf, setViewState } = createLeaf();
      const h = await setup(leaf);
      h.ready();
      await vi.advanceTimersByTimeAsync(0);
      if (change === "focus") h.focus(createLeaf("markdown").leaf);
      if (change === "null") h.focus(null);
      if (change === "detached") h.setRecentLeaf(null);
      if (change === "file-open") { await leaf.setViewState({ type: "markdown" }); setViewState.mockClear(); }
      if (change === "disabled") h.plugin.settings.autoReplaceEmptyTabs = false;
      if (change === "layout") h.workspace.layoutReady = false;
      if (change === "unloaded") h.plugin.onunload();
      await vi.advanceTimersByTimeAsync(100);
      expect(setViewState).not.toHaveBeenCalled();
    }
  );

  it("ignores a delayed startup callback after unloading", async () => {
    const { leaf, setViewState } = createLeaf();
    const h = await setup(leaf);
    let finishSeeding = (_value: boolean) => {};
    vi.spyOn(h.plugin, "ensureDefaultPinnedFiles").mockReturnValue(new Promise(resolve => { finishSeeding = resolve; }));
    h.ready();
    h.plugin.onunload();
    finishSeeding(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(setViewState).not.toHaveBeenCalled();
    expect(h.workspace.getLeaf).not.toHaveBeenCalled();
  });
});

describe("search candidates", () => {
  it("reads all vault files instead of only Markdown files", async () => {
    const h = await setup(null);
    const base = { path: "Projects/Tasks.base", basename: "Tasks", extension: "base" } as TFile;
    h.vault.getFiles.mockReturnValue([base]);
    expect(h.plugin.getSearchResults("tasks")).toEqual([base]);
    expect(h.vault.getMarkdownFiles).not.toHaveBeenCalled();
  });
});
