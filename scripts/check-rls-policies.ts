import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkRLSPolicies() {
  // Check if RLS is enabled
  const { data: rlsStatus } = await supabase
    .rpc('exec', {
      query: `
        SELECT relname, relrowsecurity 
        FROM pg_class 
        WHERE relname = 'media_items' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      `
    })
  
  console.log('RLS Status for media_items:', rlsStatus)
  
  // Get all policies on media_items
  const { data: policies } = await supabase
    .rpc('exec', {
      query: `
        SELECT 
          polname as policy_name,
          polcmd as command,
          pg_get_expr(polqual, polrelid) as using_expression,
          pg_get_expr(polwithcheck, polrelid) as with_check_expression,
          polroles::regrole[] as roles
        FROM pg_policy
        WHERE polrelid = 'public.media_items'::regclass
      `
    })
  
  console.log('\nPolicies on media_items:')
  console.log(JSON.stringify(policies, null, 2))
  
  // Test with anon key
  const anonClient = createClient(
    supabaseUrl, 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const { count: anonCount } = await anonClient
    .from('media_items')
    .select('*', { count: 'exact', head: true })
  
  console.log('\nRows visible with anon key:', anonCount)
  
  const { count: serviceCount } = await supabase
    .from('media_items')
    .select('*', { count: 'exact', head: true })
  
  console.log('Rows visible with service key:', serviceCount)
}

// Simpler alternative - just check table info
async function checkTableInfo() {
  console.log('\n=== Checking RLS and Table Info ===\n')
  
  // This query will work if the service role has access
  const { data, error } = await supabase.rpc('exec', {
    query: `
      SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        COUNT(p.polname) AS policy_count
      FROM pg_class c
      LEFT JOIN pg_policy p ON p.polrelid = c.oid
      WHERE c.relname = 'media_items'
      GROUP BY c.relname, c.relrowsecurity;
    `
  })
  
  if (error) {
    console.log('Error checking RLS (trying simpler query):', error.message)
    
    // Fallback to checking row counts
    const { count: totalCount } = await supabase
      .from('media_items')
      .select('*', { count: 'exact', head: true })
    
    console.log('Total rows in media_items:', totalCount)
  } else {
    console.log('Table RLS info:', data)
  }
}

checkTableInfo().catch(console.error)