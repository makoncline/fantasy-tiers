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
    {name: 'Unranked Fixture Player', position: 'WR'},
  ].map((row) => [`${row.position}:${row.name.toLowerCase()}`, row])).values()];
  const positionIds = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 16 };
  await context.route('https://lm-api-reads.fantasy.espn.com/**', (route) => route.fulfill({ json: {
    id: 99, seasonId: 2026, members: [{ id: 'PRIVATE_MEMBER' }],
    settings: { name: 'Reader practice fixture', draftSettings: { type: 'SNAKE' }, scoringSettings: { playerRankType: 'PPR', scoringItems: [[53, 1], [24, 0.1], [42, 0.1], [25, 6], [43, 6], [3, 0.04], [4, 4], [20, -1], [72, -2]].map(([statId, points]) => ({statId, points})) } },
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

  const unrankedId = 101 + fixturePlayers.findIndex(player => player.name === 'Unranked Fixture Player');
  draftSocket.send(`SELECTED 2 ${unrankedId} 2`);
  await expect(second.getByText(/Reader practice fixture.*3 picks/)).toBeVisible();
  await expect(second.getByTestId('draft-sidebar')).toContainText('Unranked Fixture Player');
  await expect(second.getByText('Recommendations paused', {exact: true})).toHaveCount(0);
  draftSocket.send('UNDONE 1');
  await expect(second.getByText(/Reader practice fixture.*1 picks/)).toBeVisible();
  await expect(second.getByTestId('draft-sidebar')).not.toContainText('Unranked Fixture Player');
  draftSocket.send('SELECTED 2 102 1');
  await expect(second.getByText(/Reader practice fixture.*2 picks/)).toBeVisible();

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
  const verifyDraftedRows = async () => {
    const draftedRows = second.getByTestId('draft-player-pool').locator('tr[data-row-drafted="true"]');
    await expect(draftedRows).toHaveCount(0);
    await second.getByRole('switch', {name: 'Show drafted', exact: true}).click();
    await expect(draftedRows.filter({hasText: 'Justin Jefferson'}).first()).toBeVisible();
    // VAL remains the saved source value; drafted players have no live ADJ.
    const cells = draftedRows.filter({hasText: 'Justin Jefferson'}).first().locator('td');
    await expect(cells.nth(4)).not.toHaveText('—');
    await expect(cells.nth(5)).toHaveText('—');
    await second.getByRole('switch', {name: 'Show drafted', exact: true}).click();
    await expect(draftedRows).toHaveCount(0);
  };
  await verifyDraftedRows();
  await source.getByRole('button', {name: 'FantasyPros', exact: true}).click();
  await expect(second.locator('[title^="FantasyPros projected position rank"]').first()).toBeVisible();
  await verifyDraftedRows();
  await source.getByRole('button', {name: 'Sleeper', exact: true}).click();
  // Feed the same draft through the live Sleeper provider, not a mocked UI context.
  const sharedRows = Object.values(rankingBundle.shards).flat();
  const playerId = name => sharedRows.find(row => row.name.toLowerCase() === name.toLowerCase())?.player_id;
  const sleeperPicks = [
    {player_id: playerId('Justin Jefferson'), pick_no: 1, round: 1, draft_slot: 1, picked_by: 'other-user'},
    {player_id: playerId('CeeDee Lamb'), pick_no: 2, round: 1, draft_slot: 2, picked_by: 'parity-user'},
  ];
  if (sleeperPicks.some(pick => !pick.player_id)) throw new Error('Parity players missing');
  await context.route('https://api.sleeper.app/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    const json = pathname.endsWith('/picks') ? sleeperPicks
      : pathname.includes('/draft/parity-draft') ? {
        draft_id: 'parity-draft', type: 'snake', season: '2026', status: 'drafting',
        metadata: {name: 'Reader practice fixture', scoring_type: 'ppr'},
        settings: {teams: 2, rounds: 2, slots_qb: 0, slots_rb: 0, slots_wr: 1, slots_te: 0, slots_k: 0, slots_def: 0, slots_flex: 0, slots_bn: 1},
        draft_order: {'other-user': 1, 'parity-user': 2},
      } : pathname.endsWith('/state/nfl') ? {season: '2026', league_season: '2026', season_type: 'regular', week: 1}
      : pathname.endsWith('/drafts') ? []
      : {user_id: 'parity-user', username: 'parity-user', display_name: 'You'};
    return route.fulfill({json});
  });
  const sleeper = await context.newPage();
  await sleeper.setViewportSize({width: 1440, height: 1000});
  await sleeper.goto(`${origin}/draft-assistant?userId=parity-user&draftId=parity-draft`);
  const sleeperSource = sleeper.getByRole('group', {name: 'Projection source', exact: true});
  await expect(sleeper.getByTestId('draft-player-pool')).toBeVisible();
  for (const name of ['Sleeper', 'FantasyPros']) {
    await source.getByRole('button', {name, exact: true}).click();
    await sleeperSource.getByRole('button', {name, exact: true}).click();
    for (const page of [second, sleeper]) {
      await page.getByRole('switch', {name: 'Show drafted', exact: true}).check();
      await expect(page.getByTestId('draft-player-pool').locator('tr[data-row-drafted="true"]').filter({hasText: 'Justin Jefferson'}).first()).toBeVisible();
    }
    await expect.poll(async () => sleeper.getByTestId('draft-player-pool').getByRole('table').first().innerText())
      .toBe(await second.getByTestId('draft-player-pool').getByRole('table').first().innerText());
    for (const page of [second, sleeper]) await page.getByRole('switch', {name: 'Show drafted', exact: true}).uncheck();
  }
  await sleeper.close();
  await source.getByRole('button', {name: 'Sleeper', exact: true}).click();
  if (await second.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Assistant page overflows');
  await second.screenshot({ path: '/private/tmp/fantasy-tiers-screenshots/espn-reader-two-tabs.png', fullPage: true });
  clearInterval(heartbeat);
  const lastFrameAt = Date.now();
  await expect.poll(async () => {
    const { pairs } = await worker.evaluate(() => chrome.storage.session.get('pairs'));
    return pairs[0]?.draft.room.updatedAt ?? 0;
  }, { timeout: 20000 }).toBeGreaterThan(lastFrameAt + 16000);
  await expect(second.getByText('Connected', { exact: true })).toBeVisible();
  await draft.evaluate(() => window.fixtureSocket.close());
  await expect(second.getByText('Recommendations stopped', { exact: true })).toBeVisible({ timeout: 10000 });
  await draft.close();
  await expect(second.getByText('Open ESPN Reader in your draft tab', { exact: true })).toBeVisible();
  if (relayRequests !== 0) throw new Error('Unexpected relay HTTP request');
  console.log(JSON.stringify({ result: 'PASS', recommendationsBlocked, checks: ['packaged extension loads', 'one click creates session and opens assistant', 'ESPN existing socket observed', 'HTTP data normalized', 'assistant receives live pick and survives reload', 'unranked pick and suffix undo', 'Show drafted preserves source values', 'Sleeper and ESPN rendered table parity for both sources', 'private fields excluded', 'no new socket or draft commands', 'idle open socket stays connected', 'closed socket removes advice', 'no relay HTTP'], socketCount, sentCommands, relayRequests }));
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
