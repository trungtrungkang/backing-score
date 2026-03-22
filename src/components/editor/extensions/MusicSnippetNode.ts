import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MusicSnippetView from './MusicSnippetView';

export const MusicSnippetNode = Node.create({
  name: 'musicSnippet',
  group: 'block',
  atom: true, // This node is treated as a single structural unit (like an image)
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      projectId: {
        default: null,
        parseHTML: element => element.getAttribute('data-project-id'),
        renderHTML: attributes => {
          if (!attributes.projectId) return {};
          return { 'data-project-id': attributes.projectId };
        }
      },
      practiceRequired: {
        default: true,
        parseHTML: element => element.getAttribute('data-practice-required') !== 'false',
        renderHTML: attributes => {
          return { 'data-practice-required': attributes.practiceRequired === false ? 'false' : 'true' };
        }
      },
      snippetId: {
        default: null,
        parseHTML: element => element.getAttribute('data-snippet-id'),
        renderHTML: attributes => {
          if (!attributes.snippetId) return { 'data-snippet-id': `snippet_${Math.random().toString(36).substr(2, 9)}` };
          return { 'data-snippet-id': attributes.snippetId };
        }
      },
      payloadRaw: {
        default: null, // JSON String of DAWPayload for hydration
        parseHTML: element => element.getAttribute('data-payload-raw'),
        renderHTML: attributes => {
          if (!attributes.payloadRaw) return {};
          return { 'data-payload-raw': attributes.payloadRaw };
        }
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="music-snippet"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'music-snippet' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MusicSnippetView);
  },
});
