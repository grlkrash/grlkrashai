import { Howl } from 'howler';
import { NodeStorage } from './NodeStorage';

export enum SoundAction {
    // Crystal actions
    FORGE_CRYSTAL = 'FORGE_CRYSTAL',
    BIND_CRYSTAL = 'BIND_CRYSTAL',
    
    // Twitter actions
    TWEET = 'TWEET',
    REPLY = 'REPLY',
    FOLLOW = 'FOLLOW',
    
    // General actions
    START = 'START',
    STOP = 'STOP',
    SUCCESS = 'SUCCESS',
    ERROR = 'ERROR'
}

// Sound file mapping
const soundFiles = {
    forge: new Howl({ src: ['/sounds/forge.mp3'] }),
    bind: new Howl({ src: ['/sounds/bind.mp3'] }),
    stop: new Howl({ src: ['/sounds/stop.mp3'] }),
    success: new Howl({ src: ['/sounds/success.mp3'] })
};

// Map actions to sound files
const actionSoundMap: Record<SoundAction, Howl> = {
    // Crystal actions
    [SoundAction.FORGE_CRYSTAL]: soundFiles.forge,
    [SoundAction.BIND_CRYSTAL]: soundFiles.bind,
    
    // Twitter actions - using existing sounds
    [SoundAction.TWEET]: soundFiles.success,
    [SoundAction.REPLY]: soundFiles.bind,
    [SoundAction.FOLLOW]: soundFiles.success,
    
    // General actions
    [SoundAction.START]: soundFiles.forge,
    [SoundAction.STOP]: soundFiles.stop,
    [SoundAction.SUCCESS]: soundFiles.success,
    [SoundAction.ERROR]: soundFiles.stop
};

export class SoundEffects {
    private static instance: SoundEffects;
    private enabled: boolean;
    private sounds: Map<SoundAction, Howl>;

    constructor() {
        const storage = new NodeStorage();
        const storedEnabled = storage.getItem('soundEnabled');
        this.enabled = storedEnabled ? JSON.parse(storedEnabled) : true;
        this.sounds = new Map();

        Object.values(SoundAction).forEach(action => {
            const sound = new Howl({
                src: [`/sounds/${action.toLowerCase()}.mp3`],
                volume: 0.3,
                // For success sound, add fade out
                ...(action === SoundAction.SUCCESS && {
                    onfade: () => {
                        setTimeout(() => {
                            sound.fade(0.3, 0, 300);
                        }, 200);
                    }
                })
            });
            this.sounds.set(action, sound);
        });
    }

    public static getInstance(): SoundEffects {
        if (!SoundEffects.instance) {
            SoundEffects.instance = new SoundEffects();
        }
        return SoundEffects.instance;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.sounds.forEach(sound => sound.stop());
        }
    }

    public playSound(action: SoundAction): void {
        if (!this.enabled) return;
        const sound = this.sounds.get(action);
        if (sound) {
            sound.play();
        }
    }

    public async waitForSound(action: SoundAction): Promise<void> {
        if (!this.enabled) return;
        const sound = this.sounds.get(action);
        if (!sound) return;

        return new Promise<void>((resolve) => {
            const id = sound.play();
            sound.once('end', () => resolve(), id);
        });
    }
}

export const playSound = (soundName: string) => {
  const audio = new Audio(`/sounds/${soundName}.mp3`);
  
  // Add fade out effect
  let volume = 1.0;
  const fadeOutDuration = 1000; // 1 second fade
  const fadeOutInterval = 50; // Update every 50ms
  const volumeStep = volume / (fadeOutDuration / fadeOutInterval);
  
  audio.volume = volume;
  audio.play();
  
  const fadeOut = setInterval(() => {
    volume = Math.max(0, volume - volumeStep);
    audio.volume = volume;
    
    if (volume <= 0) {
      clearInterval(fadeOut);
      audio.pause();
      audio.currentTime = 0;
    }
  }, fadeOutInterval);
}; 