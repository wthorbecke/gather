'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type AmbientSoundType = 'off' | 'white' | 'brown' | 'rain'

/**
 * Hook for playing ambient sounds in focus mode
 * Uses Web Audio API to generate noise
 */
export function useAmbientSound() {
  const [soundType, setSoundType] = useState<AmbientSoundType>('off')
  const [volume, setVolume] = useState(0.3) // 0-1
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

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

  return {
    soundType,
    setSoundType,
    volume,
    setVolume,
    toggleSound,
  }
}
