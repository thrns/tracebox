import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  // Mark workspace as stopped
  await adminSupabase
    .from('workspaces')
    .update({
      status: 'stopped',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  // Mark all non-complete bots as stopped
  await adminSupabase
    .from('bots')
    .update({
      status: 'stopped',
      error_message: 'Stopped by user',
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', id)
    .not('status', 'in', '("complete","error","stopped")')

  return NextResponse.json({ success: true })
}
