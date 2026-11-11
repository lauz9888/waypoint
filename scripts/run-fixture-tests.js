#!/usr/bin/env node
'use strict';

/**
 * The test entry point for the Waypoint plugin. Checks, in order:
 *
 * - the marketplace and plugin manifests (.claude-plugin/marketplace.json, and each listed
 *   plugin's .claude-plugin/plugin.json);
 * - the plugin's pipeline files — structurally, as they are and for every combination of optional
 *   layers an agent can read them with (validate-templates.js);
 * - the plugin's .waypoint/ templates, and that stack.example.md is examples/throughline's real one;
 * - examples/throughline: its .waypoint/config.json and stack.md are valid, and its
 *   .claude/settings.json enables the plugin the way /waypoint:init writes it.
 *
 * Usage: node scripts/run-fixture-tests.js
 */

const fs = require('fs');
const path = require('path');
const { validate, PLUGIN_NAME } = require('./validate-templates');
const { validateConfig, validateStack } = require('./lib/waypoint-config');

const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGIN_DIR = path.join(REPO_ROOT, 'plugins', PLUGIN_NAME);
const TEMPLATES_DIR = path.join(PLUGIN_DIR, 'templates');
const THROUGHLINE_DIR = path.join(REPO_ROOT, 'examples', 'throughline');

const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readText = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function report(label, failures, okMessage) {
  if (failures.length) {
    console.error(`FAIL — ${label}: ${failures.length} issue(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    return true;
  }
  console.log(`OK — ${label}: ${okMessage}`);
  return false;
}

/** The parts of the marketplace/plugin manifest schema this repo relies on. `claude plugin
 * validate` is the full check; this keeps CI dependency-free. */
function checkManifests() {
  const failures = [];
  const marketplace = readJson(path.join(REPO_ROOT, '.claude-plugin', 'marketplace.json'));
  if (!KEBAB_RE.test(marketplace.name || '')) failures.push('marketplace name must be kebab-case');
  if (!marketplace.owner || !marketplace.owner.name) failures.push('marketplace owner.name is required');
  if (!Array.isArray(marketplace.plugins) || !marketplace.plugins.length) failures.push('marketplace plugins must be a non-empty array');
  for (const entry of marketplace.plugins || []) {
    const label = `plugin entry "${entry.name}"`;
    if (typeof entry.source !== 'string' || !entry.source.startsWith('./') || entry.source.includes('..')) {
      failures.push(`${label}: source must be a "./" path inside the repo with no ".."`);
      continue;
    }
    const manifestPath = path.join(REPO_ROOT, entry.source, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      failures.push(`${label}: no .claude-plugin/plugin.json at ${entry.source}`);
      continue;
    }
    const plugin = readJson(manifestPath);
    if (plugin.name !== entry.name) failures.push(`${label}: plugin.json name is "${plugin.name}"`);
    if (!KEBAB_RE.test(plugin.name || '')) failures.push(`${label}: plugin name must be kebab-case`);
    if (plugin.version !== undefined && !SEMVER_RE.test(plugin.version)) failures.push(`${label}: version "${plugin.version}" isn't MAJOR.MINOR.PATCH`);
    if (entry.version !== undefined) failures.push(`${label}: set the version in plugin.json only, not in the marketplace entry`);
    const stray = fs.readdirSync(path.join(REPO_ROOT, entry.source, '.claude-plugin')).filter((f) => f !== 'plugin.json');
    if (stray.length) failures.push(`${label}: only plugin.json belongs in .claude-plugin/, found ${stray.join(', ')}`);
  }
  if (!(marketplace.plugins || []).some((p) => p.name === PLUGIN_NAME)) failures.push(`marketplace doesn't list "${PLUGIN_NAME}"`);
  return failures;
}

/** examples/throughline/.claude must be exactly what /waypoint:init writes for a shared setup. */
function checkProjectSettings(claudeDir) {
  const failures = [];
  const entries = fs.readdirSync(claudeDir);
  if (entries.join() !== 'settings.json') failures.push(`expected only settings.json, found ${entries.join(', ')}`);
  const settings = readJson(path.join(claudeDir, 'settings.json'));
  const source = settings.extraKnownMarketplaces && settings.extraKnownMarketplaces[PLUGIN_NAME] && settings.extraKnownMarketplaces[PLUGIN_NAME].source;
  if (!source || source.source !== 'github' || source.repo !== 'lauz9888/waypoint') {
    failures.push(`extraKnownMarketplaces.${PLUGIN_NAME} must point at the lauz9888/waypoint GitHub repo`);
  }
  if (!settings.enabledPlugins || settings.enabledPlugins[`${PLUGIN_NAME}@${PLUGIN_NAME}`] !== true) {
    failures.push(`enabledPlugins must enable ${PLUGIN_NAME}@${PLUGIN_NAME}`);
  }
  return failures;
}

function main() {
  let anyFailure = false;
  const check = (label, failures, ok) => {
    anyFailure = report(label, failures, ok) || anyFailure;
  };

  check('manifests', checkManifests(), 'marketplace and plugin manifests are consistent.');
  check(`plugins/${PLUGIN_NAME}`, validate(PLUGIN_DIR), 'structurally valid for every layer combination.');

  check('templates/config.json', validateConfig(readJson(path.join(TEMPLATES_DIR, 'config.json'))), 'valid.');
  check('templates/stack.md', validateStack(readText(path.join(TEMPLATES_DIR, 'stack.md')), {}, { template: true }), 'has every section.');

  const config = readJson(path.join(THROUGHLINE_DIR, '.waypoint', 'config.json'));
  const stack = readText(path.join(THROUGHLINE_DIR, '.waypoint', 'stack.md'));
  check('examples/throughline: config.json', validateConfig(config), 'valid.');
  check('examples/throughline: stack.md', validateStack(stack, config.layers), 'has exactly the sections its layers need.');
  check(
    'templates/stack.example.md',
    readText(path.join(TEMPLATES_DIR, 'stack.example.md')) === stack ? [] : ["differs from examples/throughline/.waypoint/stack.md — copy that file over it"],
    "identical to examples/throughline's stack.md."
  );
  check('examples/throughline: .claude', checkProjectSettings(path.join(THROUGHLINE_DIR, '.claude')), 'enables the plugin as /waypoint:init writes it.');

  if (anyFailure) {
    console.error('\nOne or more checks failed.');
    process.exit(1);
  }
  console.log('\nAll checks passed.');
}

main();
