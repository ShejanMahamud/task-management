import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all teams and their members with task counts
    const teams = await prisma.team.findMany({
      include: {
        members: {
          include: {
            tasks: {
              where: {
                status: {
                  not: "DONE",
                },
              },
            },
          },
        },
      },
    });

    const reassignments: Array<{
      taskId: string;
      taskTitle: string;
      fromMember: string;
      toMember: string;
      teamName: string;
    }> = [];

    // Process each team
    for (const team of teams) {
      // Find overloaded members (currentTasks > capacity)
      const overloadedMembers = team.members.filter(
        (member) => member.tasks.length > member.capacity
      );

      if (overloadedMembers.length === 0) continue;

      // For each overloaded member, try to reassign their low/medium priority tasks
      for (const overloadedMember of overloadedMembers) {
        const tasksToMove = overloadedMember.tasks
          .filter((task) => task.priority !== "HIGH") // Only move LOW and MEDIUM
          .sort((a, b) => {
            // Move LOW priority first, then MEDIUM
            const priorityOrder: Record<string, number> = {
              LOW: 0,
              MEDIUM: 1,
              HIGH: 2,
            };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          });

        const excessCount =
          overloadedMember.tasks.length - overloadedMember.capacity;
        const tasksToReassign = tasksToMove.slice(0, excessCount);

        // Find available members (under capacity)
        const availableMembers = team.members
          .filter(
            (member) =>
              member.id !== overloadedMember.id &&
              member.tasks.length < member.capacity
          )
          .sort(
            (a, b) => a.tasks.length - b.tasks.length // Least loaded first
          );

        // Reassign tasks
        for (const task of tasksToReassign) {
          // Find the member with the most available capacity
          const targetMember = availableMembers.find(
            (member) => member.tasks.length < member.capacity
          );

          if (!targetMember) break; // No more available members

          // Update the task
          await prisma.task.update({
            where: { id: task.id },
            data: { assignedToId: targetMember.id },
          });

          // Log the reassignment
          await prisma.activityLog.create({
            data: {
              taskId: task.id,
              action: `Reassigned from ${overloadedMember.name} to ${targetMember.name}`,
              description: `Task "${task.title}" reassigned from ${overloadedMember.name} to ${targetMember.name}`,
              userId: userId,
            },
          });

          reassignments.push({
            taskId: task.id,
            taskTitle: task.title,
            fromMember: overloadedMember.name,
            toMember: targetMember.name,
            teamName: team.name,
          });

          // Update the target member's task count in our local array
          targetMember.tasks.push(task);
        }
      }
    }

    return NextResponse.json({
      message: `Successfully reassigned ${reassignments.length} task(s)`,
      reassignments,
    });
  } catch (error) {
    console.error("Error reassigning tasks:", error);
    return NextResponse.json(
      { error: "Failed to reassign tasks" },
      { status: 500 }
    );
  }
}
