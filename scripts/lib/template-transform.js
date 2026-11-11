'use strict';

/**
 * Pure string helpers for checking Waypoint's templates: parsing the `WAYPOINT:OPTIONAL` layer
 * blocks the agents apply at run time, resolving them the way an agent reads a file for a given
 * set of layers, and the step-ID parsing the validator uses. See scripts/README.md for what the
 * checks built on these do and don't prove.
 */

const OPTIONAL_BLOCK_RE = /<!-- WAYPOINT:OPTIONAL:(\w+) -->([\s\S]*?)<!-- WAYPOINT:END -->/g;
// Matches every OPTIONAL-start and END token individually, in document order — used to validate
// structure (balanced, non-nested, known layer names) before OPTIONAL_BLOCK_RE's non-greedy
// pairing papers over a mistake by just matching the nearest END regardless of whether it was
// the *intended* one.
const OPTIONAL_TOKEN_RE = /<!-- WAYPOINT:(OPTIONAL:(\w+)|END) -->/g;
// A marker wrapped in backticks on both sides is a quotation of the syntax (e.g. the rule text
// that explains it, `<!-- WAYPOINT:END -->`), not a marker.
const QUOTED_MARKER_RE = /`<!-- WAYPOINT:[^`\n]*?-->`/g;

/** `text` with every quoted marker blanked out, so marker parsing ignores it. Same length, so
 * offsets into the result are offsets into `text`. */
function maskQuotedMarkers(text) {
  return text.replace(QUOTED_MARKER_RE, (q) => ' '.repeat(q.length));
}
const KNOWN_LAYERS = ['BDD', 'STATIC_SPA_DEPLOY', 'STORYBOOK'];

// Matches a step mention: "Step N", "Step Na", a range "Steps N-M" / "Steps N–M" (hyphen or en
// dash), or a slash list "Step 5/6/7" — anywhere in the text, including inside "## Step N — ..."
// headers, since a header is just "## " followed by ordinary "Step N" text. Group 1 is the first
// step ID; group 2 is the rest of a range or list, if any (see parseStepRef).
const STEP_REF_RE = /\bSteps?\s+(\d+a?)((?:\s*[–/-]\s*\d+a?)*)/g;

// A whole "## Step N — Title" / "## Steps N–M — Title" header line.
const STEP_HEADER_LINE_RE = /^## Steps?\s+(\d+a?)(?:\s*[–-]\s*(\d+a?))?\s+—\s+(.+?)\s*$/;

/** Throws a descriptive error unless every `WAYPOINT:OPTIONAL:<layer>` start has exactly one
 * matching `WAYPOINT:END`, blocks aren't nested, and every layer name is known. */
function validateOptionalBlocks(rawText, filename, knownLayers = KNOWN_LAYERS) {
  const text = maskQuotedMarkers(rawText);
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

/** `text` as an agent reads it for the given layers: an enabled layer's block keeps its content
 * without the markers, a disabled layer's block disappears. */
function resolveOptionalBlocks(text, enabledLayers) {
  const masked = maskQuotedMarkers(text);
  let out = '';
  let last = 0;
  let m;
  OPTIONAL_BLOCK_RE.lastIndex = 0;
  while ((m = OPTIONAL_BLOCK_RE.exec(masked))) {
    const innerStart = m.index + m[0].indexOf('-->') + 3;
    const innerEnd = innerStart + m[2].length;
    out += text.slice(last, m.index) + (enabledLayers[m[1]] ? text.slice(innerStart, innerEnd) : '');
    last = m.index + m[0].length;
  }
  return out + text.slice(last);
}

/** The layer whose block encloses each character offset of `text`, as a lookup function
 * (offset -> layer name or null). Assumes the blocks are well-formed (validateOptionalBlocks). */
function layerLookup(rawText) {
  const text = maskQuotedMarkers(rawText);
  const spans = [];
  let open = null;
  let m;
  OPTIONAL_TOKEN_RE.lastIndex = 0;
  while ((m = OPTIONAL_TOKEN_RE.exec(text))) {
    if (m[2] !== undefined) open = { layer: m[2], start: m.index };
    else if (open) {
      spans.push({ ...open, end: m.index });
      open = null;
    }
  }
  return (offset) => {
    const span = spans.find((s) => offset > s.start && offset < s.end);
    return span ? span.layer : null;
  };
}

/** Every "## Step(s) N — Title" header in `text`, in document order, as
 * `{ label, ids, title, layer }` — `label` as written ("12", "21a", "16–17"), `ids` every step ID
 * it covers (both ends of a range), and `layer` the WAYPOINT:OPTIONAL layer the header sits inside
 * (null for a step every project runs). Step numbers are fixed IDs, never renumbered. */
function parseStepHeaders(text) {
  const headers = [];
  let layer = null;
  for (const line of maskQuotedMarkers(text).split('\n')) {
    const hm = line.match(STEP_HEADER_LINE_RE);
    if (hm) {
      const ids = hm[2] ? [hm[1], hm[2]] : [hm[1]];
      headers.push({ label: ids.join('–'), ids, title: hm[3], layer });
    }
    // Markers can open and close on the same line (inline fragments), so track them in order.
    let m;
    OPTIONAL_TOKEN_RE.lastIndex = 0;
    while ((m = OPTIONAL_TOKEN_RE.exec(line))) {
      layer = m[2] !== undefined ? m[2] : null;
    }
  }
  return headers;
}

/** Splits one STEP_REF_RE match into `{ ids, multi }`: a range ("9–11") yields its two ends, a
 * slash list ("5/6/7") every member, and `multi` says whether the mention names more than one step
 * (in which case it means "whichever of these this project runs"). */
function parseStepRef(first, rest) {
  if (!rest) return { ids: [first], multi: false };
  if (rest.includes('/')) {
    return { ids: [first, ...rest.split('/').map((s) => s.trim()).filter(Boolean)], multi: true };
  }
  return { ids: [first, rest.replace(/^\s*[–-]\s*/, '')], multi: true };
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
  validateOptionalBlocks,
  resolveOptionalBlocks,
  layerLookup,
  KNOWN_LAYERS,
  parseStepHeaders,
  parseStepRef,
  findAgentSpawnStep,
  STEP_REF_RE,
};
