import { PluginSettingTab, Setting } from "obsidian";
import type NewTabPinsPlugin from "./main";
import type { LayoutDensity } from "./settings";

const LAYOUT_DENSITY_OPTIONS: Record<string, string> = {
  comfortable: "Comfortable",
  compact: "Compact"
};

const STARTER_PIN_OPTIONS: Record<string, string> = {
  "0": "Off",
  "2": "Two recent files",
  "4": "Four recent files",
  "6": "Six recent files",
  "8": "Eight recent files"
};

export class NewTabPinsSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: NewTabPinsPlugin) {
    super(plugin.app, plugin);
  }

  getSettingDefinitions() {
    return [
      {
        name: "Home title",
        desc: "Shown at the top of the home view.",
        control: {
          type: "text" as const,
          key: "title",
          defaultValue: "Start here"
        }
      },
      {
        name: "Home subtitle",
        desc: "Shown below the title.",
        control: {
          type: "textarea" as const,
          key: "subtitle",
          defaultValue: "Pinned notes and recent work from this vault."
        }
      },
      {
        name: "Auto-open on empty tabs",
        desc: "Replace newly focused empty Obsidian tabs with the New Tab Pins home view.",
        control: {
          type: "toggle" as const,
          key: "autoReplaceEmptyTabs",
          defaultValue: true
        }
      },
      {
        name: "Layout density",
        desc: "Choose how much spacing the home view uses.",
        control: {
          type: "dropdown" as const,
          key: "layoutDensity",
          defaultValue: "comfortable",
          options: LAYOUT_DENSITY_OPTIONS
        }
      },
      {
        name: "Starter pins",
        desc: "When there are no pinned files yet, pin this many recent Markdown files once. Choose no starter pins to start empty.",
        control: {
          type: "dropdown" as const,
          key: "defaultPinRecentCount",
          defaultValue: "4",
          options: STARTER_PIN_OPTIONS
        }
      }
    ];
  }

  getControlValue(key: string): unknown {
    if (key === "defaultPinRecentCount") {
      return String(this.plugin.settings.defaultPinRecentCount);
    }

    return this.plugin.settings[key as keyof typeof this.plugin.settings];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    switch (key) {
      case "title":
        if (typeof value !== "string") return;
        this.plugin.settings.title = value.trim() || "Start here";
        break;
      case "subtitle":
        if (typeof value !== "string") return;
        this.plugin.settings.subtitle =
          value.trim() || "Pinned notes and recent work from this vault.";
        break;
      case "autoReplaceEmptyTabs":
        if (typeof value !== "boolean") return;
        this.plugin.settings.autoReplaceEmptyTabs = value;
        break;
      case "layoutDensity":
        if (value !== "comfortable" && value !== "compact") return;
        this.plugin.settings.layoutDensity = value;
        break;
      case "defaultPinRecentCount": {
        if (typeof value !== "string") return;
        const count = Number(value);
        if (![0, 2, 4, 6, 8].includes(count)) return;
        this.plugin.settings.defaultPinRecentCount = count;
        this.plugin.settings.defaultPinnedFilesSeeded = false;
        await this.plugin.saveSettings();
        await this.plugin.ensureDefaultPinnedFiles();
        return;
      }
      default:
        return;
    }

    await this.plugin.saveSettings();
    this.plugin.refreshViews();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Home title")
      .setDesc("Shown at the top of the home view.")
      .addText((text) => {
        text
          .setValue(this.plugin.settings.title)
          .onChange(async (value) => {
            this.plugin.settings.title = value.trim() || "Start here";
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
      });

    new Setting(containerEl)
      .setName("Home subtitle")
      .setDesc("Shown below the title.")
      .addTextArea((text) => {
        text
          .setValue(this.plugin.settings.subtitle)
          .onChange(async (value) => {
            this.plugin.settings.subtitle =
              value.trim() || "Pinned notes and recent work from this vault.";
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
      });

    new Setting(containerEl)
      .setName("Auto-open on empty tabs")
      .setDesc("Replace newly focused empty Obsidian tabs with the New Tab Pins home view.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.autoReplaceEmptyTabs)
          .onChange(async (value) => {
            this.plugin.settings.autoReplaceEmptyTabs = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Layout density")
      .setDesc("Choose how much spacing the home view uses.")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("comfortable", "Comfortable")
          .addOption("compact", "Compact")
          .setValue(this.plugin.settings.layoutDensity)
          .onChange(async (value) => {
            this.plugin.settings.layoutDensity = value as LayoutDensity;
            await this.plugin.saveSettings();
            this.plugin.refreshViews();
          });
      });

    new Setting(containerEl)
      .setName("Starter pins")
      .setDesc(
        "When there are no pinned files yet, pin this many recent Markdown files once. Choose no starter pins to start empty."
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption("0", "Off")
          .addOption("2", "Two recent files")
          .addOption("4", "Four recent files")
          .addOption("6", "Six recent files")
          .addOption("8", "Eight recent files")
          .setValue(String(this.plugin.settings.defaultPinRecentCount))
          .onChange(async (value) => {
            this.plugin.settings.defaultPinRecentCount = Number(value);
            this.plugin.settings.defaultPinnedFilesSeeded = false;
            await this.plugin.saveSettings();
            await this.plugin.ensureDefaultPinnedFiles();
          });
      });
  }
}
