"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { MusicSnippetNode } from './extensions/MusicSnippetNode';
import { useEffect } from 'react';

export interface TiptapViewerProps {
  contentRaw: string; // The raw JSON string retrieved from Appwrite
}

/**
 * A strictly Read-Only variant of Tiptap.
 * Responsible for rendering EdTech curriculum data arrays retrieved from the Server.
 */
export function TiptapViewer({ contentRaw }: TiptapViewerProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit,
      MusicSnippetNode,
    ],
    // Bootstraps from pure stringified JSON format
    content: contentRaw ? JSON.parse(contentRaw) : null, 
    editorProps: {
      attributes: {
        class: 'prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[500px] w-full bg-white dark:bg-[#121214]',
      },
    },
  });

  // Re-hydrate the Editor instance if Appwrite Server Actions mutate the underlying JSON prop remotely
  useEffect(() => {
    if (editor && contentRaw) {
      const parsedContent = JSON.parse(contentRaw);
      editor.commands.setContent(parsedContent);
    }
  }, [editor, contentRaw]);

  if (!editor) return null;

  return (
    <div className="w-full flex flex-col pt-8 pb-32">
      <EditorContent editor={editor} />
    </div>
  );
}
