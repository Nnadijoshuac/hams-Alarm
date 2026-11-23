/** Unit tests for pure logic (lib/time, lib/geo, lib/ringPlan). No native modules. */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs', esModuleInterop: true, isolatedModules: true, rootDir: '.' } }] },
  moduleNameMapper: { '^@react-native-async-storage/async-storage$': '<rootDir>/__tests__/mocks/asyncStorage.ts' },
};
