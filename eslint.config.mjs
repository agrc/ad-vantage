import { browser } from "@ugrc/eslint-config";

export default [
  {
    ignores: ["dist/**", "dist-dev/**"],
  },
  ...browser,
];
