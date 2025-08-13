import test from 'ava';
import sinon from 'sinon';
import mockFs from 'mock-fs';
import * as fs from 'fs';
import * as path from 'path';
import { writeFile, createDirectory, deleteFile, displayTree, shouldIgnore } from '@src/utils/file-ops';

// Use serial tests to avoid conflicts with fs stubbing
const serialTest = test.serial;

// Setup filesystem mocks before each test
serialTest.beforeEach((t) => {
	// Create a test context with a sandbox
	t.context.sandbox = sinon.createSandbox();
});

serialTest.afterEach.always((t) => {
	// Restore the sandbox after each test
	if (t.context.sandbox) {
		t.context.sandbox.restore();
	}
	// Also restore global sinon just in case
	sinon.restore();
	// Restore mock-fs
	mockFs.restore();
});

serialTest('writeFile - should write file successfully', async (t) => {
	// Mock fs.promises.mkdir to succeed
	const mkdirStub = t.context.sandbox.stub(fs.promises, 'mkdir').resolves();
	// Mock fs.promises.writeFile to succeed
	const writeFileStub = t.context.sandbox.stub(fs.promises, 'writeFile').resolves();

	const result = await writeFile('/test/newfile.txt', 'content');
	
	t.is(result, true);
	
	// Verify mkdir was called with correct path
	t.true(mkdirStub.calledWith('/test', { recursive: true }));
	// Verify writeFile was called with correct parameters
	t.true(writeFileStub.calledWith('/test/newfile.txt', 'content', 'utf-8'));
});

serialTest('writeFile - should return false on error', async (t) => {
	// Mock fs.promises.mkdir to throw an error
	t.context.sandbox.stub(fs.promises, 'mkdir').rejects(new Error('Permission denied'));
	
	const result = await writeFile('/test/dir', 'content');
	
	t.is(result, false);
});

serialTest('writeFile - should handle force and backup parameters', async (t) => {
	const mkdirStub = t.context.sandbox.stub(fs.promises, 'mkdir').resolves();
	const writeFileStub = t.context.sandbox.stub(fs.promises, 'writeFile').resolves();

	const result = await writeFile('/test/file.txt', 'new content', true, true);
	
	t.is(result, true);
	
	// Verify mkdir was called
	t.true(mkdirStub.calledWith('/test', { recursive: true }));
	// Verify writeFile was called with correct parameters
	t.true(writeFileStub.calledWith('/test/file.txt', 'new content', 'utf-8'));
});

serialTest('createDirectory - should create directory successfully', async (t) => {
	// Mock fs.promises.mkdir to succeed
	const mkdirStub = t.context.sandbox.stub(fs.promises, 'mkdir').resolves();

	const result = await createDirectory('/test/newdir');
	
	t.is(result, true);
	
	// Verify mkdir was called with correct parameters
	t.true(mkdirStub.calledWith('/test/newdir', { recursive: true }));
});

serialTest('createDirectory - should return false on error', async (t) => {
	// Mock fs.promises.mkdir to throw an error
	t.context.sandbox.stub(fs.promises, 'mkdir').rejects(new Error('Permission denied'));
	
	const result = await createDirectory('/test/file.txt');
	
	t.is(result, false);
});

serialTest('deleteFile - should delete file when force is true', async (t) => {
	// Mock fs.promises.stat to return file stats
	const statsStub = t.context.sandbox.stub(fs.promises, 'stat').resolves({
		isFile: () => true,
		isDirectory: () => false
	} as any);
	// Mock fs.promises.unlink to succeed
	const unlinkStub = t.context.sandbox.stub(fs.promises, 'unlink').resolves();

	const result = await deleteFile('/test/file.txt', true);
	
	t.is(result, true);
	
	// Verify stat was called
	t.true(statsStub.calledWith(path.resolve('/test/file.txt')));
	// Verify unlink was called
	t.true(unlinkStub.calledWith(path.resolve('/test/file.txt')));
});

