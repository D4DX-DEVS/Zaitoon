/**
 * Retry an async function on transient Mongo/network errors.
 * @param {() => Promise<any>} fn - Async function to run
 * @param {{ maxAttempts?: number, delayMs?: number }} opts - maxAttempts (default 3), delayMs (default 500)
 * @returns {Promise<any>} - Result of fn()
 */
function isRetryableError(err) {
  if (!err || typeof err !== "object") return false;
  const name = err.name || "";
  const code = err.code || "";
  return (
    name === "MongoNetworkError" ||
    name === "MongoTimeoutError" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND"
  );
}

async function retryAsync(fn, opts = {}) {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const delayMs = Math.max(0, opts.delayMs ?? 500);
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !isRetryableError(err)) throw err;
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

module.exports = { retryAsync };
