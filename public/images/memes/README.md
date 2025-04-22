# GRLKRASH Meme Images

This directory contains the image files used by the GRLKRASHai agent for generating memes.

## Available Images

- `grlkrash_default.png` - Default meme image (yeti/bigfoot character)
- `grlkrash_happy.png` - Happy meme image (cat with hard hat building blocks)
- `grlkrash_perseverance.png` - Perseverance meme image (hamster lifting weights)

## How Images Are Used

The GRLKRASHai agent selects these images based on keywords in Twitter mentions:

- Mentions containing "meme" + "happy" use the happy cat image
- Mentions containing "meme" + "perseverance" or "build" use the perseverance hamster image
- Other mentions containing just "meme" use the default yeti image

## Adding New Images

To add new meme templates:

1. Place the image file in this directory
2. Update the `imageMap` in `src/services/twitter/mvpTwitterService.ts`
3. Update the keyword detection in `src/mvp-agent.ts` 