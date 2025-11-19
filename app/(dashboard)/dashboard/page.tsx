"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  CheckSquare,
  Clock,
  Folder,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

interface DashboardStats {
  totalTeams: number;
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
}

interface Task {
  id: string;
  status: string;
}

interface TeamMember {
  id: string;
  name: string;
  capacity: number;
  _count: {
    tasks: number;
  };
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

interface ActivityLog {
  id: string;
  action: string;
  createdAt: string;
  task: {
    title: string;
  };
}

export default function Page() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTeams: 0,
    totalProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [reassigning, setReassigning] = useState(false);
  const [reassignmentMessage, setReassignmentMessage] = useState<string>("");

  useEffect(() => {
    fetchStats();
    fetchTeams();
    fetchActivityLogs();
  }, []);

  const fetchStats = async () => {
    try {
      const [teamsRes, projectsRes, tasksRes] = await Promise.all([
        fetch("/api/teams"),
        fetch("/api/projects"),
        fetch("/api/tasks"),
      ]);

      if (teamsRes.ok && projectsRes.ok && tasksRes.ok) {
        const teams = await teamsRes.json();
        const projects = await projectsRes.json();
        const tasks = await tasksRes.json();

        setStats({
          totalTeams: teams.length,
          totalProjects: projects.length,
          totalTasks: tasks.length,
          completedTasks: tasks.filter((t: Task) => t.status === "DONE").length,
        });
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const teamsData = await res.json();

        // Fetch members for each team
        const teamsWithMembers = await Promise.all(
          teamsData.map(async (team: { id: string }) => {
            const membersRes = await fetch(`/api/teams/${team.id}/members`);
            if (membersRes.ok) {
              const members = await membersRes.json();
              return { ...team, members };
            }
            return { ...team, members: [] };
          })
        );

        setTeams(teamsWithMembers);
      }
    } catch (err) {
      console.error("Error fetching teams:", err);
    }
  };

  const fetchActivityLogs = async () => {
    try {
      const res = await fetch("/api/activity-logs");
      if (res.ok) {
        const logs = await res.json();
        setActivityLogs(logs.slice(0, 10)); // Get latest 10
      }
    } catch (err) {
      console.error("Error fetching activity logs:", err);
    }
  };

  const handleReassignTasks = async () => {
    setReassigning(true);
    setReassignmentMessage("");

    try {
      const res = await fetch("/api/tasks/reassign", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setReassignmentMessage(data.message);

        // Refresh data
        await Promise.all([fetchStats(), fetchTeams(), fetchActivityLogs()]);
      } else {
        const error = await res.json();
        setReassignmentMessage(`Error: ${error.error}`);
      }
    } catch (err) {
      console.error("Error reassigning tasks:", err);
      setReassignmentMessage("Failed to reassign tasks");
    } finally {
      setReassigning(false);
    }
  };

  const getOverloadedCount = () => {
    return teams.reduce((count, team) => {
      const overloaded = team.members.filter(
        (member) => (member._count?.tasks || 0) > member.capacity
      );
      return count + overloaded.length;
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-auto p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold md:text-4xl">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to your task management system
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTeams}</div>
            <p className="text-xs text-muted-foreground">Manage your teams</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Projects
            </CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground">Active projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">All tasks created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckSquare className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalTasks > 0
                ? `${Math.round(
                    (stats.completedTasks / stats.totalTasks) * 100
                  )}% completion rate`
                : "No tasks yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Get started with common tasks</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Button
            variant="outline"
            className="h-auto flex-col items-start p-4"
            onClick={() => (window.location.href = "/dashboard/teams")}
          >
            <Users className="h-8 w-8 mb-2" />
            <div className="text-left">
              <div className="font-semibold">Manage Teams</div>
              <div className="text-xs text-muted-foreground mt-1">
                Create and manage your teams
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col items-start p-4"
            onClick={() => (window.location.href = "/dashboard/projects")}
          >
            <Folder className="h-8 w-8 mb-2" />
            <div className="text-left">
              <div className="font-semibold">View Projects</div>
              <div className="text-xs text-muted-foreground mt-1">
                Browse and create projects
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col items-start p-4"
            onClick={() => (window.location.href = "/dashboard/projects")}
          >
            <Plus className="h-8 w-8 mb-2" />
            <div className="text-left">
              <div className="font-semibold">Create Task</div>
              <div className="text-xs text-muted-foreground mt-1">
                Add a new task to a project
              </div>
            </div>
          </Button>
        </CardContent>
      </Card>

      {/* Auto Reassignment Section */}
      {teams.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Task Reassignment</CardTitle>
                <CardDescription>
                  Automatically balance workload across team members
                </CardDescription>
              </div>
              <Button
                onClick={handleReassignTasks}
                disabled={reassigning}
                className="gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${reassigning ? "animate-spin" : ""}`}
                />
                {reassigning ? "Reassigning..." : "Reassign Tasks"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {reassignmentMessage && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{reassignmentMessage}</AlertDescription>
              </Alert>
            )}
            {getOverloadedCount() > 0 && (
              <Alert className="mb-4 border-orange-500 bg-orange-50">
                <AlertCircle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-900">
                  {getOverloadedCount()} team member(s) are over capacity. Click
                  &quot;Reassign Tasks&quot; to balance the workload.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Team Workload Summary */}
      {teams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Team Workload Summary</CardTitle>
            <CardDescription>
              Current task distribution across all teams
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teams.map((team) => (
                <div key={team.id} className="space-y-2">
                  <h4 className="font-semibold text-sm">{team.name}</h4>
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {team.members.map((member) => {
                      const currentTasks = member._count?.tasks || 0;
                      const isOverloaded = currentTasks > member.capacity;

                      return (
                        <div
                          key={member.id}
                          className={`p-3 rounded-lg border ${
                            isOverloaded
                              ? "border-red-500 bg-red-50"
                              : currentTasks === member.capacity
                              ? "border-yellow-500 bg-yellow-50"
                              : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {member.name}
                            </span>
                            <Badge
                              variant={
                                isOverloaded ? "destructive" : "secondary"
                              }
                            >
                              {currentTasks}/{member.capacity}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity Log */}
      {activityLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Reassignments</CardTitle>
            <CardDescription>Last 10 task reassignments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 pb-3 border-b last:border-0"
                >
                  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{log.task.title}</span> —{" "}
                      {log.action}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Getting Started */}
      {stats.totalTeams === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold mb-2">Get Started</h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              Welcome! Start by creating your first team, then add members,
              create projects, and assign tasks.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => (window.location.href = "/dashboard/teams")}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Team
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
