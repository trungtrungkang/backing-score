import { useState, useEffect, useCallback } from "react";
import { getUserPrefsV5, updateUserPrefsV5 } from "@/app/actions/v5/user-prefs";
import { MicProfile } from "./useMicInput";

export function useMicProfile() {
  const [profile, setProfile] = useState<MicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const prefs = await getUserPrefsV5();
      if (prefs && prefs.micProfile) {
        setProfile(JSON.parse(prefs.micProfile) as MicProfile);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Failed to load user mic profile:", error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveProfile = useCallback(async (newProfile: MicProfile) => {
    try {
      await updateUserPrefsV5({
        micProfile: JSON.stringify(newProfile),
      });
      setProfile(newProfile);
      return true;
    } catch (error) {
      console.error("Failed to save mic profile:", error);
      return false;
    }
  }, []);

  const clearProfile = useCallback(async () => {
      try {
        await updateUserPrefsV5({ micProfile: null });
        setProfile(null);
        return true;
      } catch (error) {
        console.error("Failed to clear mic profile:", error);
        return false;
      }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return { profile, loading, saveProfile, loadProfile, clearProfile };
}
