import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

interface PreviewOptions {
    width: number;
    height: number;
    duration: number;
    quality: number;
}

const defaultOptions: PreviewOptions = {
    width: 320,
    height: 240,
    duration: 3,
    quality: 80
};

export async function generatePreview(
    inputPath: string,
    outputPath: string,
    options: Partial<PreviewOptions> = {}
): Promise<string> {
    const opts: PreviewOptions = { ...defaultOptions, ...options };
    const fileType = path.extname(inputPath).toLowerCase();

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        if (['.mp4', '.mov', '.MOV'].includes(fileType)) {
            // Generate video preview (thumbnail + short clip)
            return await generateVideoPreview(inputPath, outputPath, opts);
        } else if (['.mp3', '.wav'].includes(fileType)) {
            // Generate audio preview (waveform image + short clip)
            return await generateAudioPreview(inputPath, outputPath, opts);
        } else if (['.jpg', '.jpeg', '.png'].includes(fileType)) {
            // Generate image preview (thumbnail)
            return await generateImagePreview(inputPath, outputPath, opts);
        } else {
            throw new Error(`Unsupported file type: ${fileType}`);
        }
    } catch (error) {
        console.error(`Error generating preview for ${inputPath}:`, error);
        throw error;
    }
}

async function generateVideoPreview(
    inputPath: string,
    outputPath: string,
    options: PreviewOptions
): Promise<string> {
    const thumbnailPath = outputPath.replace(/\.[^/.]+$/, '_thumb.jpg');
    const previewPath = outputPath.replace(/\.[^/.]+$/, '_preview.mp4');

    // Generate thumbnail
    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .screenshots({
                timestamps: ['00:00:01'],
                filename: path.basename(thumbnailPath),
                folder: path.dirname(thumbnailPath),
                size: `${options.width}x${options.height}`
            })
            .on('end', resolve)
            .on('error', reject);
    });

    // Generate preview clip
    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .setStartTime(0)
            .setDuration(options.duration)
            .size(`${options.width}x${options.height}`)
            .output(previewPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    return previewPath;
}

async function generateAudioPreview(
    inputPath: string,
    outputPath: string,
    options: PreviewOptions
): Promise<string> {
    const waveformPath = outputPath.replace(/\.[^/.]+$/, '_waveform.png');
    const previewPath = outputPath.replace(/\.[^/.]+$/, '_preview.mp3');

    // Generate waveform image
    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .complexFilter([
                {
                    filter: 'showwavespic',
                    options: {
                        s: `${options.width}x${options.height}`,
                        colors: '#1ED760'
                    }
                }
            ])
            .output(waveformPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    // Generate preview clip
    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .setStartTime(0)
            .setDuration(options.duration)
            .output(previewPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    return previewPath;
}

async function generateImagePreview(
    inputPath: string,
    outputPath: string,
    options: PreviewOptions
): Promise<string> {
    await sharp(inputPath)
        .resize(options.width, options.height, {
            fit: 'inside',
            withoutEnlargement: true
        })
        .jpeg({
            quality: options.quality
        })
        .toFile(outputPath);

    return outputPath;
}

// Generate previews for all files in the content directory
export async function generateAllPreviews(contentDir: string, previewDir: string): Promise<void> {
    const files = fs.readdirSync(contentDir, { recursive: true }) as string[];
    
    for (const file of files) {
        const inputPath = path.join(contentDir, file);
        const relativePath = path.relative(contentDir, inputPath);
        const outputPath = path.join(previewDir, relativePath);

        if (fs.statSync(inputPath).isFile()) {
            try {
                await generatePreview(inputPath, outputPath);
                console.log(`Generated preview for ${relativePath}`);
            } catch (error) {
                console.error(`Failed to generate preview for ${relativePath}:`, error);
            }
        }
    }
} 