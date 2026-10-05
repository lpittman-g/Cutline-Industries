// Same-origin JSON transport. Never treat an HTML fallback page as an API success.
(function (root) {
  async function request(path, options = {}, user = null) {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid application endpoint.');
    const response = await fetch(path, {
      method: options.method || 'GET', credentials: 'same-origin',
      signal: options.signal || AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(user && options.method ? { 'X-CSRF-Token': user.csrf } : {}) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    let body;
    try { body = await response.json(); }
    catch { const error = new Error('The service is temporarily unavailable. Please try again later.'); error.code = response.ok ? 503 : response.status; throw error; }
    if (!response.ok) { const error = new Error(typeof body?.error === 'string' ? body.error : 'The request could not be completed.'); error.code = response.status; throw error; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('The service returned an invalid response. Please try again later.');
    return body;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { request };
  else root.ArtemisAPI = { request };
})(globalThis);
