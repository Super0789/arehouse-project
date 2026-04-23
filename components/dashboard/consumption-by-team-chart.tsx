"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TeamConsumptionRow } from "@/lib/queries/dashboard";

export function ConsumptionByTeamChart({
  data,
}: {
  data: TeamConsumptionRow[];
}) {
  const chartData = data.map((d) => ({
    name: d.team_name,
    الموزع: d.distributed,
    الاستهلاك: d.consumption,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>الاستهلاك حسب الفريق</CardTitle>
        <CardDescription>مقارنة الموزّع والاستهلاك لكل فريق اليوم</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
            لا توجد بيانات لعرضها.
          </div>
        ) : (
          <div className="h-72 w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 8, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={-20}
                  textAnchor="end"
                  interval={0}
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    direction: "rtl",
                    fontSize: 12,
                    borderRadius: 8,
                  }}
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="الموزع" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="الاستهلاك" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}