import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended"],
    rules: {
      quotes: ["error", "double"],
      semi: ["error", "always"],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],
      "space-before-function-paren": "off",
      "arrow-spacing": ["error", { before: true, after: true }],
      "key-spacing": ["error", { beforeColon: false, afterColon: true }],
      "no-multiple-empty-lines": ["error", { max: 1 }],
      "eol-last": ["error", "always"],
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-duplicate-imports": "error",
      "no-console": "warn",
    },
  },
  {
    files: ["**/*.{js, mjs, cjs, ts, mts, cts}"],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
