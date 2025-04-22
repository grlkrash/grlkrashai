// Content arrays for different access levels
interface ContentItem {
    name: string;
    contentURI: string;
    type: 'music' | 'video' | 'images';
}

// Basic Access Content (Level 1)
export const BASIC_CONTENT: ContentItem[] = [
    // Music
    {
        name: "MORE_INSTRUMENTAL",
        contentURI: "ipfs://QmcXG4L9nRQ31jKCViFV5CYXrzDnuWQ4zUrJyeTaF4FKqG",
        type: "music"
    },
    {
        name: "MORE_SNIPPET",
        contentURI: "ipfs://QmYnTNmPrG7d4Sh4PZuRZ1pbSkZ4VdMHZD91SZ3XubTKuT",
        type: "music"
    },
    {
        name: "PSILOCYBIN",
        contentURI: "ipfs://QmcHZS9Rq5wpXozGhzknYzT8gzZ1oASHpWawWjGNZ8vYXr",
        type: "music"
    },
    {
        name: "PSILOCYBIN_INSTRUMENTAL",
        contentURI: "ipfs://QmRxKWkvfkxY215RX3k9CLtZJuPLyvZbomke7Jd69WKuaQ",
        type: "music"
    },
    {
        name: "RIDE_OR_DIE",
        contentURI: "ipfs://QmQmb9hEBgZQSkLdYGpSdb79169VKnMjswdHFajNJA46XJ",
        type: "music"
    },
    // Images
    {
        name: "PSILOCYBIN_COVER",
        contentURI: "ipfs://QmPw74yKWhMsbgEmW6JKKukCm1wphuHjAZMrpB3ufzWbAb",
        type: "images"
    },
    {
        name: "RIDE_OR_DIE_COVER",
        contentURI: "ipfs://QmZUaAPCCdF8x2M8ZRz5qUhbZNAyCFqR7jZqwVk8MKrK1Y",
        type: "images"
    },
    {
        name: "RIDE_OR_DIE_MODELING",
        contentURI: "ipfs://QmWsFLBHC2YuaAF5C5pUi6gGvCYvQqN1xAT9MurAXWjsMz",
        type: "images"
    },
    {
        name: "RIDE_OR_DIE_STILL_1",
        contentURI: "ipfs://QmRRM4GWMjDfPKm6bkKvruUrL3dXJ45vLvmzsLhfSWKUB7",
        type: "images"
    },
    {
        name: "RIDE_OR_DIE_STILL_2",
        contentURI: "ipfs://QmQW4xgtbMRMp9wF52ez9pfXK9Pm7TdACvezZ617cDd6M6",
        type: "images"
    },
    {
        name: "RIDE_OR_DIE_STILL_3",
        contentURI: "ipfs://QmQmGcHcUSPZNug1HEgMjWjAwUKkwsQ7MsXqRzNsVHWpRs",
        type: "images"
    },
    {
        name: "RIDE_OR_DIE_STILL_4",
        contentURI: "ipfs://QmbEyAvNJkmqRP8crLKjnWa46nEwQ5sFC2jXbzsw58nADR",
        type: "images"
    },
    {
        name: "RIDE_OR_DIE_STILL_5",
        contentURI: "ipfs://QmYLVRm1Yi5XYnUaQaCqBv2EyTmFDT5nnAvxTLia4vnCoN",
        type: "images"
    }
];

// Premium Access Content (Level 2)
export const PREMIUM_CONTENT: ContentItem[] = [
    // Videos
    {
        name: "PSILOCYBIN_ANIMATION_PART_1",
        contentURI: "ipfs://QmbJuivmDpfyPt3tqV33HP54KZ73MLFtmv3w95jkkeZ2pT",
        type: "video"
    },
    {
        name: "PSILOCYBIN_ANIMATION_PART_2",
        contentURI: "ipfs://QmRgEFHnQgFhJ7UdAccRzkBAX8FVK3Ld5vPp9NB3foLDqN",
        type: "video"
    },
    {
        name: "PSILOCYBIN_ANIMATION_PART_3",
        contentURI: "ipfs://QmRNGhoDKWwKU78s5NRDmaMWnoMeds4KpUK5J6UMuYih3a",
        type: "video"
    },
    // Images
    {
        name: "PSILOCYBIN_ALT_COVER",
        contentURI: "ipfs://QmaS4avaPMY6nB4yb5ZhDWxD83Gd9SPFfc9keJQc9XsMTi",
        type: "images"
    },
    {
        name: "RIDE_OR_DIE_ALT_COVER",
        contentURI: "ipfs://QmVTA3ms2eJ1Uguz6sFq2WYQAiiYmJi5xdVRUWcR5bjMV2",
        type: "images"
    }
];

// Elite Access Content (Level 3)
export const ELITE_CONTENT: ContentItem[] = [
    // Videos
    {
        name: "RIDE_OR_DIE_ANIMATION_FULL",
        contentURI: "ipfs://Qmesy57ivzwfPtRKKzPUmt7SYubPGz84ehUrKBtgBroGyR",
        type: "video"
    },
    // Images
    {
        name: "KRASH_WORLD_BIRD",
        contentURI: "ipfs://QmQZGxRBQPQa17LK2JBCDsz6WzBkdNHP9gMM5ccpvimhtC",
        type: "images"
    },
    {
        name: "RIDE_OR_DIE_STORYBOARD_1",
        contentURI: "ipfs://QmPstdbZCJuBmh6eZMU51xeJbp9kkJBDrxrkbdvX2hbqxz",
        type: "images"
    },
    {
        name: "RIDE_OR_DIE_STORYBOARD_2",
        contentURI: "ipfs://QmfRBQEkGHY4aTqVPsMykrfP9SX8ejcEqTXh4uD7zRYEEF",
        type: "images"
    }
];

// Helper function to get random content by access level
export function getRandomContent(accessLevel: 0 | 1 | 2): ContentItem {
    let contentPool: ContentItem[];
    
    switch(accessLevel) {
        case 0: // Basic
            contentPool = BASIC_CONTENT;
            break;
        case 1: // Premium
            contentPool = [...BASIC_CONTENT, ...PREMIUM_CONTENT];
            break;
        case 2: // Elite
            contentPool = [...BASIC_CONTENT, ...PREMIUM_CONTENT, ...ELITE_CONTENT];
            break;
        default:
            throw new Error("Invalid access level");
    }
    
    return contentPool[Math.floor(Math.random() * contentPool.length)];
} 