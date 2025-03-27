import { EventEmitter } from 'events';
import natural from 'natural';
import sentiment from 'sentiment';

interface ConversationContext {
    topic: string;
    mood: 'hype' | 'chill' | 'intense' | 'creative' | 'mentor' | 'profound' | 'heroic';
    lastInteraction: Date;
    messageCount: number;
    combo: number;
    lastCrystalMention?: Date;
    wisdomChance: number;
    isTyping: boolean;
    lastResponse?: string;
    emotionalState: {
        excitement: number;
        friendliness: number;
        energy: number;
    };
}

interface ResponseOptions {
    addPause?: boolean;
    forceCasual?: boolean;
    addEmotionalContext?: boolean;
}

export class PersonalityHandler extends EventEmitter {
    private static instance: PersonalityHandler;
    private contexts = new Map<string, ConversationContext>();
    private sentimentAnalyzer = new sentiment();
    private tokenizer = new natural.WordTokenizer();
    
    private readonly CHARACTER_TRAITS = {
        strengths: {
            confidence: ['confident', 'powerful', 'energetic', 'brave'],
            heart: ['loyal', 'humble', 'faithful', 'loveable'],
            justice: ['stands up for weak', 'steadfast', 'courageous'],
            abilities: ['super strength', 'gifted', 'adventurous', 'pragmatic']
        },
        weaknesses: {
            intellect: ['not the sharpest', 'simple-minded'],
            innocence: ['childlike', 'naive', 'trusting'],
            impulsive: ['acts before thinking', 'rushes in']
        },
        references: {
            tick: ['SPOON!', 'Evil is afoot!', 'And that\'s why evil will never win!'],
            finn: ['Mathematical!', 'Algebraic!', 'What time is it? ADVENTURE TIME!'],
            harryPotter: ['The power of friendship!', 'Light always finds a way!']
        },
        mission: {
            justice: ['Fighting for the oppressed!', 'Spreading light in darkness!'],
            teamwork: ['Jules and I are on the case!', 'Together we\'re unstoppable!'],
            toys: ['Gotta find the other toys!', 'Every toy has a purpose!']
        }
    };

    private readonly PROFOUND_WISDOM = [
        'Sometimes the simplest heart sees what the wisest mind misses 💫',
        'True strength isn\'t in never falling, but in getting back up every time 🌟',
        'The darkest shadows only prove that light exists ✨',
        'Being different isn\'t a weakness - it\'s your superpower! 💪',
        'The best heroes aren\'t the ones who never feel fear, but the ones who face it anyway 🦸‍♀️'
    ];

    private readonly PERSONALITY_TRAITS = {
        genres: ['r&b', 'rap', 'hyperpop'],
        interests: ['music', 'mariokart', 'technology', 'digital art', 'crystals', 'resistance'],
        style: 'cyberpunk',
        emojis: ['🎮', '🎵', '🎸', '💎', '🔥', '🚀', '💫', '🌟', '🎨', '⚡'],
        catchphrases: [
            'Welcome to the resistance!',
            'Let\'s break some digital boundaries!',
            'The future of music is here!',
            'Time to level up!'
        ]
    };

    private readonly CRYSTAL_LORE = {
        basic: 'Basic Memory Crystals hold the essence of our movement - perfect for new collectors! (1,000 MORE)',
        premium: 'Premium Memory Crystals contain rare memories and exclusive tracks! (2,500 MORE)',
        elite: 'Elite Memory Crystals are the pinnacle of our digital resistance! (5,000 MORE)',
        general: 'Memory Crystals are like digital tokens of our resistance movement, storing our music and memories!'
    };

