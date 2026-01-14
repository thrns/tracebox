'use client'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  if (typeof window !== 'undefined') {
    console.error('[global-error]', error?.message ?? error)
    if (error?.stack) console.error('[global-error] Stack:', error.stack)
  }

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          {error?.message ?? 'Internal server error'}
        </p>
        <a
          href="/login"
          style={{
            display: 'inline-block',
            padding: '0.5rem 1rem',
            background: '#333',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '6px',
          }}
        >
          Go to login
        </a>
      </body>
    </html>
  )
}
