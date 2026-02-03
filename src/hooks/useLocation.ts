'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { safeGetJSON, safeSetJSON, safeGetItem, safeSetItem } from '@/lib/storage'
import {
  SavedLocation,
  LocationTrigger,
  LocationPermission,
  LocationPreset,
  DEFAULT_GEOFENCE_RADIUS,
  LOCATION_STORAGE_KEYS,
  MIN_TRIGGER_INTERVAL,
  isWithinGeofence,
} from '@/lib/location'
import type { Task } from '@/hooks/useUserData'

interface UseLocationOptions {
  enabled?: boolean
  tasks?: Task[]
  onLocationTrigger?: (task: Task, location: SavedLocation) => void
}

interface UseLocationReturn {
  // Permission state
  permission: LocationPermission
  permissionDismissed: boolean
  requestPermission: () => Promise<boolean>
  dismissPermissionPrompt: () => void

  // Current position
  currentPosition: GeolocationPosition | null
  positionError: string | null
  isTracking: boolean
  startTracking: () => void
  stopTracking: () => void

  // Saved locations
  savedLocations: SavedLocation[]
  addLocation: (location: Omit<SavedLocation, 'id' | 'createdAt'>) => SavedLocation
  updateLocation: (id: string, updates: Partial<SavedLocation>) => void
  deleteLocation: (id: string) => void
  getLocationById: (id: string) => SavedLocation | undefined

  // Geofence state
  currentLocationMatches: SavedLocation[]
}

/**
 * Hook for managing location services and geofencing
 *
 * Features:
 * - Request and track location permission
 * - Save named locations (home, work, custom)
 * - Monitor current position
 * - Detect when user enters/leaves geofenced areas
 * - Trigger callbacks for location-based task reminders
 */
