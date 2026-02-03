'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type AmbientSoundType = 'off' | 'white' | 'brown' | 'rain'

// Check-in messages for body doubling mode
const CHECK_IN_MESSAGES = [
  "Still going strong?",
  "You've got this.",
  "How's it going?",
  "Take a breath if you need.",
  "You're doing great.",
  "Keep it up!",
  "Still there?",
  "Nice work.",
  "One step at a time.",
]

// Check-in interval range (10-15 minutes in milliseconds)
const CHECK_IN_MIN_INTERVAL = 10 * 60 * 1000
const CHECK_IN_MAX_INTERVAL = 15 * 60 * 1000

/**
 * Hook for playing ambient sounds in focus mode
 * Uses Web Audio API to generate noise
 * Also supports body doubling with speech synthesis check-ins
 */
export function useAmbientSound() {
  const [soundType, setSoundType] = useState<AmbientSoundType>('off')
  const [volume, setVolume] = useState(0.3) // 0-1
  const [workAlongEnabled, setWorkAlongEnabled] = useState(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const checkInTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastMessageIndexRef = useRef<number>(-1)

  // Generate noise buffer
  const generateNoiseBuffer = useCallback((type: 'white' | 'brown', sampleRate: number, duration: number) => {
    const bufferSize = sampleRate * duration
    const buffer = new Float32Array(bufferSize)

    if (type === 'white') {
      // White noise: random values
      for (let i = 0; i < bufferSize; i++) {
        buffer[i] = Math.random() * 2 - 1
      }
    } else if (type === 'brown') {
      // Brown noise: integrated white noise (smoother, deeper)
      let lastOut = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        buffer[i] = (lastOut + 0.02 * white) / 1.02
        lastOut = buffer[i]
        buffer[i] *= 3.5 // Boost volume
      }
    }

    return buffer
  }, [])

  // Stop current sound
  const stopSound = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
      } catch {
        // Already stopped
      }
      sourceNodeRef.current = null
    }
  }, [])

  // Play sound
  const playSound = useCallback((type: AmbientSoundType) => {
    stopSound()

    if (type === 'off') return

    // Create audio context if needed
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }

    const ctx = audioContextRef.current
    const sampleRate = ctx.sampleRate

    // Create gain node for volume control
    if (!gainNodeRef.current) {
      gainNodeRef.current = ctx.createGain()
      gainNodeRef.current.connect(ctx.destination)
    }
    gainNodeRef.current.gain.value = volume

    if (type === 'white' || type === 'brown') {
      // Generate noise buffer (10 seconds, will loop)
      const noiseData = generateNoiseBuffer(type, sampleRate, 10)
      const audioBuffer = ctx.createBuffer(1, noiseData.length, sampleRate)
      audioBuffer.copyToChannel(noiseData, 0)

      // Create source and play
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.loop = true
      source.connect(gainNodeRef.current)
      source.start()

      sourceNodeRef.current = source
    } else if (type === 'rain') {
      // Rain: combination of filtered noise
      const noiseData = generateNoiseBuffer('white', sampleRate, 10)
      const audioBuffer = ctx.createBuffer(1, noiseData.length, sampleRate)
      audioBuffer.copyToChannel(noiseData, 0)

      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.loop = true

      // Low-pass filter for softer rain sound
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 400

      source.connect(filter)
      filter.connect(gainNodeRef.current)
      source.start()

      sourceNodeRef.current = source
    }
  }, [volume, generateNoiseBuffer, stopSound])

  // Effect to play/stop when soundType changes
  useEffect(() => {
    playSound(soundType)
    return () => stopSound()
  }, [soundType, playSound, stopSound])

  // Effect to update volume
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume
    }
  }, [volume])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSound()
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [stopSound])

  const toggleSound = useCallback(() => {
    const types: AmbientSoundType[] = ['off', 'white', 'brown', 'rain']
    const currentIndex = types.indexOf(soundType)
    const nextIndex = (currentIndex + 1) % types.length
    setSoundType(types[nextIndex])
  }, [soundType])

  // Speak a message using SpeechSynthesis
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    // Cancel any ongoing speech
    speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.85 // Calm, slow pace
    utterance.pitch = 0.9
    utterance.volume = 0.7 // Not too loud

    // Try to get a natural-sounding voice
    const voices = speechSynthesis.getVoices()
    const preferredVoice = voices.find(v =>
      v.name.includes('Samantha') || // macOS
      v.name.includes('Google US English') ||
      v.lang.startsWith('en')
    )
    if (preferredVoice) {
      utterance.voice = preferredVoice
    }

    speechSynthesis.speak(utterance)
  }, [])

  // Get a random check-in message (avoiding immediate repeats)
  const getRandomMessage = useCallback(() => {
    let index: number
    do {
      index = Math.floor(Math.random() * CHECK_IN_MESSAGES.length)
    } while (index === lastMessageIndexRef.current && CHECK_IN_MESSAGES.length > 1)
    lastMessageIndexRef.current = index
    return CHECK_IN_MESSAGES[index]
  }, [])

  // Schedule the next check-in
  const scheduleCheckIn = useCallback(() => {
    if (checkInTimeoutRef.current) {
      clearTimeout(checkInTimeoutRef.current)
    }

    // Random interval between 10-15 minutes
    const interval = CHECK_IN_MIN_INTERVAL +
      Math.random() * (CHECK_IN_MAX_INTERVAL - CHECK_IN_MIN_INTERVAL)

    checkInTimeoutRef.current = setTimeout(() => {
      speak(getRandomMessage())
      // Schedule the next one
      scheduleCheckIn()
    }, interval)
  }, [speak, getRandomMessage])

  // Stop check-ins
  const stopCheckIns = useCallback(() => {
    if (checkInTimeoutRef.current) {
      clearTimeout(checkInTimeoutRef.current)
      checkInTimeoutRef.current = null
    }
  }, [])

  // Toggle work-along mode
  const toggleWorkAlong = useCallback(() => {
    setWorkAlongEnabled(prev => !prev)
  }, [])

  // Effect to manage check-ins based on workAlongEnabled state
  useEffect(() => {
    if (workAlongEnabled) {
      // Start with a check-in after the first interval
      scheduleCheckIn()
    } else {
      stopCheckIns()
    }

    return () => stopCheckIns()
  }, [workAlongEnabled, scheduleCheckIn, stopCheckIns])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCheckIns()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        speechSynthesis.cancel()
      }
    }
  }, [stopCheckIns])

  return {
    soundType,
    setSoundType,
    volume,
    setVolume,
    toggleSound,
    workAlongEnabled,
    setWorkAlongEnabled,
    toggleWorkAlong,
    speak,
  }
}
