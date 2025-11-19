import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// GET a specific team member
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id, memberId } = await params;

    // Check if team exists and user owns it
    const team = await prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (team.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        _count: {
          select: { tasks: true },
        },
        tasks: {
          select: {
            id: true,
            title: true,
            priority: true,
            status: true,
          },
        },
      },
    });

    if (!member || member.teamId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error fetching team member:", error);
    return NextResponse.json(
      { error: "Failed to fetch team member" },
      { status: 500 }
    );
  }
}

// PUT update a team member
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id, memberId } = await params;

    // Check if team exists and user owns it
    const team = await prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (team.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!existingMember || existingMember.teamId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, role, capacity } = body;

    // Validation
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Member name cannot be empty" },
          { status: 400 }
        );
      }

      // Check if new name conflicts with another member
      if (name.trim() !== existingMember.name) {
        const nameConflict = await prisma.teamMember.findUnique({
          where: {
            teamId_name: {
              teamId: id,
              name: name.trim(),
            },
          },
        });

        if (nameConflict) {
          return NextResponse.json(
            { error: "A member with this name already exists in this team" },
            { status: 400 }
          );
        }
      }

      updateData.name = name.trim();
    }

    if (role !== undefined) {
      if (typeof role !== "string" || role.trim().length === 0) {
        return NextResponse.json(
          { error: "Member role cannot be empty" },
          { status: 400 }
        );
      }
      updateData.role = role.trim();
    }

    if (capacity !== undefined) {
      if (typeof capacity !== "number" || capacity < 0 || capacity > 5) {
        return NextResponse.json(
          { error: "Capacity must be a number between 0 and 5" },
          { status: 400 }
        );
      }
      updateData.capacity = capacity;
    }

    const member = await prisma.teamMember.update({
      where: { id: memberId },
      data: updateData,
      include: {
        _count: {
          select: { tasks: true },
        },
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error("Error updating team member:", error);
    return NextResponse.json(
      { error: "Failed to update team member" },
      { status: 500 }
    );
  }
}

// DELETE a team member
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id, memberId } = await params;

    // Check if team exists and user owns it
    const team = await prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (team.ownerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!existingMember || existingMember.teamId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ message: "Member deleted successfully" });
  } catch (error) {
    console.error("Error deleting team member:", error);
    return NextResponse.json(
      { error: "Failed to delete team member" },
      { status: 500 }
    );
  }
}
