import { prisma } from '@/lib/prisma/client'
import { PrismaClient } from '@prisma/client'

// Provider ID mapping from watch-providers.ts
const PROVIDER_CONFIGS: Record<number, { name: string; baseUrl: string }> = {
  8: { name: 'Netflix', baseUrl: 'https://www.netflix.com' },
  9: { name: 'Amazon Prime Video', baseUrl: 'https://www.amazon.com' },
  337: { name: 'Disney Plus', baseUrl: 'https://www.disneyplus.com' },
  384: { name: 'Max', baseUrl: 'https://www.max.com' },
  15: { name: 'Hulu', baseUrl: 'https://www.hulu.com' },
  386: { name: 'Peacock', baseUrl: 'https://www.peacocktv.com' },
  531: { name: 'Paramount Plus', baseUrl: 'https://www.paramountplus.com' },
  2: { name: 'Apple TV Plus', baseUrl: 'https://tv.apple.com' },
  3: { name: 'Google Play Movies & TV', baseUrl: 'https://play.google.com/store/search' },
  192: { name: 'YouTube', baseUrl: 'https://www.youtube.com' },
  10: { name: 'Amazon Video', baseUrl: 'https://www.amazon.com' },
  7: { name: 'Vudu', baseUrl: 'https://www.vudu.com' }
}

interface ProviderInfo {
  provider_id: number
  provider_name: string
  logo_path?: string
}

interface WatchProviderData {
  flatrate?: ProviderInfo[]
  rent?: ProviderInfo[]
  buy?: ProviderInfo[]
}

interface ProviderStats {
  id: number
  name: string
  flatrateCount: number
  rentCount: number
  buyCount: number
  totalCount: number
  isKnownProvider: boolean
  configuredName?: string
}

async function analyzeWatchProviders() {
  console.log('🎬 Analyzing Watch Providers in Database...\n')
  
  try {
    // Query all media items with watch providers
    const mediaItems = await prisma.media.findMany({
      where: {
        watch_providers: {
          not: null
        }
      },
      select: {
        id: true,
        title: true,
        watch_providers: true
      }
    })
    
    console.log(`📊 Found ${mediaItems.length} media items with watch provider data\n`)
    
    // Track unique providers
    const providerMap = new Map<number, ProviderStats>()
    
    // Process each media item
    mediaItems.forEach(item => {
      const providers = item.watch_providers as WatchProviderData
      
      // Process flatrate providers
      if (providers?.flatrate) {
        providers.flatrate.forEach(provider => {
          updateProviderStats(providerMap, provider, 'flatrate')
        })
      }
      
      // Process rent providers
      if (providers?.rent) {
        providers.rent.forEach(provider => {
          updateProviderStats(providerMap, provider, 'rent')
        })
      }
      
      // Process buy providers
      if (providers?.buy) {
        providers.buy.forEach(provider => {
          updateProviderStats(providerMap, provider, 'buy')
        })
      }
    })
    
    // Convert map to array and sort by total count
    const providerStats = Array.from(providerMap.values())
      .sort((a, b) => b.totalCount - a.totalCount)
    
    // Display results
    console.log('🏢 All Unique Watch Providers:\n')
    console.log('ID    | Provider Name                  | Flatrate | Rent | Buy  | Total | Status')
    console.log('------|--------------------------------|----------|------|------|-------|------------------')
    
    providerStats.forEach(provider => {
      const status = provider.isKnownProvider 
        ? `✅ Known (${provider.configuredName})`
        : '❌ Unknown'
      
      console.log(
        `${provider.id.toString().padEnd(5)} | ` +
        `${provider.name.padEnd(30)} | ` +
        `${provider.flatrateCount.toString().padEnd(8)} | ` +
        `${provider.rentCount.toString().padEnd(4)} | ` +
        `${provider.buyCount.toString().padEnd(4)} | ` +
        `${provider.totalCount.toString().padEnd(5)} | ` +
        `${status}`
      )
    })
    
    // Summary statistics
    console.log('\n📈 Summary Statistics:')
    console.log(`- Total unique providers: ${providerStats.length}`)
    console.log(`- Known providers (in config): ${providerStats.filter(p => p.isKnownProvider).length}`)
    console.log(`- Unknown providers: ${providerStats.filter(p => !p.isKnownProvider).length}`)
    
    // List unknown providers separately
    const unknownProviders = providerStats.filter(p => !p.isKnownProvider)
    if (unknownProviders.length > 0) {
      console.log('\n⚠️  Unknown Providers (not in configuration):')
      unknownProviders.forEach(provider => {
        console.log(`- ID: ${provider.id}, Name: "${provider.name}" (appears ${provider.totalCount} times)`)
      })
    }
    
    // Top providers by type
    console.log('\n🏆 Top 5 Providers by Type:')
    
    console.log('\nFlatrate (Subscription):')
    providerStats
      .filter(p => p.flatrateCount > 0)
      .sort((a, b) => b.flatrateCount - a.flatrateCount)
      .slice(0, 5)
      .forEach((p, i) => {
        console.log(`${i + 1}. ${p.name} (${p.flatrateCount} titles)`)
      })
    
    console.log('\nRent:')
    providerStats
      .filter(p => p.rentCount > 0)
      .sort((a, b) => b.rentCount - a.rentCount)
      .slice(0, 5)
      .forEach((p, i) => {
        console.log(`${i + 1}. ${p.name} (${p.rentCount} titles)`)
      })
    
    console.log('\nBuy:')
    providerStats
      .filter(p => p.buyCount > 0)
      .sort((a, b) => b.buyCount - a.buyCount)
      .slice(0, 5)
      .forEach((p, i) => {
        console.log(`${i + 1}. ${p.name} (${p.buyCount} titles)`)
      })
    
  } catch (error) {
    console.error('❌ Error analyzing watch providers:', error)
  } finally {
    await prisma.$disconnect()
  }
}

function updateProviderStats(
  providerMap: Map<number, ProviderStats>,
  provider: ProviderInfo,
  type: 'flatrate' | 'rent' | 'buy'
) {
  const stats = providerMap.get(provider.provider_id) || {
    id: provider.provider_id,
    name: provider.provider_name,
    flatrateCount: 0,
    rentCount: 0,
    buyCount: 0,
    totalCount: 0,
    isKnownProvider: false,
    configuredName: undefined
  }
  
  // Update counts
  if (type === 'flatrate') stats.flatrateCount++
  else if (type === 'rent') stats.rentCount++
  else if (type === 'buy') stats.buyCount++
  stats.totalCount++
  
  // Check if provider is in our configuration
  const config = PROVIDER_CONFIGS[provider.provider_id]
  if (config) {
    stats.isKnownProvider = true
    stats.configuredName = config.name
  }
  
  providerMap.set(provider.provider_id, stats)
}

// Run the analysis
analyzeWatchProviders()