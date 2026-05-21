import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { Scenario } from "@/services/householdAiService";

interface TimelineProjectionProps {
  scenarios: Scenario[];
  currentSurplus: number;
  currentSavings: number;
  results: Map<string, { newSurplus: number }>;
}

export function TimelineProjection({
  scenarios,
  currentSurplus,
  currentSavings,
  results,
}: TimelineProjectionProps) {
  const projectionData = useMemo(() => {
    const months = 12;
    const data = [];

    for (let month = 0; month <= months; month++) {
      const point: Record<string, any> = {
        month: month === 0 ? "Now" : `M${month}`,
        monthNum: month,
      };

      // Baseline projection
      point["Baseline"] = currentSavings + currentSurplus * month;

      // Each scenario projection
      scenarios.forEach((scenario) => {
        const result = results.get(scenario.id);
        if (result) {
          const monthlySurplus = result.newSurplus;
          // For one-time, only add in month 1
          if (scenario.type === "one_time" && !scenario.isRecurring) {
            point[scenario.name] =
              currentSavings +
              currentSurplus * month +
              (month >= 1 ? scenario.amount : 0);
          } else {
            point[scenario.name] = currentSavings + monthlySurplus * month;
          }
        }
      });

      data.push(point);
    }

    return data;
  }, [scenarios, currentSurplus, currentSavings, results]);

  const colors = [
    "hsl(var(--primary))",
    "hsl(var(--status-safe))",
    "hsl(var(--status-warning))",
    "hsl(var(--accent))",
  ];

  if (scenarios.length === 0) {
    return (
      <div className="border-2 border-dashed border-border p-8 text-center">
        <p className="text-muted-foreground font-mono text-sm">
          Add scenarios to see 12-month projections
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-border p-4 bg-card">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-mono border border-primary">
          12M
        </span>
        Savings Projection
      </h3>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={projectionData}
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: "monospace" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "2px solid hsl(var(--border))",
                fontFamily: "monospace",
                fontSize: "12px",
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", fontFamily: "monospace" }}
            />
            <ReferenceLine
              y={0}
              stroke="hsl(var(--status-danger))"
              strokeDasharray="5 5"
            />

            {/* Baseline */}
            <Line
              type="monotone"
              dataKey="Baseline"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />

            {/* Scenario lines */}
            {scenarios.map((scenario, idx) => (
              <Line
                key={scenario.id}
                type="monotone"
                dataKey={scenario.name}
                stroke={scenario.color || colors[idx % colors.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="p-2 border border-border">
          <span className="text-muted-foreground">Baseline 12M:</span>
          <span className="ml-2 font-bold">
            ${(currentSavings + currentSurplus * 12).toLocaleString()}
          </span>
        </div>
        {scenarios.slice(0, 3).map((scenario) => {
          const result = results.get(scenario.id);
          const projectedValue = result
            ? currentSavings + result.newSurplus * 12
            : 0;
          const diff = projectedValue - (currentSavings + currentSurplus * 12);
          return (
            <div
              key={scenario.id}
              className="p-2 border border-border"
              style={{
                borderLeftColor: scenario.color,
                borderLeftWidth: "3px",
              }}
            >
              <span className="text-muted-foreground">{scenario.name}:</span>
              <span
                className={`ml-2 font-bold ${diff >= 0 ? "text-[hsl(var(--status-safe))]" : "text-[hsl(var(--status-danger))]"}`}
              >
                {diff >= 0 ? "+" : ""}
                {diff.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
