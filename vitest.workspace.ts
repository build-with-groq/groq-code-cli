import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
	'./vitest.config.unit.ts',
	'./vitest.config.integration.ts',
	'./vitest.config.component.ts',
]);