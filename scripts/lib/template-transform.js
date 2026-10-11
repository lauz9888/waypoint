'use strict';

/**
 * Deterministic, mechanical subset of what waypoint-init does to a template file.
 * This does NOT replicate the whole generator — {{STACK_FACTS: <layer>}} blocks need real
 * LLM-written prose about a real stack, which this module fills with an obviously-fake stub
 * instead. See scripts/README.md for what that does and doesn't prove.
 */

const PLACEHOLDER_RE = /\{\{([A-Z0-9_]+)\}\}/g;
// Matches both the colon form ({{STACK_FACTS: unit-test}}, a dedicated prose block) and the
// bare form ({{STACK_FACTS}}, used inline in a sentence, e.g. "see `{{STACK_FACTS}}` in each
// test-author agent") — examples/throughline has zero literal "STACK_FACTS" text anywhere, so
// waypoint-init resolves both forms, not just the colon one.
const STACK_FACTS_RE = /\{\{STACK_FACTS(?::\s*([\w-]+))?\s*\}\}/g;
const OPTIONAL_BLOCK_RE = /<!-- WAYPOINT:OPTIONAL:(\w+) -->([\s\S]*?)<!-- WAYPOINT:END -->/g;
// Matches every OPTIONAL-start and END token individually, in document order — used to validate
// structure (balanced, non-nested, known layer names) before OPTIONAL_BLOCK_RE's non-greedy
// pairing papers over a mistake by just matching the nearest END regardless of whether it was
// the *intended* one.
const OPTIONAL_TOKEN_RE = /<!-- WAYPOINT:(OPTIONAL:(\w+)|END) -->/g;
const KNOWN_LAYERS = ['BDD', 'STATIC_SPA_DEPLOY', 'STORYBOOK'];
const GENERATOR_NOTE_RE = /<!-- Generator note:[\s\S]*?-->\n?/g;
const GENERATOR_RE = /<!-- Generator:[\s\S]*?-->\n?/g;
const STANDALONE_WAYPOINT_NOTE_RE = /<!-- WAYPOINT: [\s\S]*?-->\n?/g;

// Matches "Step N", "Steps N", "Step Na", "Steps N-M" / "Steps N–M" (hyphen or en dash),
// anywhere in the text — including inside "## Step N — ..." headers, since a header is just
// "## " followed by ordinary "Step N" text.
const STEP_REF_RE = /\bSteps?\s+(\d+)(a)?(\s*[–-]\s*(\d+)(a)?)?/g;

// Header-only scan, used to determine which step numbers actually survive in this file (a
// disabled optional layer's steps are already gone by the time this runs, via resolveOptionalBlocks).
const STEP_HEADER_RE = /^## Steps?\s+(\d+)\b(?:\s*[–-]\s*(\d+))?/gm;

function substitutePlaceholders(text, values) {
  return text.replace(PLACEHOLDER_RE, (whole, key) => {
    if (!(key in values)) {
      throw new Error(`Missing placeholder value for {{${key}}}`);
    }
    return values[key];
  });
}

function resolveStackFacts(text, stubsByLayer, defaultStub) {
  return text.replace(STACK_FACTS_RE, (whole, layer) => {
    const stub = (stubsByLayer && stubsByLayer[layer]) || defaultStub;
    if (!stub) {
      throw new Error(`No stub STACK_FACTS text for layer "${layer}" and no default provided`);
    }
    return stub;
  });
}

/** Throws a descriptive error unless every `WAYPOINT:OPTIONAL:<layer>` start has exactly one
 * matching `WAYPOINT:END`, blocks aren't nested, and every layer name is known — turning what
 * was previously just an authoring convention (documented in TEMPLATE_CONVENTIONS.md, not
 * enforced) into something generation actually fails on if violated. */
