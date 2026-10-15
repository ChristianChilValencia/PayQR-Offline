module.exports = {
  preset: "jest-expo",
  testTimeout: 20000,
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  collectCoverageFrom: ["src/domain/**/*.ts"],
};
