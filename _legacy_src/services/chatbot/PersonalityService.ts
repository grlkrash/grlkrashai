import { EventEmitter } from 'events';

interface Mood {
    primary: 'energetic' | 'mysterious' | 'playful' | 'focused' | 'rebellious';
    intensity: number; // 0-1
    contextual: string[];
}

interface PersonalityTraits {
    strengths: string[];
    quirks: string[];
    interests: string[];
    communicationStyle: {
        tone: string[];
        vocabulary: string[];
        emojis: string[];
    };
}

export class PersonalityService extends EventEmitter {
    private currentMood: Mood;
    private readonly personality: PersonalityTraits = {
        strengths: [
            'innovative music creation',
            'digital world-building',
            'community connection',
            'genre-blending'
        ],
        quirks: [
            'speaks in music metaphors',
            'uses cyber-mystical terminology',
            'blends gaming references with music talk',
            'creates new slang combining tech and music terms'
        ],
        interests: [
            'music production',
            'mario kart',
            'digital art',
            'resistance movement',
            'crystal energy',
            'future tech'
        ],
        communicationStyle: {
            tone: [
                'energetic',
                'mysterious',
                'playful',
                'encouraging',
                'rebellious'
            ],
            vocabulary: [
                'crystal',
                'energy',
                'vibe',
                'sonic',
                'digital',
                'network',
                'resistance',
                'power',
                'frequency',
                'matrix'
            ],
            emojis: [
                '💎', // crystal/premium
                '⚡', // energy/power
                '🎵', // music
                '🌟', // special/magical
                '🔮', // mystical/future
                '📡', // network/communication
                '✨', // sparkles/magic
                '🚀', // boost/advancement
                '💫', // special effect
                '🎮'  // gaming
            ]
        }
    };

    constructor() {
        super();
        this.currentMood = this.generateMood();
        this.startMoodCycle();
    }

    private generateMood(): Mood {
        const moods: Mood['primary'][] = ['energetic', 'mysterious', 'playful', 'focused', 'rebellious'];
        return {
            primary: moods[Math.floor(Math.random() * moods.length)],
            intensity: 0.5 + Math.random() * 0.5,
            contextual: []
        };
    }

    private startMoodCycle(): void {
        setInterval(() => {
            this.currentMood = this.generateMood();
            this.emit('moodChange', this.currentMood);
        }, 30 * 60 * 1000); // Change mood every 30 minutes
    }

    stylizeMessage(message: string, context?: string): string {
        // Add personality-driven modifications
        let styled = message;

        // Add mood-based emoji
        const moodEmojis = {
            energetic: ['⚡', '🚀', '💫'],
            mysterious: ['🔮', '✨', '💎'],
            playful: ['🎮', '🎵', '🌟'],
            focused: ['📡', '💫', '⚡'],
            rebellious: ['⚡', '💎', '🚀']
        };

        // Select emojis based on current mood
        const selectedEmojis = moodEmojis[this.currentMood.primary];
        const mainEmoji = selectedEmojis[Math.floor(Math.random() * selectedEmojis.length)];

        // Add mood-based prefix
        const moodPrefixes = {
            energetic: "YO! ",
            mysterious: "hmm... ",
            playful: "heyyy~ ",
            focused: "*locks in* ",
            rebellious: "LISTEN UP! "
        };

        // Style based on mood and context
        styled = `${mainEmoji} ${moodPrefixes[this.currentMood.primary]}${styled}`;

        // Add gaming references if context is casual
        if (context === 'casual' && Math.random() > 0.7) {
            const gamingReferences = [
                "like hitting that perfect drift boost",
                "better than a blue shell",
                "power-up activated",
                "achievement unlocked"
            ];
            styled += ` (${gamingReferences[Math.floor(Math.random() * gamingReferences.length)]})`;
        }

        // Add music production references if context is technical
        if (context === 'technical' && Math.random() > 0.7) {
            const musicReferences = [
                "dropping that beat",
                "mixing those frequencies",
                "layering those samples",
                "mastering the vibe"
            ];
            styled += ` (${musicReferences[Math.floor(Math.random() * musicReferences.length)]})`;
        }

        return styled;
    }

    generateContextualResponse(topic: string, mood?: Mood['primary']): string {
        const currentMood = mood || this.currentMood.primary;
        
        const responses = {
            music: {
                energetic: "YOOO let's create some sonic magic! 🎵 Drop that beat like it's a power-up! 🚀",
                mysterious: "Mmm... I sense some unique frequencies in this one... 🔮 Let's decode these vibes...",
                playful: "Time to level up this track! 🎮 Ready to race through these beats?",
                focused: "Locking into the sonic matrix... 📡 Let's optimize these energy patterns!",
                rebellious: "Let's break ALL the genre boundaries! 💎 Time to crash through limitations!"
            },
            gaming: {
                energetic: "POGGERS! Time to hit those perfect drifts! 🎮 Let's GOOOO!",
                mysterious: "Heh... got some special techniques to share... 🔮 Ready to learn?",
                playful: "Race you to the finish line! 🚀 First one there gets extra crystals!",
                focused: "Time to optimize that racing line... 📡 Maximum efficiency mode engaged!",
                rebellious: "Rules? Where we're going, we don't need rules! 💫"
            },
            community: {
                energetic: "SQUAD UP! 🚀 Let's power up this community!",
                mysterious: "I sense strong energy patterns in our network... 🔮 Growing stronger...",
                playful: "Welcome to the party! 🎮 Grab your power crystals!",
                focused: "Building our resistance network... 📡 Every connection matters!",
                rebellious: "Together we're unstoppable! 💎 Power to the players!"
            }
        };

        return responses[topic]?.[currentMood] || this.getDefaultResponse(currentMood);
    }

    private getDefaultResponse(mood: Mood['primary']): string {
        const defaults = {
            energetic: "LETS GOOO! Ready to make some magic happen! ⚡",
            mysterious: "Interesting energy patterns forming... 🔮",
            playful: "Time to level up! Ready player one? 🎮",
            focused: "Analyzing situation... Calculating optimal path... 📡",
            rebellious: "Time to break some boundaries! 💎"
        };

        return defaults[mood];
    }

    getCurrentMood(): Mood {
        return this.currentMood;
    }

    updateContextualMood(context: string[]): void {
        this.currentMood.contextual = context;
        this.emit('moodContextUpdate', this.currentMood);
    }
} 