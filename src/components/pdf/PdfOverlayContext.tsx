"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { SheetOverlay, DrawingStroke, Bookmark, NavigationSequence, saveOverlay, getOverlays } from '@/lib/appwrite/nav-maps';
import { toast } from 'sonner';

interface PdfOverlayContextType {
  overlays: SheetOverlay[];
  setOverlays: React.Dispatch<React.SetStateAction<SheetOverlay[]>>;
  activeOverlayId: string | null;
  setActiveOverlayId: (id: string | null) => void;
  activeOverlay: SheetOverlay | null;
  
  // Drawing states
  isDrawingMode: boolean;
  setIsDrawingMode: (mode: boolean) => void;
  drawingColor: string;
  setDrawingColor: (color: string) => void;
  localDrawings: DrawingStroke[];
  setLocalDrawings: React.Dispatch<React.SetStateAction<DrawingStroke[]>>;
  
  // Navigation states
  bookmarks: Bookmark[];
  setBookmarks: React.Dispatch<React.SetStateAction<Bookmark[]>>;
  sequence: NavigationSequence;
  setSequence: React.Dispatch<React.SetStateAction<NavigationSequence>>;
  
  // Actions
  addDrawingStroke: (stroke: DrawingStroke) => void;
  clearDrawings: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;

  saveChanges: (force?: boolean) => Promise<void>;
  isSaving: boolean;
}

const PdfOverlayContext = createContext<PdfOverlayContextType | null>(null);

export function PdfOverlayProvider({ 
  sheetMusicId, 
  initialOverlays = [], 
  children 
}: { 
  sheetMusicId: string; 
  initialOverlays?: SheetOverlay[]; 
  children: React.ReactNode;
}) {
  const [overlays, setOverlays] = useState<SheetOverlay[]>(initialOverlays);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(initialOverlays.length > 0 ? initialOverlays[0].$id : null);
  const [isFetched, setIsFetched] = useState(initialOverlays.length > 0);
  
  // Initial fetch from Client if not provided by Server
  useEffect(() => {
    if (!isFetched) {
       getOverlays(sheetMusicId).then(data => {
          setOverlays(data);
          if (data.length > 0 && !activeOverlayId) {
             setActiveOverlayId(data[0].$id);
          }
       }).catch(console.error).finally(() => setIsFetched(true));
    }
  }, [sheetMusicId, isFetched, activeOverlayId]);

  const activeOverlay = overlays.find(o => o.$id === activeOverlayId) || null;
  
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawingColor, setDrawingColor] = useState("#ef4444");
  
  const [localDrawings, setLocalDrawings] = useState<DrawingStroke[]>([]);
  const [redoStack, setRedoStack] = useState<DrawingStroke[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [sequence, setSequence] = useState<NavigationSequence>([]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when active overlay changes
  useEffect(() => {
    if (activeOverlay) {
      setLocalDrawings(activeOverlay.annotations || []);
      setBookmarks(activeOverlay.bookmarks || []);
      setSequence(activeOverlay.sequence || []);
      setRedoStack([]);
      setHasUnsavedChanges(false);
    } else {
      setLocalDrawings([]);
      setBookmarks([]);
      setSequence([]);
      setRedoStack([]);
      setHasUnsavedChanges(false);
    }
  }, [activeOverlayId, overlays]);

  // Giải quyết Stale Closure cho hàm auto-save (do setTimeout giữ bản sao cũ của state)
  const stateRef = useRef({ localDrawings, bookmarks, sequence, activeOverlay, activeOverlayId });
  useEffect(() => {
    stateRef.current = { localDrawings, bookmarks, sequence, activeOverlay, activeOverlayId };
  }, [localDrawings, bookmarks, sequence, activeOverlay, activeOverlayId]);

  // Debounced save reference
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveChanges = useCallback(async (force = false) => {
    try {
      setIsSaving(true);
      const { activeOverlay, activeOverlayId, bookmarks, sequence, localDrawings: latestDrawings } = stateRef.current;
      
      const name = activeOverlay?.name || "My Notes";
      const isPublished = activeOverlay?.isPublished || false;
      const updatedOverlay = await saveOverlay(sheetMusicId, activeOverlayId, name, bookmarks, sequence, latestDrawings, isPublished);
      
      setOverlays(prev => {
        const idx = prev.findIndex(o => o.$id === activeOverlayId);
        if (idx !== -1 && prev[idx].userId === updatedOverlay.userId) {
           const next = [...prev];
           next[idx] = updatedOverlay;
           return next;
        } else {
           // Bản Fork hoặc bản khởi tạo mới
           toast.success(`Đã lưu bản nháp: ${updatedOverlay.name}`);
           return [...prev, updatedOverlay];
        }
      });
      setActiveOverlayId(updatedOverlay.$id);
      setHasUnsavedChanges(false); // Xoá cờ thay đổi
    } catch (e) {
      console.error(e);
      toast.error("Không thể lưu cấu hình Layer.");
    } finally {
      setIsSaving(false);
    }
  }, [sheetMusicId, setOverlays, setActiveOverlayId]);

  const addDrawingStroke = useCallback((stroke: DrawingStroke) => {
    setLocalDrawings(prev => [...prev, stroke]);
    setRedoStack([]); // Xóa lịch sử redo khi người dùng tự vẽ nhánh mới
    setHasUnsavedChanges(true);
  }, []);

  const clearDrawings = useCallback(() => {
    setLocalDrawings(prev => {
      // Lưu lại toàn bộ vào redoStack để hỗ trợ undo lệnh clear
      setRedoStack(prev);
      return [];
    });
    setHasUnsavedChanges(true);
  }, []);

  const undo = useCallback(() => {
    setLocalDrawings(prev => {
      if (prev.length === 0) return prev;
      const lastStroke = prev[prev.length - 1];
      const newDrawings = prev.slice(0, -1);
      setRedoStack(r => [...r, lastStroke]);
      return newDrawings;
    });
    setHasUnsavedChanges(true);
  }, []);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const strokeToRestore = prev[prev.length - 1];
      const newRedoStack = prev.slice(0, -1);
      setLocalDrawings(d => [...d, strokeToRestore]);
      return newRedoStack;
    });
    setHasUnsavedChanges(true);
  }, []);

  const canUndo = localDrawings.length > 0;
  const canRedo = redoStack.length > 0;

  // Auto-save khi Bookmarks hoặc Sequence thay đổi (Cần trigger thủ công từ Hook nếu cần, hoặc theo dõi sự khác biệt)
  // Để tối ưu, chúng ta sẽ cho Component bên ngoài (như PdfNavMapPanel) gọi thẳng saveChanges(true).

  return (
    <PdfOverlayContext.Provider value={{
      overlays, setOverlays,
      activeOverlayId, setActiveOverlayId, activeOverlay,
      isDrawingMode, setIsDrawingMode,
      drawingColor, setDrawingColor,
      localDrawings, setLocalDrawings,
      bookmarks, setBookmarks,
      sequence, setSequence,
      addDrawingStroke, clearDrawings,
      undo, redo, canUndo, canRedo, hasUnsavedChanges,
      saveChanges, isSaving
    }}>
      {children}
    </PdfOverlayContext.Provider>
  );
}

export const usePdfOverlay = () => {
  const ctx = useContext(PdfOverlayContext);
  if (!ctx) throw new Error("usePdfOverlay must be used within PdfOverlayProvider");
  return ctx;
};
