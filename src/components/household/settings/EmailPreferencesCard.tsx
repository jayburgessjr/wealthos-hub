import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Clock, Send, Loader2 } from "lucide-react";

interface EmailPreferencesCardProps {
  userId: string | undefined;
  userEmail: string | undefined;
  householdId: string | null;
  demoMode: boolean;
}

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const EMAIL_TIMES = [
  { value: "06:00:00", label: "6:00 AM" },
  { value: "07:00:00", label: "7:00 AM" },
  { value: "08:00:00", label: "8:00 AM" },
  { value: "09:00:00", label: "9:00 AM" },
  { value: "17:00:00", label: "5:00 PM" },
  { value: "18:00:00", label: "6:00 PM" },
  { value: "19:00:00", label: "7:00 PM" },
  { value: "19:30:00", label: "7:30 PM" },
  { value: "20:00:00", label: "8:00 PM" },
  { value: "21:00:00", label: "9:00 PM" },
];

export function EmailPreferencesCard({
  userId,
  userEmail,
  householdId,
  demoMode,
}: EmailPreferencesCardProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [dailyEmailEnabled, setDailyEmailEnabled] = useState(true);
  const [emailTime, setEmailTime] = useState("19:30:00");
  const [timezone, setTimezone] = useState("America/New_York");
  const [weeklyEmailEnabled, setWeeklyEmailEnabled] = useState(false);
  const [hasPreferences, setHasPreferences] = useState(false);

  useEffect(() => {
    if (!userId || !householdId) {
      setLoading(false);
      return;
    }
    loadPreferences();
  }, [userId, householdId]);

  async function loadPreferences() {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("email_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading email preferences:", error);
      }

      if (data) {
        setDailyEmailEnabled(data.daily_email_enabled);
        setEmailTime(data.email_time);
        setTimezone(data.timezone);
        setWeeklyEmailEnabled(data.weekly_email_enabled);
        setHasPreferences(true);
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    } finally {
      setLoading(false);
    }
  }

  async function savePreferences() {
    if (!userId || !householdId) {
      toast.error("Please log in to save preferences");
      return;
    }

    if (demoMode) {
      toast.success("Email preferences saved (demo)");
      return;
    }

    setSaving(true);
    try {
      const preferences = {
        user_id: userId,
        household_id: householdId,
        daily_email_enabled: dailyEmailEnabled,
        email_time: emailTime,
        timezone: timezone,
        weekly_email_enabled: weeklyEmailEnabled,
      };

      if (hasPreferences) {
        const { error } = await supabase
          .from("email_preferences")
          .update(preferences)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_preferences")
          .insert(preferences);
        if (error) throw error;
        setHasPreferences(true);
      }

      toast.success("Email preferences saved");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    if (!userId) {
      toast.error("Please log in to send a test email");
      return;
    }

    if (demoMode) {
      toast.success("Test email sent (demo)");
      return;
    }

    if (!hasPreferences) {
      await savePreferences();
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-daily-email",
        {
          body: { user_id: userId, test_mode: true },
        },
      );

      if (error) throw error;

      if (data?.success) {
        toast.success("Test email sent! Check your inbox.");
      } else {
        toast.error(data?.message || "Failed to send test email");
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Preferences
        </CardTitle>
        <CardDescription>
          {userEmail ? (
            <span>
              Emails will be sent to{" "}
              <span className="font-mono font-medium text-foreground">
                {userEmail}
              </span>
            </span>
          ) : (
            "Configure your daily and weekly email summaries"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="font-medium">Daily Email Summary</Label>
            <p className="text-sm text-muted-foreground">
              Receive a daily overview of your finances, upcoming bills, and AI
              tips
            </p>
          </div>
          <Switch
            checked={dailyEmailEnabled}
            onCheckedChange={setDailyEmailEnabled}
          />
        </div>

        {dailyEmailEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-0 md:pl-4 border-l-0 md:border-l-2 border-border">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 font-mono text-xs uppercase">
                <Clock className="h-3 w-3" />
                Preferred Time
              </Label>
              <Select value={emailTime} onValueChange={setEmailTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TIMES.map((time) => (
                    <SelectItem key={time.value} value={time.value}>
                      {time.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase">Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="font-medium">Weekly Email Report</Label>
            <p className="text-sm text-muted-foreground">
              Get a comprehensive weekly summary every Sunday
            </p>
          </div>
          <Switch
            checked={weeklyEmailEnabled}
            onCheckedChange={setWeeklyEmailEnabled}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            onClick={savePreferences}
            disabled={saving}
            className="font-mono"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={sendTestEmail}
            disabled={sendingTest || !dailyEmailEnabled}
            className="font-mono"
          >
            {sendingTest ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Test Email
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
