import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: ["dist/**", ".venv/**", "backend/**", "node_modules/**"], 
  },
  {
    files: ["**/*.jsx", "**/*.js"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser, // window, document ke liye
        ...globals.node     // setTimeout, console ke liye
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/prop-types": "off",
      "no-unused-vars": "warn",
      "no-undef": "warn"
    }
  }
];