serialTest('deleteFile - should delete directory when force is true', async (t) => {
	// Mock fs.promises.stat to return directory stats
	const statsStub = t.context.sandbox.stub(fs.promises, 'stat').resolves({
		isFile: () => false,
		isDirectory: () => true
	} as any);
	// Mock fs.promises.rm to succeed
	const rmStub = t.context.sandbox.stub(fs.promises, 'rm').resolves();

	const result = await deleteFile('/test/dir', true);
	
	t.is(result, true);
	
	// Verify stat was called
	t.true(statsStub.calledWith(path.resolve('/test/dir')));
	// Verify rm was called with recursive option
	t.true(rmStub.calledWith(path.resolve('/test/dir'), { recursive: true }));
});

serialTest('deleteFile - should return false when force is false', async (t) => {
	// Mock fs.promises.stat to return file stats
	t.context.sandbox.stub(fs.promises, 'stat').resolves({
		isFile: () => true,
		isDirectory: () => false
	} as any);
	// Create unlink stub but it shouldn't be called
	const unlinkStub = t.context.sandbox.stub(fs.promises, 'unlink').resolves();

	const result = await deleteFile('/test/file.txt', false);
	
	t.is(result, false);
	
	// Verify that no unlink was called since force is false
	t.false(unlinkStub.called);
});

serialTest('deleteFile - should return false when file does not exist', async (t) => {
	// Mock fs.promises.stat to throw ENOENT error
	const error = new Error('File not found') as any;
	error.code = 'ENOENT';
	t.context.sandbox.stub(fs.promises, 'stat').rejects(error);
	
	const result = await deleteFile('/test/nonexistent.txt', true);
	
	t.is(result, false);
});

serialTest('deleteFile - should return false on other errors', async (t) => {
	// Mock fs.promises.stat to throw a permission error
	const error = new Error('Permission denied') as any;
	error.code = 'EACCES';
	t.context.sandbox.stub(fs.promises, 'stat').rejects(error);
	
	const result = await deleteFile('/readonly/file.txt', true);
	
	t.is(result, false);
});

serialTest('displayTree - should display directory tree', async (t) => {
	// Mock fs.promises.access to indicate directory exists
	t.context.sandbox.stub(fs.promises, 'access').resolves();
	
	// Mock fs.promises.readdir to return mock directory contents
	const mockItems = [
		{ name: 'dir1', isDirectory: () => true, isFile: () => false },
		{ name: 'file1.txt', isDirectory: () => false, isFile: () => true },
		{ name: 'file2.js', isDirectory: () => false, isFile: () => true },
		{ name: 'visible.txt', isDirectory: () => false, isFile: () => true },
		{ name: '.hidden', isDirectory: () => false, isFile: () => true },
		{ name: '.env', isDirectory: () => false, isFile: () => true }
	];
	t.context.sandbox.stub(fs.promises, 'readdir').resolves(mockItems as any);

	const result = await displayTree('/mockdir', false);
	
	t.truthy(result, `displayTree should return content, got: "${result}"`);
	t.true(result.includes('dir1'));
	t.true(result.includes('file1.txt'));
	t.true(result.includes('file2.js'));
	t.true(result.includes('visible.txt'));
});

serialTest('displayTree - should handle directory not found', async (t) => {
	// Mock fs.promises.access to throw an error (directory not found)
	t.context.sandbox.stub(fs.promises, 'access').rejects(new Error('ENOENT'));
	
	const result = await displayTree('/nonexistent', false);
	
	t.is(result, '');
});

serialTest('displayTree - should filter hidden files when showHidden is false', async (t) => {
	// Mock fs.promises.access to indicate directory exists
	t.context.sandbox.stub(fs.promises, 'access').resolves();
	
	// Mock fs.promises.readdir to return mock directory contents
	const mockItems = [
		{ name: 'dir1', isDirectory: () => true, isFile: () => false },
		{ name: 'file1.txt', isDirectory: () => false, isFile: () => true },
		{ name: 'file2.js', isDirectory: () => false, isFile: () => true },
		{ name: 'visible.txt', isDirectory: () => false, isFile: () => true },
		{ name: '.hidden', isDirectory: () => false, isFile: () => true },
		{ name: '.env', isDirectory: () => false, isFile: () => true }
	];
	t.context.sandbox.stub(fs.promises, 'readdir').resolves(mockItems as any);

	const result = await displayTree('/mockdir', false);
	
	t.truthy(result, `displayTree should return content, got: "${result}"`);
	t.false(result.includes('.hidden'));
	t.false(result.includes('.env'));
	t.true(result.includes('dir1'));
	t.true(result.includes('file1.txt'));
});

