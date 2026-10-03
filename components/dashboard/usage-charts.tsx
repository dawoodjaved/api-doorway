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
      <div className="mb-8 min-w-0 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[#151B2B] p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Requests (30 days)
        </h2>
        <div className="h-[240px] w-full min-w-0 sm:h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="date" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} width={36} />
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
      </div>

      {endpoints.length > 0 && (
        <div className="min-w-0 rounded-2xl border border-[rgba(255,255,255,0.05)] bg-[#151B2B] p-4 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Top endpoints
          </h2>
          <div className="h-[240px] w-full min-w-0 sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={endpoints}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                <XAxis dataKey="endpoint" stroke="#666" fontSize={10} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis stroke="#666" fontSize={12} width={36} />
                <Tooltip />
                <Bar dataKey="requests" fill="#4F7FFF" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </>
  );
}
