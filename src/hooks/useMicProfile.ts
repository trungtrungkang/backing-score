import { useState, useEffect, useCallback } from "react";
import { account } from "@/lib/appwrite/client";
import { MicProfile } from "./useMicInput";

export function useMicProfile() {
  const [profile, setProfile] = useState<MicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const prefs = await account.getPrefs();
      if (prefs && prefs.micProfile) {
        setProfile(JSON.parse(prefs.micProfile as string) as MicProfile);
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
      const prefs = await account.getPrefs();
      await account.updatePrefs({
        ...prefs,
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
        const prefs = await account.getPrefs();
        const newPrefs = { ...prefs };
        delete newPrefs.micProfile;
        
        // Appwrite requires at least an empty object for updatePrefs
        await account.updatePrefs(newPrefs);
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
