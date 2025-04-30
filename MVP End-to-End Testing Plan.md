### MVP End-to-End Testing Plan

**Goal:** Verify the complete workflow from Twitter mention to G.A.M.E. processing and Twitter reply/action.

**Prerequisites:**
1.  `.env` file populated with valid `OPENAI_API_KEY` and Twitter API v2 App Key/Secret, Access Token/Secret, Bearer Token.
2.  `src/services/twitter/mvpTwitterService.ts` fully implemented and functional based on the previous step.
3.  `src/mvp-agent.ts` verified and potentially adjusted based on the integration prompt above.
4.  G.A.M.E. `GameWorker` initialized in `mvp-agent.ts`. Basic `worker.processInput` logic should be implemented (even if it's just simple rules returning `{action: '...', content: '...'}` based on keywords for now).
5.  Predefined images (e.g., `grlkrash_default.png`, `grlkrash_happy.png`) exist in the correct `public/images/grlkrash/` directory and match the keys used in `mvpTwitterService.ts`.
6.  Dependencies installed (`npm install`).
7.  Code compiled (e.g., `npm run build` if using TypeScript compiler `tsc`).
8.  A separate Twitter account available for sending test mentions to `@GRLKRASHai`.

**Test Steps:**

1.  **Start the Agent:**
    * **Action:** Run the agent script from your terminal (e.g., `node dist/mvp-agent.js` or `ts-node src/mvp-agent.ts`).
    * **Observe Logs:** Check the console output for:
        * Successful logger initialization.
        * Successful Twitter client initialization log message.
        * Successful stream rule update log message.
        * Twitter listener "Ready" or "Started" log message.
        * The final "GRLKRASHai agent is now running" log message.
        * *Troubleshoot any errors during startup.*
2.  **Test Case: Basic Text Reply (e.g., "hello")**
    * **Action:** From your test Twitter account, tweet: `@GRLKRASHai hello there!`
    * **Observe Logs:**
        * Verify "Received mention..." log appears.
        * Verify "G.A.M.E. decision..." log shows the expected action (e.g., `action: 'POST_TEXT'`).
        * Verify "Attempting to post text tweet" log appears.
        * Verify "Text tweet posted successfully" log appears with a tweet ID.
    * **Verify Twitter:** Go to the `@GRLKRASHai` profile on Twitter and confirm a reply tweet was posted. Check if the content aligns with the expected 'hello' response and GRLKRASH personality.
3.  **Test Case: Meme Request (e.g., "meme")**
    * **Action:** From your test Twitter account, tweet: `@GRLKRASHai create a fun meme`
    * **Observe Logs:**
        * Verify "Received mention..." log.
        * Verify "G.A.M.E. decision..." log shows `action: 'POST_MEME'` and includes an `imageKey`.
        * Verify "Attempting to read image file" log.
        * Verify "Attempting to upload media" log.
        * Verify "Attempting to post image tweet" log.
        * Verify "Image tweet posted successfully" log with a tweet ID.
    * **Verify Twitter:** Check the `@GRLKRASHai` profile for a tweet containing both generated text and the corresponding image from your `public/images/grlkrash/` directory.
4.  **Test Case: Shill Request (e.g., "$MORE")**
    * **Action:** From your test Twitter account, tweet: `@GRLKRASHai tell me about $MORE token`
    * **Observe Logs:**
        * Verify "Received mention..." log.
        * Verify "G.A.M.E. decision..." log shows the expected action (e.g., `action: 'POST_SHILL'` or `action: 'POST_TEXT'`).
        * Verify logs for posting a text tweet.
        * Verify successful posting log.
    * **Verify Twitter:** Check the `@GRLKRASHai` profile for a reply tweet containing information or shilling related to $MORE, styled appropriately.
5.  **Test Case: Ignore (e.g., no relevant keywords)**
    * **Action:** From your test Twitter account, tweet: `@GRLKRASHai just a random message`
    * **Observe Logs:**
        * Verify "Received mention..." log.
        * Verify "G.A.M.E. decision..." log shows `action: 'IGNORE'`.
        * Verify "Ignoring mention..." log.
    * **Verify Twitter:** Check the `@GRLKRASHai` profile and confirm that **NO reply** was posted for this mention.
6.  **Test Case: Shutdown**
    * **Action:** While the agent is running in the terminal, press `Ctrl+C`.
    * **Observe Logs:**
        * Verify "Shutting down..." log appears.
        * Verify "Twitter stream closed" log appears (if the stream was active).
        * Verify "Twitter service shutdown complete" log appears.
        * Confirm the Node.js process exits cleanly without errors.

**Troubleshooting During Testing:**
* Monitor logs closely for any JavaScript errors, API errors (from Twitter or OpenAI), or file system errors.
* Check your `.env` file for correct API keys/tokens if you get authentication errors.
* Review the Twitter Developer Portal dashboard for your App to check for API usage limits or errors.
* Verify image paths and file permissions if image tweets fail.
* If decisions from G.A.M.E. (`worker.processInput`) are not as expected, debug the logic within your `GameWorker` implementation (or the simple rules you set up for testing).