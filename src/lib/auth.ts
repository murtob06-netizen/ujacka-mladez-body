import { supabase } from "./supabaseClient";

export async function getMyProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return { profile: null, error: new Error("Not logged in") };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  return { profile: data ?? null, error };
}
