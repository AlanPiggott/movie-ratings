import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    // Get date ranges
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    
    // Fetch update logs
    const [todayLog, weekLogs, monthLogs] = await Promise.all([
      // Today's stats
      supabaseAdmin
        .from('rating_update_logs')
        .select('*')
        .eq('run_date', today)
        .single(),
      
      // Last 7 days
      supabaseAdmin
        .from('rating_update_logs')
        .select('*')
        .gte('run_date', weekAgo)
        .order('run_date', { ascending: false }),
      
      // Last 30 days
      supabaseAdmin
        .from('rating_update_logs')
        .select('*')
        .gte('run_date', monthAgo)
        .order('run_date', { ascending: false })
    ])
    
    // Get tier distribution
    const { data: tierStats } = await supabaseAdmin
      .from('media_items')
      .select('rating_update_tier')
      .not('rating_update_tier', 'is', null)
    
    const tierDistribution: Record<number, number> = {}
    tierStats?.forEach(item => {
      tierDistribution[item.rating_update_tier] = (tierDistribution[item.rating_update_tier] || 0) + 1
    })
    
    // Get items needing update
    const { data: itemsDueData } = await supabaseAdmin
      .rpc('get_items_due_for_rating_update', { p_limit: 1000, p_dry_run: true })
    
    const itemsDue = itemsDueData?.length || 0
    
    // Get recently updated items
    const { data: recentUpdates } = await supabaseAdmin
      .from('media_items')
      .select('id, title, media_type, also_liked_percentage, rating_last_updated, rating_update_tier')
      .not('rating_last_updated', 'is', null)
      .order('rating_last_updated', { ascending: false })
      .limit(20)
    
    // Get content source distribution
    const { data: sourceStats } = await supabaseAdmin
      .from('media_items')
      .select('content_source')
      .not('content_source', 'is', null)
    
    const sourceDistribution: Record<string, number> = {}
    sourceStats?.forEach(item => {
      sourceDistribution[item.content_source] = (sourceDistribution[item.content_source] || 0) + 1
    })
    
    // Get new items added in last 30 days by source
    const { data: newItemsData } = await supabaseAdmin
      .from('rating_update_logs')
      .select('update_source, new_items_added')
      .gte('run_date', monthAgo)
      .not('new_items_added', 'is', null)
      .gt('new_items_added', 0)
    
    const newItemsBySource: Record<string, number> = {}
    newItemsData?.forEach(log => {
      if (log.update_source) {
        newItemsBySource[log.update_source] = (newItemsBySource[log.update_source] || 0) + (log.new_items_added || 0)
      }
    })
    
    // Calculate aggregates
    const weekTotal = weekLogs.data?.reduce((sum, log) => ({
      items_updated: sum.items_updated + (log.items_updated || 0),
      items_failed: sum.items_failed + (log.items_failed || 0),
      api_calls: sum.api_calls + (log.api_calls_made || 0),
      cost: sum.cost + (log.total_cost || 0)
    }), { items_updated: 0, items_failed: 0, api_calls: 0, cost: 0 })
    
    const monthTotal = monthLogs.data?.reduce((sum, log) => ({
      items_updated: sum.items_updated + (log.items_updated || 0),
      items_failed: sum.items_failed + (log.items_failed || 0),
      api_calls: sum.api_calls + (log.api_calls_made || 0),
      cost: sum.cost + (log.total_cost || 0)
    }), { items_updated: 0, items_failed: 0, api_calls: 0, cost: 0 })
    
    // Calculate estimated annual cost based on tier distribution
    const annualEstimate = Object.entries(tierDistribution).reduce((total, [tier, count]) => {
      const updatesPerYear = {
        1: 26,  // bi-weekly
        2: 12,  // monthly
        3: 4,   // quarterly
        4: 2,   // bi-annually
        5: 0    // never
      }[parseInt(tier)] || 0
      
      return total + (count * updatesPerYear * 2 * 0.0006) // 2 API calls per update
    }, 0)
    
    return NextResponse.json({
      today: {
        date: today,
        items_updated: todayLog.data?.items_updated || 0,
        items_failed: todayLog.data?.items_failed || 0,
        api_calls: todayLog.data?.api_calls_made || 0,
        cost: todayLog.data?.total_cost || 0,
        runtime_seconds: todayLog.data?.runtime_seconds || 0
      },
      week: {
        items_updated: weekTotal?.items_updated || 0,
        items_failed: weekTotal?.items_failed || 0,
        api_calls: weekTotal?.api_calls || 0,
        cost: weekTotal?.cost || 0,
        days_with_updates: weekLogs.data?.length || 0
      },
      month: {
        items_updated: monthTotal?.items_updated || 0,
        items_failed: monthTotal?.items_failed || 0,
        api_calls: monthTotal?.api_calls || 0,
        cost: monthTotal?.cost || 0,
        days_with_updates: monthLogs.data?.length || 0
      },
      tiers: {
        distribution: tierDistribution,
        total_items: Object.values(tierDistribution).reduce((a, b) => a + b, 0)
      },
      queue: {
        items_due_now: itemsDue || 0
      },
      estimates: {
        annual_cost: annualEstimate,
        monthly_cost: annualEstimate / 12,
        daily_cost: annualEstimate / 365
      },
      content_sources: {
        distribution: sourceDistribution,
        total_items: Object.values(sourceDistribution).reduce((a, b) => a + b, 0),
        new_items_last_30_days: newItemsBySource
      },
      recent_updates: recentUpdates?.map(item => ({
        title: item.title,
        type: item.media_type,
        rating: item.also_liked_percentage,
        updated: item.rating_last_updated,
        tier: item.rating_update_tier
      })) || []
    })
    
  } catch (error) {
    console.error('Rating stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rating statistics' },
      { status: 500 }
    )
  }
}