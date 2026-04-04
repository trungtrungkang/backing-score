"use client";

import { useEffect, useRef } from "react";
import { useUniversalSync } from "./UniversalSyncProvider";

// Hook/Controller thao túng API của AlphaTab
export function useMusicSyncController(apiRef: any) {
  const { latestXmlCoordinates, isAutoSyncEnabled, broadcastPayload, setAutoSync } = useUniversalSync();

  // Nhận dữ liệu P2P -> Cuộn AlphaTab xuống tọa độ (Deskew Sync)
  useEffect(() => {
    if (!latestXmlCoordinates || !isAutoSyncEnabled || !apiRef.current) return;
    
    // Giả lập Deskew (Lùi lại 80ms chờ âm thanh bay tới máy học sinh)
    const deskewTimeout = setTimeout(() => {
      // Ví dụ gọi hàm API di chuyển Cursor của AlphaTab...
      // apiRef.current.tick(latestXmlCoordinates.measure, latestXmlCoordinates.beat);
    }, 80); // 80ms là giả định JitterBufferDelay bình quân

    return () => clearTimeout(deskewTimeout);
  }, [latestXmlCoordinates, isAutoSyncEnabled, apiRef]);

  // Hook Lắng nghe thao tác cục bộ của học sinh
  // Nếu học sinh dùng chuột CLICK đổi Tempo/Mute, ngắt kết nối đồng bộ
  const handleLocalStudentAction = () => {
    setAutoSync(false);
  };

  return { handleLocalStudentAction };
}

// Hook thao túng PDFViewer scroll
export function usePdfSyncController(scrollContainerRef: any) {
  const { latestPdfCoordinates, isAutoSyncEnabled } = useUniversalSync();

  useEffect(() => {
    if (!latestPdfCoordinates || !isAutoSyncEnabled || !scrollContainerRef.current) return;

    // Giả lập Deskew
    const latency = setTimeout(() => {
       const height = scrollContainerRef.current.scrollHeight;
       scrollContainerRef.current.scrollTo(0, latestPdfCoordinates.scrollY * height);
    }, 80);

    return () => clearTimeout(latency);
  }, [latestPdfCoordinates, isAutoSyncEnabled, scrollContainerRef]);
}
