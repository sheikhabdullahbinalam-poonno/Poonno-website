// ============================================================================
//  audio.js — looping ambient bed + low rumble, a reshuffled whistle bag, and
//  the soft UI chime. Browsers block sound until a user gesture, so nothing
//  plays until start() is called from the Enter tap (§8). Mute choice persists.
//  Filenames contain spaces → encodeURI (§0.8).
// ============================================================================

const DIR = 'assets/audio/';

export class AudioManager {
  constructor() {
    this.muted = localStorage.getItem('poonno-muted') === '1';
    this.started = false;

    this.bed = this._make('ambient platform loop.mp3', true, 0.5);
    this.rumble = this._make('Train Rumble.mp3', true, 0.55);
    this.whistles = ['Whistle 1.mp3', 'Whistle 2.mp3', 'Whistle 3.mp3']
      .map(f => this._make(f, false, 0.5));
    this.chime = this._make('Soft UI Chime.mp3', false, 0.6);

    this._bag = [];
    this._lastWhistle = -1;
    this._applyMute();
  }

  _make(file, loop, volume) {
    const a = new Audio(encodeURI(DIR + file));
    a.loop = loop;
    a.volume = volume;
    a.preload = 'auto';
    return a;
  }

  // Called on the first user gesture (Enter): starts the looping bed + rumble.
  start() {
    if (this.started) return;
    this.started = true;
    if (!this.muted) {
      this.bed.play().catch(() => {});
      this.rumble.play().catch(() => {});
    }
  }

  isMuted() { return this.muted; }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('poonno-muted', m ? '1' : '0');
    this._applyMute();
    if (this.started && !m) {
      this.bed.play().catch(() => {});
      this.rumble.play().catch(() => {});
    }
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  _applyMute() {
    [this.bed, this.rumble, ...this.whistles, this.chime]
      .forEach(a => { a.muted = this.muted; });
  }

  // Lets the speed beat (Phase 5) swell the rumble; clamped 0..1.
  setRumbleLevel(v) {
    this.rumble.volume = Math.max(0, Math.min(1, v));
  }

  // Random-bag whistle: no immediate repeat; reshuffle when all three are used.
  whistle() {
    if (!this.started) return;
    if (this._bag.length === 0) {
      this._bag = [0, 1, 2];
      for (let i = this._bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this._bag[i], this._bag[j]] = [this._bag[j], this._bag[i]];
      }
      if (this._bag[this._bag.length - 1] === this._lastWhistle) {
        this._bag.reverse(); // avoid an immediate repeat across reshuffles
      }
    }
    const idx = this._bag.pop();
    this._lastWhistle = idx;
    const w = this.whistles[idx];
    try { w.currentTime = 0; w.play().catch(() => {}); } catch (e) {}
  }

  playChime() {
    if (!this.started) return;
    try { this.chime.currentTime = 0; this.chime.play().catch(() => {}); } catch (e) {}
  }
}
