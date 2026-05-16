import { Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Macro() {
  return (
    <DashboardLayout>
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
      </div>
    </DashboardLayout>
  );
}
