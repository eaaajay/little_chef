import { REACTIONS, WORD_META, type Recipe, type Resident, type WordId } from './data';

/** Calm music, system speech synthesis and tiny synthesized UI cues. */
export class AudioManager {
  enabled: boolean;
  private unlocked = false;
  private music?: HTMLAudioElement;
  private audioContext?: AudioContext;
  private speechRequest = 0;
  private lastSpeech?: { text: string; at: number };
  private lastEffect?: { name: string; at: number };

  constructor(enabled: boolean) { this.enabled = enabled; }

  private get speech(): SpeechSynthesis | undefined {
    return 'speechSynthesis' in window ? window.speechSynthesis : undefined;
  }

  unlock(): void {
    this.unlocked = true;
    if (!this.audioContext) this.audioContext = new AudioContext();
    void this.audioContext.resume();
    void this.speech?.resume();
    if (this.enabled) this.startMusic();
  }

  private startMusic(): void {
    if (!this.unlocked || !this.enabled) return;
    this.music ??= new Audio('/assets/audio/kitchen_loop_calm.mp3');
    this.music.loop = true;
    this.music.playbackRate = 1;
    this.music.volume = 0.09;
    void this.music.play().catch(() => undefined);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.speechRequest += 1;
      this.lastSpeech = undefined;
      this.speech?.cancel();
      this.music?.pause();
      void this.audioContext?.suspend();
    } else {
      void this.audioContext?.resume();
      this.startMusic();
    }
  }

  private speak(text: string, pitch = 1): void {
    const speech = this.speech;
    if (!this.enabled || !this.unlocked || !speech || typeof SpeechSynthesisUtterance === 'undefined') return;
    const now = performance.now();
    if (this.lastSpeech?.text === text && now - this.lastSpeech.at < 600) return;
    this.lastSpeech = { text, at: now };
    const request = ++this.speechRequest;
    speech.cancel();
    // Some system voices overlap when speak() immediately follows cancel().
    window.setTimeout(() => {
      if (!this.enabled || !this.unlocked || request !== this.speechRequest) return;
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = speech.getVoices();
      const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
      const preferredNames = ['Samantha', 'Alex', 'Google US English', 'Microsoft Aria', 'Microsoft Zira'];
      utterance.voice = preferredNames.map((name) => englishVoices.find((voice) => voice.name.includes(name))).find(Boolean) ?? englishVoices[0] ?? null;
      utterance.lang = utterance.voice?.lang ?? 'en-US';
      utterance.rate = 0.82;
      utterance.pitch = pitch;
      utterance.volume = 0.9;
      speech.speak(utterance);
    }, 60);
  }

  private tone(frequency: number, delay: number, duration: number, volume = 0.045): void {
    const context = this.audioContext;
    if (!context || !this.enabled || !this.unlocked) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  effectSound(name: 'guest_enter' | 'serve' | 'payment' | 'food_pick' | 'coin'): void {
    const now = performance.now();
    if (this.lastEffect?.name === name && now - this.lastEffect.at < 250) return;
    this.lastEffect = { name, at: now };
    const frequencies: Record<typeof name, number> = {
      guest_enter: 523.25,
      serve: 659.25,
      payment: 880,
      food_pick: 880,
      coin: 1046.5,
    };
    this.tone(frequencies[name], 0, name === 'food_pick' ? 0.07 : 0.15);
  }

  word(word: WordId): void { this.speak(WORD_META[word].english); }

  wrong(): void { this.speak('Try again.'); }

  order(recipe: Recipe, resident: Resident): void {
    this.speak(`I want ${recipe.english.toLowerCase()}, please.`, resident.female ? 1.02 : 0.97);
  }

  reaction(resident: Resident, reactionId: string): void {
    const text = REACTIONS.find((reaction) => reaction.id === reactionId)?.text ?? 'Thank you!';
    this.speak(text, resident.female ? 1.02 : 0.97);
  }

  pauseForVisibility(hidden: boolean): void {
    if (hidden) {
      this.speechRequest += 1;
      this.music?.pause();
      this.speech?.cancel();
      void this.audioContext?.suspend();
    } else {
      void this.audioContext?.resume();
      this.startMusic();
    }
  }
}
