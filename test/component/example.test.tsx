import React from 'react';
import test from 'ava';
import { render, fireEvent, cleanup } from '@testing-library/react';

const ExampleButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
	<button onClick={onClick}>{children}</button>
);

const ExampleCounter = () => {
	const [count, setCount] = React.useState(0);
	return (
		<div>
			<span data-testid="count">{count}</span>
			<button onClick={() => setCount(count + 1)}>Increment</button>
		</div>
	);
};

test('ExampleButton - should render button with text', (t) => {
	const { container } = render(<ExampleButton onClick={() => {}}>Click me</ExampleButton>);
	const button = container.querySelector('button');
	t.truthy(button);
	t.is(button?.textContent, 'Click me');
	cleanup();
});

test('ExampleButton - should handle click events', (t) => {
	let clicked = false;
	const handleClick = () => { clicked = true; };
	
	const { container } = render(<ExampleButton onClick={handleClick}>Test</ExampleButton>);
	const button = container.querySelector('button');
	
	fireEvent.click(button!);
	t.is(clicked, true);
	cleanup();
});

test('ExampleCounter - should increment counter on click', (t) => {
	const { container, getByTestId, getByText } = render(<ExampleCounter />);
	
	const count = getByTestId('count');
	const button = getByText('Increment');
	
	t.is(count.textContent, '0');
	
	fireEvent.click(button);
	t.is(count.textContent, '1');
	
	fireEvent.click(button);
	t.is(count.textContent, '2');
	cleanup();
});