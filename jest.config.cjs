const expoPreset = require("jest-expo/jest-preset");
module.exports = {
  preset: "jest-expo",
  testTimeout: 20000,
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  collectCoverageFrom: ["src/domain/**/*.ts"],
  // Lucide publishes native components as ESM, including its per-icon exports.
  transform: {
    ...expoPreset.transform,
    "^.+\\.mjs$": expoPreset.transform["\\.[jt]sx?$"],
  },
  transformIgnorePatterns: expoPreset.transformIgnorePatterns.map((pattern) =>
    pattern.replace(
      ".pnpm|react-native",
      ".pnpm|lucide-react-native|@noble/hashes|react-native",
    ),
  ),
};
