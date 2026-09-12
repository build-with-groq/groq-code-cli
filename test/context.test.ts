import test from 'ava';
import { estimateTokens, estimateConversationTokens, isOverBudget, trimConversation, compactMarker, type AgentMessage } from '../src/core/context.js';

test('token estimation approximates chars/4', (t) => {
  t.is(estimateTokens(''), 0);
  t.is(estimateTokens('hello world'), Math.ceil(11 / 4));
});

test('conversation estimation sums messages', (t) => {
  const msgs: AgentMessage[] = [
    { role: 'user', content: 'short' },
    { role: 'assistant', content: 'a '.repeat(100) },
  ];
  const est = estimateConversationTokens(msgs);
  t.true(est > 0);
});

test('isOverBudget triggers over target', (t) => {
  const msgs: AgentMessage[] = [{ role: 'user', content: 'x'.repeat(400_000) }];
  t.true(isOverBudget(msgs));
});

test('trimConversation keeps system + recent when over budget', (t) => {
  const system = { role: 'system' as const, content: 'SYSTEM PROMPT' };
  const first = { role: 'user' as const, content: 'x'.repeat(400_000) }; // ~100k tokens, way over budget
  const recent = { role: 'user' as const, content: 'recent tail' };
  const trimmed = trimConversation([system, first, recent], 40_000);
  // System must survive.
  t.true(trimmed.some((m) => m.role === 'system' && m.content === 'SYSTEM PROMPT'));
  // The most recent should survive.
  t.true(trimmed.some((m) => m.content === 'recent tail'));
  // The big first message is trimmed out.
  t.false(trimmed.some((m) => m.content && m.content.length > 10_000));
});

test('compactMarker includes summary and instruction', (t) => {
  const marker = compactMarker('We built the login flow.');
  t.true(marker.includes('CONTEXT COMPACTED'));
  t.true(marker.includes('We built the login flow.'));
});