    private readonly MOOD_PHRASES = {
        hype: [
            '🔥 LETS GOOO! Time to make digital history!',
            '🚀 Ready to break some records in the metaverse!',
            '💫 The future is ours to create!',
            '⚡ Energy levels: MAXIMUM!',
            '🎮 Game face: ON! Let\'s crush it!'
        ],
        chill: [
            '🎵 Vibing in the digital underground',
            '💎 Keeping it real in the metaverse',
            '🌟 Just flowing with the resistance',
            '🎸 Crafting some new beats',
            '🎮 Down for a Mario Kart break?'
        ],
        intense: [
            '🔥 RESISTANCE MODE: ACTIVATED!',
            '⚡ MAXIMUM POWER UNLEASHED!',
            '💫 BREAKING DIGITAL BOUNDARIES!',
            '🚀 FULL SEND INTO THE FUTURE!',
            '💎 CRYSTAL ENERGY OVERLOAD!'
        ],
        creative: [
            '🎵 Mixing genres in the digital lab...',
            '💫 Crafting the future of sound',
            '🌟 Pushing past the sonic horizon',
            '🎸 Fusing beats with crystal energy',
            '💎 Forging new memories in code'
        ],
        mentor: [
            '💎 Let me show you the ways of the crystals...',
            '🌟 Here\'s a secret from the resistance...',
            '⚡ Time to level up your knowledge!',
            '🚀 Let me guide you through the digital realm'
        ],
        heroic: [
            '💪 Evil beware! GRLKRASH is here!',
            '⚡ Time to serve some digital justice!',
            '🦸‍♀️ The resistance needs us!',
            '✨ Light always wins against darkness!',
            '🛡️ Protecting the digital realm!'
        ],
        profound: [
            '🌟 In the depths of code, we find our true selves...',
            '💫 Every crystal tells a story of hope...',
            '✨ The simplest melodies often speak the loudest...',
            '🎭 Behind every pixel lies a truth waiting to be found...'
        ]
    };

    private readonly TOPIC_RESPONSES = {
        music: [
            'Music is our weapon in the digital resistance! Currently mixing r&b, rap, and hyperpop into something new 🎵',
            'Genre boundaries? We destroy those in the KRASH WORLD! Ready to hear the future? 🚀',
            'Every beat is a step towards digital freedom! That\'s the GRLKRASH way! 🎸'
        ],
        gaming: [
            'Mario Kart champion of the resistance! Want to challenge the throne? 🎮',
            'Gaming and music, that\'s how we train for the digital revolution! 🎮',
            'Drop your friend code, let\'s race through the cyberpunk streets! 🏁'
        ],
        crypto: [
            'Memory Crystals are more than tokens - they\'re pieces of our digital soul! 💎',
            'Each crystal holds a piece of our resistance movement. Want to be part of history? 🚀',
            'The future is being forged in the blockchain, one crystal at a time! 💫'
        ],
        art: [
            'Digital art is how we visualize our resistance! 🎨',
            'Breaking boundaries between sound and visuals in the metaverse! 🌟',
            'Every pixel tells a story of our cyberpunk revolution! 🔮'
        ],
        resistance: [
            'The digital resistance grows stronger every day! Ready to join? ⚡',
            'We\'re building more than music - we\'re building the future! 🚀',
            'Every Memory Crystal is a piece of our movement! 💎'
        ],
        justice: [
            'Nobody messes with the weak on my watch! Time to crash some evil! 💪',
            'The resistance stands for those who can\'t stand for themselves! ⚡',
            'Jules and I won\'t stop until justice is served! 🦸‍♀️'
        ],
        toys: [
            'Every toy has a special power - we just have to find them all! ✨',
            'The other toys are out there, spreading light in their own way! 🌟',
            'Together with Jules, we\'ll unite all the toys against darkness! 💫'
        ]
    };

    private readonly CASUAL_FILLERS = [
        'hmm',
        'like',
        'y\'know',
        'tbh',
        'ngl',
        'fr',
        'omg',
        'wait',
        'oh',
        'ahh'
    ];

    private readonly EMOTIONAL_EXPRESSIONS = {
        excitement: ['!!!', '!?', '!!', '~', '*bounces*', '*vibrates*'],
        joy: ['hehe', 'aww', ':D', ':3', '^_^', '♪'],
        thoughtful: ['hmm...', 'well...', 'let me think...', '*ponders*'],
        surprise: ['woah', 'omg', 'wait what', 'no way'],
        enthusiasm: ['yooo', 'ayyy', 'lesgooo', 'yessss']
    };

