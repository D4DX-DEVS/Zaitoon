// Class values are stored as free-text strings and two formats exist in the data:
// "Class 9" (user data collection screen) and "9th" (student form). Filtering is
// therefore done with per-class regexes that accept every known variant.

const NUMERIC_CLASSES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const CLASS_KEYS = ["PRE_KG", "LKG", "UKG", ...NUMERIC_CLASSES, "NOT_STUDYING"];

const NON_NUMERIC_PATTERNS = {
  PRE_KG: /^\s*pre[\s-]*kg\s*$/i,
  LKG: /^\s*l[\s-]*kg\s*$/i,
  UKG: /^\s*u[\s-]*kg\s*$/i,
  NOT_STUDYING: /^\s*not[\s-]*studying\s*$/i
};

function patternForKey(key) {
  if (NON_NUMERIC_PATTERNS[key]) return NON_NUMERIC_PATTERNS[key];
  if (NUMERIC_CLASSES.includes(key)) {
    // matches "9", "09", "9th", "Class 9", "class-9", "Std 9", "Grade 9"
    return new RegExp(`^\\s*(class|std|standard|grade)?[\\s.-]*0*${key}\\s*(st|nd|rd|th)?\\s*$`, "i");
  }
  return null;
}

/**
 * Parse a `classes` query param ("8,9,10") into regexes usable in a $in match.
 * Returns null when nothing valid was requested (i.e. no filtering).
 */
function parseClassFilter(classesParam) {
  if (!classesParam) return null;
  const raw = Array.isArray(classesParam) ? classesParam : String(classesParam).split(",");
  const patterns = raw
    .map(v => String(v).trim().toUpperCase().replace(/\s+/g, "_"))
    .filter(Boolean)
    .map(patternForKey)
    .filter(Boolean);
  return patterns.length ? patterns : null;
}

/** Does a raw class string match one of the parsed patterns? */
function matchesClassFilter(value, patterns) {
  if (!patterns) return true;
  const str = String(value || "");
  return patterns.some(p => p.test(str));
}

module.exports = { CLASS_KEYS, parseClassFilter, matchesClassFilter };
