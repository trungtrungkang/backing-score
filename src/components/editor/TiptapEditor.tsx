"use client";

import { useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { MusicSnippetNode } from './extensions/MusicSnippetNode';
import { ProjectSelectorModal } from './ProjectSelectorModal';
import { Bold, Italic, List, ListOrdered, Quote, Music, Heading2, Heading3, Save } from 'lucide-react';

export function TiptapEditor({ onSave, initialContent, saveButtonLabel = "Publish Curriculum" }: { onSave?: (json: any) => void, initialContent?: any, saveButtonLabel?: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start writing your interactive lesson... Click Insert Snippet to embed sheet music.' }),
      MusicSnippetNode,
    ],
    content: initialContent || `
      <h2>Welcome to Creator Studio</h2>
      <p>This is where you compose interactive digital lessons. You can format text, insert images, and <strong>most importantly</strong>, embed live music examples powered by Wait Mode directly within paragraphs!</p>
      <p>Try clicking the <strong>Insert Music Snippet</strong> button in the top right corner!</p>
    `,
    editorProps: {
      attributes: {
        class: 'prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[500px] border border-zinc-200 dark:border-zinc-800 rounded-b-lg p-6 bg-white dark:bg-[#121214]',
      },
    },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!editor) return null;

  const handleProjectSelect = (projectId: string) => {
     // Secure injection of explicit Appwrite Project Document IDs directly into the Node attributes!
     editor.chain().focus().insertContent({
       type: 'musicSnippet',
       attrs: { projectId, payloadRaw: null }
     }).run();
  };

  return (
    <div className="w-full flex flex-col shadow-sm">
      {/* Visual Rich-Text Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border border-b-0 border-zinc-200 dark:border-zinc-800 rounded-t-lg bg-zinc-50 dark:bg-[#1A1A1E]">
        <button 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          className={`p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${editor.isActive('bold') ? 'bg-zinc-200 dark:bg-zinc-800 text-blue-500' : 'text-zinc-600 dark:text-zinc-400'}`}
        >
          <Bold className="w-4 h-4" />
        </button>
        <button 
          onClick={() => editor.chain().focus().toggleItalic().run()} 
          className={`p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${editor.isActive('italic') ? 'bg-zinc-200 dark:bg-zinc-800 text-blue-500' : 'text-zinc-600 dark:text-zinc-400'}`}
        >
          <Italic className="w-4 h-4" />
        </button>
        
        <div className="w-[1px] h-6 bg-zinc-300 dark:bg-zinc-700 mx-2" />
        
        <button 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
          className={`p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 2 }) ? 'bg-zinc-200 dark:bg-zinc-800 text-blue-500' : 'text-zinc-600 dark:text-zinc-400'}`}
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button 
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} 
          className={`p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 3 }) ? 'bg-zinc-200 dark:bg-zinc-800 text-blue-500' : 'text-zinc-600 dark:text-zinc-400'}`}
        >
          <Heading3 className="w-4 h-4" />
        </button>
        
        <div className="w-[1px] h-6 bg-zinc-300 dark:bg-zinc-700 mx-2" />

        <button 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          className={`p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${editor.isActive('bulletList') ? 'bg-zinc-200 dark:bg-zinc-800 text-blue-500' : 'text-zinc-600 dark:text-zinc-400'}`}
        >
          <List className="w-4 h-4" />
        </button>
        <button 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          className={`p-2 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 ${editor.isActive('orderedList') ? 'bg-zinc-200 dark:bg-zinc-800 text-blue-500' : 'text-zinc-600 dark:text-zinc-400'}`}
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <div className="flex-1" />
        
        {/* Custom Node Injection Plugin */}
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-semibold tracking-wide transition-all shadow-md shadow-blue-500/20"
        >
          <Music className="w-4 h-4" />
          Insert Music Snippet
        </button>
        
        {onSave && (
           <button 
             onClick={() => onSave(editor.getJSON())} 
             className="flex items-center gap-2 px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-bold tracking-wide transition-all shadow-md shadow-green-500/20 ml-2"
           >
             <Save className="w-4 h-4 text-white" />
             {saveButtonLabel}
           </button>
        )}
      </div>
      
      {/* Tiptap Rendering Canvas */}
      <EditorContent editor={editor} />
      
      {/* Pop-out Selector Frame */}
      <ProjectSelectorModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSelect={handleProjectSelect} 
      />
    </div>
  );
}
