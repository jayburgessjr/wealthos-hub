import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useStrategy, useStrategyActions, useStrategyItems } from "@/hooks/useCoachPlan";
import type { PlanSection } from "@/lib/coachTypes";
import { ActionList } from "./ActionList";
import { PlanItemCard } from "./PlanItemCard";
import { ProfileCard } from "./ProfileCard";

const TABS: { id: PlanSection; label: string; empty: string }[] = [
  { id: "wealth", label: "Wealth", empty: "No wealth steps yet." },
  { id: "invest", label: "Invest", empty: "No investing steps yet." },
  { id: "income", label: "Earn more", empty: "No earn more ideas yet." },
  { id: "opportunity", label: "Opportunities", empty: "No opportunities yet." },
  { id: "gap", label: "Gaps", empty: "No gaps found yet." },
];

function Section({ section, empty }: { section: PlanSection; empty: string }) {
  const { data } = useStrategyItems(section);
  if (!data?.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2">
      {data.map((i) => (
        <PlanItemCard key={i.id} item={i} />
      ))}
    </div>
  );
}

export function PlanPanel({ onGoChat }: { onGoChat: () => void }) {
  const strategy = useStrategy();
  const items = useStrategyItems();
  const actions = useStrategyActions();
  const hasPlan = !!strategy.data && (strategy.data.status === "active" || (items.data?.length ?? 0) > 0);

  if (!hasPlan) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center" data-testid="plan-empty">
        <h2 className="font-display text-base font-bold">No plan yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tell the coach about your goal and what you can save. It works from $1.</p>
        <Button className="mt-3" onClick={onGoChat}>
          Start with the coach
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {strategy.data && <ProfileCard strategy={strategy.data} />}
      <Tabs defaultValue="actions">
        <TabsList className="flex-wrap">
          <TabsTrigger value="actions">Actions</TabsTrigger>
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="actions">
          <ActionList actions={actions.data ?? []} />
        </TabsContent>
        {TABS.map((t) => (
          <TabsContent key={t.id} value={t.id}>
            <Section section={t.id} empty={t.empty} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
