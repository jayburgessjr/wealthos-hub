import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getVisionPlan } from "@/services/householdAiService";
import { VisionUpload } from "@/components/household/vision/VisionUpload";
import { VisionCard } from "@/components/household/vision/VisionCard";
import { VisionDrawer } from "@/components/household/vision/VisionDrawer";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import {
  useVisionQuery,
  useUploadVisionMutation,
  useUpdateVisionMutation,
  useDeleteVisionMutation,
  useAddVisionUrlMutation,
  VisionItem,
} from "@/hooks/useHouseholdVisionData";
import { useUpdateHouseholdMutation } from "@/hooks/useHouseholdBudgetData";
import { toast } from "sonner";
import { Save } from "lucide-react";

export default function HouseholdVision() {
  const { householdId, addGoal, budget } = useHouseholdBudget();
  const { data, isLoading } = useVisionQuery(householdId);
  const uploadMutation = useUploadVisionMutation(householdId);
  const addUrlMutation = useAddVisionUrlMutation(householdId);
  const updateMutation = useUpdateVisionMutation(householdId);
  const deleteMutation = useDeleteVisionMutation(householdId);
  const updateHousehold = useUpdateHouseholdMutation(householdId, budget.month);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [active, setActive] = useState<VisionItem | null>(null);
  const [desc, setDesc] = useState("");
  const [ai, setAi] = useState("");
  const [loading, setLoading] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalMonthly, setGoalMonthly] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const items = data?.items ?? [];

  const onFiles = (files: File[]) => uploadMutation.mutate(files);
  const onAddUrl = () => {
    if (!imageUrl) return;
    addUrlMutation.mutate(imageUrl, {
      onSuccess: () => setImageUrl(""),
    });
  };

  const onOpen = (item: VisionItem) => {
    setActive(item);
    setDrawerOpen(true);
  };
  const onSave = (patch: Partial<VisionItem>) => {
    if (!active) return;
    updateMutation.mutate({ id: active.id, patch });
    setActive((prev) => (prev ? { ...prev, ...patch } : prev));
  };
  const onTogglePin = (item: VisionItem) =>
    updateMutation.mutate({ id: item.id, patch: { pinned: !item.pinned } });
  const onToggleFav = (item: VisionItem) =>
    updateMutation.mutate({ id: item.id, patch: { favorite: !item.favorite } });
  const onDelete = (item: VisionItem) => deleteMutation.mutate(item);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const suggestion = await getVisionPlan({
        vision: desc,
        images: items.length,
      });
      setAi(suggestion);
    } finally {
      setLoading(false);
    }
  };

  const savePlanToHousehold = () => {
    if (!ai) return;
    updateHousehold.mutate(
      { notes: ai },
      {
        onSuccess: () => toast.success("Plan saved to household notes!"),
        onError: () => toast.error("Failed to save plan"),
      },
    );
  };

  const createGoalFromForm = () => {
    const target = parseFloat(goalTarget || "0");
    const monthly = parseFloat(goalMonthly || "0");
    if (!goalName || !(target > 0) || !(monthly > 0)) return;
    addGoal({
      name: goalName,
      targetAmount: target,
      currentAmount: 0,
      monthlyContribution: monthly,
    });
    setGoalName("");
    setGoalTarget("");
    setGoalMonthly("");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Life
              </span>
            </div>
            <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
              Vision <span className="text-emerald-500">Board</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Curate images and link them to goals.
            </p>
          </div>
        </div>

        {items.length === 0 && (
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Add to Vision Board</CardTitle>
              <CardDescription>
                Upload files or paste image URLs to visualize your goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="upload">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger
                    value="upload"
                    className="font-mono text-xs uppercase"
                  >
                    Upload Files
                  </TabsTrigger>
                  <TabsTrigger
                    value="url"
                    className="font-mono text-xs uppercase"
                  >
                    Paste URL
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="upload">
                  <VisionUpload onFiles={onFiles} />
                </TabsContent>
                <TabsContent value="url" className="space-y-3">
                  <div className="space-y-1">
                    <Label className="font-mono text-xs uppercase">
                      Image URL
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="font-mono"
                      />
                      <Button
                        onClick={onAddUrl}
                        disabled={!imageUrl || addUrlMutation.isPending}
                        className="font-mono"
                      >
                        {addUrlMutation.isPending ? "Adding..." : "Add"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Paste a direct link to an image (ending in .jpg, .png,
                      etc.) or any public image URL.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Your Vision</CardTitle>
            <CardDescription>Pinned items appear first</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center text-muted-foreground py-10">
                Loading…
              </div>
            ) : items.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                No images yet
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {items.map((it) => (
                  <VisionCard
                    key={it.id}
                    item={it}
                    onOpen={() => onOpen(it)}
                    onTogglePin={() => onTogglePin(it)}
                    onToggleFav={() => onToggleFav(it)}
                    onDelete={() => onDelete(it)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Copilot</CardTitle>
            <CardDescription>
              Describe your vision—get a plan suggestion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label className="font-mono text-xs uppercase">
                Vision Description
              </Label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Describe what you want to achieve…"
                className="min-h-24"
              />
              <div className="flex gap-2">
                <Button
                  onClick={generatePlan}
                  disabled={loading}
                  className="font-mono text-xs"
                >
                  {loading ? "Thinking…" : "Generate Plan"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAi("")}
                  className="font-mono text-xs"
                >
                  Clear
                </Button>
              </div>
              {ai && (
                <div className="space-y-3">
                  <div className="border-2 border-border bg-card p-3">
                    <pre className="whitespace-pre-wrap text-sm">{ai}</pre>
                  </div>
                  <Button
                    onClick={savePlanToHousehold}
                    disabled={updateHousehold.isPending}
                    className="font-mono text-xs"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateHousehold.isPending
                      ? "Saving…"
                      : "Save to Household Notes"}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Create Goal</CardTitle>
            <CardDescription>
              Translate your vision into an attainable goal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="font-mono text-xs uppercase">Goal Name</Label>
                <Input
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="e.g., Buy a home"
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="font-mono text-xs uppercase">
                  Target Amount
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={goalTarget}
                  onChange={(e) => setGoalTarget(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label className="font-mono text-xs uppercase">
                  Monthly Contribution
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={goalMonthly}
                  onChange={(e) => setGoalMonthly(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="mt-3">
              <Button onClick={createGoalFromForm} className="font-mono">
                Create Goal
              </Button>
            </div>
          </CardContent>
        </Card>

        <VisionDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          item={active}
          onSave={onSave}
        />
      </div>
    </DashboardLayout>
  );
}
