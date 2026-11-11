'use strict';

/**
 * Checks for an adopting project's `.waypoint/config.json` and `.waypoint/stack.md` — the only
 * project-specific files in a Waypoint pipeline (see the plugin's STANDARDS.md, "Project
 * configuration" section). No dependencies, no I/O: the caller reads the files.
 */

const LAYERS = ['BDD', 'STATIC_SPA_DEPLOY', 'STORYBOOK'];
const SCHEMA_VERSION = 1;

// stack.md section -> the layer it belongs to (null: every project has it).
const STACK_SECTIONS = {
  'test-frameworks': null,
  'unit-test': null,
  'bdd-test': 'BDD',
  'e2e-test': null,
  'storybook-test': 'STORYBOOK',
  coverage: null,
};

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';
const isPercent = (v) => typeof v === 'number' && v >= 0 && v <= 100;

/** Returns a list of problems with a parsed config.json; empty if it's valid. */
function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) return ['config is not a JSON object'];

  if (config.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${SCHEMA_VERSION}, found ${JSON.stringify(config.schemaVersion)}`);
  }
  if (!config.project || !isNonEmptyString(config.project.name)) errors.push('project.name must be a non-empty string');
  if (!config.project || !isNonEmptyString(config.project.summary)) errors.push('project.summary must be a non-empty string');
  for (const key of ['packageManager', 'packageExec', 'runtimeVersion']) {
    if (!isNonEmptyString(config[key])) errors.push(`${key} must be a non-empty string`);
  }

  if (!config.layers || typeof config.layers !== 'object') {
    errors.push(`layers must be an object with ${LAYERS.join(', ')}`);
  } else {
    for (const layer of LAYERS) {
      if (typeof config.layers[layer] !== 'boolean') errors.push(`layers.${layer} must be true or false`);
    }
    for (const layer of Object.keys(config.layers)) {
      if (!LAYERS.includes(layer)) errors.push(`layers.${layer} isn't a known layer (known: ${LAYERS.join(', ')})`);
    }
  }

  if (!config.coverage || !isPercent(config.coverage.statements) || !isPercent(config.coverage.branches)) {
    errors.push('coverage.statements and coverage.branches must be numbers from 0 to 100');
  }
  if (!Array.isArray(config.wcagTags) || !config.wcagTags.length || !config.wcagTags.every(isNonEmptyString)) {
    errors.push('wcagTags must be a non-empty array of strings');
  }
  if (!Number.isInteger(config.releaseReportCadence) || config.releaseReportCadence < 1) {
    errors.push('releaseReportCadence must be a positive integer');
  }
  return errors;
}

/** Every `## <name>` section in stack.md, as name -> body text (trimmed). */
function parseStackSections(text) {
  const sections = new Map();
  let current = null;
  for (const line of text.split('\n')) {
    const m = line.match(/^## (\S+)\s*$/);
    if (m) {
      current = m[1];
      sections.set(current, '');
    } else if (current) {
      sections.set(current, sections.get(current) + line + '\n');
    }
  }
  for (const [name, body] of sections) sections.set(name, body.trim());
  return sections;
}

/** Returns a list of problems with a filled-in stack.md for the given layers; empty if valid.
 * With `{ template: true }`, checks the template instead: every section present, no layer
 * filtering, generator comments allowed in place of content. */
function validateStack(text, layers, { template = false } = {}) {
  const errors = [];
  const sections = parseStackSections(text);
  for (const [name, layer] of Object.entries(STACK_SECTIONS)) {
    const expected = template || !layer || layers[layer];
    if (expected && !sections.has(name)) errors.push(`missing "## ${name}" section`);
    if (!expected && sections.has(name)) errors.push(`has a "## ${name}" section but the ${layer} layer is off`);
    if (!template && expected && sections.has(name) && !sections.get(name)) errors.push(`"## ${name}" section is empty`);
  }
  for (const name of sections.keys()) {
    if (!(name in STACK_SECTIONS)) errors.push(`"## ${name}" isn't a known section (known: ${Object.keys(STACK_SECTIONS).join(', ')})`);
  }
  if (!template) {
    if (text.includes('<!-- Generator')) errors.push('leftover "<!-- Generator" comment');
    if (text.includes('{{')) errors.push('leftover "{{" placeholder syntax');
  }
  return errors;
}

module.exports = { LAYERS, SCHEMA_VERSION, STACK_SECTIONS, validateConfig, parseStackSections, validateStack };
