import { chromium, expect } from '@playwright/test';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Isolated browser. No live ESPN requests or personal browser credentials.
const root = await mkdtemp(path.join(tmpdir(), 'espn-reader-check-'));
const extension = path.join(root, 'extension');
await cp('dist/espn-reader', extension, { recursive: true });
const origin = process.env.ESPN_TEST_ORIGIN ?? 'http://localhost:3006';
const context = await chromium.launchPersistentContext(path.join(root, 'profile'), {
  channel: 'chromium', headless: true,
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
let heartbeat; let relayRequests = 0;
context.on("request", request => { if (request.url().includes("/api/espn/relay")) relayRequests++; });
try {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const setup = await context.newPage();
  await setup.goto(`${origin}/espn-draft`);
  const roomUrl = 'https://fantasy.espn.com/football/draft?leagueId=99&seasonId=2026&teamId=2';
  const init = initFrame();
  let socketCount = 0, sentCommands = 0;
  let draftSocket;
  await context.routeWebSocket('wss://fantasydraft.espn.com/**', (socket) => {
    socketCount++; draftSocket = socket;
    socket.onMessage(() => { sentCommands++; });
    socket.send(init);
  });
  await context.route('https://fantasy.espn.com/football/draft?*', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>ESPN test fixture</title><p>Practice fixture stays connected</p><script>window.fixtureSocket = new WebSocket("wss://fantasydraft.espn.com/game-1/league-99/JOIN");</script>' }));
  const rankingResponse = await setup.request.get(`${origin}/api/aggregates/bundle?scoring=ppr&teams=2&slots_qb=0&slots_rb=0&slots_wr=1&slots_te=0&slots_k=0&slots_def=0&slots_flex=0&slots_bench=1`);
  const rankingBundle = await rankingResponse.json();
  const fixturePlayers = [...new Map([
    { name: 'Justin Jefferson', position: 'WR' }, { name: 'CeeDee Lamb', position: 'WR' },
    ...Object.values(rankingBundle.shards).flat(),
  ].map((row) => [`${row.position}:${row.name.toLowerCase()}`, row])).values()];
  const positionIds = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 16 };
  await context.route('https://lm-api-reads.fantasy.espn.com/**', (route) => route.fulfill({ json: {
    id: 99, seasonId: 2026, members: [{ id: 'PRIVATE_MEMBER' }],
    settings: { name: 'Reader practice fixture', draftSettings: { type: 'SNAKE' }, scoringSettings: { playerRankType: 'PPR', scoringItems: [{ statId: 53, points: 1 }] } },
    teams: [{ id: 1, name: 'First team', owners: ['PRIVATE_OWNER'] }, { id: 2, name: 'Second team', owners: [] }],
    players: fixturePlayers.map((row, index) => ({ player: { id: 101 + index, fullName: row.position === 'DEF' ? `${row.name.split(' ').at(-1)} D/ST` : row.name, defaultPositionId: positionIds[row.position], proTeamId: 1, eligibleSlots: [4, 23], draftRanksByRankType: { PPR: { rank: index + 1 } }, ownership: { averageDraftPosition: index + 1 }, stats: [{ statSourceId: 1, statSplitTypeId: 0, externalId: '2026', appliedTotal: Math.max(20, 300 - index) }] } })),
  } }));
  const draft = await context.newPage();
  await draft.goto(roomUrl);
  heartbeat = setInterval(() => draftSocket?.send("CLOCK 0 30000"), 3000);
  // Identify the selected fixture tab; no account/session data is used.
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)?.id, roomUrl);
  if (!tabId) throw new Error('Fixture tab missing');
  await expect.poll(() => worker.evaluate((id) => chrome.tabs.sendMessage(id, { type: 'source-probe' }), tabId)).toMatchObject({ ready: true });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByRole('button', { name: 'Open assistant' })).toBeVisible();
  // A popup is a tab in this harness. Supply the ESPN tab selected by a native popup.
  await popup.evaluate((id) => { chrome.tabs.query = async () => [{ id }]; }, tabId);
  const opened = context.waitForEvent('page', { timeout: 15000 });
  await popup.getByRole('button', { name: 'Open assistant' }).click();
  const assistant = await opened.catch(async (error) => { throw new Error(`${error.message}: ${await popup.locator("body").innerText()}`); });
  await assistant.waitForURL('**/espn-draft');
  const second = assistant;
  await second.setViewportSize({ width: 1440, height: 1000 });
  await expect(second.getByText('Connected', { exact: true })).toBeVisible({ timeout: 20000 });
  await expect(second.getByText(/Reader practice fixture.*1 picks/)).toBeVisible();
  const stored = await worker.evaluate(() => chrome.storage.session.get('pairs'));
  if (JSON.stringify(stored).includes('PRIVATE_')) throw new Error('Private fields leaked');
  draftSocket.send('SELECTED 2 102 1 PRIVATE_MEMBER');
  await expect(second.getByText(/Reader practice fixture.*2 picks/)).toBeVisible({ timeout: 15000 });

  if (socketCount !== 1 || sentCommands !== 0) throw new Error('Reader opened a socket or sent a command');
  await expect(second.getByTestId('draft-player-pool')).toBeVisible({ timeout: 10000 });
  await expect(second.getByTestId('draft-sidebar')).toContainText('Slot 2');
  await expect(second.getByTestId('draft-pick-feed')).toBeVisible();
  await second.getByRole('link', { name: 'WR', exact: true }).first().click();
  await expect(second.getByRole('button', { name: 'Disconnect' })).toBeVisible();
  await second.reload();
  await expect(second.getByTestId('draft-sidebar')).toContainText('Slot 2');
  const recommendationsBlocked = await second.getByText('Draft data incident', { exact: true }).isVisible();
  if (recommendationsBlocked) throw new Error('Fixture recommendations are blocked');
  const source = second.getByRole('group', { name: 'Projection source', exact: true });
  await expect(source.getByRole('button', {name: 'Sleeper', exact: true})).toBeVisible();
  await expect(second.locator('[title^="Sleeper projected position rank"]').first()).toBeVisible();
  await expect(source.getByRole('button', {name: 'FantasyPros', exact: true})).toBeEnabled();
  await source.getByRole('button', {name: 'FantasyPros', exact: true}).click();
  await expect(second.locator('[title^="FantasyPros projected position rank"]').first()).toBeVisible();
  await source.getByRole('button', {name: 'Sleeper', exact: true}).click();
  if (await second.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Assistant page overflows');
  await second.screenshot({ path: '/private/tmp/fantasy-tiers-screenshots/espn-reader-two-tabs.png', fullPage: true });
  clearInterval(heartbeat);
  await expect(second.getByText('Recommendations stopped', { exact: true })).toBeVisible({ timeout: 22000 });
  await draft.close();
  await expect(second.getByText('Open ESPN Reader in your draft tab', { exact: true })).toBeVisible();
  if (relayRequests !== 0) throw new Error('Unexpected relay HTTP request');
  console.log(JSON.stringify({ result: 'PASS', recommendationsBlocked, checks: ['packaged extension loads', 'one click creates session and opens assistant', 'ESPN existing socket observed', 'HTTP data normalized', 'assistant receives live pick and survives reload', 'private fields excluded', 'no new socket or draft commands', 'stale board removed', 'no relay HTTP'], socketCount, sentCommands, relayRequests }));
} finally {
  clearInterval(heartbeat);
  await context.close(); await rm(root, { recursive: true, force: true });
}
function initFrame() {
  const bytes = [];
  const int = (n) => { const a = new Uint8Array(4); new DataView(a.buffer).setInt32(0,n); bytes.push(...a); };
  const ints = (...values) => values.forEach(int);
  const object = (version, write) => { ints(1,version); write(); };
  object(1, () => { ints(99,2); object(1, () => {
    ints(99,1,1,0,3); int(0); int(0); int(0);
    int(2); object(1, () => ints(99,1,4,0)); object(1, () => ints(99,2,20,0));
    int(4); [1,2,2,1].forEach((team,i) => object(3, () => { ints(99,team,i+1,i===0?101:-1,i===0?1:0,0,0); bytes.push(0); ints(0,0); }));
    int(2); [1,2].forEach(id => object(2, () => ints(99,id,id-1,0,0,0,0)));
  }); });
  return `INIT ${Buffer.from(bytes).toString('base64')}`;
}
