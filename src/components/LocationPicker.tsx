'use client'

import { useState, useCallback, useEffect } from 'react'
import { Modal } from './Modal'
import {
  SavedLocation,
  LocationPreset,
  DEFAULT_GEOFENCE_RADIUS,
} from '@/lib/location'

interface LocationPickerProps {
  isOpen: boolean
  onClose: () => void
  savedLocations: SavedLocation[]
  onAddLocation: (location: Omit<SavedLocation, 'id' | 'createdAt'>) => SavedLocation
  onUpdateLocation: (id: string, updates: Partial<SavedLocation>) => void
  onDeleteLocation: (id: string) => void
  permission: 'granted' | 'denied' | 'prompt' | 'unsupported'
  onRequestPermission: () => Promise<boolean>
  currentPosition: GeolocationPosition | null
  editingLocation?: SavedLocation | null
}

/**
 * LocationPicker - Modal for managing saved locations
 *
 * Allows users to:
 * - Add new locations (home, work, custom)
 * - Use current location or enter manually
 * - Edit and delete existing locations
 * - Adjust geofence radius
 */
export function LocationPicker({
  isOpen,
  onClose,
  savedLocations,
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation,
  permission,
  onRequestPermission,
  currentPosition,
  editingLocation,
}: LocationPickerProps) {
  // Form state
  const [name, setName] = useState('')
  const [preset, setPreset] = useState<LocationPreset>(LocationPreset.CUSTOM)
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [radius, setRadius] = useState(DEFAULT_GEOFENCE_RADIUS.toString())
  const [address, setAddress] = useState('')
  const [isUsingCurrentLocation, setIsUsingCurrentLocation] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Initialize form when editing
  useEffect(() => {
    if (editingLocation) {
      setName(editingLocation.name)
      setPreset(editingLocation.preset)
      setLatitude(editingLocation.latitude.toString())
      setLongitude(editingLocation.longitude.toString())
      setRadius(editingLocation.radius.toString())
      setAddress(editingLocation.address || '')
    } else {
      resetForm()
    }
  }, [editingLocation, isOpen])

  const resetForm = () => {
    setName('')
    setPreset(LocationPreset.CUSTOM)
    setLatitude('')
    setLongitude('')
    setRadius(DEFAULT_GEOFENCE_RADIUS.toString())
    setAddress('')
    setIsUsingCurrentLocation(false)
    setShowDeleteConfirm(false)
  }

  // Use current location
  const useCurrentLocation = useCallback(async () => {
    if (permission !== 'granted') {
      const granted = await onRequestPermission()
      if (!granted) return
    }

    if (currentPosition) {
      setLatitude(currentPosition.coords.latitude.toString())
      setLongitude(currentPosition.coords.longitude.toString())
      setIsUsingCurrentLocation(true)
    }
  }, [permission, onRequestPermission, currentPosition])

  // Handle preset selection
  const handlePresetChange = (newPreset: LocationPreset) => {
    setPreset(newPreset)
    if (newPreset === LocationPreset.HOME) {
      setName('Home')
    } else if (newPreset === LocationPreset.WORK) {
      setName('Work')
    } else {
      setName('')
    }
  }

  // Validate form
  const isValid = () => {
    if (!name.trim()) return false
    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)
    const rad = parseInt(radius, 10)
    if (isNaN(lat) || lat < -90 || lat > 90) return false
    if (isNaN(lon) || lon < -180 || lon > 180) return false
    if (isNaN(rad) || rad < 50 || rad > 5000) return false
    return true
  }

  // Save location
  const handleSave = () => {
    if (!isValid()) return

    setIsSaving(true)

    const locationData = {
      name: name.trim(),
      preset,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      radius: parseInt(radius, 10),
      address: address.trim() || undefined,
    }

    if (editingLocation) {
      onUpdateLocation(editingLocation.id, locationData)
    } else {
      onAddLocation(locationData)
    }

    setIsSaving(false)
    onClose()
    resetForm()
  }

  // Delete location
  const handleDelete = () => {
    if (!editingLocation) return
    onDeleteLocation(editingLocation.id)
    onClose()
    resetForm()
  }

  // Check if home/work already exist
  const hasHome = savedLocations.some((l) => l.preset === LocationPreset.HOME)
  const hasWork = savedLocations.some((l) => l.preset === LocationPreset.WORK)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingLocation ? 'Edit Location' : 'Add Location'}
      maxWidth="400px"
    >
      <div className="p-5 space-y-5">
        {/* Location Type Selector */}
        <div>
          <label className="block text-sm font-medium text-text-soft mb-2">
            Location type
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handlePresetChange(LocationPreset.HOME)}
              disabled={hasHome && !editingLocation}
              className={`
                flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium
                transition-all duration-150
                ${
                  preset === LocationPreset.HOME
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface text-text-soft hover:border-text-muted'
                }
                ${hasHome && !editingLocation ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span className="block text-lg mb-0.5">Home</span>
              <span className="block text-xs text-text-muted">Your residence</span>
            </button>
            <button
              onClick={() => handlePresetChange(LocationPreset.WORK)}
              disabled={hasWork && !editingLocation}
              className={`
                flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium
                transition-all duration-150
                ${
                  preset === LocationPreset.WORK
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface text-text-soft hover:border-text-muted'
                }
                ${hasWork && !editingLocation ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <span className="block text-lg mb-0.5">Work</span>
              <span className="block text-xs text-text-muted">Your workplace</span>
            </button>
            <button
              onClick={() => handlePresetChange(LocationPreset.CUSTOM)}
              className={`
                flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium
                transition-all duration-150
                ${
                  preset === LocationPreset.CUSTOM
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border bg-surface text-text-soft hover:border-text-muted'
                }
              `}
            >
              <span className="block text-lg mb-0.5">Custom</span>
              <span className="block text-xs text-text-muted">Any place</span>
            </button>
          </div>
        </div>

        {/* Name Input */}
        {preset === LocationPreset.CUSTOM && (
          <div>
            <label className="block text-sm font-medium text-text-soft mb-2">
              Location name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Grocery store, Gym, Mom's house"
              className="
                w-full px-4 py-3 rounded-xl
                bg-surface border border-border
                text-text placeholder:text-text-muted
                focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
                transition-colors
              "
            />
          </div>
        )}

        {/* Coordinates */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-text-soft">
              Coordinates
            </label>
            {permission !== 'unsupported' && (
              <button
                onClick={useCurrentLocation}
                className="text-sm text-accent hover:text-accent/80 transition-colors"
              >
                {isUsingCurrentLocation ? 'Using current location' : 'Use current location'}
              </button>
            )}
          </div>

          {permission === 'denied' && (
            <p className="text-sm text-text-muted mb-2">
              Location access was denied. You can enter coordinates manually or enable location in your browser settings.
            </p>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={latitude}
                onChange={(e) => {
                  setLatitude(e.target.value)
                  setIsUsingCurrentLocation(false)
                }}
                placeholder="Latitude"
                className="
                  w-full px-4 py-3 rounded-xl
                  bg-surface border border-border
                  text-text placeholder:text-text-muted
                  focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
                  transition-colors font-mono text-sm
                "
              />
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={longitude}
                onChange={(e) => {
                  setLongitude(e.target.value)
                  setIsUsingCurrentLocation(false)
                }}
                placeholder="Longitude"
                className="
                  w-full px-4 py-3 rounded-xl
                  bg-surface border border-border
                  text-text placeholder:text-text-muted
                  focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
                  transition-colors font-mono text-sm
                "
              />
            </div>
          </div>
        </div>

        {/* Address (optional) */}
        <div>
          <label className="block text-sm font-medium text-text-soft mb-2">
            Address <span className="text-text-muted">(optional)</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g., 123 Main St"
            className="
              w-full px-4 py-3 rounded-xl
              bg-surface border border-border
              text-text placeholder:text-text-muted
              focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
              transition-colors
            "
          />
        </div>

        {/* Radius */}
        <div>
          <label className="block text-sm font-medium text-text-soft mb-2">
            Trigger radius: {radius}m
          </label>
          <input
            type="range"
            min="50"
            max="500"
            step="25"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>50m</span>
            <span>500m</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          {editingLocation && (
            <>
              {showDeleteConfirm ? (
                <div className="flex-1 flex gap-2">
                  <button
                    onClick={handleDelete}
                    className="flex-1 py-3 bg-danger text-white rounded-xl font-medium hover:bg-danger/90 transition-colors"
                  >
                    Confirm delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-3 bg-surface text-text-soft rounded-xl font-medium hover:bg-card-hover transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-3 text-danger hover:bg-danger/10 rounded-xl font-medium transition-colors"
                >
                  Delete
                </button>
              )}
            </>
          )}

          {!showDeleteConfirm && (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-surface text-text-soft rounded-xl font-medium hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!isValid() || isSaving}
                className="
                  flex-1 py-3 bg-accent text-white rounded-xl font-medium
                  hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                {isSaving ? 'Saving...' : editingLocation ? 'Save changes' : 'Add location'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
