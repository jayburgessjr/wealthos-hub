import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { isDemoMode } = useDemo();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  // Logged-out visitors in demo mode may browse; DemoProvider clears demo for signed-in users.
  if (!user && !isDemoMode) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
