'use client'

import { useState } from 'react'

interface SpacePanelProps {
  zoneTasks: Record<string, boolean>
  onToggleTask: (taskId: string) => void
}

interface Zone {
  id: string
  name: string
  tasks: { id: string; name: string }[]
}

export function SpacePanel({ zoneTasks, onToggleTask }: SpacePanelProps) {
  const [zones, setZones] = useState<Zone[]>([])
  const [showAddZone, setShowAddZone] = useState(false)
  const [newZoneName, setNewZoneName] = useState('')
  const [addingTaskToZone, setAddingTaskToZone] = useState<string | null>(null)
  const [newTaskName, setNewTaskName] = useState('')

  const addZone = () => {
    if (!newZoneName.trim()) return
    const id = `zone_${Date.now()}`
    setZones([...zones, { id, name: newZoneName.trim(), tasks: [] }])
    setNewZoneName('')
    setShowAddZone(false)
  }

  const addTaskToZone = (zoneId: string) => {
    if (!newTaskName.trim()) return
    const taskId = `task_${Date.now()}`
    setZones(zones.map(z =>
      z.id === zoneId
        ? { ...z, tasks: [...z.tasks, { id: taskId, name: newTaskName.trim() }] }
        : z
    ))
    setNewTaskName('')
    setAddingTaskToZone(null)
  }

  const getZoneProgress = (zone: Zone) => {
    const done = zone.tasks.filter((t) => zoneTasks[t.id]).length
    return `${done}/${zone.tasks.length}`
  }

  // Empty state
  if (zones.length === 0 && !showAddZone) {
    return (
      <div className="animate-fade-in">
        <div className="text-center py-12">
          <div className="text-4xl mb-4 opacity-50">🏠</div>
          <p className="text-[var(--text-soft)] mb-2">No spaces set up yet.</p>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            Create zones for different areas you want to organize.
          </p>
          <button
            onClick={() => setShowAddZone(true)}
            className="px-6 py-3 bg-[var(--text)] text-white rounded-xl text-[0.9rem] hover:bg-[var(--text-soft)] transition-colors"
          >
            + Add a zone
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <p className="text-[0.95rem] text-[var(--text-soft)] mb-6 leading-relaxed">
        Your space should feel like yours. One zone at a time.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="bg-white border border-[var(--border-light)] rounded-2xl p-5"
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-[var(--border-light)]">
              <h3 className="font-serif text-lg font-medium">{zone.name}</h3>
              <span className="text-[0.8rem] text-[var(--text-muted)]">{getZoneProgress(zone)}</span>
            </div>
            <div className="flex flex-col gap-1">
              {zone.tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onToggleTask(task.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-[0.9rem] transition-all hover:bg-[var(--bg-warm)] ${
                    zoneTasks[task.id] ? 'opacity-50 line-through' : ''
                  }`}
                >
                  <div
                    className={`w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 transition-all ${
                      zoneTasks[task.id]
                        ? 'bg-[var(--sage)] border-[var(--sage)]'
                        : 'border-[var(--border)]'
                    }`}
                  />
                  <span>{task.name}</span>
                </div>
              ))}

              {addingTaskToZone === zone.id ? (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="Task name"
                    className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-[0.85rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addTaskToZone(zone.id)
                      if (e.key === 'Escape') setAddingTaskToZone(null)
                    }}
                  />
                  <button
                    onClick={() => addTaskToZone(zone.id)}
                    className="px-3 py-2 bg-[var(--sage)] text-white rounded-lg text-[0.85rem]"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTaskToZone(zone.id)}
                  className="text-[0.8rem] text-[var(--text-muted)] hover:text-[var(--accent)] mt-2 text-left px-3"
                >
                  + Add task
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add zone card */}
        {showAddZone ? (
          <div className="bg-white border border-[var(--border-light)] rounded-2xl p-5">
            <input
              type="text"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              placeholder="Zone name (e.g., Kitchen, Closet)"
              className="w-full px-4 py-3 border border-[var(--border)] rounded-xl text-[0.95rem] bg-[var(--bg)] focus:outline-none focus:border-[var(--accent)] mb-3"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') addZone()
                if (e.key === 'Escape') setShowAddZone(false)
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={addZone}
                className="flex-1 py-2.5 bg-[var(--text)] text-white rounded-lg text-[0.85rem]"
              >
                Create zone
              </button>
              <button
                onClick={() => setShowAddZone(false)}
                className="px-4 py-2.5 border border-[var(--border)] text-[var(--text-muted)] rounded-lg text-[0.85rem]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddZone(true)}
            className="border-2 border-dashed border-[var(--border)] rounded-2xl p-8 text-center hover:border-[var(--accent-soft)] hover:bg-[var(--bg-warm)] transition-all"
          >
            <div className="text-2xl mb-2 opacity-50">+</div>
            <div className="text-[0.9rem] text-[var(--text-muted)]">Add zone</div>
          </button>
        )}
      </div>
    </div>
  )
}
