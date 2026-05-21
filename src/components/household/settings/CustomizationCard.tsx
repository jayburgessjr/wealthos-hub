import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useEffect, useState } from "react";
import { Moon, Sun, Palette } from "lucide-react";

const THEMES = [
  {
    name: "Default",
    value: "default",
    primary: "0 0% 0%",
    primaryForeground: "0 0% 100%",
    class: "bg-black",
  },
  {
    name: "Ocean",
    value: "ocean",
    primary: "221 83% 53%",
    primaryForeground: "0 0% 100%",
    class: "bg-blue-600",
  },
  {
    name: "Forest",
    value: "forest",
    primary: "142 71% 45%",
    primaryForeground: "0 0% 100%",
    class: "bg-green-600",
  },
  {
    name: "Berry",
    value: "berry",
    primary: "316 73% 52%",
    primaryForeground: "0 0% 100%",
    class: "bg-pink-600",
  },
];

export function CustomizationCard() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [currentTheme, setCurrentTheme] = useState("default");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setIsDarkMode(isDark);

    const storedTheme = localStorage.getItem("theme-color");
    if (storedTheme) {
      applyTheme(storedTheme);
    }
  }, []);

  const toggleDarkMode = (checked: boolean) => {
    setIsDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme-mode", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme-mode", "light");
    }
  };

  const applyTheme = (themeValue: string) => {
    setCurrentTheme(themeValue);
    localStorage.setItem("theme-color", themeValue);

    const theme = THEMES.find((t) => t.value === themeValue);
    if (!theme) return;

    if (themeValue === "default") {
      document.documentElement.style.removeProperty("--primary");
      document.documentElement.style.removeProperty("--primary-foreground");
    } else {
      document.documentElement.style.setProperty("--primary", theme.primary);
      document.documentElement.style.setProperty(
        "--primary-foreground",
        theme.primaryForeground,
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Customization
        </CardTitle>
        <CardDescription>Personalize your experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Dark Mode</Label>
            <p className="text-xs text-muted-foreground">
              Switch between light and dark themes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch checked={isDarkMode} onCheckedChange={toggleDarkMode} />
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-0.5">
            <Label className="text-base">Accent Color</Label>
            <p className="text-xs text-muted-foreground">
              Choose your primary interface color
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                onClick={() => applyTheme(theme.value)}
                className={`
                  w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all
                  ${currentTheme === theme.value ? "border-foreground ring-2 ring-offset-2 ring-foreground" : "border-transparent"}
                  ${theme.class}
                `}
                aria-label={`Select ${theme.name} theme`}
              >
                {currentTheme === theme.value && (
                  <span className="text-white font-bold text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
