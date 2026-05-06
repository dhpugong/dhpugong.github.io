(function () {
  class SnakeAudio {
    constructor(soundToggle) {
      this.soundToggle = soundToggle;
      this.context = undefined;
      this.musicNodes = undefined;
      this.musicStep = 0;
      this.musicTimerId = undefined;
      this.enabled = soundToggle.checked;
    }

    syncEnabled() {
      this.enabled = this.soundToggle.checked;
      if (!this.enabled) {
        this.stopMusic();
      }
      return this.enabled;
    }

    ensureContext() {
      if (!this.context) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) {
          throw new Error("AudioContext unsupported");
        }
        this.context = new AudioCtor();
      }

      if (this.context.state === "suspended") {
        this.context.resume();
      }
    }

    playTone(frequency, duration, volume = 0.05, type = "sine") {
      if (!this.enabled) {
        return;
      }

      try {
        this.ensureContext();
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(volume, this.context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
        oscillator.connect(gain);
        gain.connect(this.context.destination);
        oscillator.start();
        oscillator.stop(this.context.currentTime + duration);
      } catch {
        this.enabled = false;
        this.soundToggle.checked = false;
      }
    }

    startMusic(getState) {
      if (!this.enabled || this.musicTimerId) {
        return;
      }

      try {
        this.ensureContext();
      } catch {
        this.enabled = false;
        this.soundToggle.checked = false;
        return;
      }

      this.musicNodes = this.createMusicNodes();
      this.musicStep = 0;
      this.scheduleMusicStep(getState);
    }

    stopMusic() {
      if (this.musicTimerId) {
        window.clearTimeout(this.musicTimerId);
        this.musicTimerId = undefined;
      }

      if (this.musicNodes) {
        this.musicNodes.oscillator.stop();
        this.musicNodes = undefined;
      }
    }

    createMusicNodes() {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = 220;
      gain.gain.value = 0.02;
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start();
      return { oscillator, gain };
    }

    scheduleMusicStep(getState) {
      if (!this.musicNodes || !this.enabled || getState() !== "playing") {
        return;
      }

      const pattern = [
        220, 277.18, 329.63, 277.18,
        246.94, 329.63, 392.0, 329.63,
      ];
      const accent = this.musicStep % 4 === 0 ? 0.028 : 0.018;

      this.musicNodes.oscillator.frequency.setTargetAtTime(
        pattern[this.musicStep % pattern.length],
        this.context.currentTime,
        0.02
      );
      this.musicNodes.gain.gain.cancelScheduledValues(this.context.currentTime);
      this.musicNodes.gain.gain.setValueAtTime(accent, this.context.currentTime);
      this.musicNodes.gain.gain.exponentialRampToValueAtTime(0.012, this.context.currentTime + 0.22);

      this.musicStep += 1;
      this.musicTimerId = window.setTimeout(() => this.scheduleMusicStep(getState), 320);
    }
  }

  window.SnakeAudio = SnakeAudio;
})();
