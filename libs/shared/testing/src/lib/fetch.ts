/**
 * Build a resolved fetch Response carrying a JSON body. Use it to stub the
 * global fetch in specs that exercise API-calling code.
 */
export function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}
