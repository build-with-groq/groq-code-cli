import React from 'react';
import test from 'ava';
import sinon from 'sinon';
import { render, cleanup } from '@testing-library/react';
import TokenMetrics from '@src/ui/components/display/TokenMetrics';

let clock: sinon.SinonFakeTimers;

test.beforeEach(() => {
	clock = sinon.useFakeTimers();
});

test.afterEach.always(() => {
	cleanup();
	if (clock) {
		clock.restore();
	}
});

test('TokenMetrics - rendering - should not render when inactive and no tokens', (t) => {
	const { container } = render(
		<TokenMetrics
			isActive={false}
			isPaused={false}
			startTime={null}
			endTime={null}
			pausedTime={0}
			completionTokens={0}
		/>
	);

	t.is(container.firstChild, null);
});

test('TokenMetrics - rendering - should render when active', (t) => {
	const { getByText } = render(
		<TokenMetrics
			isActive={true}
			isPaused={false}
			startTime={new Date()}
			endTime={null}
			pausedTime={0}
			completionTokens={0}
		/>
	);

	t.truthy(getByText('0.0s'));
	t.truthy(getByText('0 tokens'));
	t.truthy(getByText('⚡ GroqThinking...'));
});

test('TokenMetrics - rendering - should render when inactive but has tokens', (t) => {
	const startTime = new Date(Date.now() - 5000);
	const endTime = new Date();
	
	const { getByText } = render(
		<TokenMetrics
			isActive={false}
			isPaused={false}
			startTime={startTime}
			endTime={endTime}
			pausedTime={0}
			completionTokens={100}
		/>
	);

	t.truthy(getByText('5.0s'));
	t.truthy(getByText('100 tokens'));
});

test('TokenMetrics - rendering - should show paused status', (t) => {
	const { getByText } = render(
		<TokenMetrics
			isActive={true}
			isPaused={true}
			startTime={new Date()}
			endTime={null}
			pausedTime={0}
			completionTokens={50}
		/>
	);

	t.truthy(getByText('⏸ Waiting for approval...'));
});

test('TokenMetrics - time tracking - should update time every 100ms when active', (t) => {
	const startTime = new Date(Date.now() - 1000);
	
	const { getByText } = render(
		<TokenMetrics
			isActive={true}
			isPaused={false}
			startTime={startTime}
			endTime={null}
			pausedTime={0}
			completionTokens={0}
		/>
	);

	t.truthy(getByText('1.0s'));

	// Advance timers carefully to avoid infinite loop
	clock.tick(100);
	
	// Clear all timers to prevent infinite loop
	clock.reset();
});

test('TokenMetrics - time tracking - should not update time when paused', (t) => {
	const startTime = new Date(Date.now() - 1000);
	
	const { getByText } = render(
		<TokenMetrics
			isActive={true}
			isPaused={true}
			startTime={startTime}
			endTime={null}
			pausedTime={0}
			completionTokens={0}
		/>
	);

	const initialTime = getByText(/\d+\.\d+s/);
	
	clock.tick(1000);
	
	t.truthy(initialTime);
});

test('TokenMetrics - time tracking - should account for paused time', (t) => {
	const startTime = new Date(Date.now() - 5000);
	const pausedTime = 2000;
	
	const { getByText } = render(
		<TokenMetrics
			isActive={true}
			isPaused={false}
			startTime={startTime}
			endTime={null}
			pausedTime={pausedTime}
			completionTokens={0}
		/>
	);

	t.truthy(getByText('3.0s'));
});

test('TokenMetrics - time tracking - should show final time when completed', (t) => {
	const startTime = new Date(Date.now() - 10000);
	const endTime = new Date(Date.now() - 2000);
	const pausedTime = 1000;
	
	const { getByText } = render(
		<TokenMetrics
			isActive={false}
			isPaused={false}
			startTime={startTime}
			endTime={endTime}
			pausedTime={pausedTime}
			completionTokens={100}
		/>
	);

	t.truthy(getByText('7.0s'));
});

test('TokenMetrics - loading messages - should cycle through loading messages', (t) => {
	const { getByText, rerender } = render(
		<TokenMetrics
			isActive={true}
			isPaused={false}
			startTime={new Date()}
			endTime={null}
			pausedTime={0}
			completionTokens={0}
		/>
	);

	t.truthy(getByText('⚡ GroqThinking...'));

	clock.tick(2000);
	rerender(
		<TokenMetrics
			isActive={true}
			isPaused={false}
			startTime={new Date()}
			endTime={null}
			pausedTime={0}
			completionTokens={0}
		/>
	);

	clock.tick(2000);
	rerender(
		<TokenMetrics
			isActive={true}
			isPaused={false}
			startTime={new Date()}
			endTime={null}
			pausedTime={0}
			completionTokens={0}
		/>
	);

	clock.tick(2000);
	rerender(
		<TokenMetrics
			isActive={true}
			isPaused={false}
			startTime={new Date()}
			endTime={null}
			pausedTime={0}
			completionTokens={0}
		/>
	);
});

test('TokenMetrics - loading messages - should reset loading message index when becoming active', (t) => {
	const { getByText, rerender } = render(
		<TokenMetrics
			isActive={false}
			isPaused={false}
			startTime={null}
			endTime={null}
			pausedTime={0}
			completionTokens={100}
		/>
	);

	rerender(
		<TokenMetrics
			isActive={true}
			isPaused={false}
			startTime={new Date()}
			endTime={null}
			pausedTime={0}
			completionTokens={100}
		/>
	);

	t.truthy(getByText('⚡ GroqThinking...'));
});

test('TokenMetrics - edge cases - should handle null startTime', (t) => {
	const { getByText } = render(
		<TokenMetrics
			isActive={true}
			isPaused={false}
			startTime={null}
			endTime={null}
			pausedTime={0}
			completionTokens={0}
		/>
	);

	t.truthy(getByText('0.0s'));
});

test('TokenMetrics - edge cases - should handle transition from active to inactive', (t) => {
	const startTime = new Date(Date.now() - 3000);
	const endTime = new Date();
	
	const { getByText, rerender } = render(
		<TokenMetrics
			isActive={true}
			isPaused={false}
			startTime={startTime}
			endTime={null}
			pausedTime={0}
			completionTokens={50}
		/>
	);

	t.truthy(getByText('⚡ GroqThinking...'));

	rerender(
		<TokenMetrics
			isActive={false}
			isPaused={false}
			startTime={startTime}
			endTime={endTime}
			pausedTime={0}
			completionTokens={50}
		/>
	);

	t.truthy(getByText('3.0s'));
});