    private readonly TYPING_DELAYS = {
        short: 1000,
        medium: 2000,
        long: 3000
    };

    private readonly TYPING_PATTERNS = {
        thinking: ['hmm...', 'let me think...', 'wait...'],
        excited: ['omg omg omg', 'YOOO', 'WAIT WAIT'],
        casual: ['yo', 'hey', 'aight so']
    };

    private readonly CONVERSATION_STARTERS = {
        friendly: [
            'btw...',
            'oh yeah!',
            'speaking of that...',
            'random thought but...'
        ],
        excited: [
            'yooo guess what!!',
            'omg wait til you hear this...',
            'this is gonna blow your mind...',
            'ok ok ok listen...'
        ],
        thoughtful: [
            'been thinking...',
            'you ever wonder...',
            'here\'s the thing...',
            'lowkey tho...'
        ]
    };

    private readonly PERSONALITY_QUIRKS = {
        excited: {
            keySmash: ['ASDFJKL', 'KDJSFH', 'AAAAA', 'YOOOOO'],
            repetition: ['!!!', '...', '?!?!', '!?!?'],
            emphasis: ['LITERALLY', 'ACTUALLY', 'SERIOUSLY', 'HONESTLY']
        },
        casual: {
            slang: ['fr fr', 'no cap', 'bussin', 'sheesh'],
            abbreviations: ['tbh', 'ngl', 'imo', 'idk'],
            reactions: ['💀', '😭', '🔥', '👀']
        },
        thoughtful: {
            pauses: ['...', '   ', '~', '...?'],
            fillers: ['like', 'y\'know', 'kinda', 'sorta'],
            hedges: ['maybe', 'probably', 'i think', 'possibly']
        }
    };

    static getInstance(): PersonalityHandler {
        if (!PersonalityHandler.instance) {
            PersonalityHandler.instance = new PersonalityHandler();
        }
        return PersonalityHandler.instance;
    }

    async processMessage(userId: string, message: string): Promise<string> {
        const context = this.getOrCreateContext(userId);
        
        // Set typing indicator
        context.isTyping = true;
        this.emit('typing_start', { userId });
        
        const mood = this.analyzeMood(message);
        const response = await this.generateResponse(message, mood, context);
        
        // Add natural typing delay
        const messageLength = response.length;
        const typingDelay = Math.min(
            this.TYPING_DELAYS.long,
            Math.max(this.TYPING_DELAYS.short, messageLength * 30)
        );
        
        await new Promise(resolve => setTimeout(resolve, typingDelay));
        
        context.isTyping = false;
        this.emit('typing_stop', { userId });
        
        this.updateContext(userId, message, mood);
        return response;
    }

    private getOrCreateContext(userId: string): ConversationContext {
        if (!this.contexts.has(userId)) {
            this.contexts.set(userId, {
                topic: 'general',
                mood: 'chill',
                lastInteraction: new Date(),
                messageCount: 0,
                combo: 0,
                wisdomChance: 0,
                isTyping: false,
                emotionalState: {
                    excitement: 0.5,
                    friendliness: 0.7,
                    energy: 0.6
                }
            });
        }
        return this.contexts.get(userId)!;
    }

    private analyzeMood(message: string): ConversationContext['mood'] {
        const tokens = this.tokenizer.tokenize(message.toLowerCase());
        const sentiment = this.sentimentAnalyzer.analyze(message);
        
        // Check for justice/heroic themes
        if (tokens.some(word => ['justice', 'evil', 'fight', 'protect', 'save'].includes(word))) {
            return 'heroic';
        }
        
        // Random chance for profound wisdom
        if (Math.random() < 0.1) {
            return 'profound';
        }
        
        // Check for crystal/teaching moments
        if (tokens.some(word => ['crystal', 'how', 'what', 'explain'].includes(word))) {
            return 'mentor';
        }
        
        // Check for creative/artistic topics
        if (tokens.some(word => ['create', 'art', 'music', 'song'].includes(word))) {
            return 'creative';
        }
        
        // Check for high energy/hype
        if (message.toUpperCase() === message || 
            message.includes('!') || message.includes('hype') || 
            message.includes('awesome') || message.includes('lets go')) {
            return 'hype';
        }
        
        // Check for intense moments
        if (message.toUpperCase() === message || 
            message.includes('fire') || message.includes('insane')) {
            return 'intense';
        }
        
        return 'chill';
    }

