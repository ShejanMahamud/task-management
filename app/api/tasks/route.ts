import { prisma } from "@/lib/prisma";
import {
  findBestMemberForTask,
  validateTaskAssignment,
} from "@/lib/team-utils";
import { auth } from "@clerk/nextjs/server";
import { TaskPriority, TaskStatus } from "@prisma/client";
import { NextResponse } from "next/server";

// GET all tasks with filtering
export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const memberId = searchParams.get("memberId");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");

    // Build filter query
    const whereClause: Record<string, unknown> = {
      project: {
        userId: user.id,
      },
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    if (memberId) {
      whereClause.assignedToId = memberId === "unassigned" ? null : memberId;
    }

    if (status && ["PENDING", "IN_PROGRESS", "DONE"].includes(status)) {
      whereClause.status = status as TaskStatus;
    }

    if (priority && ["LOW", "MEDIUM", "HIGH"].includes(priority)) {
      whereClause.priority = priority as TaskPriority;
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        project: {
          include: {
            team: true,
          },
        },
        assignedTo: true,
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

// POST create a new task
export async function POST(req: Request) {
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

    const body = await req.json();
    const {
      title,
      description,
      projectId,
      assignedToId,
      priority,
      status,
      dueDate,
      autoAssign,
      forceAssign,
    } = body;

    // Validation
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Task title is required" },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Verify project exists and user owns it
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { team: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.userId !== user.id) {
      return NextResponse.json(
        { error: "You don't have permission to add tasks to this project" },
        { status: 403 }
      );
    }

    // Handle auto-assignment
    let finalAssignedToId = assignedToId;

    if (autoAssign && !assignedToId) {
      const bestMember = await findBestMemberForTask(project.teamId);
      if (bestMember) {
        finalAssignedToId = bestMember.id;
      }
    }

    // Validate assignment if member is selected
    if (finalAssignedToId && !forceAssign) {
      const validation = await validateTaskAssignment(finalAssignedToId);

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
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        projectId,
        assignedToId: finalAssignedToId || null,
        priority: priority || "MEDIUM",
        status: status || "PENDING",
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: {
        project: {
          include: {
            team: true,
          },
        },
        assignedTo: true,
      },
    });

    // Log activity if task was assigned
    if (finalAssignedToId) {
      await prisma.activityLog.create({
        data: {
          action: "Task assigned",
          description: `Task "${task.title}" assigned to ${task.assignedTo?.name}`,
          taskId: task.id,
          userId: user.id,
          metadata: {
            assignedToId: finalAssignedToId,
            autoAssigned: autoAssign,
          },
        },
      });
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}
