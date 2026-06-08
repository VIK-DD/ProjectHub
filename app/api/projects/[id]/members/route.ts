import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProjectAccess, getProjectMemberUsers } from "@/lib/access";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await getProjectAccess(session.user.id, params.id);
  if (!access)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await getProjectMemberUsers(params.id);
  return NextResponse.json({ members: users });
}
