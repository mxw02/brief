import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dbDeleteUser, dbUpdateUserAccess } from "@/lib/db";
import type { UserRole } from "@/lib/workspace";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  let body: {
    role?: UserRole;
    allSpaces?: boolean;
    spaceIds?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const role =
    body.role === "admin" || body.role === "editor" || body.role === "viewer"
      ? body.role
      : undefined;

  const updated = await dbUpdateUserAccess(id, {
    role,
    allSpaces:
      role === "admin"
        ? true
        : typeof body.allSpaces === "boolean"
          ? body.allSpaces
          : undefined,
    spaceIds: Array.isArray(body.spaceIds) ? body.spaceIds : undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: updated });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (sessionUser.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (id === sessionUser.id) {
    return NextResponse.json(
      { error: "Du kannst deinen eigenen Admin-Account nicht löschen" },
      { status: 400 }
    );
  }

  const deleted = await dbDeleteUser(id);
  if (!deleted) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ deleted: true });
}
