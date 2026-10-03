"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DailyPoint = { date: string; requests: number; errors: number };
type EndpointPoint = { endpoint: string; requests: number; avgLatency: number };

export function UsageCharts({
  daily,
  endpoints,
}: {
  daily: DailyPoint[];
  endpoints: EndpointPoint[];
}) {
  return (
    <>
      <div className="rounded-2xl p-6 bg-[#151B2B] border border-[rgba(255,255,255,0.05)] mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          Requests (30 days)
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" />
            <XAxis dataKey="date" stroke="#666" fontSize={12} />
            <YAxis stroke="#666" fontSize={12} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="requests"
              stroke="#4F7FFF"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="errors"
              stroke="#EF4444"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {endpoints.length > 0 && (
        <div className="rounded-2xl p-6 bg-[#151B2B] border border-[rgba(255,255,255,0.05)]">
          <h2 className="text-lg font-semibold text-white mb-4">
            Top endpoints
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={endpoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="endpoint" stroke="#666" fontSize={10} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip />
              <Bar dataKey="requests" fill="#4F7FFF" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}
