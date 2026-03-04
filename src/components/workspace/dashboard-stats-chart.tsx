'use client'

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell } from 'recharts'

interface WorkspaceWithBotStats {
  id: string
  name: string
  bot_count: number
  completedBots: number
  failedBots: number
}

interface DashboardStatsChartProps {
  workspaces: WorkspaceWithBotStats[]
}

export function DashboardStatsChart({ workspaces }: DashboardStatsChartProps) {
  const totalBots = workspaces.reduce((sum, w) => sum + w.bot_count, 0)
  const totalCompleted = workspaces.reduce((sum, w) => sum + w.completedBots, 0)
  const totalFailed = workspaces.reduce((sum, w) => sum + w.failedBots, 0)
  const successRate = totalBots > 0 ? Math.round((totalCompleted / totalBots) * 100) : 0

  const barData = [
    { name: 'Total Bots', value: totalBots, fill: '#1c1c1c' },
    { name: 'Completed', value: totalCompleted, fill: '#22c55e' },
    { name: 'Failed', value: totalFailed, fill: '#ef4444' },
  ].filter((d) => d.value > 0)

  if (barData.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-tracebox-border bg-tracebox-dark p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Overview</h3>
        <span className="text-sm font-medium text-green-400">Success rate: {successRate}%</span>
      </div>
      <div className="h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1c1c1c',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'rgba(255,255,255,0.7)' }}
              formatter={(value) => [value ?? 0, 'bots']}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {barData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
