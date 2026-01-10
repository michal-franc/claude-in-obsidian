module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/src'],
	testMatch: ['**/*.test.ts'],
	moduleFileExtensions: ['ts', 'js'],
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
	// Mock obsidian module since it's not available in test environment
	moduleNameMapper: {
		'^obsidian$': '<rootDir>/src/__mocks__/obsidian.ts',
	},
};