export function useLocation({
  enabled = true,
  tasks = [],
  onLocationTrigger,
}: UseLocationOptions = {}): UseLocationReturn {
  // Permission state
  const [permission, setPermission] = useState<LocationPermission>('prompt')
  const [permissionDismissed, setPermissionDismissed] = useState(false)

  // Position state
  const [currentPosition, setCurrentPosition] = useState<GeolocationPosition | null>(null)
  const [positionError, setPositionError] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)

  // Saved locations
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([])

  // Geofence tracking
  const [currentLocationMatches, setCurrentLocationMatches] = useState<SavedLocation[]>([])
  const previousMatchesRef = useRef<Set<string>>(new Set())
  const watchIdRef = useRef<number | null>(null)
  const triggeredTasksRef = useRef<Map<string, number>>(new Map()) // taskId -> lastTriggeredTime

  // Initialize - check permission and load saved data
  useEffect(() => {
    // Check if geolocation is supported
    if (!('geolocation' in navigator)) {
      setPermission('unsupported')
      return
    }

    // Check if permission was dismissed
    const dismissed = safeGetItem(LOCATION_STORAGE_KEYS.LOCATION_PERMISSION_DISMISSED)
    if (dismissed === 'true') {
      setPermissionDismissed(true)
    }

    // Load saved locations
    const stored = safeGetJSON<SavedLocation[]>(LOCATION_STORAGE_KEYS.SAVED_LOCATIONS, [])
    setSavedLocations(stored)

    // Check current permission state
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermission(result.state as LocationPermission)

        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermission(result.state as LocationPermission)
        })
      }).catch(() => {
        // Permissions API not fully supported, default to prompt
        setPermission('prompt')
      })
    }
  }, [])

  // Request location permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!('geolocation' in navigator)) {
      setPermission('unsupported')
      return false
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPermission('granted')
          setCurrentPosition(position)
          setPositionError(null)
          resolve(true)
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setPermission('denied')
          }
          setPositionError(error.message)
          resolve(false)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }, [])

  // Dismiss permission prompt
  const dismissPermissionPrompt = useCallback(() => {
    safeSetItem(LOCATION_STORAGE_KEYS.LOCATION_PERMISSION_DISMISSED, 'true')
    setPermissionDismissed(true)
  }, [])

  // Start tracking location
  const startTracking = useCallback(() => {
    if (!('geolocation' in navigator) || permission !== 'granted') {
      return
    }

    if (watchIdRef.current !== null) {
      return // Already tracking
    }

    setIsTracking(true)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition(position)
        setPositionError(null)

        // Save last known position
        safeSetJSON(LOCATION_STORAGE_KEYS.LAST_KNOWN_POSITION, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
        })
      },
      (error) => {
        setPositionError(error.message)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000, // Accept positions up to 30s old
        timeout: 30000,
      }
    )
  }, [permission])

  // Stop tracking location
  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  // Auto-start tracking if enabled and permitted
  useEffect(() => {
    if (enabled && permission === 'granted' && savedLocations.length > 0) {
      startTracking()
    } else {
      stopTracking()
    }
  }, [enabled, permission, savedLocations.length, startTracking, stopTracking])

  // Check geofences when position updates
  useEffect(() => {
    if (!currentPosition || savedLocations.length === 0) {
      setCurrentLocationMatches([])
      return
    }

    const { latitude, longitude } = currentPosition.coords
    const matches: SavedLocation[] = []

    for (const location of savedLocations) {
      if (isWithinGeofence(latitude, longitude, location.latitude, location.longitude, location.radius)) {
        matches.push(location)
      }
    }

    setCurrentLocationMatches(matches)

    // Check for enter/leave transitions and trigger callbacks
    const currentMatchIds = new Set(matches.map((l) => l.id))
    const previousMatchIds = previousMatchesRef.current

    // Find newly entered locations
    const enteredLocations = matches.filter((l) => !previousMatchIds.has(l.id))

    // Find newly left locations
    const leftLocationIds = Array.from(previousMatchIds).filter((id) => !currentMatchIds.has(id))
    const leftLocations = savedLocations.filter((l) => leftLocationIds.includes(l.id))

    // Trigger callbacks for tasks with location triggers
    if (onLocationTrigger && tasks.length > 0) {
      const now = Date.now()

      for (const task of tasks) {
        const trigger = task.locationTrigger
        if (!trigger?.enabled) continue

        const location = savedLocations.find((l) => l.id === trigger.locationId)
        if (!location) continue

        // Check if this task was recently triggered
        const lastTriggered = triggeredTasksRef.current.get(task.id) || 0
        if (now - lastTriggered < MIN_TRIGGER_INTERVAL) continue

        // Check for arriving trigger
        if (trigger.triggerType === 'arriving' && enteredLocations.some((l) => l.id === trigger.locationId)) {
          onLocationTrigger(task, location)
          triggeredTasksRef.current.set(task.id, now)
        }

        // Check for leaving trigger
        if (trigger.triggerType === 'leaving' && leftLocations.some((l) => l.id === trigger.locationId)) {
          onLocationTrigger(task, location)
          triggeredTasksRef.current.set(task.id, now)
        }
      }
    }

    previousMatchesRef.current = currentMatchIds
  }, [currentPosition, savedLocations, tasks, onLocationTrigger])

  // Add a new saved location
  const addLocation = useCallback((location: Omit<SavedLocation, 'id' | 'createdAt'>): SavedLocation => {
    const newLocation: SavedLocation = {
      ...location,
      id: `loc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date().toISOString(),
    }

    setSavedLocations((prev) => {
      const updated = [...prev, newLocation]
      safeSetJSON(LOCATION_STORAGE_KEYS.SAVED_LOCATIONS, updated)
      return updated
    })

    return newLocation
  }, [])

  // Update a saved location
  const updateLocation = useCallback((id: string, updates: Partial<SavedLocation>) => {
    setSavedLocations((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
      safeSetJSON(LOCATION_STORAGE_KEYS.SAVED_LOCATIONS, updated)
      return updated
    })
  }, [])

  // Delete a saved location
  const deleteLocation = useCallback((id: string) => {
    setSavedLocations((prev) => {
      const updated = prev.filter((l) => l.id !== id)
      safeSetJSON(LOCATION_STORAGE_KEYS.SAVED_LOCATIONS, updated)
      return updated
    })
  }, [])

  // Get a location by ID
  const getLocationById = useCallback(
    (id: string): SavedLocation | undefined => {
      return savedLocations.find((l) => l.id === id)
    },
    [savedLocations]
  )

  return {
    // Permission
    permission,
    permissionDismissed,
    requestPermission,
    dismissPermissionPrompt,

    // Position
    currentPosition,
    positionError,
    isTracking,
    startTracking,
    stopTracking,

    // Saved locations
    savedLocations,
    addLocation,
    updateLocation,
    deleteLocation,
    getLocationById,

    // Geofence state
    currentLocationMatches,
  }
}

// Export types
export type { SavedLocation, LocationTrigger, LocationPermission }
export { LocationPreset, DEFAULT_GEOFENCE_RADIUS }
