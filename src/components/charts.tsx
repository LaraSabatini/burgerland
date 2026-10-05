'use client'

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtCompactMoney, fmtMoney, fmtNum, fmtShortDay } from '@/lib/format'

const axis = { stroke: 'var(--muted)', fontSize: 12, tickLine: false, axisLine: { stroke: 'var(--axis)' } }

function TooltipBox({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map(([k, v]) => (
        <p key={k} className="flex justify-between gap-4 text-ink-2">
          <span>{k}</span>
          <span className="tabular font-medium text-ink">{v}</span>
        </p>
      ))}
    </div>
  )
}

type Point = { orders: number; revenue: number }

export function HoursChart({ data }: { data: (Point & { hour: number })[] }) {
  // Completa las horas vacías entre la primera y la última para que el eje sea continuo
  const hours = data.map((d) => d.hour)
  const filled = hours.length
    ? Array.from({ length: Math.max(...hours) - Math.min(...hours) + 1 }, (_, i) => {
        const hour = Math.min(...hours) + i
        return data.find((d) => d.hour === hour) ?? { hour, orders: 0, revenue: 0 }
      })
    : []
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={filled} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} {...axis} />
        <YAxis allowDecimals={false} {...axis} axisLine={false} width={40} />
        <Tooltip
          cursor={{ fill: 'var(--surface-2)' }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as (Point & { hour: number }) | undefined
            if (!active || !p) return null
            return (
              <TooltipBox
                title={`${p.hour}:00 a ${p.hour}:59`}
                rows={[
                  ['Pedidos', fmtNum(p.orders)],
                  ['Ventas', fmtMoney(p.revenue)],
                ]}
              />
            )
          }}
        />
        <Bar dataKey="orders" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DaysChart({ data }: { data: (Point & { day: string })[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="day" tickFormatter={fmtShortDay} minTickGap={24} {...axis} />
        <YAxis tickFormatter={fmtCompactMoney} {...axis} axisLine={false} width={56} />
        <Tooltip
          cursor={{ stroke: 'var(--axis)' }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as (Point & { day: string }) | undefined
            if (!active || !p) return null
            return (
              <TooltipBox
                title={fmtShortDay(p.day)}
                rows={[
                  ['Ventas', fmtMoney(p.revenue)],
                  ['Pedidos', fmtNum(p.orders)],
                ]}
              />
            )
          }}
        />
        <Line
          type="linear"
          dataKey="revenue"
          stroke="var(--series-1)"
          strokeWidth={2}
          dot={data.length <= 31 ? { r: 3, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 } : false}
          activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
