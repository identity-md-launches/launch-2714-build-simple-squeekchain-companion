import { useState } from 'react';
import type { ReactNode } from 'react';
import { BLOCK_UNITS, CORE_ADDRESS, EXPLORER, formatNumber, progressPercent } from './core';
import { useDashboard } from './useDashboard';
import { Icon } from './icons';
import type { IconName } from './icons';
import hamsterWheel from './assets/hamster-wheel.svg';

const DOCS = 'https://docs.squeekchain.com';
const coreUrl = `${EXPLORER}/address/${CORE_ADDRESS}`;

function ExternalLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}<Icon name="external" /><span className="sr-only"> (opens a new tab)</span></a>;
}

function Metric({ label, value, detail, icon, tone }: { label: string; value?: bigint; detail: string; icon: IconName; tone: string }) {
  return <div className="metric">
    <div className="metric-heading"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon name={icon} /></span></div>
    <p className="metric-value" data-testid={icon === 'block' ? 'block-height' : icon === 'round' ? 'settled-rounds' : 'work-units'}>{value === undefined ? <span className="pending-value" aria-label="Not loaded">…</span> : formatNumber(value)}</p>
    <p className="metric-detail">{detail}</p>
  </div>;
}

export default function App() {
  const { snapshot, loading, error, automatic, setAutomatic, refresh, now } = useDashboard();
  const [onlyActive, setOnlyActive] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [activeNav, setActiveNav] = useState('overview');
  const state = snapshot?.state;
  const age = snapshot ? Math.max(0, Math.floor((now - snapshot.fetchedAt) / 1000)) : null;
  const stale = !!snapshot && (error !== null || (age !== null && age > 90));
  const lag = snapshot ? snapshot.currentRound > snapshot.state.settledThroughRound + 1n ? snapshot.currentRound - snapshot.state.settledThroughRound - 1n : 0n : 0n;
  const filteredRounds = snapshot?.rounds.filter(r => !onlyActive || r.work > 0n) ?? [];
  const visibleRounds = showAll ? filteredRounds : filteredRounds.slice(0, 6);
  const percent = state ? progressPercent(state.blockProgress) : null;
  const updated = age === null ? 'Connecting to Sepolia' : `Read ${age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`} ago`;
  const connection = error ? snapshot ? 'Last successful read' : 'Connection unavailable' : stale ? 'Read is getting old' : snapshot ? 'Connected to Sepolia' : 'Connecting to Sepolia';
  const settledAt = snapshot && snapshot.state.settledThroughRound > 0n ? Number(snapshot.config.genesisTimestamp + snapshot.state.settledThroughRound * snapshot.config.roundDuration) * 1000 : null;

  const copyAddress = async () => {
    try { await navigator.clipboard.writeText(CORE_ADDRESS); setCopyMessage('Address copied'); }
    catch { setCopyMessage('Copy unavailable. Select the address below to copy it.'); }
  };

  return <>
    <a className="skip-link" href="#main">Skip to dashboard</a>
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#overview" aria-label="Squeek Peek home" onClick={() => setActiveNav('overview')}>
          <img src="./favicon.svg" alt="" width="42" height="42" />
          <span>squeek peek<span className="brand-description">A Squeekchain companion</span></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          {['overview', 'rounds', 'about'].map(item => <a key={item} href={`#${item}`} className={activeNav === item ? 'current' : ''} aria-current={activeNav === item ? 'location' : undefined} onClick={() => setActiveNav(item)}>{item[0].toUpperCase() + item.slice(1)}</a>)}
        </nav>
        <div className="header-utilities"><span className="network-label"><span className="network-mark" />Sepolia<span className="desktop-only"> testnet</span></span><ExternalLink className="docs-link" href={DOCS}>Docs</ExternalLink></div>
      </div>
    </header>

    <main id="main" className="page-shell">
      <section id="overview" aria-labelledby="dashboard-heading">
        <div className="intro">
          <div><h1 id="dashboard-heading">Small paws. Big blocks.</h1><p>A little window into Squeektoshi’s work on Sepolia.</p></div>
          <div className="refresh-group"><span className={`connection-label ${stale || error ? 'is-warning' : ''}`}><span className="status-dot" />{loading ? 'Reading SqueekCore…' : updated}</span><button type="button" className="button primary" onClick={() => void refresh()} disabled={loading}><Icon name="refresh" />{loading ? 'Refreshing…' : 'Refresh'}</button></div>
        </div>

        <div className="notice" role="status" aria-live="polite">{error ? <><Icon name="info" /><span>{error}{snapshot ? ' The totals below are from the last successful read.' : ''}</span></> : state?.paused ? <><Icon name="pause" /><span>SqueekCore settlement is paused. The last settled totals are still available.</span></> : null}</div>

        <div className={`metrics-grid ${stale ? 'stale-data' : ''}`} role="group" aria-label={stale ? 'Last successful SqueekCore totals' : 'SqueekCore totals'} aria-busy={loading}>
          <Metric label="Block height" value={state?.blockHeight} detail="Completed Squeek blocks" icon="block" tone="sage" />
          <Metric label="Settled rounds" value={state?.settledThroughRound} detail="Certified 10-minute rounds" icon="round" tone="lilac" />
          <Metric label="Work units" value={state?.cumulativeWork} detail="All-time accepted wheel work" icon="work" tone="butter" />
        </div>

        {snapshot && lag > 0n && <p className="settlement-note"><Icon name="clock" /><span>{formatNumber(lag)} closed {lag === 1n ? 'round awaits' : 'rounds await'} settlement.{settledAt !== null && <> Last certified round ended <time dateTime={new Date(settledAt).toISOString()}>{new Intl.DateTimeFormat('en-GB', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(settledAt)} UTC</time>.</>}</span></p>}

        <div className="story-grid">
          <section className="wheel-card" aria-labelledby="wheel-heading">
            <div className="wheel-heading"><h2 id="wheel-heading">A peek at the wheel</h2><span className="quiet-label"><Icon name="leaf" />Powered by tiny paws</span></div>
            <div className="wheel-content">
              <figure className="hamster-figure"><img src={hamsterWheel} alt="An illustrated Squeektoshi holding a sunflower seed in a hamster wheel" width="480" height="360" /><figcaption>Our very small block producer.</figcaption></figure>
              <div className="block-progress">
                <span className="next-block-icon"><Icon name="block" /></span>
                <h3>Next Squeek block</h3>
                <p className="progress-number">{percent ?? '…'}<span>{percent !== null ? '%' : ''}</span></p>
                <progress aria-label="Settled progress toward the next Squeek block" aria-valuetext={percent === null ? 'Waiting for the first read' : `${percent}%`} value={Number(state?.blockProgress ?? 0n)} max={Number(BLOCK_UNITS)} />
                <p className="progress-description">{state ? <>Toward block <strong>{formatNumber(state.blockHeight + 1n)}</strong></> : 'Waiting for the first read'}</p>
                <p className="fine-print">Progress from settled work, one little turn at a time.</p>
              </div>
            </div>
            <div className="wheel-footnote"><Icon name="info" /><span>Illustration only. The ledger doesn’t tell us if Squeektoshi is running right now.</span></div>
          </section>

          <aside className="about-card" id="about" aria-labelledby="about-heading">
            <div className="about-icon"><Icon name="book" /></div>
            <h2 id="about-heading">One hamster.<br /> A whole little chain.</h2>
            <p>Meet Squeektoshi, the hamster behind Squeekchain: a playful proof-of-work toychain on Ethereum.</p>
            <p>The WHEELY9000 measures wheel activity. Signed reports bring that work onchain, where it builds Squeek blocks.</p>
            <ExternalLink href={`${DOCS}/system/squeektoshi/`} className="text-link">Meet Squeektoshi</ExternalLink>
            <div className="about-note"><Icon name="info" /><p>You’re exploring Sepolia testnet data. This is an independent, read-only companion.</p></div>
          </aside>
        </div>
      </section>

      <section className="rounds-section" id="rounds" aria-labelledby="rounds-heading">
        <div className="section-heading"><div><h2 id="rounds-heading">Little rounds, real work</h2><p>The latest 12 certified rounds, newest first.</p></div><div className="segmented" role="group" aria-label="Filter rounds"><button type="button" aria-pressed={!onlyActive} onClick={() => { setOnlyActive(false); setShowAll(false); }}>All rounds</button><button type="button" aria-pressed={onlyActive} onClick={() => { setOnlyActive(true); setShowAll(false); }}>With work</button></div></div>
        <div className="rounds-table">
          <table>
            <caption className="sr-only">Settled Squeekchain rounds. Blocks are completed Squeek blocks, and times are scheduled round-end times in UTC.</caption>
            <thead><tr><th scope="col">Round</th><th scope="col">Work units</th><th scope="col">Blocks</th><th scope="col" className="time-column">Round ended <span className="table-timezone">(UTC)</span></th><th scope="col" className="status-column">Status</th></tr></thead>
            <tbody>
              {!snapshot ? <tr><td colSpan={5} className="empty-state"><Icon name={error ? 'info' : 'round'} /><strong>{error ? 'Round history is unavailable' : 'Fetching a little history…'}</strong><span>{error ? 'Use Refresh to try the Sepolia connection again.' : 'Reading certified rounds from SqueekCore.'}</span></td></tr> : visibleRounds.length === 0 ? <tr><td colSpan={5} className="empty-state"><Icon name="leaf" /><strong>{onlyActive ? 'A quiet stretch of rounds' : 'No rounds have settled yet'}</strong><span>{onlyActive ? 'No work was recorded in these 12 certified rounds.' : 'The first certified round will appear here after settlement.'}</span>{onlyActive && <button type="button" className="text-button" onClick={() => setOnlyActive(false)}>Show all rounds <Icon name="arrow" /></button>}</td></tr> : visibleRounds.map(round => <tr key={round.id.toString()}>
                <th scope="row"><span className="round-symbol">#</span>{formatNumber(round.id)}</th>
                <td>{formatNumber(round.work)}</td>
                <td>{formatNumber(round.blocks)}</td>
                <td className="time-column"><time dateTime={new Date(round.closedAt).toISOString()}>{new Intl.DateTimeFormat('en-GB', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(round.closedAt)}</time></td>
                <td className="status-column"><span className="settled-label"><Icon name="check" />Settled</span></td>
              </tr>)}
            </tbody>
          </table>
          <div className="table-footer"><span>{snapshot ? `${visibleRounds.length} of ${filteredRounds.length} ${onlyActive ? 'rounds with work' : 'rounds'}` : 'Waiting for Sepolia'}</span>{filteredRounds.length > 6 && <button type="button" className="text-button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer rounds' : `Show all ${filteredRounds.length} rounds`}<Icon name="chevron" /></button>}<ExternalLink href={`${DOCS}/system/rounds-and-blocks/`} className="rounds-help">How rounds work</ExternalLink></div>
        </div>
        <p className="round-explanation">A settled round can have zero work. Rounds still awaiting certification are not shown.</p>
      </section>

      <section className="source-section" aria-labelledby="source-heading">
        <div className="source-title"><span className="source-icon"><Icon name="block" /></span><div><h2 id="source-heading">Straight from SqueekCore</h2><p>{connection}{snapshot ? ` · Ethereum block ${formatNumber(snapshot.ethereumBlock)}` : ''}</p></div></div>
        <div className="source-actions"><button type="button" className="button secondary" onClick={() => setAutomatic(!automatic)} aria-pressed={automatic}><Icon name={automatic ? 'pause' : 'play'} />{automatic ? 'Pause auto-refresh' : 'Resume auto-refresh'}</button><ExternalLink href={coreUrl} className="button secondary">View contract</ExternalLink></div>
        <div className="source-details"><span className="contract-address"><span>SqueekCore</span><code>{CORE_ADDRESS}</code><button type="button" className="copy-button" onClick={() => void copyAddress()} aria-label="Copy SqueekCore address"><Icon name={copyMessage === 'Address copied' ? 'check' : 'copy'} /></button></span><span className="source-hint">{automatic ? 'Auto-refreshes every 30 seconds' : 'Auto-refresh paused'}{snapshot ? ` · Current round ${formatNumber(snapshot.currentRound)}` : ''}</span></div>
        <p className="sr-only" role="status">{copyMessage}</p>
        {copyMessage && copyMessage !== 'Address copied' && <p className="copy-feedback">{copyMessage}</p>}
        <details className="data-details"><summary>About these readings</summary><p>All totals and history come from SqueekCore’s published Sepolia deployment. Each refresh reads the same mined Ethereum block; it may be affected by a reorganization. This is settled ledger data, not a live wheel sensor.</p>{snapshot && <p>Read at {new Date(snapshot.fetchedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}. Provider: <a href={snapshot.endpoint} target="_blank" rel="noopener noreferrer">{new URL(snapshot.endpoint).hostname}</a>.</p>}<p>Work units count accepted wheel-magnet passages. Block progress uses the contract’s block units, not work divided by today’s difficulty. The Sepolia contract is upgradeable; this app checks the published V3 implementation before displaying a new reading.</p><ExternalLink href={`${DOCS}/developers/core/`}>Read the SqueekCore reference</ExternalLink></details>
      </section>
    </main>
    <footer className="site-footer"><a href="#overview" className="footer-brand" onClick={() => setActiveNav('overview')}><img src="./favicon.svg" alt="" width="24" height="24" />Made for the love of tiny paws.</a><span>A community companion, with a little squeek.</span><ExternalLink href="https://sepolia.squeekchain.com/">Explore Squeekchain</ExternalLink></footer>
  </>;
}
