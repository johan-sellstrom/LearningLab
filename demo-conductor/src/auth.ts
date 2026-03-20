import { createHmac, timingSafeEqual } from 'node:crypto'

export type AuthUser = {
  id: string
  email: string | null
  name: string | null
  picture: string | null
  mode: 'google' | 'open'
}

const AUTH_COOKIE_NAME = 'learninglab_demo_auth'
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12

export function createAuthCookie(user: AuthUser, secret: string, secure: boolean) {
  const payload = Buffer.from(JSON.stringify(user), 'utf8').toString('base64url')
  const signature = sign(payload, secret)
  return serializeCookie(AUTH_COOKIE_NAME, `${payload}.${signature}`, {
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
    secure
  })
}

export function clearAuthCookie(secure: boolean) {
  return serializeCookie(AUTH_COOKIE_NAME, '', {
    maxAge: 0,
    secure
  })
}

export function readAuthCookie(cookieHeader: string | undefined, secret: string): AuthUser | null {
  const cookies = parseCookies(cookieHeader)
  const value = cookies[AUTH_COOKIE_NAME]
  if (!value) return null

  const [payload, signature] = value.split('.')
  if (!payload || !signature) return null
  if (!safeCompare(signature, sign(payload, secret))) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof parsed?.id !== 'string' || !parsed.id) return null
    return {
      id: parsed.id,
      email: typeof parsed.email === 'string' ? parsed.email : null,
      name: typeof parsed.name === 'string' ? parsed.name : null,
      picture: typeof parsed.picture === 'string' ? parsed.picture : null,
      mode: parsed.mode === 'google' ? 'google' : 'open'
    }
  } catch {
    return null
  }
}

export function renderLoginPage({ googleClientId }: { googleClientId: string }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Learning Lab Demo</title>
    <link rel="icon" type="image/png" href="/favicon.png" />
    <style>
      :root {
        color-scheme: light;
        --navy: #023047;
        --navy-deep: #011f31;
        --navy-soft: #0a4c68;
        --gold: #feb306;
        --orange: #ff8300;
        --paper: rgba(255, 255, 255, 0.96);
        --ink: #082b43;
        --muted: #557085;
        --line: rgba(2, 48, 71, 0.16);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          radial-gradient(circle at 15% 15%, rgba(254, 179, 6, 0.24), transparent 28%),
          radial-gradient(circle at 85% 20%, rgba(255, 131, 0, 0.18), transparent 24%),
          radial-gradient(circle at 50% 90%, rgba(10, 76, 104, 0.45), transparent 40%),
          linear-gradient(180deg, #021521 0%, #023047 52%, #011420 100%);
        color: var(--ink);
        font-family: "Avenir Next", "Segoe UI", sans-serif;
      }

      main {
        width: min(100%, 680px);
        padding: 36px;
        background: var(--paper);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 28px;
        box-shadow: 0 32px 80px rgba(0, 12, 20, 0.38);
        overflow: hidden;
      }

      .brand-block {
        margin: -36px -36px 28px;
        padding: 32px 36px 28px;
        background:
          radial-gradient(circle at top right, rgba(254, 179, 6, 0.18), transparent 30%),
          radial-gradient(circle at bottom left, rgba(255, 131, 0, 0.18), transparent 28%),
          linear-gradient(135deg, var(--navy-deep) 0%, var(--navy) 55%, var(--navy-soft) 100%);
        color: white;
      }

      .logo {
        height: 42px;
        width: auto;
        display: block;
        margin-bottom: 22px;
      }

      .eyebrow {
        margin: 0 0 8px;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--gold);
      }

      h1 {
        margin: 0 0 12px;
        font-size: clamp(2rem, 4vw, 2.8rem);
        line-height: 1.05;
      }

      p {
        margin: 0 0 16px;
        color: var(--muted);
        line-height: 1.5;
      }

      .brand-block p {
        color: rgba(255, 255, 255, 0.8);
        max-width: 34rem;
      }

      .login-copy {
        margin-bottom: 22px;
      }

      #google-signin {
        min-height: 44px;
      }

      #login-error {
        min-height: 24px;
        color: var(--orange);
        font-weight: 600;
      }
    </style>
    <script src="https://accounts.google.com/gsi/client" async defer></script>
  </head>
  <body>
    <main>
      <section class="brand-block">
        <img class="logo" src="/brand/Master_iProov_Logo_2024_(White).svg" alt="iProov" />
        <p class="eyebrow">Learning Lab Demo</p>
        <h1>Sign in to start the experience</h1>
        <p>Follow each step with your own session, from credential issuance to iProov liveness and selective disclosure.</p>
      </section>
      <p class="login-copy">Google sign-in gives you a personal session so your credentials, proofs, and progress stay separate during the demo.</p>
      <div id="google-signin"></div>
      <p id="login-error" role="status" aria-live="polite"></p>
    </main>
    <script>
      async function handleCredentialResponse(response) {
        const errorNode = document.getElementById('login-error')
        errorNode.textContent = ''
        try {
          const login = await fetch('/auth/google', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ credential: response.credential })
          })
          const payload = await login.json()
          if (!login.ok) {
            errorNode.textContent = payload.error || 'Google sign-in failed.'
            return
          }
          window.location.href = '/'
        } catch (error) {
          errorNode.textContent = error?.message || 'Google sign-in failed.'
        }
      }

      window.onload = () => {
        google.accounts.id.initialize({
          client_id: ${JSON.stringify(googleClientId)},
          callback: handleCredentialResponse
        })
        google.accounts.id.renderButton(
          document.getElementById('google-signin'),
          { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill' }
        )
        google.accounts.id.prompt()
      }
    </script>
  </body>
</html>`
}

function parseCookies(cookieHeader: string | undefined) {
  return Object.fromEntries(
    String(cookieHeader || '')
      .split(/;\s*/)
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf('=')
        if (index === -1) return [entry, '']
        return [entry.slice(0, index), decodeURIComponent(entry.slice(index + 1))]
      })
  )
}

function serializeCookie(name: string, value: string, options: { maxAge: number; secure: boolean }) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${options.maxAge}`
  ]
  if (options.secure) parts.push('Secure')
  return parts.join('; ')
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}