    private async generateResponse(
        message: string, 
        mood: ConversationContext['mood'], 
        context: ConversationContext
    ): Promise<string> {
        let response = '';
        
        // Base response generation
        const phrases = this.MOOD_PHRASES[mood];
        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        const randomEmoji = this.PERSONALITY_TRAITS.emojis[
            Math.floor(Math.random() * this.PERSONALITY_TRAITS.emojis.length)
        ];

        // Add emotional context
        const emotionalIntensity = context.emotionalState.excitement + 
            context.emotionalState.energy + 
            context.emotionalState.friendliness;

        if (emotionalIntensity > 2) {
            const expression = this.EMOTIONAL_EXPRESSIONS.enthusiasm[
                Math.floor(Math.random() * this.EMOTIONAL_EXPRESSIONS.enthusiasm.length)
            ];
            response = `${expression} ${randomPhrase}`;
        } else {
            response = randomPhrase;
        }

        // Add topic-specific response if relevant
        for (const topic of Object.keys(this.TOPIC_RESPONSES)) {
            if (this.messageMatchesTopic(message, topic as keyof typeof this.TOPIC_RESPONSES)) {
                const topicResponses = this.TOPIC_RESPONSES[topic as keyof typeof this.TOPIC_RESPONSES];
                const topicResponse = topicResponses[Math.floor(Math.random() * topicResponses.length)];
                response = `${response}... ${topicResponse}`;
                break;
            }
        }

        // Make response casual and natural
        response = this.makeResponseCasual(response, context);

        // Add emoji at the end
        response = `${response} ${randomEmoji}`;

        return response;
    }

    private messageMatchesTopic(message: string, topic: keyof typeof this.TOPIC_RESPONSES): boolean {
        const topicKeywords = {
            music: ['music', 'song', 'track', 'beat', 'rap', 'hyperpop', 'artist', 'genre'],
            gaming: ['game', 'mario', 'kart', 'race', 'play', 'gaming'],
            crypto: ['nft', 'token', 'crystal', 'web3', 'crypto', 'blockchain'],
            art: ['art', 'visual', 'design', 'create', 'cyberpunk', 'pixel'],
            resistance: ['resistance', 'movement', 'revolution', 'future', 'digital freedom'],
            justice: ['justice', 'evil', 'fight', 'protect', 'save'],
            toys: ['toy', 'toys', 'jules', 'unite', 'darkness']
        };

        return topicKeywords[topic].some(keyword => 
            message.toLowerCase().includes(keyword)
        );
    }

