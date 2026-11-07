import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { useState } from "react";
import { Brain } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoachChat } from "@/components/coach/CoachChat";
import { CoachDisclaimer } from "@/components/coach/CoachDisclaimer";
import { PlanPanel } from "@/components/coach/PlanPanel";

/** The AI Coach: Chat (interview and questions) and My plan (what the coach built). Route: /invs/strategy and /coach. */
export default function FinancialAdvisor() {
  const [tab, setTab] = useState("chat");
  return (
    <DashboardLayout>
      <SubscriptionGate>
        <div className="flex flex-col">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
              <Brain className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold leading-none text-foreground">AJE Coach</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">A simple money plan, built with you</p>
            </div>
          </div>

          <CoachDisclaimer />

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="plan">My plan</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="mt-3">
              <CoachChat />
            </TabsContent>
            <TabsContent value="plan" className="mt-3">
              <PlanPanel onGoChat={() => setTab("chat")} />
            </TabsContent>
          </Tabs>
        </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
