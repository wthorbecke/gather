/**
 * Location Constants and Types
 *
 * Types and utilities for location-based reminders.
 */

// Location trigger types - when to remind the user
export const LocationTriggerType = {
  ARRIVING: 'arriving',   // When entering the geofence
  LEAVING: 'leaving',     // When leaving the geofence
} as const

export type LocationTriggerType = typeof LocationTriggerType[keyof typeof LocationTriggerType]

// Preset location types
export const LocationPreset = {
  HOME: 'home',
  WORK: 'work',
  CUSTOM: 'custom',
} as const

export type LocationPreset = typeof LocationPreset[keyof typeof LocationPreset]

// A saved location
export interface SavedLocation {
  id: string
  name: string
  preset: LocationPreset
  latitude: number
  longitude: number
  radius: number // meters - geofence radius
  address?: string // Human-readable address
  createdAt: string
}

// A location trigger attached to a task
export interface LocationTrigger {
  locationId: string
  triggerType: LocationTriggerType
  enabled: boolean
  lastTriggered?: string // ISO date - to prevent spamming
}

// Location permission status
export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unsupported'

// Default geofence radius in meters
export const DEFAULT_GEOFENCE_RADIUS = 150

// Minimum time between triggering the same location reminder (4 hours)
export const MIN_TRIGGER_INTERVAL = 4 * 60 * 60 * 1000

// Storage keys
export const LOCATION_STORAGE_KEYS = {
  SAVED_LOCATIONS: 'gather:saved_locations',
  LOCATION_PERMISSION_DISMISSED: 'gather:location_permission_dismissed',
  LAST_KNOWN_POSITION: 'gather:last_known_position',
} as const

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3 // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Check if a position is within a geofence
 */
export function isWithinGeofence(
  currentLat: number,
  currentLon: number,
  fenceLat: number,
  fenceLon: number,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(currentLat, currentLon, fenceLat, fenceLon)
  return distance <= radiusMeters
}

/**
 * Format a location name for display
 */
export function formatLocationName(location: SavedLocation): string {
  if (location.preset === LocationPreset.HOME) return 'Home'
  if (location.preset === LocationPreset.WORK) return 'Work'
  return location.name
}

/**
 * Get a human-friendly trigger description
 */
export function getTriggerDescription(
  trigger: LocationTrigger,
  location: SavedLocation | undefined
): string {
  if (!location) return 'Unknown location'

  const locationName = formatLocationName(location)
  const action = trigger.triggerType === LocationTriggerType.ARRIVING
    ? 'arriving at'
    : 'leaving'

  return `When ${action} ${locationName}`
}
