/**
 * What counts as a "book" for growth activity (booksRead, achievements).
 * A book read = one of: story, single_story, brightbox.
 */
const BOOK_TYPES = ["story", "single_story", "brightbox"];

function isValidBookType(value) {
  return value && BOOK_TYPES.includes(value);
}

module.exports = {
  BOOK_TYPES,
  isValidBookType,
};
