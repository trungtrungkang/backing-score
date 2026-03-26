"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useAuth } from "@/contexts/AuthContext";
import { listArtists } from "@/lib/appwrite/artists";
import { listInstruments } from "@/lib/appwrite/instruments";
import { listCompositions } from "@/lib/appwrite/compositions";
import { listGenres } from "@/lib/appwrite/genres";
import {
  createArtist, updateArtist, deleteArtist,
  createInstrument, updateInstrument, deleteInstrument,
  createComposition, updateComposition, deleteComposition,
  createGenre, updateGenre, deleteGenre,
  upsertTranslation,
} from "@/app/actions/wiki";
import { listTranslationsForEntity } from "@/lib/appwrite/wikiTranslations";
import type { ArtistDocument, InstrumentDocument, CompositionDocument, GenreDocument } from "@/lib/appwrite/types";
import { toast } from "sonner";
import {
  ShieldAlert, Loader2, Plus, Pencil, Trash2, User2, Guitar, Music, Tag, X, Save, ChevronDown, Globe
} from "lucide-react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { canAccessAdmin, canEditWiki } from "@/lib/auth/roles";

const LOCALES = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
];

type EntityType = "artists" | "instruments" | "compositions" | "genres";

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ── Field Schemas ────────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
  richtext?: boolean;
  type?: "number";
  transform?: "csv";
}

const ARTIST_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", required: true },
  { key: "nameOriginal", label: "Original Name" },
  { key: "slug", label: "Slug", required: true },
  { key: "nationality", label: "Nationality" },
  { key: "birthDate", label: "Birth Date" },
  { key: "deathDate", label: "Death Date" },
  { key: "roles", label: "Roles (comma-separated)", transform: "csv" as const },
  { key: "bio", label: "Biography", multiline: true, richtext: true },
  { key: "imageUrl", label: "Image URL" },
  { key: "coverUrl", label: "Cover URL" },
  { key: "externalLinks", label: "External Links (JSON)", multiline: true },
];

const INSTRUMENT_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", required: true },
  { key: "slug", label: "Slug", required: true },
  { key: "family", label: "Family" },
  { key: "description", label: "Description", multiline: true, richtext: true },
  { key: "tuning", label: "Tuning" },
  { key: "range", label: "Range" },
  { key: "origin", label: "Origin" },
  { key: "imageUrl", label: "Image URL" },
];

const COMPOSITION_FIELDS: FieldDef[] = [
  { key: "title", label: "Title", required: true },
  { key: "slug", label: "Slug", required: true },
  { key: "year", label: "Year", type: "number" as const },
  { key: "period", label: "Period" },
  { key: "keySignature", label: "Key Signature" },
  { key: "tempo", label: "Tempo" },
  { key: "timeSignature", label: "Time Signature" },
  { key: "difficulty", label: "Difficulty" },
  { key: "genreId", label: "Genre ID" },
  { key: "description", label: "Description", multiline: true, richtext: true },
];

const GENRE_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", required: true },
  { key: "slug", label: "Slug", required: true },
  { key: "era", label: "Era" },
  { key: "parentGenreId", label: "Parent Genre ID" },
  { key: "description", label: "Description", multiline: true, richtext: true },
];

