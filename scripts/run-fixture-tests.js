#!/usr/bin/env node
'use strict';

/**
 * The test entry point for Waypoint's templates. Checks, in order:
 *
 * - the pipeline templates in .claude/ — structurally, as they are and for every combination of
 *   optional layers an agent can read them with (validate-templates.js);
 * - the .waypoint/ templates adopters start from (templates/waypoint/);
 * - examples/throughline: its .waypoint/config.json and stack.md are valid, and its .claude/ is an
 *   exact copy of the templates, as waypoint-init installs it.
 *
 * Usage: node scripts/run-fixture-tests.js
 */

const fs = require('fs');
const path = require('path');
const { validate, PIPELINE_FILES } = require('./validate-templates');
const { validateConfig, validateStack } = require('./lib/waypoint-config');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(REPO_ROOT, '.claude');
const TEMPLATE_WAYPOINT_DIR = path.join(REPO_ROOT, 'templates', 'waypoint');
const THROUGHLINE_DIR = path.join(REPO_ROOT, 'examples', 'throughline');

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
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

/** Differences between an installed .claude/ and the templates; empty if it's an exact copy. */
function diffInstalledCopy(installedDir) {
  const diffs = [];
  const installed = new Set(walkFiles(installedDir).map((f) => path.relative(installedDir, f).split(path.sep).join('/')));
  for (const rel of PIPELINE_FILES) {
    const copy = path.join(installedDir, rel);
    if (!installed.has(rel)) diffs.push(`${rel} missing`);
    else if (fs.readFileSync(copy, 'utf8') !== fs.readFileSync(path.join(TEMPLATE_DIR, rel), 'utf8')) {
      diffs.push(`${rel} differs from the template`);
    }
  }
  for (const rel of installed) {
    if (!PIPELINE_FILES.includes(rel)) diffs.push(`${rel} isn't a pipeline file`);
  }
  return diffs;
}

function main() {
  let anyFailure = false;

  anyFailure = report('.claude templates', validate(TEMPLATE_DIR), 'structurally valid for every layer combination.') || anyFailure;

  const templateConfig = JSON.parse(fs.readFileSync(path.join(TEMPLATE_WAYPOINT_DIR, 'config.json'), 'utf8'));
  anyFailure = report('templates/waypoint/config.json', validateConfig(templateConfig), 'valid.') || anyFailure;
  const templateStack = fs.readFileSync(path.join(TEMPLATE_WAYPOINT_DIR, 'stack.md'), 'utf8');
  anyFailure = report('templates/waypoint/stack.md', validateStack(templateStack, {}, { template: true }), 'has every section.') || anyFailure;

  const config = JSON.parse(fs.readFileSync(path.join(THROUGHLINE_DIR, '.waypoint', 'config.json'), 'utf8'));
  anyFailure = report('examples/throughline: config.json', validateConfig(config), 'valid.') || anyFailure;
  const stack = fs.readFileSync(path.join(THROUGHLINE_DIR, '.waypoint', 'stack.md'), 'utf8');
  anyFailure = report('examples/throughline: stack.md', validateStack(stack, config.layers), 'has exactly the sections its layers need.') || anyFailure;
  const copyDiffs = diffInstalledCopy(path.join(THROUGHLINE_DIR, '.claude'));
  if (copyDiffs.length) {
    copyDiffs.push(`Fix: copy ${PIPELINE_FILES.length} pipeline files from .claude/ to examples/throughline/.claude/`);
  }
  anyFailure = report('examples/throughline: .claude', copyDiffs, 'an exact copy of the templates.') || anyFailure;

  if (anyFailure) {
    console.error('\nOne or more checks failed.');
    process.exit(1);
  }
  console.log('\nAll checks passed.');
}

main();
