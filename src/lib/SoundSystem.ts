import { UserSettings } from '../types';

class SoundSystem {
  private ctx: AudioContext | null = null;
  private musicInterval: any = null;
  private musicVolumeNode: GainNode | null = null;
  private isMusicActive: boolean = false;

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

  playDraw(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const type = settings.synthType;
    this.playTone([261.63, 329.63], [0.08, 0.12], type, volume, pitch);
  }

  playPlay(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const type = settings.synthType;
    this.playTone([392.00, 523.25], [0.08, 0.15], type, volume, pitch);
  }

  playCoin(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const type = settings.synthType;
    this.playTone([523.25, 659.25, 783.99, 1046.50], [0.05, 0.05, 0.05, 0.2], type, volume, pitch);
  }

  playAction(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
    const type = settings.synthType;
    this.playTone([440.00, 349.23, 440.00, 523.25], [0.1, 0.1, 0.1, 0.25], type, volume, pitch);
  }

  playSteal(settings: UserSettings) {
    const volume = settings.soundVolume / 100;
    const pitch = settings.soundPitch;
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

  playPropertyPlace(settings: UserSettings, comboCount: number = 0) {
    const volume = settings.soundVolume / 100;
    const comboMultiplier = 1.0 + (comboCount * 0.15);
    const pitch = settings.soundPitch * comboMultiplier;
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

  playActionCardPlay(settings: UserSettings, comboCount: number = 0) {
    const volume = settings.soundVolume / 100;
    const comboMultiplier = 1.0 + (comboCount * 0.15);
    const pitch = settings.soundPitch * comboMultiplier;
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

  startMusic(settings: UserSettings) {
    if (this.isMusicActive) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    this.isMusicActive = true;

    if (!this.musicVolumeNode) {
      this.musicVolumeNode = ctx.createGain();
      this.musicVolumeNode.connect(ctx.destination);
    }
    
    // Low baseline volume so it stays atmospheric
    const vol = (settings.soundVolume / 100) * 0.08;
    this.musicVolumeNode.gain.setValueAtTime(vol, ctx.currentTime);

    const chords = [
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [130.81, 164.81, 196.00, 246.94], // Cmaj7
      [196.00, 246.94, 293.66, 329.63], // G6
    ];

    const melodyScales = [
      [440.00, 523.25, 587.33, 659.25, 783.99], // A minor pentatonic
      [349.23, 440.00, 523.25, 587.33, 659.25], // F major pentatonic
      [261.63, 293.66, 329.63, 392.00, 440.00], // C major pentatonic
      [293.66, 329.63, 392.00, 440.00, 493.88], // G major pentatonic
    ];

    let step = 0;

    const tick = () => {
      if (!this.isMusicActive || !this.ctx) return;
      const now = this.ctx.currentTime;
      const chordIndex = Math.floor(step / 4) % chords.length;
      const beatInChord = step % 4;

      // 1. Play Soft Pad Chord
      if (beatInChord === 0) {
        const chordNotes = chords[chordIndex];
        chordNotes.forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const gainNode = this.ctx!.createGain();
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);
          
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.04, now + 0.3); // Soft attack
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2.8); // Long decay
          
          osc.connect(gainNode);
          gainNode.connect(this.musicVolumeNode!);
          
          osc.start(now);
          osc.stop(now + 2.8);
        });
      }

      // 2. Play Deep Soft Kick Drum (Step 0 and 2)
      if (beatInChord === 0 || beatInChord === 2) {
        const kickOsc = this.ctx!.createOscillator();
        const kickGain = this.ctx!.createGain();
        
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(120, now);
        kickOsc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
        
        kickGain.gain.setValueAtTime(0.08, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        
        kickOsc.connect(kickGain);
        kickGain.connect(this.musicVolumeNode!);
        
        kickOsc.start(now);
        kickOsc.stop(now + 0.12);
      }

      // 3. Play Retro Hihat Shaker (Step 1 and 3)
      if (beatInChord === 1 || beatInChord === 3) {
        const hatOsc = this.ctx!.createOscillator();
        const hatGain = this.ctx!.createGain();
        
        hatOsc.type = 'triangle';
        hatOsc.frequency.setValueAtTime(2000, now);
        
        hatGain.gain.setValueAtTime(0.006, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        
        hatOsc.connect(hatGain);
        hatGain.connect(this.musicVolumeNode!);
        
        hatOsc.start(now);
        hatOsc.stop(now + 0.04);
      }

      // 4. Play Gentle Pentatonic Arpeggio Melodies
      if (Math.random() > 0.4 && beatInChord !== 1) {
        const scale = melodyScales[chordIndex];
        const freq = scale[Math.floor(Math.random() * scale.length)];
        
        const melOsc = this.ctx!.createOscillator();
        const melGain = this.ctx!.createGain();
        
        melOsc.type = 'sine';
        melOsc.frequency.setValueAtTime(freq, now);
        
        melGain.gain.setValueAtTime(0, now);
        melGain.gain.linearRampToValueAtTime(0.02, now + 0.08); // Gentle swell
        melGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        
        melOsc.connect(melGain);
        melGain.connect(this.musicVolumeNode!);
        
        melOsc.start(now);
        melOsc.stop(now + 0.6);
      }

      step++;
    };

    if (this.musicInterval) {
      clearInterval(this.musicInterval);
    }
    
    tick();
    this.musicInterval = setInterval(tick, 750); // 80 BPM
  }

  stopMusic() {
    this.isMusicActive = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  updateMusicVolume(settings: UserSettings) {
    if (this.musicVolumeNode && this.ctx) {
      const vol = (settings.soundVolume / 100) * 0.08;
      this.musicVolumeNode.gain.setValueAtTime(vol, this.ctx.currentTime);
    }
  }
}

export const sounds = new SoundSystem();
