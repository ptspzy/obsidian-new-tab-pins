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
    containerEl.createEl("h2", { text: "New Tab Pins" });

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
  }
}
