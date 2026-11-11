#!/usr/bin/env node
'use strict';

/**
 * The actual regression test the external review asked for: proves the generated pipeline
 * variants (BDD x static-deploy x Storybook) are internally valid, and that every
 * .waypoint/config.json and .waypoint/stack.md involved is well-formed.
 *
 * Every variant is freshly regenerated from .claude/ on every run and diffed against its committed
 * copy — that diff is what actually catches "someone edited a template but never regenerated the
 * fixture." The four synthetic variants live under test/fixtures/; the BDD + static-deploy variant
 * is examples/throughline, whose .waypoint/ holds real project values and stack prose.
 *
 * Usage: node scripts/run-fixture-tests.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { generate } = require('./generate-fixture');
const { validate } = require('./validate-templates');
const { validateConfig, validateStack } = require('./lib/waypoint-config');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'test', 'fixtures');
const CONFIGS_DIR = path.join(FIXTURES_DIR, 'configs');

const TEMPLATE_WAYPOINT_DIR = path.join(REPO_ROOT, 'templates', 'waypoint');
const THROUGHLINE_DIR = path.join(REPO_ROOT, 'examples', 'throughline');

// name -> { config: path to its .waypoint/config.json, dir: its committed .claude/-shaped output,
// stack: path to its .waypoint/stack.md, if it has a real one }
const FIXTURES = {
  ...Object.fromEntries(
    ['bdd-on_static-off', 'bdd-off_static-on', 'bdd-off_static-off', 'bdd-off_static-on_storybook-on'].map((name) => [
      name,
      { config: path.join(CONFIGS_DIR, `${name}.json`), dir: path.join(FIXTURES_DIR, name) },
    ])
  ),
  'examples/throughline': {
    config: path.join(THROUGHLINE_DIR, '.waypoint', 'config.json'),
    dir: path.join(THROUGHLINE_DIR, '.claude'),
    stack: path.join(THROUGHLINE_DIR, '.waypoint', 'stack.md'),
  },
};

function report(label, failures, okMessage) {
  if (failures.length) {
    console.error(`FAIL — ${label}: ${failures.length} issue(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    return true;
  }
  console.log(`OK — ${label}: ${okMessage}`);
  return false;
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

/** Returns a list of human-readable diff descriptions; empty if the two trees are identical. */
function diffTrees(committedDir, freshDir) {
  const diffs = [];
  const committedFiles = new Set(walkFiles(committedDir).map((f) => path.relative(committedDir, f)));
  const freshFiles = new Set(walkFiles(freshDir).map((f) => path.relative(freshDir, f)));

  for (const rel of committedFiles) {
    if (!freshFiles.has(rel)) diffs.push(`committed file ${rel} no longer exists in a fresh generation`);
  }
  for (const rel of freshFiles) {
    if (!committedFiles.has(rel)) diffs.push(`fresh generation produced ${rel}, not present in the committed fixture`);
  }
  for (const rel of committedFiles) {
    if (!freshFiles.has(rel)) continue;
    const committedText = fs.readFileSync(path.join(committedDir, rel), 'utf8');
    const freshText = fs.readFileSync(path.join(freshDir, rel), 'utf8');
    if (committedText !== freshText) {
      diffs.push(`${rel} differs from a fresh generation — the template changed but this fixture wasn't regenerated`);
    }
  }
  return diffs;
}

function main() {
  let anyFailure = false;

  // The templates adopters start .waypoint/ from.
  const templateConfig = JSON.parse(fs.readFileSync(path.join(TEMPLATE_WAYPOINT_DIR, 'config.json'), 'utf8'));
  anyFailure = report('templates/waypoint/config.json', validateConfig(templateConfig), 'valid.') || anyFailure;
  const templateStack = fs.readFileSync(path.join(TEMPLATE_WAYPOINT_DIR, 'stack.md'), 'utf8');
  anyFailure = report('templates/waypoint/stack.md', validateStack(templateStack, {}, { template: true }), 'has every section.') || anyFailure;

  for (const [name, fixture] of Object.entries(FIXTURES)) {
    const config = JSON.parse(fs.readFileSync(fixture.config, 'utf8'));
    anyFailure = report(`${name}: config.json`, validateConfig(config), 'valid.') || anyFailure;
    if (fixture.stack) {
      const stack = fs.readFileSync(fixture.stack, 'utf8');
      anyFailure = report(`${name}: stack.md`, validateStack(stack, config.layers), 'has exactly the sections its layers need.') || anyFailure;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'waypoint-fixture-'));
    try {
      generate(fixture.config, tmpDir);
      const driftDiffs = diffTrees(fixture.dir, tmpDir);
      if (driftDiffs.length) {
        anyFailure = true;
        console.error(`FAIL — ${name}: committed copy is out of date (${driftDiffs.length} diff(s)):`);
        for (const d of driftDiffs) console.error(`  - ${d}`);
        console.error(`  Fix: node scripts/generate-fixture.js ${path.relative(REPO_ROOT, fixture.config)} ${path.relative(REPO_ROOT, fixture.dir)}`);
      } else {
        console.log(`OK — ${name}: committed copy matches a fresh generation.`);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    anyFailure = report(name, validate(fixture.dir, config), 'structurally valid.') || anyFailure;
  }

  if (anyFailure) {
    console.error('\nOne or more fixture checks failed.');
    process.exit(1);
  }
  console.log('\nAll fixture checks passed — every generated pipeline variant is structurally valid.');
}

main();
