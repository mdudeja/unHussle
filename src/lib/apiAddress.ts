/** Every local API client uses the same address, including the SSE connection. */
export const apiAddress = (path = '') =>
  `http://localhost:${import.meta.env.VITE_DB_SERVER_PORT || '3456'}${path ? `/${path.replace(/^\//, '')}` : ''}`
