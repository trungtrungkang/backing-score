"use client";

import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProject, ProjectDocument } from "@/lib/appwrite";
import { toast } from "sonner";

const TAG_OPTIONS = {
  Instruments: ["Piano", "Acoustic Guitar", "Electric Guitar", "Bass", "Violin", "Cello", "Trumpet", "Saxophone", "Drums", "Vocals", "Flute", "Clarinet"],
  Genres: ["Pop", "Rock", "Jazz", "Classical", "Blues", "R&B", "Country", "Folk", "Latin", "Electronic", "Hip Hop"],
  Difficulty: ["Beginner", "Intermediate", "Advanced"],
};

interface QuickEditModalProps {
  project: ProjectDocument;
  onClose: () => void;
  onSaved: (updated: ProjectDocument) => void;
}

export function QuickEditModal({ project, onClose, onSaved }: QuickEditModalProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [tags, setTags] = useState<string[]>(project.tags || []);
  const [saving, setSaving] = useState(false);

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProject(project.$id, {
        name: name.trim(),
        description: description.trim() || undefined,
        tags,
      });
      toast.success("Saved ✓");
      onSaved(updated);
      onClose();
    } catch (err: any) {
      toast.error("Failed: " + (err?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Quick Edit</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
              placeholder="Project name"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Short description..."
            />
          </div>

          {/* Tags */}
          {Object.entries(TAG_OPTIONS).map(([group, options]) => (
            <div key={group}>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 block">{group}</label>
              <div className="flex flex-wrap gap-1.5">
                {options.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                      tags.includes(tag)
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-500/30"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="outline" onClick={onClose} className="text-zinc-600 dark:text-zinc-400">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
