import test from 'ava';
import sinon from 'sinon';
import * as path from 'path';
import { setReadFilesTracker, validateReadBeforeEdit, getReadBeforeEditError } from '@src/tools/validators';

test.beforeEach(t => {
	// Reset tracker before each test
	setReadFilesTracker(null as any);
});

test.afterEach.always(t => {
	sinon.restore();
});

test('validateReadBeforeEdit - should return true when no tracker is set', t => {
	const result = validateReadBeforeEdit('/test/file.txt');
	t.is(result, true);
});

test('validateReadBeforeEdit - should return true when file has been read', t => {
	const tracker = new Set<string>();
	const filePath = '/test/file.txt';
	const resolvedPath = path.resolve(filePath);
	
	tracker.add(resolvedPath);
	setReadFilesTracker(tracker);
	
	const result = validateReadBeforeEdit(filePath);
	t.is(result, true);
});

test('validateReadBeforeEdit - should return false when file has not been read', t => {
	const tracker = new Set<string>();
	setReadFilesTracker(tracker);
	
	const result = validateReadBeforeEdit('/test/unread.txt');
	t.is(result, false);
});

test('validateReadBeforeEdit - should handle relative paths correctly', t => {
	const tracker = new Set<string>();
	const relativePath = './test/file.txt';
	const absolutePath = path.resolve(relativePath);
	
	tracker.add(absolutePath);
	setReadFilesTracker(tracker);
	
	const result = validateReadBeforeEdit(relativePath);
	t.is(result, true);
});

test('validateReadBeforeEdit - should handle different path formats for same file', t => {
	const tracker = new Set<string>();
	const filePath1 = '/test/../test/file.txt';
	const filePath2 = '/test/file.txt';
	const resolvedPath = path.resolve(filePath2);
	
	tracker.add(resolvedPath);
	setReadFilesTracker(tracker);
	
	const result = validateReadBeforeEdit(filePath1);
	t.is(result, true);
});

test('getReadBeforeEditError - should return error message with file path', t => {
	const filePath = '/test/file.txt';
	const error = getReadBeforeEditError(filePath);
	
	t.is(error, `File must be read before editing. Use read_file tool first: ${filePath}`);
});

test('getReadBeforeEditError - should handle relative paths in error message', t => {
	const filePath = './relative/path.js';
	const error = getReadBeforeEditError(filePath);
	
	t.is(error, `File must be read before editing. Use read_file tool first: ${filePath}`);
});

test('setReadFilesTracker - should set tracker correctly', t => {
	const tracker1 = new Set<string>(['file1.txt']);
	const tracker2 = new Set<string>(['file2.txt']);
	
	setReadFilesTracker(tracker1);
	t.is(validateReadBeforeEdit('file1.txt'), false); // Not resolved path
	
	setReadFilesTracker(tracker2);
	t.is(validateReadBeforeEdit('file2.txt'), false); // Not resolved path
});

test('setReadFilesTracker - should allow resetting tracker to null', t => {
	const tracker = new Set<string>();
	setReadFilesTracker(tracker);
	t.is(validateReadBeforeEdit('/test/file.txt'), false);
	
	setReadFilesTracker(null as any);
	t.is(validateReadBeforeEdit('/test/file.txt'), true);
});