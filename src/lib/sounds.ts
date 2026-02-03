/**
 * Sound effects for completions
 * Uses Web Audio API for low-latency playback with programmatically generated tones.
 * OFF by default - user must enable in settings.
 */

type SoundType = 'stepComplete' | 'taskComplete' | 'levelUp'

const STORAGE_KEY = 'gather_sounds_enabled'

let audioContext: AudioContext | null = null
let initialized = false

/**
 * Initialize the audio context.
 * Must be called after a user interaction due to browser autoplay policies.
 */
export function initSounds(): void {
  if (initialized || typeof window === 'undefined') return

  try {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    initialized = true
  } catch (e) {
    console.warn('Web Audio API not supported:', e)
  }
}

/**
 * Resume audio context if it was suspended.
 * Call this on user interaction to ensure sounds can play.
 */
export async function resumeAudioContext(): Promise<void> {
  if (audioContext?.state === 'suspended') {
    await audioContext.resume()
  }
}

/**
 * Play a synthesized sound effect.
 * Uses oscillators and gain envelopes for clean, simple tones.
 */
export function playSound(type: SoundType): void {
  // Check user preference first
  if (!areSoundsEnabled()) return

  // Initialize on first play (user has already interacted by completing something)
  if (!initialized) {
    initSounds()
  }

  if (!audioContext) return

  // Resume context if needed
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }

  const now = audioContext.currentTime

  switch (type) {
    case 'stepComplete':
      // Quick, light pop - short blip with fast decay
      playTone(audioContext, 880, 0.08, 0.15, 'sine')
      break

    case 'taskComplete':
      // Satisfying ding - two-note chord with gentle decay
      playTone(audioContext, 523.25, 0.15, 0.2, 'sine') // C5
      playTone(audioContext, 659.25, 0.15, 0.2, 'sine', 0.05) // E5, slightly delayed
      playTone(audioContext, 783.99, 0.12, 0.15, 'sine', 0.1) // G5, more delayed
      break

    case 'levelUp':
      // Celebratory ascending chime
      playTone(audioContext, 523.25, 0.12, 0.18, 'sine', 0) // C5
      playTone(audioContext, 659.25, 0.12, 0.18, 'sine', 0.1) // E5
      playTone(audioContext, 783.99, 0.12, 0.18, 'sine', 0.2) // G5
      playTone(audioContext, 1046.5, 0.15, 0.25, 'sine', 0.3) // C6
      break
  }
}

/**
 * Play a single tone with envelope.
 */
function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  volume: number = 0.2,
  type: OscillatorType = 'sine',
  delay: number = 0
): void {
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.type = type
  oscillator.frequency.value = frequency

  // Envelope: quick attack, smooth decay
  const startTime = ctx.currentTime + delay
  gainNode.gain.setValueAtTime(0, startTime)
  gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01) // 10ms attack
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration) // decay

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.start(startTime)
  oscillator.stop(startTime + duration + 0.1)
}

/**
 * Set whether sounds are enabled.
 * Initializes audio context when enabled.
 */
export function setSoundsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return

  localStorage.setItem(STORAGE_KEY, String(enabled))

  if (enabled) {
    initSounds()
    // Play a preview sound when enabling
    playSound('stepComplete')
  }
}

/**
 * Check if sounds are currently enabled.
 * OFF by default.
 */
export function areSoundsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === 'true'
}
