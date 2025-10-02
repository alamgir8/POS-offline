export class SoundManager {
  private context: AudioContext | null = null;
  private enabled = true;

  constructor() {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.context = new AudioContextClass();
    } catch {
      console.warn('Audio not supported');
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine'
  ) {
    if (!this.enabled || !this.context) return;

    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = type;

    gainNode.gain.setValueAtTime(0.3, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.context.currentTime + duration
    );

    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + duration);
  }

  // Success sound - pleasant ascending notes
  playSuccess() {
    this.playTone(523, 0.15); // C5
    setTimeout(() => this.playTone(659, 0.15), 100); // E5
    setTimeout(() => this.playTone(784, 0.2), 200); // G5
  }

  // Error sound - descending notes
  playError() {
    this.playTone(400, 0.2, 'square');
    setTimeout(() => this.playTone(300, 0.3, 'square'), 150);
  }

  // Warning sound - double beep
  playWarning() {
    this.playTone(800, 0.1);
    setTimeout(() => this.playTone(800, 0.1), 200);
  }

  // Info sound - single pleasant tone
  playInfo() {
    this.playTone(600, 0.2);
  }

  // Cash register sound
  playCashRegister() {
    this.playTone(1000, 0.05);
    setTimeout(() => this.playTone(800, 0.05), 50);
    setTimeout(() => this.playTone(600, 0.1), 100);
    setTimeout(() => this.playTone(400, 0.15), 200);
  }

  // Button click sound
  playClick() {
    this.playTone(800, 0.05, 'square');
  }

  // Add to cart sound
  playAddToCart() {
    this.playTone(440, 0.1); // A4
    setTimeout(() => this.playTone(554, 0.1), 80); // C#5
  }

  // Remove from cart sound
  playRemoveFromCart() {
    this.playTone(554, 0.1); // C#5
    setTimeout(() => this.playTone(440, 0.15), 80); // A4
  }
}

export const soundManager = new SoundManager();
