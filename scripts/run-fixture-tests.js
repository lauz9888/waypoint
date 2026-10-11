#!/usr/bin/env node
'use strict';

/**
 * The actual regression test the external review asked for: proves the generated pipeline
 * variants (BDD x static-deploy x Storybook) are internally valid, plus that examples/throughline
 * hasn't structurally drifted from the templates it was extracted from.
 *
 * The synthetic combinations are freshly regenerated from .claude/ on every run and diffed
 * against the committed copy under test/fixtures/ — that diff is what actually catches "someone
 * edited a template but never regenerated the fixture." The BDD + static-deploy
 * combination is examples/throughline itself: it's never regenerated (its STACK_FACTS
 * prose is real, hand-written content a mechanical script can't reproduce), only structurally
 * validated.
 *
 * Usage: node scripts/run-fixture-tests.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { generate } = require('./generate-fixture');
const { validate } = require('./validate-templates');

const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'test', 'fixtures');
const CONFIGS_DIR = path.join(FIXTURES_DIR, 'configs');

const SYNTHETIC_FIXTURES = ['bdd-on_static-off', 'bdd-off_static-on', 'bdd-off_static-off', 'bdd-off_static-on_storybook-on'];

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

  for (const name of SYNTHETIC_FIXTURES) {
    const configPath = path.join(CONFIGS_DIR, `${name}.json`);
    const committedDir = path.join(FIXTURES_DIR, name);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `waypoint-fixture-${name}-`));
    try {
      generate(configPath, tmpDir);

      const driftDiffs = diffTrees(committedDir, tmpDir);
      if (driftDiffs.length) {
        anyFailure = true;
        console.error(`FAIL — ${name}: committed fixture is out of date (${driftDiffs.length} diff(s)):`);
        for (const d of driftDiffs) console.error(`  - ${d}`);
        console.error(`  Fix: node scripts/generate-fixture.js ${path.relative(REPO_ROOT, configPath)} ${path.relative(REPO_ROOT, committedDir)}`);
      } else {
        console.log(`OK — ${name}: committed fixture matches a fresh generation.`);
      }

      const structuralFailures = validate(committedDir, config);
      if (structuralFailures.length) {
        anyFailure = true;
        console.error(`FAIL — ${name}: ${structuralFailures.length} structural issue(s):`);
        for (const f of structuralFailures) console.error(`  - ${f}`);
      } else {
        console.log(`OK — ${name}: structurally valid.`);
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  // The BDD + static-deploy combination: examples/throughline, validated structurally only (never regenerated).
  const throughlineDir = path.join(REPO_ROOT, 'examples', 'throughline', '.claude');
  const throughlineConfig = JSON.parse(fs.readFileSync(path.join(CONFIGS_DIR, 'throughline.json'), 'utf8'));
  const throughlineFailures = validate(throughlineDir, throughlineConfig);
  if (throughlineFailures.length) {
    anyFailure = true;
    console.error(`FAIL — examples/throughline: ${throughlineFailures.length} structural issue(s):`);
    for (const f of throughlineFailures) console.error(`  - ${f}`);
  } else {
    console.log('OK — examples/throughline: structurally valid.');
  }

  if (anyFailure) {
    console.error('\nOne or more fixture checks failed.');
    process.exit(1);
  }
  console.log('\nAll fixture checks passed — every generated pipeline variant is structurally valid.');
}

main();
