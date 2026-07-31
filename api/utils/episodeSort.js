/**
 * Get a numeric sort key from an episode (for ascending episode order).
 * Uses leading digits from title (e.g. "01", "02", "Episode 10" -> 1, 2, 10).
 * Episodes without a leading number sort after numbered ones, then by title.
 */
function getEpisodeSortKey(ep) {
  const title = (ep.title || "").trim();
  const match = title.match(/^\d+/);
  if (match) return parseInt(match[0], 10);
  return Number.MAX_SAFE_INTEGER; // unnumbered episodes at end
}

/**
 * Compare two episodes for ascending order (by episode number then by title).
 */
function compareEpisodes(a, b) {
  const keyA = getEpisodeSortKey(a);
  const keyB = getEpisodeSortKey(b);
  if (keyA !== keyB) return keyA - keyB;
  const titleA = (a.title || "").trim();
  const titleB = (b.title || "").trim();
  return titleA.localeCompare(titleB, undefined, { numeric: true });
}

/**
 * Return a new array of episodes sorted by episode number (ascending).
 */
function sortEpisodesAscending(episodes) {
  if (!Array.isArray(episodes) || episodes.length === 0) return episodes;
  return [...episodes].sort(compareEpisodes);
}

module.exports = { getEpisodeSortKey, compareEpisodes, sortEpisodesAscending };
