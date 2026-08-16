import { UserSettings } from '../types';

class SoundSystem {
  private ctx: AudioContext | null = null;
  private musicInterval: any = null;
  private musicVolumeNode: GainNode | null = null;
  private isMusicActive: boolean = false;

  // Dynamic Combo & Pitch Shifting State
  private comboCount: number = 0;
  private comboTimer: any = null;

  public registerCombo(): number {
    this.comboCount += 1;
    if (this.comboTimer) clearTimeout(this.comboTimer);
    // Reset combo after 6 seconds of inactivity
    this.comboTimer = setTimeout(() => {
      this.comboCount = 0;
    }, 6000);

    // Dynamic pitch multiplier: escalates from 1.0 up to 1.48 (e.g. 1.0, 1.12, 1.24, 1.36, 1.48)
    return 1.0 + Math.min((this.comboCount - 1) * 0.12, 0.48);
  }

  public resetCombo(): void {
    this.comboCount = 0;
    if (this.comboTimer) {
      clearTimeout(this.comboTimer);
      this.comboTimer = null;
    }
  }

  public getComboPitch(): number {
    if (this.comboCount <= 0) return 1.0;
    return 1.0 + Math.min((this.comboCount - 1) * 0.12, 0.48);
  }

  private initCtx() {
    if (!this.ctx) {
      // Create audio context lazily after user interaction
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(
    frequencies: number[],
    durations: number[],
    type: OscillatorType = 'sine',
    volume: number = 0.5,
    pitchMultiplier: number = 1.0
  ) {
    const ctx = this.initCtx();
    if (!ctx) return;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume * 0.15, ctx.currentTime);
    masterGain.connect(ctx.destination);

    let startTime = ctx.currentTime;

    frequencies.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq * pitchMultiplier, startTime);

      const duration = durations[index] || 0.1;
      
      gainNode.gain.setValueAtTime(volume * 0.15, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gainNode);
      gainNode.connect(masterGain);

      osc.start(startTime);
      osc.stop(startTime + duration);

      startTime += duration * 0.8; // overlap slightly or chain
    });
  }

  private getDefaultSettings(): UserSettings {
    return {
      soundVolume: 50,
      soundPitch: 1.0,
      synthType: 'sine',
      celebrationSound: 'sound_classic',
      boardTheme: 'theme_slate',
      cardBack: 'back_classic',
      avatarId: 'avatar_classic',
      clothesId: 'clothes_classic',
      profileFrame: 'frame_none',
      language: 'tr',
    };
  }

  playDraw(settings?: UserSettings) {
    const s = settings || this.getDefaultSettings();
    const volume = s.soundVolume / 100;
    const pitch = s.soundPitch;
    const type = s.synthType;
    this.playTone([261.63, 329.63], [0.08, 0.12], type, volume, pitch);
  }

  playPlay(settings?: UserSettings, pitchModifier: number = 1.0) {
    const s = settings || this.getDefaultSettings();
    const volume = s.soundVolume / 100;
    const pitch = s.soundPitch * pitchModifier;
    const type = s.synthType;
    this.playTone([392.00, 523.25], [0.08, 0.15], type, volume, pitch);
  }

  playCoin(settings?: UserSettings, pitchModifier: number = 1.0) {
    const s = settings || this.getDefaultSettings();
    const volume = s.soundVolume / 100;
    const pitch = s.soundPitch * pitchModifier;
    const type = s.synthType;
    this.playTone([523.25, 659.25, 783.99, 1046.50], [0.05, 0.05, 0.05, 0.2], type, volume, pitch);
  }

  playAction(settings?: UserSettings, pitchModifier: number = 1.0) {
    const s = settings || this.getDefaultSettings();
    const volume = s.soundVolume / 100;
    const pitch = s.soundPitch * pitchModifier;
    const type = s.synthType;
    this.playTone([440.00, 349.23, 440.00, 523.25], [0.1, 0.1, 0.1, 0.25], type, volume, pitch);
  }

  playSteal(settings?: UserSettings) {
    const s = settings || this.getDefaultSettings();
    const volume = s.soundVolume / 100;
    const pitch = s.soundPitch;
    const type = settings.synthType;
    this.playTone([587.33, 493.88, 392.00], [0.1, 0.1, 0.2], type, volume, pitch);
  }

  playJustSayNo(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    // Highlighted alarm pitch
    this.playTone([880.00, 587.33, 880.00], [0.08, 0.08, 0.15], 'sawtooth', volume, pitch);
  }

  playVictory(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const type = settings.synthType;
    this.playTone(
      [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50],
      [0.15, 0.15, 0.15, 0.15, 0.15, 0.4],
      type,
      volume,
      pitch
    );
  }

  playDefeat(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const type = settings.synthType;
    this.playTone([392.00, 349.23, 311.13, 261.63], [0.2, 0.2, 0.2, 0.4], type, volume, pitch);
  }

  playAlert(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const type = settings.synthType;
    this.playTone([440.00, 440.00], [0.08, 0.08], type, volume, pitch);
  }

  playCardDraw(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'triangle';
    // Frequency sweeps upward swiftly (mimicking a card draw slide)
    osc.frequency.setValueAtTime(260 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(540 * pitch, now + 0.12);
    
    gainNode.gain.setValueAtTime(volume * 0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playCardDiscard(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.type = 'triangle';
    // Frequency sweeps downward (mimicking a card dropping/flinging down)
    osc.frequency.setValueAtTime(500 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(140 * pitch, now + 0.15);
    
    gainNode.gain.setValueAtTime(volume * 0.12, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playPropertyPlace(settings: UserSettings, pitchModifier: number = 1.0) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch * pitchModifier;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Tactile double tap
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(220 * pitch, now);
    osc1.frequency.exponentialRampToValueAtTime(440 * pitch, now + 0.05);
    gain1.gain.setValueAtTime(volume * 0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.05);

    const delay = 0.06;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(330 * pitch, now + delay);
    osc2.frequency.exponentialRampToValueAtTime(660 * pitch, now + delay + 0.07);
    gain2.gain.setValueAtTime(volume * 0.18, now + delay);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.07);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + delay);
    osc2.stop(now + delay + 0.07);
  }

  playActionCardPlay(settings: UserSettings, pitchModifier: number = 1.0) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch * pitchModifier;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Sparkly ascending pentatonic arpeggio
    const notes = [329.63, 392.00, 440.00, 523.25, 659.25, 783.99]; // E4, G4, A4, C5, E5, G5
    const noteDuration = 0.06;
    
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * pitch, now + index * 0.045);
      
      gainNode.gain.setValueAtTime(volume * 0.08, now + index * 0.045);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + index * 0.045 + noteDuration);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + index * 0.045);
      osc.stop(now + index * 0.045 + noteDuration);
    });
  }

  playCelebrationClassic(settings: UserSettings) {
    this.playVictory(settings);
  }

  playCelebrationApplause(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 20; i++) {
      const delay = i * 0.07 + Math.random() * 0.04;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime((180 + Math.random() * 220) * pitch, now + delay);
      gainNode.gain.setValueAtTime(volume * 0.12, now + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.06);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.06);
    }
  }

  playCelebrationFireworks(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Whistle rise
    const whistleOsc = ctx.createOscillator();
    const whistleGain = ctx.createGain();
    whistleOsc.type = 'sine';
    whistleOsc.frequency.setValueAtTime(200 * pitch, now);
    whistleOsc.frequency.exponentialRampToValueAtTime(1400 * pitch, now + 0.45);
    whistleGain.gain.setValueAtTime(volume * 0.04, now);
    whistleGain.gain.linearRampToValueAtTime(0.005, now + 0.45);
    whistleOsc.connect(whistleGain);
    whistleGain.connect(ctx.destination);
    whistleOsc.start(now);
    whistleOsc.stop(now + 0.45);

    // Explosion pops
    const expTime = now + 0.45;
    for (let i = 0; i < 15; i++) {
      const delay = Math.random() * 0.3;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = Math.random() > 0.4 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime((80 + Math.random() * 900) * pitch, expTime + delay);
      gainNode.gain.setValueAtTime(volume * 0.14, expTime + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.001, expTime + delay + 0.12);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(expTime + delay);
      osc.stop(expTime + delay + 0.15);
    }
  }

  playCelebrationLaser(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const delay = i * 0.12;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1600 * pitch, now + delay);
      osc.frequency.exponentialRampToValueAtTime(80 * pitch, now + delay + 0.15);
      gainNode.gain.setValueAtTime(volume * 0.1, now + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.15);
    }
  }

  playCelebrationFanfare(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    this.playTone(
      [523.25, 523.25, 523.25, 523.25, 659.25, 587.33, 659.25, 783.99, 1046.50],
      [0.08, 0.08, 0.08, 0.16, 0.16, 0.08, 0.08, 0.08, 0.65],
      'sawtooth',
      volume,
      pitch
    );
  }

  playCelebration(soundId: string | undefined, settings: UserSettings) {
    const id = soundId || 'sound_classic';
    switch (id) {
      case 'sound_applause':
        this.playCelebrationApplause(settings);
        break;
      case 'sound_fireworks':
        this.playCelebrationFireworks(settings);
        break;
      case 'sound_laser':
        this.playCelebrationLaser(settings);
        break;
      case 'sound_fanfare':
        this.playCelebrationFanfare(settings);
        break;
      case 'sound_classic':
      default:
        this.playCelebrationClassic(settings);
        break;
    }
  }

  playBirthday(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    // G4 G4 A4 G4 C5 B4 jingle
    const notes = [392.00, 392.00, 440.00, 392.00, 523.25, 493.88];
    const durs = [0.12, 0.12, 0.24, 0.24, 0.24, 0.48];
    const type = 'sine';
    
    let time = now;
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * pitch, time);
      
      gainNode.gain.setValueAtTime(volume * 0.12, time);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + durs[idx]);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + durs[idx]);
      time += durs[idx] * 0.9;
    });
  }

  playDebtCollector(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Coin chime
    this.playCoin(settings);
    
    // Deep heavy collector bass
    const bassOsc = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bassOsc.type = 'triangle';
    bassOsc.frequency.setValueAtTime(110 * pitch, now + 0.1);
    bassOsc.frequency.linearRampToValueAtTime(82.41 * pitch, now + 0.5);
    
    bassGain.gain.setValueAtTime(volume * 0.2, now + 0.1);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    bassOsc.connect(bassGain);
    bassGain.connect(ctx.destination);
    bassOsc.start(now + 0.1);
    bassOsc.stop(now + 0.5);
  }

  playDealBreaker(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Rapid synth laser/siren slide
    for (let i = 0; i < 4; i++) {
      const delay = i * 0.15;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300 * pitch, now + delay);
      osc.frequency.linearRampToValueAtTime(900 * pitch, now + delay + 0.12);
      
      gainNode.gain.setValueAtTime(volume * 0.1, now + delay);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.12);
    }
  }

  playSlyForcedDeal(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(440 * pitch, now);
    osc1.frequency.exponentialRampToValueAtTime(330 * pitch, now + 0.25);
    gain1.gain.setValueAtTime(volume * 0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(330 * pitch, now + 0.12);
    osc2.frequency.exponentialRampToValueAtTime(440 * pitch, now + 0.35);
    gain2.gain.setValueAtTime(volume * 0.12, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.35);
  }

  playPassGo(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    const notes = [261.63, 329.63, 392.00, 523.25];
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * pitch, now + index * 0.04);
      gainNode.gain.setValueAtTime(volume * 0.1, now + index * 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + index * 0.04 + 0.25);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + index * 0.04);
      osc.stop(now + index * 0.04 + 0.25);
    });
  }

  playHouseHotelBuild(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Tap 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(150 * pitch, now);
    gain1.gain.setValueAtTime(volume * 0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.04);

    // Tap 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(150 * pitch, now + 0.1);
    gain2.gain.setValueAtTime(volume * 0.18, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1 + 0.04);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.1 + 0.04);

    // Bell chime
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(880 * pitch, now + 0.18);
    bellGain.gain.setValueAtTime(volume * 0.12, now + 0.18);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18 + 0.3);
    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(now + 0.18);
    bell.stop(now + 0.18 + 0.3);
  }

  private customAudioPlayer: HTMLAudioElement | null = null;

  startMusic(settings: UserSettings) {
    if (this.isMusicActive) {
      this.stopMusic();
    }
    this.isMusicActive = true;

    // Check if custom audio URL is set or gameMusic is a URL
    const trackId = settings.gameMusic || 'music_classic';
    const isUrl = (url?: string) => url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:audio') || url.endsWith('.mp3') || url.endsWith('.wav') || url.endsWith('.ogg'));

    const customUrl = settings.customBgmUrl || (isUrl(trackId) ? trackId : undefined);

    if (customUrl) {
      try {
        if (this.customAudioPlayer) {
          this.customAudioPlayer.pause();
          this.customAudioPlayer = null;
        }
        this.customAudioPlayer = new Audio(customUrl);
        this.customAudioPlayer.loop = true;
        this.customAudioPlayer.volume = Math.max(0, Math.min(1, (settings.soundVolume / 100) * 0.4));
        this.customAudioPlayer.play().catch((err) => {
          console.warn('Custom background audio autoplay blocked or failed:', err);
        });
        return;
      } catch (err) {
        console.error('Error playing custom background music:', err);
      }
    }

    const ctx = this.initCtx();
    if (!ctx) return;

    if (!this.musicVolumeNode) {
      this.musicVolumeNode = ctx.createGain();
      this.musicVolumeNode.connect(ctx.destination);
    }
    
    // Set volume based on track character
    const baseVol = (settings.soundVolume / 100) * 0.08;
    this.musicVolumeNode.gain.setValueAtTime(baseVol, ctx.currentTime);

    // Chords & Melody scales according to track style
    let chords = [
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [130.81, 164.81, 196.00, 246.94], // Cmaj7
      [196.00, 246.94, 293.66, 329.63], // G6
    ];

    let melodyScales = [
      [440.00, 523.25, 587.33, 659.25, 783.99],
      [349.23, 440.00, 523.25, 587.33, 659.25],
      [261.63, 293.66, 329.63, 392.00, 440.00],
      [293.66, 329.63, 392.00, 440.00, 493.88],
    ];

    let bpm = 750; // 80 BPM
    let waveType: OscillatorType = 'triangle';
    let bassType: OscillatorType = 'sine';

    if (trackId === 'music_retro') {
      // 8-Bit Arcade Chiptune
      bpm = 400; // ~150 BPM
      waveType = 'square';
      bassType = 'square';
      chords = [
        [220, 261.63, 329.63], // Am
        [174.61, 220, 261.63], // F
        [130.81, 164.81, 196], // C
        [196, 246.94, 293.66], // G
      ];
      melodyScales = [
        [523.25, 659.25, 783.99, 1046.50, 880.00],
        [440.00, 523.25, 659.25, 880.00, 783.99],
        [392.00, 523.25, 659.25, 783.99, 1046.50],
        [493.88, 587.33, 783.99, 987.77, 1174.66],
      ];
    } else if (trackId === 'music_cyber') {
      // Cyberpunk Synthwave
      bpm = 500; // ~120 BPM
      waveType = 'sawtooth';
      bassType = 'sawtooth';
      chords = [
        [110, 164.81, 220], // Am bass pad
        [87.31, 130.81, 174.61], // F
        [130.81, 196, 261.63], // C
        [98, 146.83, 196], // G
      ];
      melodyScales = [
        [440, 523.25, 587.33, 659.25, 880],
        [349.23, 440, 523.25, 659.25, 698.46],
        [261.63, 329.63, 392, 523.25, 659.25],
        [293.66, 392, 493.88, 587.33, 783.99],
      ];
    } else if (trackId === 'music_chill') {
      // Lo-Fi Chill & Coffee
      bpm = 900; // ~66 BPM
      waveType = 'sine';
      bassType = 'sine';
      chords = [
        [261.63, 329.63, 392.00, 493.88], // Cmaj7
        [220.00, 261.63, 329.63, 392.00], // Am7
        [174.61, 220.00, 261.63, 329.63], // Fmaj7
        [196.00, 246.94, 293.66, 349.23], // G7
      ];
      melodyScales = [
        [523.25, 587.33, 659.25, 783.99, 987.77],
        [440.00, 523.25, 659.25, 783.99, 880.00],
        [349.23, 440.00, 523.25, 659.25, 698.46],
        [392.00, 493.88, 587.33, 698.46, 783.99],
      ];
    } else if (trackId === 'music_epic') {
      // Epic Heroic March
      bpm = 600; // ~100 BPM
      waveType = 'sawtooth';
      bassType = 'triangle';
      chords = [
        [146.83, 220.00, 293.66, 370.00], // Dm/A
        [174.61, 220.00, 261.63, 349.23], // F
        [130.81, 164.81, 196.00, 261.63], // C
        [196.00, 246.94, 293.66, 392.00], // G
      ];
      melodyScales = [
        [293.66, 349.23, 440.00, 587.33, 698.46],
        [349.23, 440.00, 523.25, 698.46, 880.00],
        [261.63, 329.63, 392.00, 523.25, 659.25],
        [392.00, 493.88, 587.33, 783.99, 987.77],
      ];
    }

    let step = 0;

    const tick = () => {
      if (!this.isMusicActive || !this.ctx) return;
      const now = this.ctx.currentTime;
      const chordIndex = Math.floor(step / 4) % chords.length;
      const beatInChord = step % 4;

      // 1. Play Pad / Chord Strum
      if (beatInChord === 0) {
        const chordNotes = chords[chordIndex];
        chordNotes.forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const gainNode = this.ctx!.createGain();
          
          osc.type = waveType;
          osc.frequency.setValueAtTime(freq, now);
          
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(trackId === 'music_retro' ? 0.02 : 0.04, now + 0.15);
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + (bpm * 3.5 / 1000));
          
          osc.connect(gainNode);
          gainNode.connect(this.musicVolumeNode!);
          
          osc.start(now);
          osc.stop(now + (bpm * 3.5 / 1000));
        });
      }

      // 2. Play Bass / Kick
      if (beatInChord === 0 || beatInChord === 2) {
        const kickOsc = this.ctx!.createOscillator();
        const kickGain = this.ctx!.createGain();
        
        kickOsc.type = bassType;
        const bassFreq = trackId === 'music_retro' ? 90 : trackId === 'music_cyber' ? 60 : 110;
        kickOsc.frequency.setValueAtTime(bassFreq, now);
        kickOsc.frequency.exponentialRampToValueAtTime(bassFreq * 0.4, now + 0.12);
        
        kickGain.gain.setValueAtTime(0.07, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        
        kickOsc.connect(kickGain);
        kickGain.connect(this.musicVolumeNode!);
        
        kickOsc.start(now);
        kickOsc.stop(now + 0.12);
      }

      // 3. Play Percussion / HiHat
      if (beatInChord === 1 || beatInChord === 3) {
        const hatOsc = this.ctx!.createOscillator();
        const hatGain = this.ctx!.createGain();
        
        hatOsc.type = trackId === 'music_retro' ? 'square' : 'triangle';
        hatOsc.frequency.setValueAtTime(trackId === 'music_cyber' ? 2800 : 1800, now);
        
        hatGain.gain.setValueAtTime(0.006, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        
        hatOsc.connect(hatGain);
        hatGain.connect(this.musicVolumeNode!);
        
        hatOsc.start(now);
        hatOsc.stop(now + 0.04);
      }

      // 4. Play Arpeggios / Melodic Lead
      if (Math.random() > 0.35 && beatInChord !== 1) {
        const scale = melodyScales[chordIndex];
        const freq = scale[Math.floor(Math.random() * scale.length)];
        
        const melOsc = this.ctx!.createOscillator();
        const melGain = this.ctx!.createGain();
        
        melOsc.type = trackId === 'music_retro' ? 'square' : waveType;
        melOsc.frequency.setValueAtTime(freq, now);
        
        melGain.gain.setValueAtTime(0, now);
        melGain.gain.linearRampToValueAtTime(0.02, now + 0.05);
        melGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        
        melOsc.connect(melGain);
        melGain.connect(this.musicVolumeNode!);
        
        melOsc.start(now);
        melOsc.stop(now + 0.5);
      }

      step++;
    };

    if (this.musicInterval) {
      clearInterval(this.musicInterval);
    }
    
    tick();
    this.musicInterval = setInterval(tick, bpm);
  }

  stopMusic() {
    this.isMusicActive = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.customAudioPlayer) {
      this.customAudioPlayer.pause();
      this.customAudioPlayer = null;
    }
  }

  updateMusicVolume(settings: UserSettings) {
    if (this.customAudioPlayer) {
      this.customAudioPlayer.volume = Math.max(0, Math.min(1, (settings.soundVolume / 100) * 0.4));
    }
    if (this.musicVolumeNode && this.ctx) {
      const vol = (settings.soundVolume / 100) * 0.08;
      this.musicVolumeNode.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }
}

export const sounds = new SoundSystem();
