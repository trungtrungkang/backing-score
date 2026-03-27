"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { GraduationCap, ArrowLeft, Loader2 } from "lucide-react";
import { createClassroom } from "@/lib/appwrite";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";

export default function CreateClassroomPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instrumentFocus, setInstrumentFocus] = useState("");
  const [level, setLevel] = useState("");
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || creating) return;

    setCreating(true);
    try {
      const classroom = await createClassroom({
        name: name.trim(),
        description: description.trim(),
        instrumentFocus: instrumentFocus.trim(),
        level,
      });
      toast.success("Classroom created!");
      router.push(`/classroom/${classroom.$id}`);
    } catch (err) {
      toast.error("Failed to create classroom");
    } finally {
      setCreating(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background dark:bg-black text-foreground dark:text-white">
      <div className="max-w-2xl mx-auto py-12 px-6">
        {/* Back */}
        <Link href="/classroom" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Classrooms
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white">Create Classroom</h1>
            <p className="text-sm text-zinc-400">Set up a new class for your students</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Classroom Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Piano Beginner Class 2026"
                className="w-full h-11 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will students learn in this class?"
                rows={3}
                className="w-full px-4 py-3 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
              />
            </div>

            {/* Instrument / Level Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Instrument Focus
                </label>
                <input
                  type="text"
                  value={instrumentFocus}
                  onChange={(e) => setInstrumentFocus(e.target.value)}
                  placeholder="e.g., Piano, Guitar, Violin"
                  className="w-full h-11 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                  Level
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                >
                  <option value="">Select level...</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="mixed">Mixed Level</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/classroom")}
              className="text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating || !name.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 h-11 shadow-lg shadow-indigo-500/20"
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Classroom
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
