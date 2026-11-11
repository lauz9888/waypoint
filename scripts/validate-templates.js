#!/usr/bin/env node
'use strict';

/**
 * Structural validation of a generated (or hand-maintained, e.g. examples/throughline) concrete
 * `.claude/` directory. Proves the *mechanical* correctness properties from the external review
 * that prompted this file — placeholders/markers gone, the right agent files exist, every step
 * reference resolves, frontmatter step-mentions match reality. Does NOT judge STACK_FACTS prose
 * quality — see scripts/README.md.
 *
 * Usage: node scripts/validate-templates.js <dir> <config.json>
 * Exits non-zero and prints every failure if anything's wrong.
 */

const fs = require('fs');
const path = require('path');
const { parseStepHeaders, parseStepRef, findAgentSpawnStep, STEP_REF_RE } = require('./lib/template-transform');

// The template's step headers are the catalogue of fixed step IDs every concrete SKILL.md is
// checked against.
const TEMPLATE_SKILL = path.resolve(__dirname, '..', '.claude', 'skills', 'ship-feature', 'SKILL.md');

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

// agent name -> the step this agent's own frontmatter description names as its invocation point
const AGENTS_WITH_STEP_MENTION = ['qa-reviewer', 'docs-updater', 'report-generator', 'quality-reporter'];

function walkMdFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMdFiles(full));
    } else if (entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

function readIfExists(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function validate(dir, config) {
  const failures = [];
  const mdFiles = walkMdFiles(dir);

  // 1-3: no leftover placeholder/marker syntax anywhere.
  for (const file of mdFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(dir, file);
    if (text.includes('{{')) failures.push(`${rel}: leftover "{{" placeholder syntax`);
    if (text.includes('WAYPOINT:')) failures.push(`${rel}: leftover "WAYPOINT:" marker`);
    if (text.includes('<!-- Generator')) failures.push(`${rel}: leftover "<!-- Generator" comment`);
  }

  // 4-5: expected agent file set, present/absent per BDD flag.
  const agentsDir = path.join(dir, 'agents');
  for (const agent of ALL_AGENTS) {
    const agentPath = path.join(agentsDir, `${agent}.md`);
    const exists = fs.existsSync(agentPath);
    if (agent === 'bdd-test-author') {
      if (config.layers.BDD && !exists) failures.push(`agents/${agent}.md missing but BDD is enabled`);
      if (!config.layers.BDD && exists) failures.push(`agents/${agent}.md present but BDD is disabled`);
    } else if (!exists) {
      failures.push(`agents/${agent}.md missing`);
    }
  }

  // 6, 8: step numbers are fixed IDs. Every header is the template's step with the same number
  // and title (identity, not just existence — a renumbered step fails here), exactly the steps of
  // enabled layers are present, and every step mention in every file resolves.
  const skillPath = path.join(dir, 'skills', 'ship-feature', 'SKILL.md');
  const skillText = readIfExists(skillPath);
  if (!skillText) {
    failures.push(`skills/ship-feature/SKILL.md missing`);
  } else {
    const catalogue = parseStepHeaders(fs.readFileSync(TEMPLATE_SKILL, 'utf8'));
    const byLabel = new Map(catalogue.map((h) => [h.label, h]));
    const headers = parseStepHeaders(skillText);
    for (const h of headers) {
      const canonical = byLabel.get(h.label);
      if (!canonical) {
        failures.push(`skills/ship-feature/SKILL.md: "Step ${h.label}" isn't a Waypoint step ID`);
      } else if (canonical.title !== h.title) {
        failures.push(
          `skills/ship-feature/SKILL.md: Step ${h.label} is titled "${h.title}" but Waypoint's Step ${h.label} is "${canonical.title}" — renumbered?`
        );
      } else if (canonical.layer && !config.layers[canonical.layer]) {
        failures.push(`skills/ship-feature/SKILL.md: Step ${h.label} belongs to the disabled ${canonical.layer} layer`);
      }
    }
    const presentLabels = headers.map((h) => h.label);
    for (const h of catalogue) {
      if ((!h.layer || config.layers[h.layer]) && !presentLabels.includes(h.label)) {
        failures.push(`skills/ship-feature/SKILL.md: Step ${h.label} ("${h.title}") is missing`);
      }
    }
    const catalogueOrder = catalogue.map((h) => h.label);
    const positions = presentLabels.map((l) => catalogueOrder.indexOf(l)).filter((i) => i >= 0);
    if (positions.some((pos, idx) => idx > 0 && pos < positions[idx - 1])) {
      failures.push(`skills/ship-feature/SKILL.md: step headers are out of order — found [${presentLabels.join(', ')}]`);
    }

    // A single-step mention must name a step present here; a range or list ("Steps 9–11",
    // "Step 5/6/7") means whichever of them exist, so it may also name a disabled layer's step.
    const presentIds = new Set(headers.flatMap((h) => h.ids));
    const stepLayer = new Map(catalogue.flatMap((h) => h.ids.map((id) => [id, h.layer])));
    for (const file of mdFiles) {
      const rel = path.relative(dir, file);
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, idx) => {
        let m;
        STEP_REF_RE.lastIndex = 0;
        while ((m = STEP_REF_RE.exec(line))) {
          const { ids, multi } = parseStepRef(m[1], m[2]);
          for (const id of ids) {
            if (presentIds.has(id)) continue;
            if (!stepLayer.has(id)) {
              failures.push(`${rel}:${idx + 1}: "${m[0].trim()}" names Step ${id}, which isn't a Waypoint step ID`);
            } else if (!multi) {
              failures.push(`${rel}:${idx + 1}: "${m[0].trim()}" names Step ${id}, which isn't in this SKILL.md`);
            }
          }
          if (multi && !ids.some((id) => presentIds.has(id))) {
            failures.push(`${rel}:${idx + 1}: "${m[0].trim()}" names no step that's in this SKILL.md`);
          }
        }
      });
    }

    // 9: disabled-layer script/label mentions absent when off, present when on.
    const bddMarkers = ['test:bdd', 'bdd-test'];
    for (const marker of bddMarkers) {
      const present = skillText.includes(marker);
      if (config.layers.BDD && !present) {
        failures.push(`skills/ship-feature/SKILL.md: expected "${marker}" (BDD enabled) but it's absent`);
      }
      if (!config.layers.BDD && present) {
        failures.push(`skills/ship-feature/SKILL.md: found "${marker}" but BDD is disabled`);
      }
    }
    const storybookMarkers = ['test:storybook', 'storybook-test'];
    for (const marker of storybookMarkers) {
      const present = skillText.includes(marker);
      if (config.layers.STORYBOOK && !present) {
        failures.push(`skills/ship-feature/SKILL.md: expected "${marker}" (Storybook enabled) but it's absent`);
      }
      if (!config.layers.STORYBOOK && present) {
        failures.push(`skills/ship-feature/SKILL.md: found "${marker}" but Storybook is disabled`);
      }
    }
    const staticDeployPresent = skillText.includes('deploy-path');
    if (config.layers.STATIC_SPA_DEPLOY && !staticDeployPresent) {
      failures.push(`skills/ship-feature/SKILL.md: expected "deploy-path" (static deploy enabled) but it's absent`);
    }
    if (!config.layers.STATIC_SPA_DEPLOY && staticDeployPresent) {
      failures.push(`skills/ship-feature/SKILL.md: found "deploy-path" but static deploy is disabled`);
    }

    // 7, 10: frontmatter step-mentions match the step SKILL.md actually spawns that agent at.
    for (const agent of AGENTS_WITH_STEP_MENTION) {
      const agentPath = path.join(agentsDir, `${agent}.md`);
      const agentText = readIfExists(agentPath);
      if (!agentText) continue; // already flagged as missing above
      const fmMatch = agentText.match(/Invoked[^.]*?\bStep (\d+a?)\b/);
      const actualStep = findAgentSpawnStep(skillText, agent);
      if (fmMatch && actualStep && fmMatch[1] !== actualStep) {
        failures.push(
          `agents/${agent}.md: frontmatter says "Step ${fmMatch[1]}" but SKILL.md spawns it at Step ${actualStep}`
        );
      } else if (fmMatch && !actualStep) {
        failures.push(`agents/${agent}.md: frontmatter names Step ${fmMatch[1]} but SKILL.md never spawns it`);
      }
    }
  }

  return failures;
}

function main() {
  const [, , dir, configPath] = process.argv;
  if (!dir || !configPath) {
    console.error('Usage: node scripts/validate-templates.js <dir> <config.json>');
    process.exit(2);
  }
  const config = JSON.parse(fs.readFileSync(path.resolve(configPath), 'utf8'));
  const failures = validate(path.resolve(dir), config);
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

module.exports = { validate };
