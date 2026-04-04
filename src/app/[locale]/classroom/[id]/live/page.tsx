import React from "react";
import { LiveKitClassroomContainer } from "@/components/livekit/LiveKitClassroom";
import { getAuth } from "@/lib/auth/better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function LiveClassroomPage(props: { params: Promise<{ id: string, locale: string }> }) {
  const resolvedParams = await props.params;

  const auth = getAuth();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session || !session.user) {
    redirect(`/${resolvedParams.locale}/login`);
  }

  // The LiveKitToken action handles whether this user is allowed in or not,
  // so we can render the Container right away and let it bootstrap.
  return (
    <div className="fixed inset-0 z-50 w-screen h-screen overflow-hidden bg-slate-950 text-white">
      <LiveKitClassroomContainer classroomId={resolvedParams.id} />
    </div>
  );
}
