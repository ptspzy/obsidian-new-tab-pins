# New Tab Pins

New Tab Pins is an Obsidian plugin that adds a browser-like home tab for large vaults. It gives you a focused search box, a pinned notes grid, and a recent modified files section.

## Features

- Open a custom home tab from the command palette.
- Optionally replace newly focused empty tabs with the home view.
- Pin and unpin Markdown files from commands or the file menu.
- Search Markdown files by title or path.
- Show recent modified Markdown files.
- Customize the home title, subtitle, layout density, and empty-tab replacement setting.

## Development

```bash
npm install
npm run dev
```

`npm run dev` watches `src/main.ts` and writes `main.js`.

## Build

```bash
npm run build
```

The build creates `main.js` in the plugin root. Obsidian also needs `manifest.json` and `styles.css`.

## Test and Release Checks

Run the full pre-release gate before publishing:

```bash
npm run release:check
```

This runs unit tests, production TypeScript/build checks, and release asset validation.

To stage the exact files that need to be attached to a GitHub release:

```bash
npm run release:stage
```

The staged files are written to `dist/`:

```txt
manifest.json
main.js
styles.css
```

## Publishing

1. Confirm `manifest.json`, `package.json`, and `versions.json` use the same plugin version.
2. Run `npm run release:stage`.
3. Commit the source, `manifest.json`, `versions.json`, `README.md`, `LICENSE`, `main.js`, and `styles.css`.
4. Push a Git tag that exactly matches the manifest version, for example `0.1.0`.
5. Create or verify the GitHub release for that tag and attach `dist/manifest.json`, `dist/main.js`, and `dist/styles.css`.
6. Submit the GitHub repository from the Obsidian Community directory after the release exists.

## Manual Installation

Create this folder inside a test vault:

```txt
.obsidian/plugins/new-tab-pins/
```

Copy these files into it:

```txt
manifest.json
main.js
styles.css
```

Reload Obsidian, enable community plugins, then enable **New Tab Pins**.

## Commands

- `New Tab Pins: Open home tab`
- `New Tab Pins: Replace current tab with home`
- `New Tab Pins: Pin current file`
- `New Tab Pins: Unpin current file`

## Compatibility Note

The stable core of the plugin is the custom Obsidian view and commands. The setting **Auto-open on empty tabs** tries to replace Obsidian empty tabs with the home view. That behavior depends on Obsidian exposing empty tabs as an `empty` view type. If this stops working in a future Obsidian version, disable the setting and use the command palette entry.
