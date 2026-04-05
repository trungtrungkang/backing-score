import { WebhookReceiver } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';
import { endLiveSessionSystem } from '@/app/actions/v5/livekit';

// Khởi tạo Receiver bằng Key và Secret (để verify chữ ký bảo mật từ cụm Livekit Cloud)
const receiver = new WebhookReceiver(
  process.env.LIVEKIT_API_KEY || '',
  process.env.LIVEKIT_API_SECRET || ''
);

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    // Verify JWT payload
    const event = await receiver.receive(body, authHeader);
    
    // Bắt đúng sự kiện phòng bị giải tán (do không còn Host hoặc rỗng lâu quá)
    if (event.event === 'room_finished') {
       if (event.room && event.room.name) {
          // room.name chính là classroomId (được truyền lúc tạo JWT AccessToken qua `at.addGrant({ room: classroomId })`)
          await endLiveSessionSystem(event.room.name);
          console.log(`[Webhook] Dọn dẹp thành công Zombie Session cho Phòng: ${event.room.name}`);
       }
    }

    // Luôn trả về 200 để LiveKit không gọi lại quá nhiều lần
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[LiveKit Webhook Error]', err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 400 });
  }
}
