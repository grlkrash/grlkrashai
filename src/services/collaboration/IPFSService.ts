import { create } from 'ipfs-http-client'
import { readFileSync } from 'fs'
import { join } from 'path'
import { EventEmitter } from 'events'

interface IPFSConfig {
  gateways: string[]
  cacheSize: number
  timeout: number
}

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

export class IPFSService extends EventEmitter {
  private config: IPFSConfig
  private cache: Map<string, Buffer>
  private metadata: MetadataFile
  private readonly METADATA_FILE: string

  constructor(config: Partial<IPFSConfig> = {}) {
    super()
    this.config = {
      gateways: config.gateways || [
        'http://localhost:5001',
        'https://ipfs.infura.io:5001',
        'https://ipfs.io:5001'
      ],
      cacheSize: config.cacheSize || 100,
      timeout: config.timeout || 30000
    }
    this.cache = new Map()
    this.METADATA_FILE = join(__dirname, 'assets/3d-metadata.json')
    this.metadata = JSON.parse(readFileSync(this.METADATA_FILE, 'utf-8'))
  }

  private async getIPFSClient(): Promise<any> {
    for (const gateway of this.config.gateways) {
      try {
        const client = create({ url: gateway })
        await client.version()
        return client
      } catch (error) {
        console.log(`Failed to connect to ${gateway}, trying next...`)
      }
    }
    throw new Error('Failed to connect to any IPFS gateway')
  }

  async getAsset(assetKey: string): Promise<Buffer> {
    // Check cache first
    if (this.cache.has(assetKey)) {
      return this.cache.get(assetKey)!
    }

    const asset = this.metadata.assets[assetKey]
    if (!asset) {
      throw new Error(`Asset ${assetKey} not found in metadata`)
    }

    const client = await this.getIPFSClient()
    const content = await client.cat(asset.ipfsHash)

    // Update cache
    if (this.cache.size >= this.config.cacheSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    this.cache.set(assetKey, content)

    return content
  }

  async getAssetMetadata(assetKey: string): Promise<AssetMetadata> {
    const asset = this.metadata.assets[assetKey]
    if (!asset) {
      throw new Error(`Asset ${assetKey} not found in metadata`)
    }
    return asset
  }

  async listAssets(): Promise<string[]> {
    return Object.keys(this.metadata.assets)
  }

  async getAssetByType(type: string): Promise<string[]> {
    return Object.entries(this.metadata.assets)
      .filter(([_, asset]) => asset.type === type)
      .map(([key]) => key)
  }

  async getAssetByTag(tag: string): Promise<string[]> {
    return Object.entries(this.metadata.assets)
      .filter(([_, asset]) => asset.tags.includes(tag))
      .map(([key]) => key)
  }

  clearCache(): void {
    this.cache.clear()
  }
} 