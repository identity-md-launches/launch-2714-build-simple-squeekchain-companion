import { Interface } from 'ethers/abi';
import { keccak256 } from 'ethers/crypto';
import abi from './core-abi.json';
import deployment from './deployment.json';

export const CORE_ADDRESS = deployment.contracts.SqueekCore.address;
export const CHAIN_ID = deployment.chainId;
export const EXPLORER = deployment.explorer;
export const RPC_ENDPOINTS = ['https://ethereum-sepolia-rpc.publicnode.com', 'https://sepolia.gateway.tenderly.co'];
export const POLL_INTERVAL = 30_000;
export const CORE_INTERFACE = new Interface(abi);
export const BLOCK_UNITS = 1_000_000_000n;
export const ROUND_COUNT = 12n;

export interface CoreState {
  settledThroughRound: bigint;
  cumulativeWork: bigint;
  cumulativeBlockUnits: bigint;
  blockHeight: bigint;
  blockProgress: bigint;
  workPerThousandBlocks: bigint;
  paused: boolean;
}

export interface Configuration {
  genesisTimestamp: bigint;
  roundDuration: bigint;
  blockUnitsPerBlock: bigint;
}

export interface LedgerPosition {
  cumulativeWork: bigint;
  cumulativeBlockUnits: bigint;
}

export interface Checkpoint extends LedgerPosition {
  roundId: bigint;
}

export interface RoundRecord {
  id: bigint;
  work: bigint;
  blocks: bigint;
  blockUnits: bigint;
  closedAt: number;
}

export interface Snapshot {
  state: CoreState;
  config: Configuration;
  rounds: RoundRecord[];
  currentRound: bigint;
  ethereumBlock: bigint;
  blockTimestamp: number;
  fetchedAt: number;
  endpoint: string;
}

export class DashboardError extends Error {
  constructor(message: string, public readonly kind: 'connection' | 'contract' = 'connection') {
    super(message);
  }
}

export function validateState(state: CoreState, config: Configuration) {
  if (config.blockUnitsPerBlock !== BLOCK_UNITS || config.roundDuration <= 0n ||
      state.blockHeight !== state.cumulativeBlockUnits / config.blockUnitsPerBlock ||
      state.blockProgress !== state.cumulativeBlockUnits % config.blockUnitsPerBlock) {
    throw new DashboardError('SqueekCore returned an unexpected ledger. Review the current deployment in the docs.', 'contract');
  }
}

/** Missing checkpoints inside a certified span mean zero work, not missing data. */
export function expandRounds(after: bigint, through: bigint, start: LedgerPosition, checkpoints: Checkpoint[], config: Configuration): RoundRecord[] {
  if (through < after || through - after > ROUND_COUNT) throw new DashboardError('Unexpected round range.', 'contract');
  const result: RoundRecord[] = [];
  let position = start;
  let index = 0;
  for (let id = after + 1n; id <= through; id++) {
    const checkpoint = checkpoints[index];
    if (checkpoint && checkpoint.roundId < id) throw new DashboardError('Round history is out of order.', 'contract');
    const next = checkpoint?.roundId === id ? checkpoint : position;
    if (next.cumulativeWork < position.cumulativeWork || next.cumulativeBlockUnits < position.cumulativeBlockUnits) {
      throw new DashboardError('Round history contains an inconsistent total.', 'contract');
    }
    result.push({
      id,
      work: next.cumulativeWork - position.cumulativeWork,
      blocks: next.cumulativeBlockUnits / config.blockUnitsPerBlock - position.cumulativeBlockUnits / config.blockUnitsPerBlock,
      blockUnits: next.cumulativeBlockUnits - position.cumulativeBlockUnits,
      closedAt: Number(config.genesisTimestamp + id * config.roundDuration) * 1000,
    });
    if (checkpoint?.roundId === id) index++;
    position = next;
  }
  if (index !== checkpoints.length) throw new DashboardError('Round history exceeds its certified range.', 'contract');
  return result.reverse();
}

let requestId = 0;
async function rpc<T>(endpoint: string, method: string, params: unknown[], signal: AbortSignal): Promise<T> {
  const id = ++requestId;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    signal,
  });
  if (!response.ok) throw new DashboardError(`The Sepolia provider returned HTTP ${response.status}. Try refreshing shortly.`);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('id' in body) || body.id !== id || !('result' in body) || 'error' in body) {
    throw new DashboardError('The Sepolia provider could not complete the read. Try refreshing shortly.');
  }
  return body.result as T;
}

