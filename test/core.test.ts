import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { keccak256 } from 'ethers/crypto';
import { expandRounds, formatNumber, progressPercent, readFromEndpoint, readSnapshot, validateState } from '../src/core';
import type { Configuration, CoreState } from '../src/core';
import { FIXTURE_CODE, GENESIS, rpcFixture } from './fixtures';
import deployment from '../src/deployment.json';

const config: Configuration = { genesisTimestamp: GENESIS, roundDuration: 600n, blockUnitsPerBlock: 1_000_000_000n };
const position = { cumulativeWork: 50n, cumulativeBlockUnits: 900_000_000n };
const state: CoreState = { settledThroughRound: 1n, cumulativeWork: 10n, cumulativeBlockUnits: 1_500_000_000n, blockHeight: 1n, blockProgress: 500_000_000n, workPerThousandBlocks: 10000n, paused: false };
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('published implementation fixture hashes to the pinned deployment identity', () => {
  assert.equal(keccak256(FIXTURE_CODE), deployment.contracts.SqueekCore.implementationRuntimeHash);
});
test('empty launch frontier contains no rounds', () => {
  assert.deepEqual(expandRounds(0n, 0n, position, [], config), []);
});
test('certified omitted rounds expand to genuine zero work', () => {
  const rounds = expandRounds(10n, 13n, position, [], config);
  assert.deepEqual(rounds.map(r => [r.id, r.work, r.blocks]), [[13n, 0n, 0n], [12n, 0n, 0n], [11n, 0n, 0n]]);
});
test('work is differenced across active checkpoints and absent certified rounds', () => {
  const rounds = expandRounds(10n, 13n, position, [
    { roundId: 11n, cumulativeWork: 57n, cumulativeBlockUnits: 1_100_000_000n },
    { roundId: 13n, cumulativeWork: 60n, cumulativeBlockUnits: 2_100_000_000n },
  ], config);
  assert.deepEqual(rounds.map(r => r.work), [3n, 0n, 7n]);
  assert.deepEqual(rounds.map(r => r.blocks), [1n, 0n, 1n]);
  assert.equal(rounds[2].blockUnits, 200_000_000n);
});
test('fractional block carry completes a block without dividing by current difficulty', () => {
  const [round] = expandRounds(0n, 1n, position, [{ roundId: 1n, cumulativeWork: 51n, cumulativeBlockUnits: 1_000_000_000n }], config);
  assert.equal(round.blocks, 1n);
  assert.equal(round.work, 1n);
});
test('round end timestamps are based on genesis plus completed durations', () => {
  const [round] = expandRounds(0n, 1n, position, [], config);
  assert.equal(round.closedAt, Number(GENESIS + 600n) * 1000);
});
test('a reversed or oversized round window is refused', () => {
  assert.throws(() => expandRounds(3n, 2n, position, [], config));
  assert.throws(() => expandRounds(0n, 13n, position, [], config));
});
test('decreasing cumulative totals are refused', () => {
  assert.throws(() => expandRounds(0n, 1n, position, [{ roundId: 1n, cumulativeWork: 49n, cumulativeBlockUnits: 1_000_000_000n }], config));
});
test('out-of-order and extra checkpoints are refused', () => {
  assert.throws(() => expandRounds(0n, 2n, position, [{ roundId: 2n, cumulativeWork: 55n, cumulativeBlockUnits: 2_000_000_000n }, { roundId: 1n, cumulativeWork: 60n, cumulativeBlockUnits: 3_000_000_000n }], config));
  assert.throws(() => expandRounds(0n, 1n, position, [{ roundId: 2n, cumulativeWork: 55n, cumulativeBlockUnits: 2_000_000_000n }], config));
});
test('state invariant rejects an inconsistent height, progress or unit scale', () => {
  assert.doesNotThrow(() => validateState(state, config));
  assert.throws(() => validateState({ ...state, blockHeight: 2n }, config));
  assert.throws(() => validateState({ ...state, blockProgress: 1n }, config));
  assert.throws(() => validateState(state, { ...config, blockUnitsPerBlock: 1000n }));
});
test('uint64 totals retain exact digits beyond JavaScript safe integer', () => {
  assert.equal(formatNumber((1n << 64n) - 1n), '18,446,744,073,709,551,615');
});
test('progress formatting includes zero and floors below the next block', () => {
  assert.equal(progressPercent(0n), '0.0');
  assert.equal(progressPercent(500_000_000n), '50.0');
  assert.equal(progressPercent(999_999_999n), '99.9');
});

function mockRpc(transform?: (method: string, params: unknown[]) => unknown) {
  const calls: { endpoint: string; method: string; params: unknown[] }[] = [];
  globalThis.fetch = (async (endpoint, options) => {
    const body = JSON.parse(options?.body as string);
    calls.push({ endpoint: String(endpoint), method: body.method, params: body.params });
    const result = transform ? transform(body.method, body.params) : rpcFixture(body.method, body.params);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
  }) as typeof fetch;
  return calls;
}
test('a complete snapshot uses one Ethereum block for all calls and decodes real ABI tuples', async () => {
  const calls = mockRpc();
  const snapshot = await readFromEndpoint('https://rpc.test');
  assert.equal(snapshot.state.blockHeight, 12n);
  assert.equal(snapshot.state.cumulativeWork, 120n);
  assert.equal(snapshot.currentRound, 26n);
  assert.equal(snapshot.rounds.length, 12);
  assert.equal(snapshot.rounds[0].work, 10n);
  assert.ok(calls.filter(c => c.method === 'eth_call' || c.method === 'eth_getCode').every(c => c.params[1] === '0xb00001'));
});
test('wrong chain fails closed before contract reads', async () => {
  const calls = mockRpc((method, params) => method === 'eth_chainId' ? '0x1' : rpcFixture(method, params));
  await assert.rejects(readFromEndpoint('https://rpc.test'), /different network/);
  assert.equal(calls.some(c => c.method === 'eth_call'), false);
});
test('an upgraded implementation fails closed', async () => {
  mockRpc((method, params) => rpcFixture(method, params, 'changed'));
  await assert.rejects(readFromEndpoint('https://rpc.test'), /deployment has changed/);
});
test('unexpected implementation bytecode is refused', async () => {
  mockRpc((method, params) => method === 'eth_getCode' ? '0x00' : rpcFixture(method, params));
  await assert.rejects(readFromEndpoint('https://rpc.test'), /contract code/);
});
test('HTTP failure advances to the next configured public provider', async () => {
  let first: string | null = null;
  globalThis.fetch = (async (endpoint, options) => {
    first ??= String(endpoint);
    if (String(endpoint) === first) return new Response('', { status: 503 });
    const body = JSON.parse(options?.body as string);
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: rpcFixture(body.method, body.params) }));
  }) as typeof fetch;
  const snapshot = await readSnapshot();
  assert.notEqual(snapshot.endpoint, first);
});
test('JSON-RPC errors and all-provider failures remain errors', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'Unavailable' } }))) as typeof fetch;
  await assert.rejects(readSnapshot(), /could not complete the read/);
});
test('a cancelled refresh never starts another provider', async () => {
  const controller = new AbortController();
  controller.abort(new Error('Cancelled'));
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw Error('Unexpected'); }) as typeof fetch;
  await assert.rejects(readSnapshot(controller.signal), /Cancelled/);
  assert.equal(calls, 0);
});
