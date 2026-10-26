export const makeJSONRequest = async <T>({
  url,
  method,
  body,
}: {
  url: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}) => {
  const reqInit: RequestInit = {
    method,
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  }
  const res = await fetch(url, reqInit)

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`)
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
