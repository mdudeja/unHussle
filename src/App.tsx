import { useState } from 'react'
import reactLogo from './assets/react.svg'
import { invoke } from '@tauri-apps/api/core'
import '@/styles/App.css'
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus'

function App() {
  const [greetMsg, setGreetMsg] = useState('')
  const [name, setName] = useState('')
  const { isReady, error } = useDatabaseStatus()

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke('greet', { name }))
  }

  if (error) {
    return (
      <main className="container">
        <h1>Database Error</h1>
        <p style={{ color: 'red' }}>{error}</p>
        <p>Please restart the application.</p>
      </main>
    )
  }

  if (!isReady) {
    return (
      <main className="container">
        <h1>Loading...</h1>
        <p>Initializing database...</p>
      </main>
    )
  }

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          greet()
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  )
}

export default App
