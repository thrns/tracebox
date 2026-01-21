'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Workspace } from '@/types/workspace'

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setWorkspaces(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  return { workspaces, loading, error, refetch: fetchWorkspaces }
}

export function useWorkspace(id: string) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchWorkspace = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      setError(error.message)
    } else {
      setWorkspace(data)
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchWorkspace()
  }, [fetchWorkspace])

  return { workspace, loading, error, refetch: fetchWorkspace }
}
