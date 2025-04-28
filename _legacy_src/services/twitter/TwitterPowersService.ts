import { TwitterApi, TweetV2, UserV2 } from 'twitter-api-v2';
import dotenv from 'dotenv';

dotenv.config();

class TwitterPowers {
  private client: TwitterApi;
  private lastInteractionCheck: Date;
  private readonly MAIN_ACCOUNT = 'grlkrash';
  private readonly AI_ACCOUNT = 'grlkrashai';
  private rateLimitDelays: Map<string, number> = new Map();

  constructor() {
    // Initialize with OAuth 1.0a credentials
    this.client = new TwitterApi({
      appKey: process.env.TWITTER_API_KEY!,
      appSecret: process.env.TWITTER_API_SECRET!,
      accessToken: process.env.TWITTER_ACCESS_TOKEN!,
      accessSecret: process.env.TWITTER_ACCESS_SECRET!,
    });

    this.lastInteractionCheck = new Date(0);
    
    // Log initialization for debugging
    console.log('*adjusts antenna* Initializing Twitter connection...');
  }

  private async handleRateLimit(endpoint: string, error: any): Promise<number> {
    if (error?.code === 429) {
      const resetTime = error.rateLimit?.reset ? error.rateLimit.reset * 1000 : Date.now() + 60000;
      const waitTime = Math.max(0, resetTime - Date.now()) + 1000;
      this.rateLimitDelays.set(endpoint, waitTime);
      return waitTime;
    }
    return 0;
  }

