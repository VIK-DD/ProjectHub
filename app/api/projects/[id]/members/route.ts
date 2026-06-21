import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getProjectAccess, getProjectMemberUsers } from "@/lib/access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await getProjectAccess(session.user.id, id);
  if (!access)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await getProjectMemberUsers(id);
  return NextResponse.json({ members: users });
}
