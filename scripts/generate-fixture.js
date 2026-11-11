#!/usr/bin/env node
'use strict';

/**
 * Generates a concrete fixture from Waypoint's .claude/ templates, the same mechanical way a
 * real waypoint-init run would (placeholder substitution, optional-layer resolution, generator
 * comment stripping) — everything EXCEPT writing real STACK_FACTS
 * prose, which needs an LLM that actually knows a real stack. See scripts/README.md.
 *
 * Usage: node scripts/generate-fixture.js <config.json> <outputDir>
 */

const fs = require('fs');
const path = require('path');
const {
  substitutePlaceholders,
  resolveStackFacts,
  validateOptionalBlocks,
  resolveOptionalBlocks,
  stripGeneratorComments,
} = require('./lib/template-transform');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_ROOT = path.join(REPO_ROOT, '.claude');

function readConfig(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const required = [
    'PROJECT_NAME',
    'APP_STACK_SUMMARY',
    'PKG_MANAGER',
    'PKG_EXEC',
    'RUNTIME_VERSION',
    'COVERAGE_THRESHOLD',
    'BRANCH_COVERAGE_THRESHOLD',
    'WCAG_TAGS',
    'RELEASE_REPORT_CADENCE',
  ];
  for (const key of required) {
    if (!(key in config.values)) {
      throw new Error(`Config ${configPath} is missing values.${key}`);
    }
  }
  for (const layer of ['BDD', 'STATIC_SPA_DEPLOY', 'STORYBOOK']) {
    if (!config.layers || !(layer in config.layers)) {
      throw new Error(`Config ${configPath} must set layers.${layer}`);
    }
  }
  return config;
}

function transformFile(text, config, filename) {
  validateOptionalBlocks(text, filename, Object.keys(config.layers));
  let out = text;
  out = resolveOptionalBlocks(out, config.layers);
  out = resolveStackFacts(out, config.stackFactsStubs, config.defaultStackFactsStub);
  out = substitutePlaceholders(out, config.values);
  out = stripGeneratorComments(out);
  return out;
}

function generate(configPath, outputDir) {
  const config = readConfig(configPath);
  const SKILL_REL = path.join('skills', 'ship-feature', 'SKILL.md');

  const filesToProcess = [
    'STANDARDS.md',
    SKILL_REL,
    path.join('skills', 'quality-report', 'SKILL.md'),
  ];

  for (const agentFile of fs.readdirSync(path.join(TEMPLATE_ROOT, 'agents'))) {
    if (!agentFile.endsWith('.md')) continue;
    if (agentFile === 'bdd-test-author.md' && !config.layers.BDD) continue;
    filesToProcess.push(path.join('agents', agentFile));
  }

  // Step numbers are fixed IDs, so there's no renumbering pass: a disabled layer's steps just
  // leave a gap (see TEMPLATE_CONVENTIONS.md's "Step numbers" section).
  const transformed = new Map();
  for (const relPath of filesToProcess) {
    const srcPath = path.join(TEMPLATE_ROOT, relPath);
    transformed.set(relPath, transformFile(fs.readFileSync(srcPath, 'utf8'), config, relPath));
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const [relPath, text] of transformed) {
    const destPath = path.join(outputDir, relPath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, text, 'utf8');
  }

  return filesToProcess;
}

function main() {
  const [, , configPath, outputDir] = process.argv;
  if (!configPath || !outputDir) {
    console.error('Usage: node scripts/generate-fixture.js <config.json> <outputDir>');
    process.exit(2);
  }
  const written = generate(path.resolve(configPath), path.resolve(outputDir));
  console.log(`Generated ${written.length} files into ${outputDir}`);
}

if (require.main === module) {
  main();
}

module.exports = { generate };
