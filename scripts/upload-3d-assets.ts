import { create } from 'ipfs-http-client'
import { readFileSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'
import { globSync } from 'glob'

const ASSETS_DIR = join(__dirname, '../src/services/collaboration/assets/3d')
const METADATA_FILE = join(__dirname, '../src/services/collaboration/assets/3d-metadata.json')

interface AssetMetadata {
  name: string
  type: string
  ipfsHash: string
  size: number
  lastUpdated: string
  description: string
  tags: string[]
}

interface MetadataFile {
  version: string
  assets: Record<string, AssetMetadata>
}

async function uploadToIPFS() {
  try {
    // Connect to IPFS daemon with fallback options
    const ipfsConfigs = [
      { url: process.env.IPFS_API_URL || 'http://localhost:5001' },
      { url: 'https://ipfs.infura.io:5001' },
      { url: 'https://ipfs.io:5001' }
    ]

    let ipfs
    for (const config of ipfsConfigs) {
      try {
        ipfs = create(config)
        await ipfs.version()
        console.log(`Connected to IPFS node: ${config.url}`)
        break
      } catch (error) {
        console.log(`Failed to connect to ${config.url}, trying next...`)
      }
    }

    if (!ipfs) {
      throw new Error('Failed to connect to any IPFS node')
    }

    // Read current metadata
    const metadata: MetadataFile = JSON.parse(readFileSync(METADATA_FILE, 'utf-8'))

    // Find all 3D files
    const files = globSync('*.{blend,fbx,obj}', { cwd: ASSETS_DIR })
    console.log(`Found ${files.length} files to upload`)

    for (const file of files) {
      const filePath = join(ASSETS_DIR, file)
      const fileContent = readFileSync(filePath)
      const stats = statSync(filePath)
      
      console.log(`\nProcessing ${file} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`)
      
      // Upload to IPFS
      const result = await ipfs.add(fileContent, {
        pin: true,
        progress: (bytes: number) => {
          const progress = (bytes / stats.size * 100).toFixed(1)
          process.stdout.write(`\rUploaded ${progress}% (${(bytes / 1024 / 1024).toFixed(1)} MB)...`)
        }
      })

      console.log(`\nUploaded ${file} to IPFS with hash: ${result.cid.toString()}`)

      // Update metadata
      const fileKey = file.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
      if (metadata.assets[fileKey]) {
        metadata.assets[fileKey].ipfsHash = result.cid.toString()
        metadata.assets[fileKey].size = stats.size
        metadata.assets[fileKey].lastUpdated = new Date().toISOString()
        console.log(`Updated metadata for ${fileKey}`)
      } else {
        console.warn(`Warning: No metadata entry found for ${fileKey}`)
      }
    }

    // Save updated metadata
    writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2))
    console.log('\nMetadata updated successfully')

  } catch (error) {
    console.error('Error uploading to IPFS:', error)
    process.exit(1)
  }
}

uploadToIPFS() 