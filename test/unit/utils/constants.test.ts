import test from 'ava';
import { IGNORE_PATTERNS } from '@src/utils/constants';

test('IGNORE_PATTERNS should be a Set', t => {
	t.true(IGNORE_PATTERNS instanceof Set);
});

test('IGNORE_PATTERNS should contain common directories to ignore', t => {
	t.true(IGNORE_PATTERNS.has('node_modules'));
	t.true(IGNORE_PATTERNS.has('.git'));
	t.true(IGNORE_PATTERNS.has('dist'));
	t.true(IGNORE_PATTERNS.has('build'));
});

test('IGNORE_PATTERNS should contain Python-specific patterns', t => {
	t.true(IGNORE_PATTERNS.has('__pycache__'));
	t.true(IGNORE_PATTERNS.has('venv'));
	t.true(IGNORE_PATTERNS.has('.venv'));
	t.true(IGNORE_PATTERNS.has('*.pyc'));
});

test('IGNORE_PATTERNS should contain IDE-specific patterns', t => {
	t.true(IGNORE_PATTERNS.has('.idea'));
	t.true(IGNORE_PATTERNS.has('.vscode'));
});

test('IGNORE_PATTERNS should contain OS and temporary file patterns', t => {
	t.true(IGNORE_PATTERNS.has('.DS_Store'));
	t.true(IGNORE_PATTERNS.has('*.log'));
	t.true(IGNORE_PATTERNS.has('*.tmp'));
});

test('IGNORE_PATTERNS should have the expected number of patterns', t => {
	t.is(IGNORE_PATTERNS.size, 19);
});