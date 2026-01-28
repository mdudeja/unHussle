export const makeJSONRequest = async <T>({
  url,
  method,
  body,
}: {
  url: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: any
}) => {
  try {
    const res = await fetch(url, {
      method,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }

    return res.json() as T
  } catch (err) {
    console.error(err)
    throw err
  }
}

export const makeTextRequest = async ({
  url,
  method,
  body,
}: {
  url: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: any
}) => {
  try {
    const res = await fetch(url, {
      method,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`)
    }

    return res.text()
  } catch (err) {
    console.error(err)
    throw err
  }
}
