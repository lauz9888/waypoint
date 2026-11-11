#!/usr/bin/env node
'use strict';

/**
 * Archives the repo's GitHub traffic stats, which GitHub only keeps for 14 days. Each run merges
 * the latest daily clone and view counts into .traffic-history/traffic.json (keyed by day, so
 * overlapping runs never double-count) and records that day's top referrers. Clones are the
 * closest proxy for plugin installs, but they include your own clones and CI checkouts.
 *
 * Needs the gh CLI, logged in with push access to the repo.
 *
 * Usage: node scripts/archive-traffic.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = 'lauz9888/waypoint';
const HISTORY_DIR = path.resolve(__dirname, '..', '.traffic-history');
const HISTORY_FILE = path.join(HISTORY_DIR, 'traffic.json');

const ghApi = (endpoint) =>
  JSON.parse(execFileSync('gh', ['api', `repos/${REPO}/traffic/${endpoint}`], { encoding: 'utf8' }));

const history = fs.existsSync(HISTORY_FILE)
  ? JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'))
  : { clones: {}, views: {}, referrers: {} };

// GitHub's most recent day is still in progress, so a later run overwrites it with the full count.
for (const { timestamp, count, uniques } of ghApi('clones').clones) {
  history.clones[timestamp.slice(0, 10)] = { count, uniques };
}
for (const { timestamp, count, uniques } of ghApi('views').views) {
  history.views[timestamp.slice(0, 10)] = { count, uniques };
}
history.referrers[new Date().toISOString().slice(0, 10)] = ghApi('popular/referrers');

const sortKeys = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
history.clones = sortKeys(history.clones);
history.views = sortKeys(history.views);

fs.mkdirSync(HISTORY_DIR, { recursive: true });
fs.writeFileSync(HISTORY_FILE, `${JSON.stringify(history, null, 2)}\n`);

const total = (series) =>
  Object.values(series).reduce((sum, d) => ({ count: sum.count + d.count, uniques: sum.uniques + d.uniques }), {
    count: 0,
    uniques: 0,
  });
const days = Object.keys(history.clones);
const clones = total(history.clones);
const views = total(history.views);
console.log(`Archived ${days.length} days (${days[0]} to ${days[days.length - 1]}) to ${HISTORY_FILE}`);
console.log(`All-time clones: ${clones.count} (sum of daily uniques: ${clones.uniques})`);
console.log(`All-time views:  ${views.count} (sum of daily uniques: ${views.uniques})`);
