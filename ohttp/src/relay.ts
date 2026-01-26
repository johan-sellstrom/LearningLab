// Cloudflare Privacy Gateway Relay template
// NOTE: Cloudflare provides a managed OHTTP relay; this Worker is a placeholder for
// environments where a custom Worker is preferred. See docs:
// https://developers.cloudflare.com/privacy-gateway/relay/

export default {
  async fetch(_request: Request, _env: any, _ctx: ExecutionContext): Promise<Response> {
    return new Response(
      JSON.stringify({
        message: 'OHTTP relay is not configured. Use Cloudflare Privacy Gateway Relay and point wallet/verifier to the relay endpoint.',
        docs: 'https://developers.cloudflare.com/privacy-gateway/relay/'
      }),
      { status: 501, headers: { 'content-type': 'application/json' } }
    )
  }
}
