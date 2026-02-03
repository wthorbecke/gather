'use client'

import { useState } from 'react'
import { Modal } from './Modal'
import {
  SavedLocation,
  LocationTrigger,
  LocationTriggerType,
  formatLocationName,
} from '@/lib/location'

interface LocationTriggerPickerProps {
  isOpen: boolean
  onClose: () => void
  savedLocations: SavedLocation[]
  currentTrigger: LocationTrigger | null | undefined
  onSave: (trigger: LocationTrigger | null) => void
  onManageLocations: () => void
}

/**
 * LocationTriggerPicker - Modal for setting location-based triggers on tasks
 *
 * Allows users to:
 * - Select a saved location
 * - Choose arriving/leaving trigger type
 * - Enable/disable the trigger
 */
export function LocationTriggerPicker({
  isOpen,
  onClose,
  savedLocations,
  currentTrigger,
  onSave,
  onManageLocations,
}: LocationTriggerPickerProps) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    currentTrigger?.locationId || null
  )
  const [triggerType, setTriggerType] = useState<LocationTriggerType>(
    currentTrigger?.triggerType || LocationTriggerType.ARRIVING
  )

  const handleSave = () => {
    if (!selectedLocationId) {
      onSave(null)
    } else {
      onSave({
        locationId: selectedLocationId,
        triggerType,
        enabled: true,
      })
    }
    onClose()
  }

  const handleRemove = () => {
    onSave(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Location Reminder"
      maxWidth="400px"
    >
      <div className="p-5 space-y-5">
        {/* Empty state */}
        {savedLocations.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface flex items-center justify-center">
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <p className="text-text-soft mb-2">No saved locations yet</p>
            <p className="text-sm text-text-muted mb-4">
              Add locations like home or work to get reminded when you arrive or leave.
            </p>
            <button
              onClick={onManageLocations}
              className="px-4 py-2.5 bg-accent text-white rounded-xl font-medium hover:bg-accent/90 transition-colors"
            >
              Add a location
            </button>
          </div>
        ) : (
          <>
            {/* Location selection */}
            <div>
              <label className="block text-sm font-medium text-text-soft mb-2">
                Remind me at
              </label>
              <div className="space-y-2">
                {savedLocations.map((location) => (
                  <button
                    key={location.id}
                    onClick={() => setSelectedLocationId(location.id)}
                    className={`
                      w-full p-4 rounded-xl border-2 text-left
                      transition-all duration-150
                      ${
                        selectedLocationId === location.id
                          ? 'border-accent bg-accent/10'
                          : 'border-border bg-surface hover:border-text-muted'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center
                        ${selectedLocationId === location.id ? 'bg-accent/20' : 'bg-card'}
                      `}>
                        {location.preset === 'home' ? (
                          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={selectedLocationId === location.id ? 'text-accent' : 'text-text-muted'}>
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                          </svg>
                        ) : location.preset === 'work' ? (
                          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={selectedLocationId === location.id ? 'text-accent' : 'text-text-muted'}>
                            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
                            <path d="M10 6h4"/>
                            <path d="M10 10h4"/>
                            <path d="M10 14h4"/>
                            <path d="M10 18h4"/>
                          </svg>
                        ) : (
                          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={selectedLocationId === location.id ? 'text-accent' : 'text-text-muted'}>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-text truncate">
                          {formatLocationName(location)}
                        </div>
                        {location.address && (
                          <div className="text-sm text-text-muted truncate">
                            {location.address}
                          </div>
                        )}
                      </div>
                      {selectedLocationId === location.id && (
                        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent flex-shrink-0">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}

                {/* Add new location button */}
                <button
                  onClick={onManageLocations}
                  className="
                    w-full p-4 rounded-xl border-2 border-dashed border-border
                    text-text-muted hover:text-text hover:border-text-muted
                    transition-colors flex items-center justify-center gap-2
                  "
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add new location
                </button>
              </div>
            </div>

            {/* Trigger type selection */}
            {selectedLocationId && (
              <div>
                <label className="block text-sm font-medium text-text-soft mb-2">
                  When should I remind you?
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTriggerType(LocationTriggerType.ARRIVING)}
                    className={`
                      flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium
                      transition-all duration-150
                      ${
                        triggerType === LocationTriggerType.ARRIVING
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-surface text-text-soft hover:border-text-muted'
                      }
                    `}
                  >
                    <span className="block text-lg mb-0.5">Arriving</span>
                    <span className="block text-xs text-text-muted">When I get there</span>
                  </button>
                  <button
                    onClick={() => setTriggerType(LocationTriggerType.LEAVING)}
                    className={`
                      flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium
                      transition-all duration-150
                      ${
                        triggerType === LocationTriggerType.LEAVING
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-surface text-text-soft hover:border-text-muted'
                      }
                    `}
                  >
                    <span className="block text-lg mb-0.5">Leaving</span>
                    <span className="block text-xs text-text-muted">When I depart</span>
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {currentTrigger && (
                <button
                  onClick={handleRemove}
                  className="px-4 py-3 text-danger hover:bg-danger/10 rounded-xl font-medium transition-colors"
                >
                  Remove
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-surface text-text-soft rounded-xl font-medium hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="
                  flex-1 py-3 bg-accent text-white rounded-xl font-medium
                  hover:bg-accent/90 transition-colors
                "
              >
                {currentTrigger ? 'Update' : selectedLocationId ? 'Set reminder' : 'Done'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
