import { formatNumber, progressPercent, readSnapshot } from '../src/core';

const data = await readSnapshot();
console.log(JSON.stringify({
  checkedAt: new Date(data.fetchedAt).toISOString(),
  publicProvider: data.endpoint,
  ethereumBlock: data.ethereumBlock.toString(),
  squeekBlockHeight: formatNumber(data.state.blockHeight),
  settledRounds: formatNumber(data.state.settledThroughRound),
  cumulativeWork: formatNumber(data.state.cumulativeWork),
  blockProgressPercent: progressPercent(data.state.blockProgress),
  currentRound: data.currentRound.toString(),
  settlementPaused: data.state.paused,
  certifiedHistoryRows: data.rounds.length,
}, null, 2));
