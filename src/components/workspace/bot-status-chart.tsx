'use client'

import type { Bot } from '@/types/bot'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface BotStatusChartProps {
  bots: Bot[]
}

const STATUS_GROUPS = [
  { key: 'complete', label: 'Complete', color: '#22c55e' },
  { key: 'error', label: 'Error', color: '#ef4444' },
  { key: 'stopped', label: 'Stopped', color: '#f97316' },
  { key: 'active', label: 'Running / Queued', color: '#056a5e' },
] as const

function getStatusGroup(status: Bot['status']): (typeof STATUS_GROUPS)[number]['key'] {
  if (status === 'complete') return 'complete'
  if (status === 'error') return 'error'
  if (status === 'stopped') return 'stopped'
  return 'active'
}

export function BotStatusChart({ bots }: BotStatusChartProps) {
  const counts = STATUS_GROUPS.reduce(
    (acc, { key }) => ({ ...acc, [key]: 0 }),
    {} as Record<string, number>
  )
  bots.forEach((b) => {
    const group = getStatusGroup(b.status)
    counts[group]++
  })

  const data = STATUS_GROUPS.filter((g) => counts[g.key] > 0).map((g) => ({
    name: g.label,
    value: counts[g.key],
    color: g.color,
  }))

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-tracebox-border bg-tracebox-dark p-4">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Bot status</h3>
        <p className="text-sm text-white/40">No bots yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-tracebox-border bg-tracebox-dark p-4">
      <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Bot status</h3>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1c1c1c',
                border: '1px solid #1c1c1c',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#fff' }}
              formatter={(value) => [value ?? 0, 'bots']}
            />
            <Legend
              layout="horizontal"
              align="center"
              verticalAlign="bottom"
              formatter={(value, entry) => (
                <span className="text-xs text-white/70">
                  {value}: {(entry.payload as { value?: number }).value ?? 0}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
