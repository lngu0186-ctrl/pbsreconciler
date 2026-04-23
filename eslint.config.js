import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi", "src/routeTree.gen.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",

      // ---- JSX correctness rules (catch mismatched / undefined tags before runtime) ----
      // Flag JSX tags that reference an identifier that is not in scope
      // (e.g. <React.Fragment> when only `Fragment` is imported).
      "react/jsx-no-undef": ["error", { allowGlobals: false }],
      // Require unique keys in lists.
      "react/jsx-key": "error",
      // Disallow duplicate props on a single JSX element.
      "react/jsx-no-duplicate-props": "error",
      // Disallow children inside void elements (<img>, <br>, ...).
      "react/void-dom-elements-no-children": "error",
      // Catch <Fragment key={...} /> usage where short syntax can't carry props.
      "react/jsx-no-useless-fragment": ["warn", { allowExpressions: true }],
    },
  },
  eslintPluginPrettier,
);
