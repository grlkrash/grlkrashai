import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import ffmpeg from 'ffmpeg-static';

const execAsync = promisify(exec);
const SOURCE_DIR = '/Users/sonia/Downloads/KRASH WORLD CONTENT';
const TARGET_DIR = path.join(process.cwd(), 'content');

// File mapping with subdirectories
const fileMapping = {
    // Music files (in KRASH WORLD MP3s)
    'KRASH WORLD MP3s/MORE (SNIPPET).mp3': 'music/MORE_SNIPPET.mp3',
    'KRASH WORLD MP3s/PSILOCYBIN (REMIX).mp3': 'music/PSILOCYBIN_REMIX.mp3',
    'KRASH WORLD MP3s/RIDE OR DIE.mp3': 'music/RIDE_OR_DIE.mp3',
    'KRASH WORLD MP3s/PSILOCYBIN.mp3': 'music/PSILOCYBIN.mp3',

    // Instrumentals
    'KRASH WORLD INSTRUMENTALS/PSILOCYBIN (INSTRUMENTAL).wav': 'music/PSILOCYBIN_INSTRUMENTAL.mp3',
    'KRASH WORLD INSTRUMENTALS/MORE (INSTRUMENTAL) .mp3': 'music/MORE_INSTRUMENTAL.mp3',

    // Video files
    'RIDE OR DIE ANIMATIONS/RIDE OR DIE ANIMATION (FULL).mp4': 'video/RIDE_OR_DIE_ANIMATION_FULL.mp4',
    'PSILOCYBIN ANIMATIONS/PSILOCYBIN ANIMATION (FULL).MOV': 'video/PSILOCYBIN_ANIMATION_FULL.mp4',
    'PSILOCYBIN ANIMATIONS/PSILOCYBIN ANIMATION PART 1.MOV': 'video/PSILOCYBIN_ANIMATION_PART_1.mp4',
    'PSILOCYBIN ANIMATIONS/PSILOCYBIN ANIMATION PART 2.mov': 'video/PSILOCYBIN_ANIMATION_PART_2.mp4',
    'PSILOCYBIN ANIMATIONS/PSILOCYBIN ANIMATION PART 3.MOV': 'video/PSILOCYBIN_ANIMATION_PART_3.mp4',
    'PSILOCYBIN ANIMATIONS/PSILOCYBIN ANIMATION BONUS SCENE.MP4': 'video/PSILOCYBIN_ANIMATION_BONUS.mp4',
    'MORE ANIMATIONS/MORE ANIMATION (FULL).mp4': 'video/MORE_ANIMATION_FULL.mp4',
    'MORE ANIMATIONS/MORE ANIMATION PART 1.mp4': 'video/MORE_ANIMATION_PART_1.mp4',
    'MORE ANIMATIONS/MORE ANIMATION PART 2.mp4': 'video/MORE_ANIMATION_PART_2.mp4',
    'MORE ANIMATIONS/MORE ANIMATION PART 3.mp4': 'video/MORE_ANIMATION_PART_3.mp4',
    'MORE ANIMATIONS/MORE ANIMATION PART 4.mp4': 'video/MORE_ANIMATION_PART_4.mp4',
    'MORE ANIMATIONS/MORE ANIMATION PART 5.mp4': 'video/MORE_ANIMATION_PART_5.mp4',
    'MORE ANIMATIONS/MORE ANIMATION PART 6.mp4': 'video/MORE_ANIMATION_PART_6.mp4',
    'MORE ANIMATIONS/MORE ANIMATION PART 7.mp4': 'video/MORE_ANIMATION_PART_7.mp4',
    'MORE ANIMATIONS/MORE ANIMATION PART 8.mp4': 'video/MORE_ANIMATION_PART_8.mp4',

    // Image files
    'RIDE OR DIE STORYBOARD/RIDE OR DIE ANIMATION (STORYBOARD 1).jpg': 'images/RIDE_OR_DIE_STORYBOARD_1.jpeg',
    'RIDE OR DIE STORYBOARD/RIDE OR DIE ANIMATION (STORYBOARD 2) .JPG': 'images/RIDE_OR_DIE_STORYBOARD_2.jpeg',
    'RIDE OR DIE ANIMATION STILLS/RIDE OR DIE (MODELING).JPG': 'images/RIDE_OR_DIE_MODELING.jpeg',
    'RIDE OR DIE ANIMATION STILLS/RIDE OR DIE ANIMATION (STILL 1).jpg': 'images/RIDE_OR_DIE_STILL_1.jpeg',
    'RIDE OR DIE ANIMATION STILLS/RIDE OR DIE ANIMATION (STILL 2).jpg': 'images/RIDE_OR_DIE_STILL_2.jpeg',
    'RIDE OR DIE ANIMATION STILLS/RIDE OR DIE ANIMATION (STILL 3).jpg': 'images/RIDE_OR_DIE_STILL_3.jpeg',
    'RIDE OR DIE ANIMATION STILLS/RIDE OR DIE ANIMATION (STILL 4).jpg': 'images/RIDE_OR_DIE_STILL_4.jpeg',
    'RIDE OR DIE ANIMATION STILLS/RIDE OR DIE ANIMATION (STILL 5).jpg': 'images/RIDE_OR_DIE_STILL_5.jpeg',
    'KRASH WORLD COVER ART/RIDE OR DIE (COVER ART).jpg': 'images/RIDE_OR_DIE_COVER.jpeg',
    'KRASH WORLD COVER ART/RIDE OR DIE (ALT-COVER ART).jpg': 'images/RIDE_OR_DIE_ALT_COVER.jpeg',
    'KRASH WORLD MISCELLANEOUS STILLS/PSILOCYBIN (COVER ART).png': 'images/PSILOCYBIN_COVER.jpeg',
    'KRASH WORLD MISCELLANEOUS STILLS/PSILOCYBIN (ALT-COVER ART).jpg': 'images/PSILOCYBIN_ALT_COVER.jpeg',
    'KRASH WORLD MISCELLANEOUS STILLS/KRASH WORLD BIRD (STILL).PNG': 'images/KRASH_WORLD_BIRD.jpeg'
};