function validateOptionalBlocks(text, filename, knownLayers = KNOWN_LAYERS) {
  const stack = [];
  let m;
  OPTIONAL_TOKEN_RE.lastIndex = 0;
  while ((m = OPTIONAL_TOKEN_RE.exec(text))) {
    const line = text.slice(0, m.index).split('\n').length;
    if (m[2] !== undefined) {
      // an OPTIONAL:<layer> start
      if (stack.length) {
        throw new Error(
          `${filename}:${line}: WAYPOINT:OPTIONAL:${m[2]} starts while WAYPOINT:OPTIONAL:${stack[stack.length - 1].layer} (line ${stack[stack.length - 1].line}) is still open — nested WAYPOINT:OPTIONAL blocks aren't supported`
        );
      }
      if (!knownLayers.includes(m[2])) {
        throw new Error(
          `${filename}:${line}: unknown optional layer "${m[2]}" — known layers are ${knownLayers.join(', ')}`
        );
      }
      stack.push({ layer: m[2], line });
    } else {
      // a WAYPOINT:END
      if (!stack.length) {
        throw new Error(`${filename}:${line}: WAYPOINT:END with no matching WAYPOINT:OPTIONAL:<layer> open`);
      }
      stack.pop();
    }
  }
  if (stack.length) {
    const unclosed = stack[stack.length - 1];
    throw new Error(
      `${filename}: WAYPOINT:OPTIONAL:${unclosed.layer} (line ${unclosed.line}) never closed with a matching WAYPOINT:END`
    );
  }
}

function resolveOptionalBlocks(text, enabledLayers) {
  return text.replace(OPTIONAL_BLOCK_RE, (whole, layer, inner) =>
    enabledLayers[layer] ? inner : ''
  );
}

function stripGeneratorComments(text) {
  return text
    .replace(GENERATOR_NOTE_RE, '')
    .replace(GENERATOR_RE, '')
    .replace(STANDALONE_WAYPOINT_NOTE_RE, '');
}

/** Every step number (both ends of any header range) that actually appears as a "## Step(s) N" heading. */
function findSurvivorSteps(text) {
  const survivors = new Set();
  let m;
  STEP_HEADER_RE.lastIndex = 0;
  while ((m = STEP_HEADER_RE.exec(text))) {
    survivors.add(Number(m[1]));
    if (m[2]) survivors.add(Number(m[2]));
  }
  return survivors;
}

/** Old step number -> new step number, derived from which "## Step(s) N" headers survive in
 * `skillText` (i.e. after disabled-layer sections have already been stripped). */
function computeStepRenumberMap(skillText) {
  const survivors = [...findSurvivorSteps(skillText)].sort((a, b) => a - b);
  return new Map(survivors.map((old, idx) => [old, idx + 1]));
}

/** Rewrites every "Step N"/"Steps N-M"/"Step Na" occurrence in `text` (headers included) using
 * a renumber map already computed from SKILL.md — this is what needs applying to every OTHER
 * generated file too (agent frontmatter, STANDARDS.md), not just SKILL.md itself, since a step
 * mention doesn't stop being a cross-reference just because it's not in the file that owns the
 * numbering. */
function applyStepRenumberMap(text, map) {
  const mapNum = (n) => (map.has(n) ? map.get(n) : n);
  return text.replace(STEP_REF_RE, (whole, n1, a1, rangePart, n2, a2) => {
    const isPlural = /^Steps\b/.test(whole);
    let out = `Step${isPlural ? 's' : ''} ${mapNum(Number(n1))}${a1 || ''}`;
    if (rangePart) {
      out += `–${mapNum(Number(n2))}${a2 || ''}`;
    }
    return out;
  });
}

/** Convenience wrapper for the common case: renumber a SKILL.md against its own headers. */
function renumberSkillSteps(text) {
  return applyStepRenumberMap(text, computeStepRenumberMap(text));
}

/** Returns the step label ("12", "20", "21a", ...) active in `skillText` at the point a
 * `subagent_type="<agentName>"` spawn first appears, or null if never spawned. */
function findAgentSpawnStep(skillText, agentName) {
  const headerLineRe = /^## Steps?\s+([\d]+a?(?:\s*[–-]\s*\d+)?)\s+—/;
  let lastHeader = null;
  const needle = `subagent_type="${agentName}"`;
  for (const line of skillText.split('\n')) {
    const hm = line.match(headerLineRe);
    if (hm) lastHeader = hm[1];
    if (line.includes(needle) && lastHeader) {
      return lastHeader;
    }
  }
  return null;
}

module.exports = {
  substitutePlaceholders,
  resolveStackFacts,
  validateOptionalBlocks,
  resolveOptionalBlocks,
  stripGeneratorComments,
  KNOWN_LAYERS,
  findSurvivorSteps,
  computeStepRenumberMap,
  applyStepRenumberMap,
  renumberSkillSteps,
  findAgentSpawnStep,
  STEP_REF_RE,
};
