'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'

// Singleton to share dark mode state across all components
let darkModeListeners: Set<() => void> = new Set()
let currentDarkMode = false

function subscribe(callback: () => void) {
  darkModeListeners.add(callback)
  return () => darkModeListeners.delete(callback)
}

function getSnapshot() {
  return currentDarkMode
}

function getServerSnapshot() {
  return false
}

// Initialize observer once
if (typeof window !== 'undefined') {
  const checkDark = () => {
    const isDark = document.documentElement.classList.contains('dark')
    if (isDark !== currentDarkMode) {
      currentDarkMode = isDark
      darkModeListeners.forEach(listener => listener())
    }
  }

  // Initial check
  checkDark()

  // Single observer for all components
  const observer = new MutationObserver(checkDark)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
}

/**
 * Centralized dark mode hook - uses a single MutationObserver
 * shared across all components instead of one per component.
 */
export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
