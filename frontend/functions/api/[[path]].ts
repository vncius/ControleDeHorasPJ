/**
 * Cloudflare Pages Function — reverse proxy same-origin para o backend (Render).
 *
 * Mesmo problema e mesma solução do projeto Gestão Financeira: front (Cloudflare
 * Pages) e back (Render) são domínios registráveis diferentes, então o cookie de
 * sessão (`sessao`, httpOnly, SameSite=None) é tratado como cookie de terceiro por
 * Safari/iOS, que bloqueia isso incondicionalmente (ITP) independente do
 * SameSite=None. Proxiando `/api/*` a partir do próprio domínio do frontend, o
 * navegador só enxerga um domínio — a chamada deixa de ser cross-site e o cookie
 * vira first-party.
 *
 * Diferença importante em relação ao projeto Gestão Financeira: aqui o backend já
 * espera o prefixo `/api` nas próprias rotas (`server.ts`: `app.use('/api', routes)`),
 * então o proxy repassa o path completo (`/api/...`) para o backend, sem remover
 * o prefixo.
 *
 * Requer a env var `API_ORIGIN` configurada no projeto Cloudflare Pages
 * (Settings → Environment variables), com a URL pública do backend no Render
 * (ex.: https://horas-pj-backend.onrender.com).
 */
interface Env {
  API_ORIGIN: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.API_ORIGIN) {
    return new Response('API_ORIGIN não configurada no ambiente do Cloudflare Pages', {
      status: 500,
    });
  }

  const incomingUrl = new URL(request.url);
  const segments = params.path;
  const path = Array.isArray(segments) ? segments.join('/') : (segments ?? '');
  const targetUrl = new URL(`/api/${path}`, env.API_ORIGIN);
  targetUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstreamRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
  });

  const upstreamResponse = await fetch(upstreamRequest);

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete('set-cookie');

  const proxiedResponse = new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });

  // `Headers` padrão colapsa múltiplos `Set-Cookie` numa string só (inválido
  // para cookies). O runtime do Cloudflare expõe `getSetCookie()` para ler
  // cada um separadamente e o `Response` deles aceita múltiplos `append`.
  const rawHeaders = upstreamResponse.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies =
    typeof rawHeaders.getSetCookie === 'function'
      ? rawHeaders.getSetCookie()
      : rawHeaders.get('set-cookie')
        ? [rawHeaders.get('set-cookie') as string]
        : [];
  for (const cookie of setCookies) {
    proxiedResponse.headers.append('set-cookie', cookie);
  }

  return proxiedResponse;
};
