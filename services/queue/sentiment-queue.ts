import { mediaService } from '@/services/database'
import { dataForSeoService } from '@/services/dataforseo'
import { supabaseAdmin } from '@/lib/supabase'

interface SentimentJob {
  mediaId: string
  title: string
  mediaType: 'MOVIE' | 'TV_SHOW'
  priority: 'high' | 'normal' | 'low'
  attempts?: number
  lastAttempt?: Date
}

/**
 * Simple in-memory queue for sentiment fetching
 * In production, use Redis Bull, AWS SQS, or Supabase Edge Functions
 */
class SentimentQueue {
  private queue: Map<string, SentimentJob> = new Map()
  private processing: Set<string> = new Set()
  private isProcessing = false

  /**
   * Add a media item to the sentiment fetch queue
   */
  async enqueue(job: SentimentJob) {
    // Skip if already in queue or processing
    if (this.queue.has(job.mediaId) || this.processing.has(job.mediaId)) {
      return
    }

    this.queue.set(job.mediaId, {
      ...job,
      attempts: 0,
      lastAttempt: new Date()
    })

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing()
    }
  }

  /**
   * Process jobs in the queue
   */
  private async startProcessing() {
    if (this.isProcessing) return
    this.isProcessing = true

    while (this.queue.size > 0) {
      // Get highest priority job
      const job = this.getNextJob()
      if (!job) break

      await this.processJob(job)
      
      // Wait between jobs to avoid rate limits
      await this.delay(1000)
    }

    this.isProcessing = false
  }

  /**
   * Get the next job based on priority
   */
  private getNextJob(): SentimentJob | null {
    let highestPriorityJob: SentimentJob | null = null

    for (const job of Array.from(this.queue.values())) {
      if (!highestPriorityJob || this.comparePriority(job, highestPriorityJob) < 0) {
        highestPriorityJob = job
      }
    }

    return highestPriorityJob
  }

  /**
   * Compare job priorities
   */
  private comparePriority(a: SentimentJob, b: SentimentJob): number {
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  }

  /**
   * Process a single job
   */
  private async processJob(job: SentimentJob) {
    this.queue.delete(job.mediaId)
    this.processing.add(job.mediaId)

    try {
      // Check if DataForSEO credentials are configured
      if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
        console.log(`Skipping sentiment fetch for ${job.title} - DataForSEO not configured`)
        return
      }

      console.log(`Fetching sentiment for: ${job.title}`)

      // Build search query
      const searchQuery = job.mediaType === 'TV_SHOW' 
        ? `${job.title} TV show`
        : `${job.title} movie`

      // Fetch sentiment from DataForSEO
      const result = await dataForSeoService.searchGoogleKnowledge(searchQuery)

      if (result.percentage !== null) {
        // Update the media item with the sentiment score
        await supabaseAdmin
          .from('media_items')
          .update({ 
            also_liked_percentage: result.percentage,
            updated_at: new Date().toISOString()
          })
          .eq('id', job.mediaId)

        console.log(`✅ Updated ${job.title} with ${result.percentage}% liked score`)
      } else {
        console.log(`❌ No sentiment found for ${job.title}`)
        
        // Retry logic for high priority jobs
        if (job.priority === 'high' && (job.attempts || 0) < 3) {
          job.attempts = (job.attempts || 0) + 1
          job.lastAttempt = new Date()
          
          // Re-queue with delay
          setTimeout(() => {
            this.queue.set(job.mediaId, job)
          }, 5 * 60 * 1000) // 5 minutes
        }
      }
    } catch (error) {
      console.error(`Error processing sentiment job for ${job.title}:`, error)
      
      // Retry on error for high priority
      if (job.priority === 'high' && (job.attempts || 0) < 3) {
        job.attempts = (job.attempts || 0) + 1
        setTimeout(() => {
          this.queue.set(job.mediaId, job)
        }, 10 * 60 * 1000) // 10 minutes
      }
    } finally {
      this.processing.delete(job.mediaId)
    }
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queued: this.queue.size,
      processing: this.processing.size,
      isProcessing: this.isProcessing,
      jobs: Array.from(this.queue.values()).map(job => ({
        mediaId: job.mediaId,
        title: job.title,
        priority: job.priority,
        attempts: job.attempts
      }))
    }
  }
}

// Export singleton instance
export const sentimentQueue = new SentimentQueue()

/**
 * Helper function to queue a sentiment fetch job
 */
export async function queueSentimentFetch(
  mediaId: string, 
  priority: 'high' | 'normal' | 'low' = 'normal'
) {
  try {
    // Get media details
    const media = await mediaService.getMediaById(mediaId)
    if (!media) return

    // Only queue if sentiment is missing
    if (media.also_liked_percentage === null) {
      await sentimentQueue.enqueue({
        mediaId: media.id,
        title: media.title,
        mediaType: media.media_type,
        priority
      })
    }
  } catch (error) {
    console.error('Error queuing sentiment fetch:', error)
  }
}