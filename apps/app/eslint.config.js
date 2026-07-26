import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".worktrees"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended, jsxA11y.flatConfigs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Most of the app pre-dates this plugin — start as warnings so new
      // violations get visibility without failing existing PRs on lint.
      // Keeps each rule's own options (only the severity is downgraded).
      ...Object.fromEntries(
        Object.entries(jsxA11y.flatConfigs.recommended.rules).map(([rule, config]) => [
          rule,
          Array.isArray(config) ? ["warn", ...config.slice(1)] : "warn",
        ]),
      ),
      // Deprecated in favor of label-has-associated-control, which we keep —
      // this one still requires *both* nesting and htmlFor/id, so it false-
      // positives on the correct, common sibling-label-with-htmlFor pattern.
      "jsx-a11y/label-has-for": "off",
    },
  },
);
