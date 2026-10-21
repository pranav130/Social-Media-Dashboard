/**
 * Centralized Eligibility Engine for UPPCL Social Media Cell
 *
 * Exact Rule:
 * A post is eligible for this X complaint dashboard ONLY if its post content
 * mentions at least one of the following exact target accounts:
 * - @UPPCLLKO
 * - @EMofficeUP
 * - @AKSharmaOffice
 * - @aksharmaBharat
 * - @mduppcl
 *
 * Rule is OR, not AND.
 * Filter is on MENTIONED target handles, NOT automatically on author handle.
 * Exact word boundary matching avoids substring false positives (e.g. @UPPCLLKO_FanClub).
 */

const TARGET_HANDLES = [
  '@UPPCLLKO',
  '@EMofficeUP',
  '@AKSharmaOffice',
  '@aksharmaBharat',
  '@mduppcl'
];

const TARGET_HANDLES_CANONICAL = TARGET_HANDLES.map(h => h.toLowerCase().replace('@', ''));

/**
 * Checks whether post content mentions at least one of the 5 exact target accounts.
 *
 * @param {string|object} postOrText - Post text string or post object
 * @param {object|null} entities - Optional Twitter API entities object containing mentions array
 * @returns {boolean} true if post mentions at least one target handle
 */
function isPostEligible(postOrText, entities = null) {
  if (!postOrText) return false;

  let text = '';
  let mentions = null;

  if (typeof postOrText === 'string') {
    text = postOrText;
  } else if (typeof postOrText === 'object') {
    text = postOrText.complaint_text || postOrText.post_text || postOrText.text || '';
    if (postOrText.entities && postOrText.entities.mentions) {
      mentions = postOrText.entities.mentions;
    } else if (Array.isArray(postOrText.mentions)) {
      mentions = postOrText.mentions;
    }
  }

  if (entities && Array.isArray(entities.mentions)) {
    mentions = entities.mentions;
  }

  // 1. Check structured entities.mentions if available
  if (Array.isArray(mentions)) {
    for (const m of mentions) {
      const u = (m.username || m.handle || (typeof m === 'string' ? m : '')).toLowerCase().replace(/^@/, '');
      if (TARGET_HANDLES_CANONICAL.includes(u)) {
        return true;
      }
    }
  }

  // 2. Exact word boundary regex check on text:
  // Match @target with negative lookahead for [a-zA-Z0-9_]
  if (typeof text === 'string' && text.trim()) {
    for (const target of TARGET_HANDLES_CANONICAL) {
      const regex = new RegExp(`@${target}(?![a-zA-Z0-9_])`, 'i');
      if (regex.test(text)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extracts all matched target handles from text or entities.
 *
 * @param {string|object} postOrText
 * @param {object|null} entities
 * @returns {string[]} Array of unique matched target handles, e.g. ['@UPPCLLKO', '@mduppcl']
 */
function getMatchedTargetHandles(postOrText, entities = null) {
  const matches = new Set();
  let text = '';
  let mentions = null;

  if (typeof postOrText === 'string') {
    text = postOrText;
  } else if (typeof postOrText === 'object') {
    text = postOrText.complaint_text || postOrText.post_text || postOrText.text || '';
    if (postOrText.entities && postOrText.entities.mentions) {
      mentions = postOrText.entities.mentions;
    } else if (Array.isArray(postOrText.mentions)) {
      mentions = postOrText.mentions;
    }
  }

  if (entities && Array.isArray(entities.mentions)) {
    mentions = entities.mentions;
  }

  if (Array.isArray(mentions)) {
    for (const m of mentions) {
      const u = (m.username || m.handle || (typeof m === 'string' ? m : '')).toLowerCase().replace(/^@/, '');
      const idx = TARGET_HANDLES_CANONICAL.indexOf(u);
      if (idx !== -1) {
        matches.add(TARGET_HANDLES[idx]);
      }
    }
  }

  if (typeof text === 'string' && text.trim()) {
    TARGET_HANDLES_CANONICAL.forEach((target, idx) => {
      const regex = new RegExp(`@${target}(?![a-zA-Z0-9_])`, 'i');
      if (regex.test(text)) {
        matches.add(TARGET_HANDLES[idx]);
      }
    });
  }

  return Array.from(matches);
}

/**
 * Resolves the primary monitored account for a complaint.
 * If multiple target handles are mentioned, resolves to the highest priority official handle:
 * 1. @UPPCLLKO (HQ)
 * 2. @EMofficeUP (Energy Minister Office)
 * 3. @AKSharmaOffice (Cabinet Minister Office)
 * 4. @aksharmaBharat (Hon. Minister)
 * 5. @mduppcl (Managing Director)
 */
function resolvePrimaryMonitoredAccount(postOrText, entities = null) {
  const matched = getMatchedTargetHandles(postOrText, entities);
  if (matched.length === 0) return null;

  for (const h of TARGET_HANDLES) {
    if (matched.includes(h)) return h;
  }
  return matched[0];
}

module.exports = {
  TARGET_HANDLES,
  TARGET_HANDLES_CANONICAL,
  isPostEligible,
  getMatchedTargetHandles,
  resolvePrimaryMonitoredAccount
};
