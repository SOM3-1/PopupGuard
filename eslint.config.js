import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**"]
  },
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error"
    }
  },
  {
    files: ["**/*.jsx"],
    rules: {
      "no-unused-vars": "off"
    }
  }
];