const TABS: { key: EntityType; label: string; icon: typeof User2; color: string }[] = [
  { key: "artists", label: "Artists", icon: User2, color: "violet" },
  { key: "instruments", label: "Instruments", icon: Guitar, color: "amber" },
  { key: "compositions", label: "Compositions", icon: Music, color: "sky" },
  { key: "genres", label: "Genres", icon: Tag, color: "emerald" },
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminWikiPage() {
  const { user, loading: authLoading, getJWT } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<EntityType>("artists");
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [translateEntity, setTranslateEntity] = useState<any>(null);
  const [translateLocale, setTranslateLocale] = useState("vi");
  const [translateData, setTranslateData] = useState<Record<string, string>>({});
  const [translateSaving, setTranslateSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !(canAccessAdmin(user.labels) || canEditWiki(user.labels))) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const loadEntities = useCallback(async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case "artists": setEntities(await listArtists(100)); break;
        case "instruments": setEntities(await listInstruments(100)); break;
        case "compositions": setEntities(await listCompositions(100)); break;
        case "genres": setEntities(await listGenres(100)); break;
      }
    } finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { loadEntities(); }, [loadEntities]);

  const fields = activeTab === "artists" ? ARTIST_FIELDS
    : activeTab === "instruments" ? INSTRUMENT_FIELDS
    : activeTab === "compositions" ? COMPOSITION_FIELDS
    : GENRE_FIELDS;

  function getDisplayName(entity: any) {
    return entity.name || entity.title || entity.slug || entity.$id;
  }

  function openCreate() {
    const initial: Record<string, any> = {};
    fields.forEach((f) => { initial[f.key] = ""; });
    setFormData(initial);
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(entity: any) {
    const data: Record<string, any> = {};
    fields.forEach((f) => {
      const val = entity[f.key];
      if (f.transform === "csv" && Array.isArray(val)) {
        data[f.key] = val.join(", ");
      } else if (typeof val === "number") {
        data[f.key] = val.toString();
      } else {
        data[f.key] = val ?? "";
      }
    });
    setFormData(data);
    setEditingId(entity.$id);
    setFormOpen(true);
  }

  async function handleSave() {
    const jwt = await getJWT();
    const payload: Record<string, unknown> = {};

    fields.forEach((f) => {
      let val: unknown = formData[f.key];
      if (f.transform === "csv" && typeof val === "string") {
        val = val.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
      if (f.type === "number" && typeof val === "string" && val.trim()) {
        val = parseInt(val, 10);
      }
      if (val !== "" && val !== undefined && val !== null) {
        payload[f.key] = val;
      }
    });

    // Auto-generate slug from name/title if empty
    if (!payload.slug && (payload.name || payload.title)) {
      payload.slug = slugify((payload.name || payload.title) as string);
    }

    try {
      if (editingId) {
        switch (activeTab) {
          case "artists": await updateArtist(jwt, editingId, payload); break;
          case "instruments": await updateInstrument(jwt, editingId, payload); break;
          case "compositions": await updateComposition(jwt, editingId, payload); break;
          case "genres": await updateGenre(jwt, editingId, payload); break;
        }
        toast.success("Updated successfully");
      } else {
        switch (activeTab) {
          case "artists": await createArtist(jwt, payload); break;
          case "instruments": await createInstrument(jwt, payload); break;
          case "compositions": await createComposition(jwt, payload); break;
          case "genres": await createGenre(jwt, payload); break;
        }
        toast.success("Created successfully");
      }
      setFormOpen(false);
      loadEntities();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const jwt = await getJWT();
    try {
      switch (activeTab) {
        case "artists": await deleteArtist(jwt, id); break;
        case "instruments": await deleteInstrument(jwt, id); break;
        case "compositions": await deleteComposition(jwt, id); break;
        case "genres": await deleteGenre(jwt, id); break;
      }
      toast.success("Deleted");
      loadEntities();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  }

  // ── Translations ─────────────────────────────────────────────────────────

  const translatableFields = fields.filter((f) => f.multiline || f.richtext || f.key === "name" || f.key === "title");
  const entityTypeMap: Record<EntityType, string> = {
    artists: "artist", instruments: "instrument", compositions: "composition", genres: "genre",
  };

  async function openTranslate(entity: any) {
    setTranslateEntity(entity);
    setTranslateLocale("vi");
    setFormOpen(false);
    await loadTranslateData(entity.$id, "vi");
  }

  async function loadTranslateData(entityId: string, locale: string) {
    const translations = await listTranslationsForEntity(entityId);
    const data: Record<string, string> = {};
    translatableFields.forEach((f) => {
      const found = translations.find((t) => t.locale === locale && t.field === f.key);
      data[f.key] = found?.value || "";
    });
    setTranslateData(data);
  }

  async function handleTranslateLocaleChange(locale: string) {
    setTranslateLocale(locale);
    if (translateEntity) {
      await loadTranslateData(translateEntity.$id, locale);
    }
  }

  async function handleSaveTranslations() {
    if (!translateEntity) return;
    setTranslateSaving(true);
    const jwt = await getJWT();
    try {
      for (const f of translatableFields) {
        const val = translateData[f.key];
        if (val && val.trim()) {
          await upsertTranslation(jwt, translateEntity.$id, entityTypeMap[activeTab], translateLocale, f.key, val);
        }
      }
      toast.success(`Translations saved for ${translateLocale.toUpperCase()}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save translations");
    } finally {
      setTranslateSaving(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-2xl shadow-inner">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-1">Wiki CMS</h1>
          <p className="text-zinc-500 dark:text-zinc-400">Manage Music Encyclopedia content</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#C8A856] hover:bg-[#b8983e] text-white font-semibold text-sm rounded-xl transition-colors shadow-lg shadow-[#C8A856]/20">
          <Plus className="w-4 h-4" /> New Entry
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setActiveTab(key); setFormOpen(false); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === key
                ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}>
            <Icon className="w-4 h-4" /> {label}
            <span className="text-xs opacity-60">({entities.length})</span>
          </button>
        ))}
      </div>

      {/* Entity Form */}
      {formOpen && (
        <div className="mb-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
              {editingId ? "Edit Entry" : "New Entry"}
            </h2>
            <button onClick={() => setFormOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className={f.multiline ? "md:col-span-2" : ""}>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                {f.richtext ? (
                  <RichTextEditor
                    content={formData[f.key] || ""}
                    onChange={(html) => setFormData({ ...formData, [f.key]: html })}
                    placeholder={f.label}
                  />
                ) : f.multiline ? (
                  <textarea rows={4} value={formData[f.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-[#C8A856]/50 resize-y" />
                ) : (
                  <input type={f.type === "number" ? "number" : "text"} value={formData[f.key] || ""}
                    onChange={(e) => {
                      const newData = { ...formData, [f.key]: e.target.value };
                      // Auto-generate slug when typing name/title
                      if ((f.key === "name" || f.key === "title") && !editingId) {
                        newData.slug = slugify(e.target.value);
                      }
                      setFormData(newData);
                    }}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-[#C8A856]/50" />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 bg-[#C8A856] hover:bg-[#b8983e] text-white font-semibold text-sm rounded-xl transition-colors shadow-lg shadow-[#C8A856]/20">
              <Save className="w-4 h-4" /> {editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Entity List */}
      <div className="bg-white dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : entities.length === 0 ? (
          <div className="text-center py-16 text-zinc-400">
            <p className="mb-2">No entries yet</p>
            <button onClick={openCreate} className="text-[#C8A856] hover:underline text-sm font-semibold">Create your first entry →</button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-white/5">
            {entities.map((entity) => (
              <div key={entity.$id} className="flex items-center gap-4 px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate">{getDisplayName(entity)}</h3>
                  <p className="text-xs text-zinc-400 truncate">
                    {entity.slug && <span className="font-mono">/{entity.slug}</span>}
                    {entity.nationality && <span> · {entity.nationality}</span>}
                    {entity.family && <span> · {entity.family}</span>}
                    {entity.period && <span> · {entity.period}</span>}
                    {entity.era && <span> · {entity.era}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openTranslate(entity)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                    title="Translate">
                    <Globe className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEdit(entity)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(entity.$id, getDisplayName(entity))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Translation Panel */}
      {translateEntity && (
        <div className="mt-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Translate: {getDisplayName(translateEntity)}
              </h2>
            </div>
            <button onClick={() => setTranslateEntity(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Locale Tabs */}
          <div className="flex gap-1 mb-6 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl overflow-x-auto">
            {LOCALES.map((loc) => (
              <button key={loc.code}
                onClick={() => handleTranslateLocaleChange(loc.code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  translateLocale === loc.code
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                }`}>
                {loc.label}
              </button>
            ))}
          </div>

          {/* Translation Fields */}
          <div className="space-y-4">
            {translatableFields.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                  {f.label}
                  <span className="ml-2 text-zinc-300 dark:text-zinc-600 normal-case font-normal">
                    (Original: {String(translateEntity[f.key] || "").slice(0, 80)}{String(translateEntity[f.key] || "").length > 80 ? "..." : ""})
                  </span>
                </label>
                {f.richtext ? (
                  <RichTextEditor
                    content={translateData[f.key] || ""}
                    onChange={(html) => setTranslateData({ ...translateData, [f.key]: html })}
                    placeholder={`${f.label} in ${LOCALES.find(l => l.code === translateLocale)?.label || translateLocale}`}
                  />
                ) : f.multiline ? (
                  <textarea rows={3} value={translateData[f.key] || ""}
                    onChange={(e) => setTranslateData({ ...translateData, [f.key]: e.target.value })}
                    placeholder={`${f.label} in ${LOCALES.find(l => l.code === translateLocale)?.label || translateLocale}`}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y" />
                ) : (
                  <input type="text" value={translateData[f.key] || ""}
                    onChange={(e) => setTranslateData({ ...translateData, [f.key]: e.target.value })}
                    placeholder={`${f.label} in ${LOCALES.find(l => l.code === translateLocale)?.label || translateLocale}`}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 rounded-xl text-sm text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setTranslateEntity(null)}
              className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors">
              Close
            </button>
            <button onClick={handleSaveTranslations} disabled={translateSaving}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50">
              {translateSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save {translateLocale.toUpperCase()} Translations
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
