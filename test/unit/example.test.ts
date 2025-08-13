import test from 'ava';

test('should add two numbers', async (t) => {
	const add = (a: number, b: number) => a + b;
	t.is(add(2, 3), 5);
});

test('should concatenate strings', async (t) => {
	const concat = (a: string, b: string) => `${a}${b}`;
	t.is(concat('hello', 'world'), 'helloworld');
});

test('should filter array', async (t) => {
	const filterEven = (arr: number[]) => arr.filter(n => n % 2 === 0);
	t.deepEqual(filterEven([1, 2, 3, 4, 5]), [2, 4]);
});

test('should merge objects', async (t) => {
	const merge = (a: object, b: object) => ({ ...a, ...b });
	t.deepEqual(merge({ x: 1 }, { y: 2 }), { x: 1, y: 2 });
});

test('should deep clone object', async (t) => {
	const deepClone = (obj: any) => JSON.parse(JSON.stringify(obj));
	const original = { a: 1, b: { c: 2 } };
	const cloned = deepClone(original);
	t.deepEqual(cloned, original);
	t.not(cloned, original);
});