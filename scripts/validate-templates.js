#!/usr/bin/env node
'use strict';

/**
 * Structural validation of the Waypoint plugin's pipeline files (plugins/waypoint/). Every adopting
 * project runs these same files and the agents apply the WAYPOINT:OPTIONAL layer blocks at run
 * time, so the checks run on the files as they are, and again on every one of the eight ways an
 * agent can read them (each combination of layers on/off). Does NOT judge .waypoint/stack.md prose
 * quality — see scripts/README.md.
 *
 * Usage: node scripts/validate-templates.js [pluginDir]   (default: plugins/waypoint)
 * Exits non-zero and prints every failure if anything's wrong.
 */

const fs = require('fs');
const path = require('path');
const {
  validateOptionalBlocks,
  resolveOptionalBlocks,
  layerLookup,
  KNOWN_LAYERS,
  parseStepHeaders,
  parseStepRef,
  findAgentSpawnStep,
  STEP_REF_RE,
} = require('./lib/template-transform');

const ALL_AGENTS = [
  'requirements-analyst',
  'solution-designer',
  'solution-reviewer',
  'unit-test-author',
  'bdd-test-author',
  'e2e-test-author',
  'implementer',
  'bug-fixer',
  'qa-reviewer',
  'docs-updater',
  'report-generator',
  'quality-reporter',
];

const PLUGIN_NAME = 'waypoint';

// The files a ship-feature run reads. Their step mentions all refer to ship-feature's steps.
const PIPELINE_FILES = [
  'STANDARDS.md',
  'skills/ship-feature/SKILL.md',
  'skills/quality-report/SKILL.md',
  ...ALL_AGENTS.map((a) => `agents/${a}.md`),
];
// The setup skill: checked for syntax and plugin paths, but its "Step N"s are its own steps.
const INIT = 'skills/init/SKILL.md';
const SKILL = 'skills/ship-feature/SKILL.md';

// Leftovers from the copied-into-.claude/ install, which the plugin replaced.
const STALE_REFERENCES = [
  [/\.claude\/STANDARDS\.md/g, 'use ${CLAUDE_PLUGIN_ROOT}/STANDARDS.md'],
  [/(?<![\w:/])\/(ship-feature|quality-report|waypoint-init)\b/g, 'skills are invoked as /waypoint:<name>'],
];
const PLUGIN_ROOT_REF_RE = /\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g;
const SUBAGENT_RE = /subagent_type="([^"]+)"/g;

// agents whose frontmatter description names the step that spawns them
const AGENTS_WITH_STEP_MENTION = ['qa-reviewer', 'docs-updater', 'report-generator', 'quality-reporter'];

// Text that only makes sense when its layer is on, so it must sit inside that layer's block —
// otherwise a project without the layer reads it anyway.
const LAYER_MENTIONS = {
  BDD: ['test:bdd', 'bdd-test-author'],
  STATIC_SPA_DEPLOY: ['deploy-path'],
  STORYBOOK: ['test:storybook', 'build-storybook'],
};
// A file that is entirely one layer's (it's only ever used when the layer is on).
const WHOLE_FILE_LAYER = { 'agents/bdd-test-author.md': 'BDD' };

const lineOf = (text, offset) => text.slice(0, offset).split('\n').length;

/** Every combination of the optional layers on and off. */
function layerCombinations() {
  return KNOWN_LAYERS.reduce(
    (combos, layer) => combos.flatMap((c) => [{ ...c, [layer]: false }, { ...c, [layer]: true }]),
    [{}]
  );
}

function describe(layers) {
  const on = KNOWN_LAYERS.filter((l) => layers[l]);
  return on.length ? `layers on: ${on.join(', ')}` : 'no layers on';
}

/** Step-reference checks on the files as an agent reads them with `layers`. Each problem is
 * recorded in `found` (message -> the layer combinations it occurs with). */
function checkStepRefs(files, catalogue, layers, found) {
  const present = catalogue.filter((h) => !h.layer || layers[h.layer]);
  const presentIds = new Set(present.flatMap((h) => h.ids));
  const catalogueIds = new Set(catalogue.flatMap((h) => h.ids));
  const add = (msg) => found.set(msg, [...(found.get(msg) || []), describe(layers)]);
  for (const [rel, raw] of files) {
    const text = resolveOptionalBlocks(raw, layers);
    let m;
    STEP_REF_RE.lastIndex = 0;
    while ((m = STEP_REF_RE.exec(text))) {
      const { ids, multi } = parseStepRef(m[1], m[2]);
      const where = `${rel}: "${m[0].trim()}"`;
      for (const id of ids) {
        if (!catalogueIds.has(id)) add(`${where} names Step ${id}, which isn't a Waypoint step ID`);
        else if (!multi && !presentIds.has(id)) add(`${where} names Step ${id}, which is skipped when its layer is off — put the mention inside that layer's block`);
      }
      if (multi && !ids.some((id) => presentIds.has(id))) add(`${where} names no step that runs`);
    }
  }
}

