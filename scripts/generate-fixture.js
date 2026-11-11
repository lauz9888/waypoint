#!/usr/bin/env node
'use strict';

/**
 * Generates a concrete .claude/ from Waypoint's templates, the same mechanical way a real
 * waypoint-init run does: resolve the optional layers a project's .waypoint/config.json turns on
 * or off, and strip generator comments. Nothing else changes — every project-specific value lives
 * in .waypoint/, so the generated files are identical for any two projects with the same layers.
 * Writing .waypoint/stack.md's prose needs an LLM that knows the real stack, so it isn't done here.
 * See scripts/README.md.
 *
 * Usage: node scripts/generate-fixture.js <.waypoint/config.json> <outputDir>
 */

const fs = require('fs');
const path = require('path');
const { validateOptionalBlocks, resolveOptionalBlocks, stripGeneratorComments } = require('./lib/template-transform');
const { validateConfig } = require('./lib/waypoint-config');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_ROOT = path.join(REPO_ROOT, '.claude');

function readConfig(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const errors = validateConfig(config);
  if (errors.length) {
    throw new Error(`Config ${configPath} is invalid:\n  - ${errors.join('\n  - ')}`);
  }
  return config;
}

function transformFile(text, config, filename) {
  validateOptionalBlocks(text, filename, Object.keys(config.layers));
  return stripGeneratorComments(resolveOptionalBlocks(text, config.layers));
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
