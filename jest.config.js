/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // Avoid <rootDir>: on Windows, Jest keeps the backslash before a parent folder that starts with a dot.
  testMatch: ["**/src/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