function validate(dir) {
  const failures = new Set();
  const files = new Map();
  for (const rel of PIPELINE_FILES) {
    const p = path.join(dir, rel);
    if (!fs.existsSync(p)) failures.add(`${rel} missing`);
    else files.set(rel, fs.readFileSync(p, 'utf8'));
  }
  const initPath = path.join(dir, INIT);
  const allFiles = new Map(files);
  if (!fs.existsSync(initPath)) failures.add(`${INIT} missing`);
  else allFiles.set(INIT, fs.readFileSync(initPath, 'utf8'));

  // Plugin wiring: every ${CLAUDE_PLUGIN_ROOT} path exists, every spawned agent is this plugin's,
  // and nothing still points at the old copied-into-.claude/ layout.
  for (const [rel, text] of allFiles) {
    let m;
    PLUGIN_ROOT_REF_RE.lastIndex = 0;
    while ((m = PLUGIN_ROOT_REF_RE.exec(text))) {
      const target = m[1].replace(/[.]+$/, '');
      if (!fs.existsSync(path.join(dir, target))) {
        failures.add(`${rel}:${lineOf(text, m.index)}: \${CLAUDE_PLUGIN_ROOT}/${target} doesn't exist in the plugin`);
      }
    }
    SUBAGENT_RE.lastIndex = 0;
    while ((m = SUBAGENT_RE.exec(text))) {
      const [prefix, agent] = m[1].split(':');
      if (prefix !== PLUGIN_NAME || !ALL_AGENTS.includes(agent)) {
        failures.add(`${rel}:${lineOf(text, m.index)}: subagent_type "${m[1]}" isn't ${PLUGIN_NAME}:<one of this plugin's agents>`);
      }
    }
    // init names the old layout on purpose: it detects and migrates it.
    for (const [re, fix] of rel === INIT ? [] : STALE_REFERENCES) {
      re.lastIndex = 0;
      while ((m = re.exec(text))) failures.add(`${rel}:${lineOf(text, m.index)}: "${m[0]}" — ${fix}`);
    }
  }

  // Raw-file checks: no template syntax from the old generator, and well-formed layer blocks.
  let blocksOk = true;
  for (const [rel, text] of allFiles) {
    if (text.includes('{{')) failures.add(`${rel}: "{{" placeholder syntax — project values belong in .waypoint/`);
    if (rel !== INIT && text.includes('<!-- Generator')) failures.add(`${rel}: "<!-- Generator" comment — templates are copied as they are`);
    try {
      validateOptionalBlocks(text, rel);
    } catch (err) {
      failures.add(err.message);
      blocksOk = false;
    }
  }
  if (!blocksOk || !files.has(SKILL)) return [...failures];

  // Layer-only text must sit inside its layer's block.
  for (const [rel, text] of files) {
    const layerAt = layerLookup(text);
    for (const [layer, needles] of Object.entries(LAYER_MENTIONS)) {
      if (WHOLE_FILE_LAYER[rel] === layer) continue;
      for (const needle of needles) {
        let i = text.indexOf(needle);
        while (i !== -1) {
          if (layerAt(i) !== layer) {
            failures.add(`${rel}:${lineOf(text, i)}: "${needle}" is outside a WAYPOINT:OPTIONAL:${layer} block`);
          }
          i = text.indexOf(needle, i + needle.length);
        }
      }
    }
  }

  // Step references, for every way an agent can read the files.
  const catalogue = parseStepHeaders(files.get(SKILL));
  const combos = layerCombinations();
  const stepProblems = new Map();
  for (const layers of combos) checkStepRefs(files, catalogue, layers, stepProblems);
  for (const [msg, when] of stepProblems) {
    failures.add(when.length === combos.length ? `${msg} (every layer combination)` : `${msg} (${when.join('; ')})`);
  }

  // Frontmatter step mentions match the step SKILL.md actually spawns that agent at.
  for (const agent of AGENTS_WITH_STEP_MENTION) {
    const agentText = files.get(`agents/${agent}.md`);
    if (!agentText) continue; // already flagged as missing
    const fmMatch = agentText.match(/Invoked[^.]*?\bStep (\d+a?)\b/);
    const actualStep = findAgentSpawnStep(files.get(SKILL), `${PLUGIN_NAME}:${agent}`);
    if (fmMatch && actualStep && fmMatch[1] !== actualStep) {
      failures.add(`agents/${agent}.md: frontmatter says "Step ${fmMatch[1]}" but SKILL.md spawns it at Step ${actualStep}`);
    } else if (fmMatch && !actualStep) {
      failures.add(`agents/${agent}.md: frontmatter names Step ${fmMatch[1]} but SKILL.md never spawns it`);
    }
  }

  return [...failures];
}

function main() {
  const dir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'plugins', PLUGIN_NAME));
  const failures = validate(dir);
  if (failures.length) {
    console.error(`FAIL — ${failures.length} issue(s) in ${dir}:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`OK — ${dir} is structurally valid.`);
}

if (require.main === module) {
  main();
}

module.exports = { validate, PIPELINE_FILES, PLUGIN_NAME };