export async function readFromEndpoint(endpoint: string, parentSignal?: AbortSignal): Promise<Snapshot> {
  const timeout = AbortSignal.timeout(14_000);
  const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
  const [chain, block] = await Promise.all([
    rpc<string>(endpoint, 'eth_chainId', [], signal),
    rpc<{ number: string; timestamp: string } | null>(endpoint, 'eth_getBlockByNumber', ['latest', false], signal),
  ]);
  if (BigInt(chain) !== BigInt(CHAIN_ID)) throw new DashboardError('The provider is on a different network. This dashboard requires Sepolia.', 'contract');
  if (!block) throw new DashboardError('The latest Sepolia block is unavailable. Try refreshing shortly.');
  // Pin every contract read to the same Ethereum block. These reads are mined, not finalized.
  const call = async (name: string, args: unknown[] = []) => {
    const data = CORE_INTERFACE.encodeFunctionData(name, args);
    const raw = await rpc<string>(endpoint, 'eth_call', [{ to: CORE_ADDRESS, data }, block.number], signal);
    try { return CORE_INTERFACE.decodeFunctionResult(name, raw)[0]; }
    catch { throw new DashboardError('SqueekCore no longer matches the pinned ABI. Check the deployment docs.', 'contract'); }
  };
  const [version, implementation, layout, rawState, rawConfig] = await Promise.all([
    call('implementationCodeVersion'), call('implementationCodeAddress'), call('implementationStorageLayoutDigest'), call('state'), call('configuration'),
  ]);
  const expected = deployment.contracts.SqueekCore;
  if (version !== BigInt(expected.implementationVersion) || implementation.toLowerCase() !== expected.implementation.toLowerCase() || layout !== expected.storageLayoutDigest) {
    throw new DashboardError('SqueekCore’s deployment has changed. Check the official docs for an updated integration.', 'contract');
  }
  const code = await rpc<string>(endpoint, 'eth_getCode', [implementation, block.number], signal);
  if (keccak256(code) !== expected.implementationRuntimeHash) throw new DashboardError('The contract code does not match the published deployment. Check the official docs.', 'contract');
  const state: CoreState = {
    settledThroughRound: rawState.settledThroughRound,
    cumulativeWork: rawState.cumulativeWork,
    cumulativeBlockUnits: rawState.cumulativeBlockUnits,
    blockHeight: rawState.blockHeight,
    blockProgress: rawState.blockProgress,
    workPerThousandBlocks: BigInt(rawState.workPerThousandBlocks),
    paused: rawState.paused,
  };
  const config: Configuration = {
    genesisTimestamp: rawConfig.genesisTimestamp,
    roundDuration: rawConfig.roundDuration,
    blockUnitsPerBlock: rawConfig.blockUnitsPerBlock,
  };
  validateState(state, config);
  if (config.genesisTimestamp !== BigInt(deployment.coreConfiguration.genesisTimestamp) || config.roundDuration !== BigInt(deployment.coreConfiguration.roundDuration)) {
    throw new DashboardError('The round configuration has changed. Check the published deployment.', 'contract');
  }
  const frontier = state.settledThroughRound;
  const after = frontier > ROUND_COUNT ? frontier - ROUND_COUNT : 0n;
  const page = await call('roundPage', [after, frontier, 16n]);
  if (page.certifiedThroughRound !== frontier || page.end.cumulativeWork !== state.cumulativeWork || page.end.cumulativeBlockUnits !== state.cumulativeBlockUnits) {
    throw new DashboardError('Round history did not cover the settled frontier. Refresh to retry.', 'contract');
  }
  const checkpoints: Checkpoint[] = Array.from(page.rounds, (r: Checkpoint) => ({ roundId: r.roundId, cumulativeWork: r.cumulativeWork, cumulativeBlockUnits: r.cumulativeBlockUnits }));
  const rounds = expandRounds(after, frontier, page.start, checkpoints, config);
  if (rounds.reduce((sum, r) => sum + r.work, 0n) !== BigInt(page.end.cumulativeWork) - BigInt(page.start.cumulativeWork) ||
      rounds.reduce((sum, r) => sum + r.blockUnits, 0n) !== BigInt(page.end.cumulativeBlockUnits) - BigInt(page.start.cumulativeBlockUnits)) {
    throw new DashboardError('The certified history is incomplete. Refresh to retry.', 'contract');
  }
  const timestamp = BigInt(block.timestamp);
  return {
    state, config, rounds,
    currentRound: timestamp < config.genesisTimestamp ? 0n : (timestamp - config.genesisTimestamp) / config.roundDuration + 1n,
    ethereumBlock: BigInt(block.number),
    blockTimestamp: Number(timestamp) * 1000,
    fetchedAt: Date.now(),
    endpoint,
  };
}

export async function readSnapshot(signal?: AbortSignal): Promise<Snapshot> {
  let lastError: unknown;
  for (const endpoint of RPC_ENDPOINTS) {
    if (signal?.aborted) throw signal.reason;
    try { return await readFromEndpoint(endpoint, signal); }
    catch (error) {
      if (error instanceof DashboardError && error.kind === 'contract') throw error;
      lastError = error;
    }
  }
  throw lastError instanceof DashboardError ? lastError : new DashboardError('Unable to reach Sepolia. Check your connection, then refresh to try again.');
}

export function formatNumber(value: bigint): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function progressPercent(progress: bigint): string {
  return (Number(progress * 1000n / BLOCK_UNITS) / 10).toFixed(1);
}