async function convertMovToMp4(sourcePath: string, targetPath: string) {
    console.log(`Converting MOV to MP4: ${sourcePath} -> ${targetPath}`);
    try {
        await execAsync(`"${ffmpeg}" -i "${sourcePath}" -c:v libx264 -c:a aac "${targetPath}"`);
        console.log('Conversion complete');
    } catch (error) {
        console.error('Error converting video:', error);
        // If conversion fails, just copy the file
        fs.copyFileSync(sourcePath, targetPath);
    }
}

async function moveAndRenameFiles() {
    // Create directories if they don't exist
    ['music', 'video', 'images'].forEach(dir => {
        const fullPath = path.join(TARGET_DIR, dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    });

    // Process each file
    for (const [sourceFile, targetPath] of Object.entries(fileMapping)) {
        const sourcePath = path.join(SOURCE_DIR, sourceFile);
        const targetFullPath = path.join(TARGET_DIR, targetPath);

        try {
            if (!fs.existsSync(sourcePath)) {
                console.log(`Warning: Source file not found: ${sourcePath}`);
                continue;
            }

            // Handle image conversion if needed
            if (targetPath.endsWith('.jpeg')) {
                console.log(`Converting and moving: ${sourceFile} -> ${targetPath}`);
                await sharp(sourcePath)
                    .jpeg({ quality: 90 })
                    .toFile(targetFullPath);
            } else if (sourceFile.toLowerCase().endsWith('.mov') && targetPath.endsWith('.mp4')) {
                // Convert MOV to MP4
                await convertMovToMp4(sourcePath, targetFullPath);
            } else {
                console.log(`Moving: ${sourceFile} -> ${targetPath}`);
                fs.copyFileSync(sourcePath, targetFullPath);
            }
        } catch (error) {
            console.error(`Error processing ${sourceFile}:`, error);
        }
    }

    console.log('\nFile processing complete!');
}

// Run the script
moveAndRenameFiles().catch(console.error); 