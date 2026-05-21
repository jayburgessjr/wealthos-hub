import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export interface VisionItem {
  id: string;
  household_id: string;
  user_id: string;
  storage_path: string;
  title?: string | null;
  note?: string | null;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  order_index: number;
  linked_goal_id?: string | null;
  created_at: string;
  updated_at: string;
  url?: string; // signed URL
  userName?: string;
}

export const visionKeys = {
  all: ["vision"] as const,
  list: (householdId: string | null) => ["vision", householdId] as const,
};

async function signUrl(path: string): Promise<string> {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const { data, error } = await supabase.storage
    .from("vision")
    .createSignedUrl(path, 60 * 60 * 6);
  if (error) throw error;
  return data.signedUrl;
}

export function useVisionQuery(householdId: string | null) {
  return useQuery<{ items: VisionItem[] }, Error>({
    queryKey: householdId
      ? visionKeys.list(householdId)
      : ["vision", "no-household"],
    enabled: !!householdId,
    queryFn: async () => {
      if (!householdId) throw new Error("No household");
      const { data, error } = await supabase
        .from("vision_items")
        .select("*")
        .eq("household_id", householdId)
        .order("pinned", { ascending: false })
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const items = await Promise.all(
        (data ?? []).map(async (row: any) => ({
          ...row,
          url: await signUrl(row.storage_path).catch(() => ""),
        })),
      );
      return { items };
    },
    staleTime: 30_000,
  });
}

export function useUploadVisionMutation(householdId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (files: File[]) => {
      if (!householdId || !user) throw new Error("Missing household/user");
      const uploaded: VisionItem[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop() || "jpg";
        const fileId = crypto.randomUUID();
        const path = `vision/${householdId}/${fileId}.${ext}`;
        const { error: uerr } = await supabase.storage
          .from("vision")
          .upload(path, f, { upsert: false, cacheControl: "3600" });
        if (uerr) throw uerr;
        const insert = {
          household_id: householdId,
          user_id: user.id,
          storage_path: path,
          title: f.name.replace(/\.[^.]+$/, ""),
          note: null,
          tags: [],
          pinned: false,
          favorite: false,
          order_index: 0,
        };
        const { data: row, error: ierr } = await supabase
          .from("vision_items")
          .insert(insert)
          .select("*")
          .single();
        if (ierr) throw ierr;
        uploaded.push({ ...(row as any), url: await signUrl(path) });
      }
      return uploaded;
    },
    onSuccess: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: visionKeys.list(householdId) });
    },
  });
}

export function useAddVisionUrlMutation(householdId: string | null) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (url: string) => {
      if (!householdId || !user) throw new Error("Missing household/user");
      const insert = {
        household_id: householdId,
        user_id: user.id,
        storage_path: url,
        title: "Image from URL",
        note: null,
        tags: [],
        pinned: false,
        favorite: false,
        order_index: 0,
      };
      const { data: row, error } = await supabase
        .from("vision_items")
        .insert(insert)
        .select("*")
        .single();
      if (error) throw error;
      return { ...(row as any), url };
    },
    onSuccess: () => {
      if (!householdId) return;
      qc.invalidateQueries({ queryKey: visionKeys.list(householdId) });
    },
  });
}

export function useUpdateVisionMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<VisionItem>;
    }) => {
      const updates: any = { ...patch };
      delete updates.url;
      delete updates.userName; // client-only
      const { data, error } = await supabase
        .from("vision_items")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as VisionItem;
    },
    onSuccess: () => {
      if (householdId)
        qc.invalidateQueries({ queryKey: visionKeys.list(householdId) });
    },
  });
}

export function useDeleteVisionMutation(householdId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: VisionItem) => {
      const { error } = await supabase
        .from("vision_items")
        .delete()
        .eq("id", item.id);
      if (error) throw error;
      // Attempt to delete storage object if it's not a URL
      if (!item.storage_path.startsWith("http")) {
        await supabase.storage
          .from("vision")
          .remove([item.storage_path])
          .catch(() => {});
      }
    },
    onSuccess: () => {
      if (householdId)
        qc.invalidateQueries({ queryKey: visionKeys.list(householdId) });
    },
  });
}
