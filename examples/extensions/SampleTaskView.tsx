import { useExtensionEntries } from '@/extensions/sdk'

export function SampleTaskView() {
  const tasks = useExtensionEntries('tasks')
  return (
    <>
      <h1>Sample tasks</h1>
      {tasks.isLoading ? (
        <p>Loading…</p>
      ) : (
        <ul>
          {tasks.data?.map((task) => (
            <li key={task.id}>{task.title}</li>
          ))}
        </ul>
      )}
    </>
  )
}