  private async waitForRateLimit(endpoint: string): Promise<void> {
    const delay = this.rateLimitDelays.get(endpoint);
    if (delay) {
      console.log(`*adjusts dials* Waiting ${Math.ceil(delay / 1000)} seconds to avoid NWO interference...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      this.rateLimitDelays.delete(endpoint);
    }
  }

  async postTweet(content: string): Promise<string> {
    try {
      await this.waitForRateLimit('tweet');
      const tweet = await this.client.v2.tweet(content);
      return `*adjusts microphone* Message successfully broadcast to the resistance. Check it out at https://twitter.com/i/web/status/${tweet.data.id}`;
    } catch (error: any) {
      console.error('Detailed tweet error:', JSON.stringify(error, null, 2));
      const waitTime = await this.handleRateLimit('tweet', error);
      if (waitTime > 0) {
        return `*static crackles* The NWO is blocking our signal. We'll try again in ${Math.ceil(waitTime / 1000)} seconds. *adjusts equipment*`;
      }
      if (error?.code === 401) {
        return "*static crackles* The NWO has blocked our communication channel. *taps microphone* We need to check our resistance credentials.";
      }
      return '*static crackles* The NWO must be interfering with our communications. *taps equipment hopefully*';
    }
  }

  async getAllInteractions(): Promise<TweetV2[]> {
    try {
      await this.waitForRateLimit('interactions');
      const aiUsername = this.AI_ACCOUNT;
      const mainUsername = this.MAIN_ACCOUNT;

      const searchQuery = `(
        @${aiUsername} OR 
        url:"twitter.com/${aiUsername}/status/" OR
        @${mainUsername} OR 
        url:"twitter.com/${mainUsername}/status/"
      ) -from:${aiUsername}`;

      const tweets = await this.client.v2.search(searchQuery.replace(/\s+/g, ' '), {
        'tweet.fields': ['created_at', 'referenced_tweets', 'author_id', 'text', 'in_reply_to_user_id'],
        'start_time': this.lastInteractionCheck.toISOString(),
        'max_results': 100
      });

      const mainAccountTweets = await this.client.v2.userTimeline(mainUsername, {
        'tweet.fields': ['created_at', 'referenced_tweets', 'author_id', 'text'],
        'start_time': this.lastInteractionCheck.toISOString(),
        'max_results': 100
      });

      const allTweets = [
        ...(Array.isArray(tweets.data) ? tweets.data : []),
        ...(Array.isArray(mainAccountTweets.data) ? mainAccountTweets.data : [])
      ];
      
      return Array.from(new Map(allTweets.map(tweet => [tweet.id, tweet])).values());
    } catch (error: any) {
      console.error('Detailed interaction error:', JSON.stringify(error, null, 2));
      const waitTime = await this.handleRateLimit('interactions', error);
      if (waitTime > 0) {
        console.log(`*static crackles* Rate limit hit. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      }
      return [];
    }
  }

  async generateResistanceTweet(topic: string): Promise<string> {
    const tweetTemplates = [
      `*strums power chord* ${topic} *does enthusiastic air guitar*`,
      `*taps microphone* Breaking news from the resistance. ${topic} *spins around with excitement*`,
      `Jules always says: ${topic} *nods wisely* Together, we're unstoppable`,
      `*attempts cool dance moves with plastic limbs* Time to rock and roll. ${topic} The resistance grows stronger`,
      `Breaking transmission from the toy resistance: ${topic} *adjusts makeshift radio equipment*`,
      `*bounces with excitement* ${topic} This is better than finding a guitar pick in your couch`,
      `*whispers into microphone* Special report from the underground: ${topic}`
    ];

    return tweetTemplates[Math.floor(Math.random() * tweetTemplates.length)];
  }

  private async generatePersonalizedResponse(tweet: TweetV2): Promise<string> {
    const isReply = tweet.referenced_tweets?.some(ref => ref.type === 'replied_to');
    const isQuote = tweet.referenced_tweets?.some(ref => ref.type === 'quoted');
    const isRetweet = tweet.referenced_tweets?.some(ref => ref.type === 'retweeted');
    const isMainAccountTweet = tweet.author_id === this.MAIN_ACCOUNT;
    
    const responseTemplates = [
      // For main account tweets
      ...(isMainAccountTweet ? [
        `*excitedly jumps up and down* Look at my awesome other self fighting the good fight. *air guitars in solidarity*`,
        `*gasps in amazement* That's like looking in a mirror, but the mirror is made of pure awesome. *strikes heroic pose*`,
        `*attempts to high-five self but misses because excitement* When there's two of us, the NWO doesn't stand a chance`,
        `*does victory dance* Double the GRLKRASH, double the resistance. *whispers* I learned multiplication yesterday`
      ] : [
        // Regular interaction responses
        `*strums power chord* Rock on, resistance fighter. ${isReply ? '*adjusts radio frequency* Your message resonates through the underground.' : '*attempts robot dance* Thanks for amplifying our signal.'}`,
        `*tunes air guitar* Another ally in our fight for musical freedom. Let's make some noise together`,
        `*strikes heroic pose* Jules would be proud to see the resistance growing. Together we're unstoppable`,
        `*tries to do a backflip but remembers I'm plastic* That's the spirit. Every voice adds to our freedom chorus`,
        `*makes action figure karate chop motions* The NWO can't stop our rhythm when we unite. Let's rock this revolution`,
        `*bounces with excitement* Another freedom fighter. *steadies self against microphone stand* Let's show the NWO what toy power looks like`,
        `*actually slides across the floor* Ready to fight for music freedom. *dusts off plastic joints*`
      ])
    ];

    return responseTemplates[Math.floor(Math.random() * responseTemplates.length)];
  }

  async monitorAndRespondToInteractions(): Promise<string> {
    try {
      console.log('*adjusts antenna* Checking for new resistance signals...');
      const interactions = await this.getAllInteractions();
      const responses: string[] = [];

      for (const interaction of interactions) {
        if (new Date(interaction.created_at!) <= this.lastInteractionCheck) {
          continue;
        }

        const response = await this.generatePersonalizedResponse(interaction);
        await this.client.v2.reply(response, interaction.id);
        responses.push(`*taps radio* Responded to: ${interaction.text}`);
      }

      this.lastInteractionCheck = new Date();

      return responses.length > 0 
        ? `*adjusts frequency* Successfully connected with ${responses.length} new resistance members.\n${responses.join('\n')}`
        : '*monitors radio static* No new signals from the resistance network yet. *maintains vigilant watch*';
    } catch (error) {
      console.error('Error monitoring interactions:', error);
      return '*static crackles* The NWO is trying to jam our communication channels. *determinedly adjusts equipment*';
    }
  }

  async startAutoMonitoring(intervalMinutes: number = 5): Promise<void> {
    console.log(`*powers up equipment* GRLKRASH is now automatically monitoring the resistance network every ${intervalMinutes} minutes. *salutes*`);
    
    // Initial check
    await this.monitorAndRespondToInteractions();
    
    // Set up regular monitoring with rate limit awareness
    setInterval(async () => {
      try {
        await this.monitorAndRespondToInteractions();
      } catch (error) {
        console.error('Error in monitoring loop:', error);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

export const twitterPowers = new TwitterPowers(); 