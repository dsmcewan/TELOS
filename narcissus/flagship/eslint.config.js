// Flat ESLint config for the flagship (the one package with a dev toolchain —
// the zero-dependency packages keep `node --check` as their honest equivalent).
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "playwright-report/", "test-results/", "**/*.d.ts"] },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      // The classic hooks rules only. The compiler-era immutability rules are
      // wrong for this codebase BY DESIGN: "WebGL is paint, never truth" means
      // the canvas components mutate three.js materials/uniforms imperatively
      // in the animation loop, outside React's data flow.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.ts", "*.ts", "*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
