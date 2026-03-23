"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Youtube from "@tiptap/extension-youtube";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Link2, Image, Youtube as YoutubeIcon,
  AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Heading3,
  Undo, Redo, RemoveFormatting, BookOpen, User2, Guitar, Music, Tag, Search,
} from "lucide-react";
import { useCallback, useState, useEffect, useRef } from "react";
import { searchArtists, listArtists } from "@/lib/appwrite/artists";
import { listInstruments } from "@/lib/appwrite/instruments";
import { searchCompositions, listCompositions } from "@/lib/appwrite/compositions";
import { listGenres } from "@/lib/appwrite/genres";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const [wikiPickerOpen, setWikiPickerOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-[#C8A856] underline" },
      }),
      ImageExtension.configure({
        HTMLAttributes: { class: "rounded-xl max-w-full mx-auto" },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Youtube.configure({
        HTMLAttributes: { class: "rounded-xl overflow-hidden w-full aspect-video" },
      }),
      Placeholder.configure({ placeholder: placeholder || "Start writing..." }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none px-4 py-3 min-h-[200px] outline-none focus:outline-none",
      },
    },
  });

  const addLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const addYoutube = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("YouTube URL:");
    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    }
  }, [editor]);

  const insertWikiLink = useCallback((name: string, href: string) => {
    if (!editor) return;
    editor.chain().focus()
      .insertContent(`<a href="${href}">${name}</a> `)
      .run();
    setWikiPickerOpen(false);
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="border border-zinc-200 dark:border-white/10 rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-800">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900">
        <ToolbarGroup>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
            <Heading1 className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
            <Heading2 className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
            <Heading3 className="w-4 h-4" />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarDivider />

        <ToolbarGroup>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
            <Bold className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
            <Italic className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
            <Strikethrough className="w-4 h-4" />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarDivider />

        <ToolbarGroup>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align Left">
            <AlignLeft className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Center">
            <AlignCenter className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align Right">
            <AlignRight className="w-4 h-4" />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarDivider />

        <ToolbarGroup>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
            <List className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Ordered List">
            <ListOrdered className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Quote">
            <Quote className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code Block">
            <Code className="w-4 h-4" />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarDivider />

        <ToolbarGroup>
          <ToolbarBtn onClick={addLink} active={editor.isActive("link")} title="Link">
            <Link2 className="w-4 h-4" />
          </ToolbarBtn>
          <div className="relative">
            <ToolbarBtn onClick={() => setWikiPickerOpen(!wikiPickerOpen)} active={wikiPickerOpen} title="Wiki Link">
              <BookOpen className="w-4 h-4" />
            </ToolbarBtn>
            {wikiPickerOpen && (
              <WikiLinkPicker
                onSelect={insertWikiLink}
                onClose={() => setWikiPickerOpen(false)}
              />
            )}
          </div>
          <ToolbarBtn onClick={addImage} title="Image">
            <Image className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={addYoutube} title="YouTube">
            <YoutubeIcon className="w-4 h-4" />
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarDivider />

        <ToolbarGroup>
          <ToolbarBtn onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear Formatting">
            <RemoveFormatting className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
            <Undo className="w-4 h-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
            <Redo className="w-4 h-4" />
          </ToolbarBtn>
        </ToolbarGroup>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

// ── Wiki Link Picker ─────────────────────────────────────────────────────────

interface WikiItem { name: string; slug: string; category: string; icon: typeof User2 }

function WikiLinkPicker({ onSelect, onClose }: { onSelect: (name: string, href: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WikiItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Focus input on mount
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  // Load defaults
  useEffect(() => {
    setLoading(true);
    Promise.all([listArtists(5), listInstruments(5), listCompositions(5), listGenres(5)])
      .then(([a, i, c, g]) => {
        setResults([
          ...a.map(x => ({ name: x.name, slug: x.slug, category: "artists", icon: User2 })),
          ...i.map(x => ({ name: x.name, slug: x.slug, category: "instruments", icon: Guitar })),
          ...c.map(x => ({ name: x.title, slug: x.slug, category: "compositions", icon: Music })),
          ...g.map(x => ({ name: x.name, slug: x.slug, category: "genres", icon: Tag })),
        ]);
      }).finally(() => setLoading(false));
  }, []);

  // Search on query change
  useEffect(() => {
    if (!query.trim()) return;
    setLoading(true);
    const timer = setTimeout(async () => {
      const q = query.toLowerCase();
      const [a, c, allInst, allGen] = await Promise.all([
        searchArtists(query, 5), searchCompositions(query, 5),
        listInstruments(50), listGenres(50),
      ]);
      setResults([
        ...a.map(x => ({ name: x.name, slug: x.slug, category: "artists", icon: User2 })),
        ...allInst.filter(x => x.name.toLowerCase().includes(q)).slice(0, 5).map(x => ({ name: x.name, slug: x.slug, category: "instruments", icon: Guitar })),
        ...c.map(x => ({ name: x.title, slug: x.slug, category: "compositions", icon: Music })),
        ...allGen.filter(x => x.name.toLowerCase().includes(q)).slice(0, 5).map(x => ({ name: x.name, slug: x.slug, category: "genres", icon: Tag })),
      ]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div ref={ref} className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-[#1A1A1E] border border-zinc-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-200 dark:border-white/5">
        <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search wiki..."
          className="flex-1 bg-transparent text-sm outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" />
      </div>
      <div className="max-h-60 overflow-y-auto py-1">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-700 border-t-[#C8A856] rounded-full animate-spin" />
          </div>
        ) : results.length === 0 ? (
          <p className="text-center text-xs text-zinc-400 py-4">No results</p>
        ) : (
          results.map((item, i) => (
            <button key={`${item.category}-${item.slug}-${i}`} type="button"
              onClick={() => onSelect(item.name, `/wiki/${item.category}/${item.slug}`)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
              <item.icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span className="text-sm text-zinc-900 dark:text-white truncate flex-1">{item.name}</span>
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{item.category}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ── Toolbar Helpers ──────────────────────────────────────────────────────────

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700 mx-1" />;
}

function ToolbarBtn({ onClick, active, disabled, title, children }: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed ${
        active ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white" : ""
      }`}
    >
      {children}
    </button>
  );
}
