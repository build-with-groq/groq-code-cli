import test from 'ava';
import { parseMarkdown, parseInlineElements, type MarkdownElement, type InlineElement } from '@src/utils/markdown';

test('parseMarkdown - should parse plain text', (t) => {
	const result = parseMarkdown('This is plain text');
	t.deepEqual(result, [
		{ type: 'text', content: 'This is plain text' }
	]);
});

test('parseMarkdown - should parse headings with correct levels', (t) => {
	const markdown = `# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6`;

	const result = parseMarkdown(markdown);
	t.deepEqual(result, [
		{ type: 'heading', content: 'Heading 1', level: 1 },
		{ type: 'heading', content: 'Heading 2', level: 2 },
		{ type: 'heading', content: 'Heading 3', level: 3 },
		{ type: 'heading', content: 'Heading 4', level: 4 },
		{ type: 'heading', content: 'Heading 5', level: 5 },
		{ type: 'heading', content: 'Heading 6', level: 6 },
	]);
});

test('parseMarkdown - should parse code blocks', (t) => {
	const markdown = `\`\`\`
const x = 1;
const y = 2;
\`\`\``;

	const result = parseMarkdown(markdown);
	t.deepEqual(result, [
		{ type: 'code-block', content: 'const x = 1;\nconst y = 2;' }
	]);
});

test('parseMarkdown - should parse mixed content with inline code', (t) => {
	const markdown = 'This line has `inline code` in it';
	const result = parseMarkdown(markdown);
	t.deepEqual(result, [
		{ type: 'mixed-line', content: 'This line has `inline code` in it' }
	]);
});

test('parseMarkdown - should parse mixed content with bold text', (t) => {
	const markdown = 'This line has **bold text** in it';
	const result = parseMarkdown(markdown);
	t.deepEqual(result, [
		{ type: 'mixed-line', content: 'This line has **bold text** in it' }
	]);
});

test('parseMarkdown - should parse mixed content with italic text', (t) => {
	const markdown = 'This line has *italic text* in it';
	const result = parseMarkdown(markdown);
	t.deepEqual(result, [
		{ type: 'mixed-line', content: 'This line has *italic text* in it' }
	]);
});

test('parseMarkdown - should handle empty lines', (t) => {
	const markdown = `Line 1

Line 3`;
	const result = parseMarkdown(markdown);
	t.deepEqual(result, [
		{ type: 'text', content: 'Line 1' },
		{ type: 'text', content: ' ' },
		{ type: 'text', content: 'Line 3' }
	]);
});

test('parseMarkdown - should handle complex markdown document', (t) => {
	const markdown = `# Main Title

This is a paragraph with **bold** and *italic* text.

## Subsection

Here's some \`inline code\`.

\`\`\`
function example() {
  return true;
}
\`\`\`

Regular text after code block.`;

	const result = parseMarkdown(markdown);
	t.is(result.length, 11);
	t.is(result[0].type, 'heading');
	t.is(result[1].type, 'text');
	t.is(result[2].type, 'mixed-line');
	t.is(result[3].type, 'text');
	t.is(result[4].type, 'heading');
	t.is(result[5].type, 'text');
	t.is(result[6].type, 'mixed-line');
	t.is(result[7].type, 'text');
	t.is(result[8].type, 'code-block');
	t.is(result[9].type, 'text');
	t.is(result[10].type, 'text');
});

test('parseMarkdown - should handle code block at end of content', (t) => {
	const markdown = `Text before
\`\`\`
code content
\`\`\``;

	const result = parseMarkdown(markdown);
	t.deepEqual(result, [
		{ type: 'text', content: 'Text before' },
		{ type: 'code-block', content: 'code content' }
	]);
});

test('parseMarkdown - should handle unclosed code block', (t) => {
	const markdown = `\`\`\`
code without closing`;

	const result = parseMarkdown(markdown);
	t.deepEqual(result, [
		{ type: 'code-block', content: 'code without closing' }
	]);
});

test('parseInlineElements - should parse plain text', (t) => {
	const result = parseInlineElements('Plain text only');
	t.deepEqual(result, [
		{ type: 'text', content: 'Plain text only' }
	]);
});

test('parseInlineElements - should parse inline code', (t) => {
	const result = parseInlineElements('Text with `code` in it');
	t.deepEqual(result, [
		{ type: 'text', content: 'Text with ' },
		{ type: 'code', content: 'code' },
		{ type: 'text', content: ' in it' }
	]);
});

test('parseInlineElements - should parse bold text', (t) => {
	const result = parseInlineElements('Text with **bold** in it');
	t.deepEqual(result, [
		{ type: 'text', content: 'Text with ' },
		{ type: 'bold', content: 'bold' },
		{ type: 'text', content: ' in it' }
	]);
});

test('parseInlineElements - should parse italic text', (t) => {
	const result = parseInlineElements('Text with *italic* in it');
	t.deepEqual(result, [
		{ type: 'text', content: 'Text with ' },
		{ type: 'italic', content: 'italic' },
		{ type: 'text', content: ' in it' }
	]);
});

test('parseInlineElements - should parse multiple inline elements', (t) => {
	const result = parseInlineElements('Text with `code`, **bold**, and *italic*');
	t.deepEqual(result, [
		{ type: 'text', content: 'Text with ' },
		{ type: 'code', content: 'code' },
		{ type: 'text', content: ', ' },
		{ type: 'bold', content: 'bold' },
		{ type: 'text', content: ', and ' },
		{ type: 'italic', content: 'italic' }
	]);
});

test('parseInlineElements - should handle text starting with inline element', (t) => {
	const result = parseInlineElements('`code` at start');
	t.deepEqual(result, [
		{ type: 'code', content: 'code' },
		{ type: 'text', content: ' at start' }
	]);
});

test('parseInlineElements - should handle text ending with inline element', (t) => {
	const result = parseInlineElements('text ends with `code`');
	t.deepEqual(result, [
		{ type: 'text', content: 'text ends with ' },
		{ type: 'code', content: 'code' }
	]);
});

test('parseInlineElements - should handle adjacent inline elements', (t) => {
	const result = parseInlineElements('`code`**bold**');
	t.deepEqual(result, [
		{ type: 'code', content: 'code' },
		{ type: 'bold', content: 'bold' }
	]);
});

test('parseInlineElements - should handle empty string', (t) => {
	const result = parseInlineElements('');
	t.deepEqual(result, []);
});

test('parseInlineElements - should prioritize inline code over other elements', (t) => {
	const result = parseInlineElements('`code with * and **`');
	t.deepEqual(result, [
		{ type: 'code', content: 'code with * and **' }
	]);
});

test('parseInlineElements - should handle unmatched markdown symbols', (t) => {
	const result = parseInlineElements('Text with single * asterisk');
	t.deepEqual(result, [
		{ type: 'text', content: 'Text with single * asterisk' }
	]);
});

test('parseInlineElements - should handle unmatched backticks', (t) => {
	const result = parseInlineElements('Text with single ` backtick');
	t.deepEqual(result, [
		{ type: 'text', content: 'Text with single ` backtick' }
	]);
});