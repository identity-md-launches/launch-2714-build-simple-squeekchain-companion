import { CORE_INTERFACE } from '../src/core';
import deployment from '../src/deployment.json';
import codeFixture from './fixtures/core-code.json';

export const FIXTURE_CODE = codeFixture.code;
export const GENESIS = BigInt(deployment.coreConfiguration.genesisTimestamp);
export type FixtureMode = 'normal' | 'zero' | 'huge' | 'paused' | 'changed' | 'quiet';

/** All values here are test-only, never imported by the application. */
export function rpcFixture(method: string, params: unknown[], mode: FixtureMode = 'normal'): unknown {
  if (method === 'eth_chainId') return '0xaa36a7';
  if (method === 'eth_getBlockByNumber') return { number: '0xb00001', timestamp: `0x${(GENESIS + 600n * 25n).toString(16)}` };
  if (method === 'eth_getCode') return FIXTURE_CODE;
  if (method !== 'eth_call') throw new Error(`Unexpected RPC method ${method}`);
  const data = (params[0] as { data: string }).data;
  const call = CORE_INTERFACE.parseTransaction({ data });
  if (!call) throw new Error('Unrecognized function');
  const huge = (1n << 64n) - 1n;
  const zero = mode === 'zero';
  const work = mode === 'huge' ? huge : zero ? 0n : 120n;
  const height = mode === 'huge' ? huge : zero ? 0n : 12n;
  const units = height * 1_000_000_000n + (zero ? 0n : 500_000_000n);
  const frontier = zero ? 0n : 24n;
  const difficulty = 10875;
  const position = (w: bigint, b: bigint) => [w, b, difficulty];
  let result: unknown;
  switch (call.name) {
    case 'implementationCodeVersion': result = mode === 'changed' ? 4n : 3n; break;
    case 'implementationCodeAddress': result = deployment.contracts.SqueekCore.implementation; break;
    case 'implementationStorageLayoutDigest': result = deployment.contracts.SqueekCore.storageLayoutDigest; break;
    case 'configuration': result = [deployment.coreConfiguration.streamId, GENESIS, 600n, 10000n, 16, deployment.coreConfiguration.guardian, deployment.coreConfiguration.reporter, difficulty, 40n, 30n, 1_000_000_000n]; break;
    case 'state': result = [frontier, work, units, height, zero ? 0n : 500_000_000n, difficulty, 0n, mode === 'paused']; break;
    case 'roundPage': {
      const after = call.args[0] as bigint;
      const quiet = mode === 'quiet' || mode === 'huge' || zero;
      const startWork = quiet ? work : 0n;
      const startUnits = quiet ? units : 0n;
      const rounds = quiet ? [] : Array.from({ length: Number(frontier - after) }, (_, i) => {
        const id = after + BigInt(i) + 1n;
        const step = BigInt(i) + 1n;
        return [id, step * 10n, step === 12n ? units : step * 1_000_000_000n, difficulty, `0x${'12'.repeat(32)}`];
      });
      result = [frontier, position(startWork, startUnits), position(work, units), rounds];
      break;
    }
    default: throw new Error(`Unexpected contract call ${call.name}`);
  }
  return CORE_INTERFACE.encodeFunctionResult(call.name, [result]);
}