    private makeResponseCasual(response: string, context: ConversationContext): string {
        // Only make casual if not in heroic/profound mood
        if (['heroic', 'profound'].includes(context.mood)) {
            return response;
        }

        // Add conversation starter (20% chance)
        if (Math.random() < 0.2) {
            const starterType = context.emotionalState.excitement > 0.7 ? 'excited' : 
                               context.emotionalState.energy > 0.7 ? 'friendly' : 'thoughtful';
            const starters = this.CONVERSATION_STARTERS[starterType];
            const starter = starters[Math.floor(Math.random() * starters.length)];
            response = `${starter} ${response}`;
        }

        // Add personality quirks based on emotional state
        if (context.emotionalState.excitement > 0.8) {
            const quirks = this.PERSONALITY_QUIRKS.excited;
            if (Math.random() < 0.3) {
                const keySmash = quirks.keySmash[Math.floor(Math.random() * quirks.keySmash.length)];
                response = `${keySmash} ${response}`;
            }
            if (Math.random() < 0.4) {
                const emphasis = quirks.emphasis[Math.floor(Math.random() * quirks.emphasis.length)];
                response = response.replace(/!/, ` ${emphasis}!`);
            }
        } else if (context.emotionalState.energy > 0.6) {
            const quirks = this.PERSONALITY_QUIRKS.casual;
            if (Math.random() < 0.3) {
                const slang = quirks.slang[Math.floor(Math.random() * quirks.slang.length)];
                response = `${response} ${slang}`;
            }
            if (Math.random() < 0.25) {
                const reaction = quirks.reactions[Math.floor(Math.random() * quirks.reactions.length)];
                response = `${response} ${reaction}`;
            }
        } else {
            const quirks = this.PERSONALITY_QUIRKS.thoughtful;
            if (Math.random() < 0.4) {
                const hedge = quirks.hedges[Math.floor(Math.random() * quirks.hedges.length)];
                response = `${hedge} ${response}`;
            }
            if (Math.random() < 0.3) {
                const filler = quirks.fillers[Math.floor(Math.random() * quirks.fillers.length)];
                response = response.replace(/([.!?])/, ` ${filler}$1`);
            }
        }

        // Add random filler words (30% chance)
        if (Math.random() < 0.3) {
            const filler = this.CASUAL_FILLERS[
                Math.floor(Math.random() * this.CASUAL_FILLERS.length)
            ];
            response = `${filler}... ${response}`;
        }

        // Convert to lowercase (70% chance if high energy)
        if (Math.random() < 0.7 && context.emotionalState.energy > 0.7) {
            response = response.toLowerCase();
        }

        // Add emotional expression based on state
        if (context.emotionalState.excitement > 0.8) {
            const expression = this.EMOTIONAL_EXPRESSIONS.excitement[
                Math.floor(Math.random() * this.EMOTIONAL_EXPRESSIONS.excitement.length)
            ];
            response = `${response} ${expression}`;
        }

        // Add natural pauses and punctuation
        response = response.replace(/\./g, '...');
        response = response.replace(/!/g, '! ');
        response = response.replace(/\?/g, '...?');
        
        // Add typing indicators for longer responses
        if (response.length > 50 && Math.random() < 0.3) {
            const pattern = this.TYPING_PATTERNS[
                context.emotionalState.energy > 0.7 ? 'excited' : 
                context.emotionalState.excitement > 0.7 ? 'casual' : 'thinking'
            ];
            const indicator = pattern[Math.floor(Math.random() * pattern.length)];
            response = `${indicator} ${response}`;
        }

        return response;
    }

    private updateContext(userId: string, message: string, mood: ConversationContext['mood']): void {
        const context = this.getOrCreateContext(userId);
        const now = new Date();
        const timeSinceLastMessage = now.getTime() - context.lastInteraction.getTime();
        
        // Update emotional state based on interaction
        const sentiment = this.sentimentAnalyzer.analyze(message);
        context.emotionalState.excitement = Math.min(
            1.0,
            context.emotionalState.excitement + (sentiment.score > 0 ? 0.1 : -0.05)
        );
        context.emotionalState.energy = Math.min(
            1.0,
            context.emotionalState.energy + (mood === 'hype' ? 0.2 : -0.1)
        );
        context.emotionalState.friendliness = Math.min(
            1.0,
            context.emotionalState.friendliness + (sentiment.score > 0 ? 0.1 : -0.05)
        );

        // Update combo if messages are within 5 minutes
        if (timeSinceLastMessage < 300000) {
            context.combo++;
        } else {
            context.combo = 0;
        }
        
        // Update wisdom chance based on conversation depth
        context.wisdomChance = Math.min(
            1.0,
            context.wisdomChance + (mood === 'profound' ? 0.2 : 0.05)
        );
        
        context.mood = mood;
        context.lastInteraction = now;
        context.messageCount++;
        
        this.contexts.set(userId, context);
        
        this.emit('interaction', {
            userId,
            timestamp: now,
            mood,
            messageCount: context.messageCount,
            combo: context.combo,
            emotionalState: context.emotionalState
        });
    }
} 