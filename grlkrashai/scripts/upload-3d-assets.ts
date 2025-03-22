import { create } from 'ipfs-http-client'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { globSync } from 'glob'

const ASSETS_DIR = join(__dirname, '../src/services/collaboration/assets/3d')
const METADATA_FILE = join(__dirname, '../src/services/collaboration/assets/3d-metadata.json')

async function uploadToIPFS() {
  try {
    // Connect to local IPFS daemon
    const ipfs = create({ url: process.env.IPFS_API_URL || 'http://localhost:5001' })

    // Read current metadata
    const metadata = JSON.parse(readFileSync(METADATA_FILE, 'utf-8'))

    // Find all 3D files
    const files = globSync('*.{blend,fbx,obj}', { cwd: ASSETS_DIR })

    console.log('Found files:', files)

    for (const file of files) {
      const filePath = join(ASSETS_DIR, file)
      const fileContent = readFileSync(filePath)
      
      console.log(`Uploading ${file}...`)
      
      // Upload to IPFS
      const result = await ipfs.add(fileContent, {
        pin: true,
        progress: (bytes: number) => {
          process.stdout.write(`\rUploaded ${bytes} bytes...`)
        }
      })

      console.log(`\nUploaded ${file} to IPFS with hash: ${result.cid.toString()}`)

      // Update metadata
      const fileKey = file.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '')
      if (metadata.models[fileKey]) {
        metadata.models[fileKey].ipfsHash = result.cid.toString()
        console.log(`Updated metadata for ${fileKey}`)
      }
    }

    // Save updated metadata
    writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2))
    console.log('Metadata updated successfully')

  } catch (error) {
    console.error('Error uploading to IPFS:', error)
    process.exit(1)
  }
}

uploadToIPFS() 