import { prisma } from "./prisma";

/**
 * Get user by Clerk ID
 */
export async function getUserByClerkId(clerkId: string) {
  return await prisma.user.findUnique({
    where: { clerkId },
  });
}

/**
 * Check if user owns a team
 */
export async function verifyTeamOwnership(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  });

  if (!team) {
    return { valid: false, error: "Team not found" };
  }

  if (team.ownerId !== userId) {
    return { valid: false, error: "Forbidden" };
  }

  return { valid: true, team };
}

/**
 * Get team with members and their workload
 */
export async function getTeamWithWorkload(teamId: string) {
  return await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          _count: {
            select: { tasks: true },
          },
          tasks: {
            where: {
              status: { not: "DONE" },
            },
            select: {
              id: true,
              title: true,
              priority: true,
              status: true,
            },
          },
        },
      },
      projects: {
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      },
    },
  });
}

/**
 * Get member's current task count (excluding completed tasks)
 */
export async function getMemberActiveTaskCount(memberId: string) {
  return await prisma.task.count({
    where: {
      assignedToId: memberId,
      status: { not: "DONE" },
    },
  });
}

/**
 * Check if member is over capacity
 */
export async function isMemberOverCapacity(memberId: string) {
  const member = await prisma.teamMember.findUnique({
    where: { id: memberId },
    include: {
      _count: {
        select: {
          tasks: {
            where: {
              status: { not: "DONE" },
            },
          },
        },
      },
    },
  });

  if (!member) return { overCapacity: false, currentLoad: 0, capacity: 0 };

  const currentLoad = member._count.tasks;
  return {
    overCapacity: currentLoad >= member.capacity,
    currentLoad,
    capacity: member.capacity,
    member,
  };
}

/**
 * Get all members with available capacity in a team
 */
export async function getMembersWithCapacity(teamId: string) {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: {
      _count: {
        select: {
          tasks: {
            where: {
              status: { not: "DONE" },
            },
          },
        },
      },
    },
  });

  return members
    .filter((member) => member._count.tasks < member.capacity)
    .sort((a, b) => a._count.tasks - b._count.tasks); // Sort by least loaded first
}

/**
 * Find best member for task assignment (auto-assign logic)
 */
export async function findBestMemberForTask(teamId: string) {
  const membersWithCapacity = await getMembersWithCapacity(teamId);

  if (membersWithCapacity.length === 0) {
    return null;
  }

  // Return the member with the least current load
  return membersWithCapacity[0];
}

/**
 * Validate capacity before assignment
 */
export async function validateTaskAssignment(
  memberId: string,
  force: boolean = false
) {
  const { overCapacity, currentLoad, capacity, member } =
    await isMemberOverCapacity(memberId);

  if (!member) {
    return {
      valid: false,
      error: "Member not found",
    };
  }

  if (overCapacity && !force) {
    return {
      valid: false,
      warning: true,
      message: `${member.name} has ${currentLoad} tasks but capacity is ${capacity}. Assign anyway?`,
      currentLoad,
      capacity,
    };
  }

  return {
    valid: true,
    member,
    currentLoad,
    capacity,
  };
}