serialTest('displayTree - should show hidden files when showHidden is true', async (t) => {
	// Mock fs.promises.access to indicate directory exists
	t.context.sandbox.stub(fs.promises, 'access').resolves();
	
	// Mock fs.promises.readdir to return mock directory contents
	const mockItems = [
		{ name: 'dir1', isDirectory: () => true, isFile: () => false },
		{ name: 'file1.txt', isDirectory: () => false, isFile: () => true },
		{ name: '.hidden', isDirectory: () => false, isFile: () => true },
		{ name: '.env', isDirectory: () => false, isFile: () => true },
		{ name: '.gitignore', isDirectory: () => false, isFile: () => true }
	];
	t.context.sandbox.stub(fs.promises, 'readdir').resolves(mockItems as any);

	const result = await displayTree('/mockdir', true);
	
	t.truthy(result, `displayTree should return content, got: "${result}"`);
	// .hidden should NOT appear because it's filtered by shouldIgnore
	t.false(result.includes('.hidden'));
	// .env and .gitignore are allowed hidden files, so they should appear when showHidden is true
	t.true(result.includes('.env'));
	t.true(result.includes('.gitignore'));
});

serialTest('displayTree - should handle errors during readdir', async (t) => {
	// Mock fs.promises.access to indicate directory exists
	t.context.sandbox.stub(fs.promises, 'access').resolves();
	// Mock fs.promises.readdir to throw a permission error
	t.context.sandbox.stub(fs.promises, 'readdir').rejects(new Error('Permission denied'));
	
	const result = await displayTree('/noaccess', false);
	
	t.is(result, '');
});

// shouldIgnore tests
test('shouldIgnore - should ignore node_modules', (t) => {
	t.true(shouldIgnore('node_modules'));
	t.true(shouldIgnore('path/node_modules'));
	t.true(shouldIgnore('node_modules/package'));
});

test('shouldIgnore - should ignore .git directory', (t) => {
	t.true(shouldIgnore('.git'));
	t.true(shouldIgnore('path/.git'));
	t.true(shouldIgnore('.git/config'));
});

test('shouldIgnore - should ignore files matching glob patterns', (t) => {
	t.true(shouldIgnore('file.log'));
	t.true(shouldIgnore('debug.tmp'));
	t.true(shouldIgnore('build.o'));
});

test('shouldIgnore - should ignore hidden files except allowed ones', (t) => {
	t.true(shouldIgnore('.hidden'));
	t.false(shouldIgnore('.env'));
	t.false(shouldIgnore('.gitignore'));
});

test('shouldIgnore - should not ignore regular files', (t) => {
	t.false(shouldIgnore('index.js'));
	t.false(shouldIgnore('README.md'));
	t.false(shouldIgnore('package.json'));
});

test('shouldIgnore - should ignore Python-specific patterns', (t) => {
	t.true(shouldIgnore('__pycache__'));
	t.true(shouldIgnore('file.pyc'));
	t.true(shouldIgnore('.pytest_cache'));
});

test('shouldIgnore - should ignore IDE directories', (t) => {
	t.true(shouldIgnore('.vscode'));
	t.true(shouldIgnore('.idea'));
	t.true(shouldIgnore('*.swp'));
});

test('shouldIgnore - should ignore build directories', (t) => {
	t.true(shouldIgnore('dist'));
	t.true(shouldIgnore('build'));
	t.true(shouldIgnore('target'));
});

test('shouldIgnore - should ignore OS-specific files', (t) => {
	t.true(shouldIgnore('.DS_Store'));
	t.true(shouldIgnore('Thumbs.db'));
	t.true(shouldIgnore('desktop.ini'));
});