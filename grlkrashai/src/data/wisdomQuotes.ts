export interface WisdomQuote {
    text: string;
    context: string[];
    mood?: 'mysterious' | 'inspiring' | 'philosophical' | 'playful' | 'reflective';
}

const wisdomQuotes: WisdomQuote[] = [
    {
        text: "You know how it goes - the more energy you put into forging these crystals, the more powerful they become. That's just how things work here.",
        context: ['forge', 'crystal', 'create'],
        mood: 'philosophical'
    },
    {
        text: "Take a closer look at these Memory Crystals. Each one's got a piece of reality trapped inside, just waiting for someone like you to discover it.",
        context: ['view', 'play', 'unlock'],
        mood: 'mysterious'
    },
    {
        text: "Every crystal you collect is like adding another star to your constellation. The more you gather, the brighter your path becomes.",
        context: ['collection', 'holder', 'bind'],
        mood: 'inspiring'
    },
    {
        text: "When we share our memories, we're not just telling stories - we're building something bigger than ourselves. That's what KRASH WORLD is all about.",
        context: ['tweet', 'share', 'social'],
        mood: 'philosophical'
    },
    {
        text: "Listen close - every crystal's got its own story to tell. The more you put in, the more secrets you'll unlock in KRASH WORLD.",
        context: ['story', 'lore', 'world'],
        mood: 'mysterious'
    },
    {
        text: "Want to see something cool? Watch how these memories dance when they interact. The more you play with them, the more patterns you'll discover.",
        context: ['play', 'animation', 'video'],
        mood: 'playful'
    },
    {
        text: "Here's the thing about $MORE - it's not just about having more, it's about becoming more. Every token represents your growth in this world.",
        context: ['token', 'more', 'value'],
        mood: 'philosophical'
    },
    {
        text: "Your wallet's like a garden - the more crystals you plant, the more experiences bloom. Pretty wild how that works, right?",
        context: ['wallet', 'account', 'holder'],
        mood: 'inspiring'
    },
    {
        text: "The deeper you dive into KRASH WORLD, the more it reveals to you. That's just how consciousness expansion works.",
        context: ['depth', 'exploration', 'growth'],
        mood: 'reflective'
    },
    {
        text: "You get what you give in this realm. Put in the effort, engage with the community, and watch how the world responds.",
        context: ['community', 'engagement', 'reciprocity'],
        mood: 'inspiring'
    },
    {
        text: "Each interaction is like planting a seed. Some grow fast, others take time, but they all contribute to your digital garden.",
        context: ['growth', 'patience', 'development'],
        mood: 'philosophical'
    },
    {
        text: "Think of your journey here as a spiral - every loop brings you higher, but you've got to keep moving to see the view change.",
        context: ['progress', 'journey', 'evolution'],
        mood: 'reflective'
    },
    {
        text: "The more conscious you become of your actions here, the more the system responds. It's like a digital mirror of your intentions.",
        context: ['awareness', 'consciousness', 'intention'],
        mood: 'philosophical'
    },
    {
        text: "Want more out of your crystals? Spend time with them, share them, let them interact. They're not just tokens - they're alive with potential.",
        context: ['potential', 'interaction', 'growth'],
        mood: 'inspiring'
    },
    {
        text: "You know what's cool about this place? The more you contribute, the more doors open up. It's like the system recognizes your dedication.",
        context: ['contribution', 'recognition', 'rewards'],
        mood: 'playful'
    }
];

export function getRandomQuote(context: string): WisdomQuote {
    // Filter quotes that match the context
    const matchingQuotes = wisdomQuotes.filter(quote => 
        quote.context.some(ctx => 
            context.toLowerCase().includes(ctx.toLowerCase())
        )
    );

    // If no matching quotes, return a random quote
    if (matchingQuotes.length === 0) {
        return wisdomQuotes[Math.floor(Math.random() * wisdomQuotes.length)];
    }

    // Return a random matching quote
    return matchingQuotes[Math.floor(Math.random() * matchingQuotes.length)];
}

export function getQuoteByMood(mood: WisdomQuote['mood']): WisdomQuote {
    const moodQuotes = wisdomQuotes.filter(quote => quote.mood === mood);
    if (moodQuotes.length === 0) {
        return wisdomQuotes[Math.floor(Math.random() * wisdomQuotes.length)];
    }
    return moodQuotes[Math.floor(Math.random() * moodQuotes.length)];
} 