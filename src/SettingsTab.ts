import { PluginSettingTab, Setting } from "obsidian";
import type NewTabPinsPlugin from "./main";
import type { LayoutDensity } from "./settings";

export class NewTabPinsSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: NewTabPinsPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("New Tab Pins")
      .setHeading();

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
        "When there are no pinned files yet, pin this many recent Markdown files once. Set to Off to start empty."
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption("0", "Off")
          .addOption("2", "2 recent files")
          .addOption("4", "4 recent files")
          .addOption("6", "6 recent files")
          .addOption("8", "8 recent files")
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
