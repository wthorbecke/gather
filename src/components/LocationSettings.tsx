'use client'

import { useState } from 'react'
import { SavedLocation, formatLocationName, LocationPreset } from '@/lib/location'

interface LocationSettingsProps {
  permission: 'granted' | 'denied' | 'prompt' | 'unsupported'
  isTracking: boolean
  savedLocations: SavedLocation[]
  onRequestPermission: () => Promise<boolean>
  onStartTracking: () => void
  onStopTracking: () => void
  onAddLocation: () => void
  onEditLocation: (location: SavedLocation) => void
}

/**
 * LocationSettings - Location management section for settings modal
 *
 * Displays:
 * - Current permission status
 * - Tracking toggle
 * - List of saved locations
 */
export function LocationSettings({
  permission,
  isTracking,
  savedLocations,
  onRequestPermission,
  onStartTracking,
  onStopTracking,
  onAddLocation,
  onEditLocation,
}: LocationSettingsProps) {
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true)
    await onRequestPermission()
    setIsRequestingPermission(false)
  }

  const getPermissionStatusText = () => {
    switch (permission) {
      case 'granted':
        return 'Location access enabled'
      case 'denied':
        return 'Location access denied'
      case 'prompt':
        return 'Location access not requested'
      case 'unsupported':
        return 'Location not supported on this device'
    }
  }

  const getPermissionStatusColor = () => {
    switch (permission) {
      case 'granted':
        return 'text-success'
      case 'denied':
        return 'text-danger'
      default:
        return 'text-text-muted'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-accent-soft flex items-center justify-center">
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div>
          <h3 className="font-medium text-text">Location Reminders</h3>
          <p className={`text-sm ${getPermissionStatusColor()}`}>
            {getPermissionStatusText()}
          </p>
        </div>
      </div>

      {/* Permission request button */}
      {permission === 'prompt' && (
        <button
          onClick={handleRequestPermission}
          disabled={isRequestingPermission}
          className="
            w-full py-3 bg-accent text-white rounded-xl
            font-medium hover:bg-accent/90 transition-colors
            disabled:opacity-50
          "
        >
          {isRequestingPermission ? 'Requesting...' : 'Enable location reminders'}
        </button>
      )}

      {/* Denied state */}
      {permission === 'denied' && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl">
          <p className="text-sm text-danger mb-2">
            Location access was denied.
          </p>
          <p className="text-sm text-text-muted">
            To use location reminders, enable location access in your browser settings for this site.
          </p>
        </div>
      )}

      {/* Tracking toggle */}
      {permission === 'granted' && (
        <div className="flex items-center justify-between p-4 bg-surface rounded-xl">
          <div>
            <div className="font-medium text-text">Location monitoring</div>
            <div className="text-sm text-text-muted">
              {isTracking ? 'Actively checking your location' : 'Not currently tracking'}
            </div>
          </div>
          <button
            onClick={isTracking ? onStopTracking : onStartTracking}
            className={`
              relative w-12 h-7 rounded-full transition-colors duration-200
              ${isTracking ? 'bg-accent' : 'bg-surface border border-border'}
            `}
            role="switch"
            aria-checked={isTracking}
          >
            <span
              className={`
                absolute top-1 w-5 h-5 rounded-full bg-white shadow
                transition-transform duration-200
                ${isTracking ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      )}

      {/* Saved locations list */}
      {permission === 'granted' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-text-soft">Saved Locations</h4>
            <button
              onClick={onAddLocation}
              className="text-sm text-accent hover:text-accent/80 transition-colors"
            >
              Add location
            </button>
          </div>

          {savedLocations.length === 0 ? (
            <div className="p-6 bg-surface rounded-xl text-center">
              <p className="text-text-muted mb-2">No locations saved yet</p>
              <p className="text-sm text-text-muted">
                Add your home, work, or favorite places to get location-based reminders.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedLocations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => onEditLocation(location)}
                  className="
                    w-full p-4 bg-surface rounded-xl
                    flex items-center gap-3
                    hover:bg-card-hover transition-colors
                    text-left
                  "
                >
                  <div className="w-10 h-10 rounded-full bg-card flex items-center justify-center flex-shrink-0">
                    {location.preset === LocationPreset.HOME ? (
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    ) : location.preset === LocationPreset.WORK ? (
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                        <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                        <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                        <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
                        <path d="M10 6h4"/>
                        <path d="M10 10h4"/>
                        <path d="M10 14h4"/>
                        <path d="M10 18h4"/>
                      </svg>
                    ) : (
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
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
                    <div className="text-xs text-text-muted">
                      {location.radius}m radius
                    </div>
                  </div>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted flex-shrink-0">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Privacy note */}
      {permission === 'granted' && (
        <p className="text-xs text-text-muted">
          Location is only checked when the app is open. Your location data stays on your device and is never sent to our servers.
        </p>
      )}
    </div>
  )
}
