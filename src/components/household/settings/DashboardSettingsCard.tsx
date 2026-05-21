import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

type Modules = {
  spending: boolean;
  activity: boolean;
  alerts: boolean;
  credit: boolean;
  goals: boolean;
};
const defaultModules: Modules = {
  spending: true,
  activity: true,
  alerts: true,
  credit: true,
  goals: true,
};

export function DashboardSettingsCard() {
  const [compactMode, setCompactMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("hh_dash_compact_v1") === "1";
    } catch {
      return false;
    }
  });

  const [modules, setModules] = useState<Modules>(() => {
    try {
      const raw = localStorage.getItem("hh_dash_modules_v1");
      return raw ? { ...defaultModules, ...JSON.parse(raw) } : defaultModules;
    } catch {
      return defaultModules;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("hh_dash_compact_v1", compactMode ? "1" : "0");
    } catch {}
  }, [compactMode]);

  useEffect(() => {
    try {
      localStorage.setItem("hh_dash_modules_v1", JSON.stringify(modules));
    } catch {}
  }, [modules]);

  const handleReset = () => {
    setModules(defaultModules);
    setCompactMode(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          Dashboard Layout
        </CardTitle>
        <CardDescription>Customize your home screen experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between border p-3 rounded-md">
          <div className="space-y-0.5">
            <p className="font-medium text-sm">Compact Mode</p>
            <p className="text-xs text-muted-foreground">
              Tighter spacing for high-density displays
            </p>
          </div>
          <Switch checked={compactMode} onCheckedChange={setCompactMode} />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-xs">
            Visible Modules
          </p>
          {(
            [
              ["spending", "Spending Flow"],
              ["activity", "Money Movement"],
              ["alerts", "Horizon & Alerts"],
              ["credit", "Credit"],
              ["goals", "Goals"],
            ] as const
          ).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between border p-3 rounded-md"
            >
              <span className="text-sm">{label}</span>
              <Switch
                checked={modules[key]}
                onCheckedChange={(v) =>
                  setModules((prev) => ({ ...prev, [key]: v }))
                }
              />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="w-full"
        >
          Reset to Defaults
        </Button>
      </CardFooter>
    </Card>
  );
}
