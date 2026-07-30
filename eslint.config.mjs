import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist/**", "main.js", "node_modules/**"]),
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: ["Markdown", "New Tab Pins", "Obsidian"]
        }
      ]
    }
  },
  {
    files: ["src/**/*.test.ts"],
    rules: {
      "obsidianmd/no-tfile-tfolder-cast": "off"
    }
  },
  {
    files: ["esbuild.config.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        fetch: "readonly"
      }
    },
    rules: {
      "no-console": "off",
      "no-restricted-globals": "off",
      "obsidianmd/hardcoded-config-path": "off",
      "obsidianmd/no-nodejs-modules": "off",
      "obsidianmd/rule-custom-message": "off"
    }
  }
]);
