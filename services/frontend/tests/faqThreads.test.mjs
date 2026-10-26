import assert from 'node:assert/strict';
import test from 'node:test';
import { groupFAQThreads } from '../lib/faqThreads.ts';

const answer = (id, replyToAnswerId, createdAt = '2026-10-01') => ({ id, replyToAnswerId, createdAt });

test('keeps ranked roots and groups replies with their root regardless of input order', () => {
  const result = groupFAQThreads([
    answer('reply', 'root', '2026-10-02'),
    answer('pinned'),
    answer('root'),
    answer('nested', 'reply', '2026-10-03'),
    answer('earlier', 'root', '2026-10-01'),
  ]);
  assert.deepEqual(result.map(({ root }) => root.id), ['pinned', 'root']);
  assert.deepEqual(result[1].replies.map(({ id }) => id), ['earlier', 'reply', 'nested']);
});

test('a surviving answer becomes a root when its parent was deleted', () => {
  const result = groupFAQThreads([answer('survivor'), answer('child', 'survivor')]);
  assert.equal(result.length, 1);
  assert.equal(result[0].root.id, 'survivor');
  assert.equal(result[0].replies[0].id, 'child');
});

test('retains an orphan instead of hiding its conversation', () => {
  const result = groupFAQThreads([answer('orphan', 'missing'), answer('child', 'orphan')]);
  assert.equal(result[0].root.id, 'orphan');
  assert.equal(result[0].replies[0].id, 'child');
});

test('handles empty answers and malformed cycles without losing entries or looping', () => {
  assert.deepEqual(groupFAQThreads([]), []);
  const result = groupFAQThreads([answer('a', 'b'), answer('b', 'a')]);
  assert.deepEqual(result.map(({ root }) => root.id), ['a', 'b']);
});

test('orders replies by actual time, including fractional seconds and timezone offsets', () => {
  const result = groupFAQThreads([
    answer('root'),
    answer('fraction', 'root', '2026-10-01T10:00:00.100Z'),
    answer('offset', 'root', '2026-10-01T11:00:00+02:00'),
    answer('whole', 'root', '2026-10-01T10:00:00Z'),
  ]);
  assert.deepEqual(result[0].replies.map(({ id }) => id), ['offset', 'whole', 'fraction']);
});
