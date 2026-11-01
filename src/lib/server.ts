export const makeJSONRequest = async <T>({
  url,
  method,
  body,
  headers,
}: {
  url: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}) => {
  const reqInit: RequestInit = {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
  }
  const res = await fetch(url, reqInit)

  if (!res.ok) {
    // Prefer the server's explanation (e.g. a scheduling conflict) when it sends one.
    const error = (await res.json().catch(() => null)) as {
      message?: unknown
    } | null
    throw new Error(
      typeof error?.message === 'string'
        ? error.message
        : `HTTP error! status: ${res.status}`,
    )
  }

  return (await res.json()) as T
}

export const makeTextRequest = async ({
  url,
  method,
  body,
}: {
  url: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}) => {
  const res = await fetch(url, {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/plain',
    },
  })

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`)
  }

  return res.text()
}
