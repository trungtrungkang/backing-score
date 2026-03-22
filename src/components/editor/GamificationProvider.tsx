"use client";

import { createContext, useContext } from "react";

export interface GamificationContextType {
  userId: string;
  courseId: string;
  lessonId: string;
  totalSnippets: number;
  isLastLesson: boolean;
  readOnly?: boolean;
}

const GamificationContext = createContext<GamificationContextType | null>(null);

export function GamificationProvider({ 
  userId, courseId, lessonId, totalSnippets, isLastLesson, readOnly = false, children 
}: GamificationContextType & { children: React.ReactNode }) {
  return (
    <GamificationContext.Provider value={{ userId, courseId, lessonId, totalSnippets, isLastLesson, readOnly }}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  return useContext(GamificationContext);
}
