import { NextResponse } from 'next/server';
import { endCurrentLiveSession, recordAttendance } from '@/app/actions/v5/livekit';

// API Point for `navigator.sendBeacon` to cleanly detach sessions unconditionally
export async function POST(req: Request) {
  try {
    const text = await req.text();
    const data = JSON.parse(text);
    
    if (data.role === 'teacher') {
      await endCurrentLiveSession(data.classroomId);
    } else if (data.role === 'student') {
      await recordAttendance(data.classroomId, 'leave');
    }
    
    return NextResponse.json({ success: true });
  } catch (e) {
    // Fail silently so it doesn't bother user on unmount
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
