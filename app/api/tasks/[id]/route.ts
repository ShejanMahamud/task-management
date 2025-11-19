import { prisma } from "@/lib/prisma";
import { validateTaskAssignment } from "@/lib/team-utils";
import { auth } from "@clerk/nextjs/server";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";

// GET a specific task
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            team: {
              include: {
                members: true,
              },
            },
          },
        },
        assignedTo: true,
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Check if user owns this task's project
    if (task.project.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// PUT update a task
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const body = await req.json();
    const {
      title,
      description,
      assignedToId,
      priority,
      status,
      dueDate,
      forceAssign,
    } = body;

    // Verify task exists and user owns it
    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
        assignedTo: true,
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (existingTask.project.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || title.trim().length === 0) {
        return NextResponse.json(
          { error: "Task title cannot be empty" },
          { status: 400 }
        );
      }
      updateData.title = title.trim();
    }

    if (description !== undefined) {
      updateData.description = description?.trim() || null;
    }

    if (priority !== undefined) {
      if (!["LOW", "MEDIUM", "HIGH"].includes(priority)) {
        return NextResponse.json(
          { error: "Invalid priority value" },
          { status: 400 }
        );
      }
      updateData.priority = priority as TaskPriority;
    }

    if (status !== undefined) {
      if (!["PENDING", "IN_PROGRESS", "DONE"].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status value" },
          { status: 400 }
        );
      }
      updateData.status = status as TaskStatus;
    }

    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }

    // Handle assignment change
    if (assignedToId !== undefined) {
      if (assignedToId === null || assignedToId === "") {
        updateData.assignedToId = null;
      } else {
        // Validate new assignment
        if (!forceAssign) {
          const validation = await validateTaskAssignment(assignedToId);

          if (!validation.valid && validation.warning) {
            return NextResponse.json(
              {
                warning: true,
                message: validation.message,
                currentLoad: validation.currentLoad,
                capacity: validation.capacity,
              },
              { status: 409 }
            );
          }

          if (!validation.valid && !validation.warning) {
            return NextResponse.json(
              { error: validation.error },
              { status: 400 }
            );
          }
        }

        updateData.assignedToId = assignedToId;
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          include: {
            team: true,
          },
        },
        assignedTo: true,
      },
    });

    // Log activity if assignment changed
    if (
      assignedToId !== undefined &&
      existingTask.assignedToId !== assignedToId
    ) {
      const oldAssignee = existingTask.assignedTo?.name || "Unassigned";
      const newAssignee = task.assignedTo?.name || "Unassigned";

      await prisma.activityLog.create({
        data: {
          action: "Task reassigned",
          description: `Task "${task.title}" reassigned from ${oldAssignee} to ${newAssignee}`,
          taskId: task.id,
          userId: user.id,
          metadata: {
            oldAssignedToId: existingTask.assignedToId,
            newAssignedToId: assignedToId,
          },
        },
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// DELETE a task
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;

    // Verify task exists and user owns it
    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (existingTask.project.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
