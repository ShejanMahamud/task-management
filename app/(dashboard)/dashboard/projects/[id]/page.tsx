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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Edit,
  Filter,
  Plus,
  Trash2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface TeamMember {
  id: string;
  name: string;
  capacity: number;
  _count: {
    tasks: number;
  };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "PENDING" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  assignedTo: TeamMember | null;
  assignedToId: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  team: {
    id: string;
    name: string;
    members: TeamMember[];
  };
  tasks: Task[];
}

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [warningDialog, setWarningDialog] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [pendingFormData, setPendingFormData] = useState<{
    title: string;
    description: string;
    priority: string;
    dueDate: string;
    assignedToId: string;
    autoAssign: boolean;
    forceAssign?: boolean;
  } | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [memberFilter, setMemberFilter] = useState<string>("ALL");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assignedToId: "",
    priority: "MEDIUM",
    status: "PENDING",
    dueDate: "",
    autoAssign: false,
  });
  const [error, setError] = useState("");

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        setFilteredTasks(data.tasks);
      } else {
        router.push("/dashboard/projects");
      }
    } catch (error) {
      console.error("Error fetching project:", error);
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  const applyFilters = useCallback(() => {
    if (!project) return;

    let filtered = project.tasks;

    if (statusFilter !== "ALL") {
      filtered = filtered.filter((task) => task.status === statusFilter);
    }

    if (priorityFilter !== "ALL") {
      filtered = filtered.filter((task) => task.priority === priorityFilter);
    }

    if (memberFilter !== "ALL") {
      filtered = filtered.filter(
        (task) => task.assignedTo?.id === memberFilter
      );
    }

    setFilteredTasks(filtered);
  }, [project, statusFilter, priorityFilter, memberFilter]);

  useEffect(() => {
    if (params.id) {
      fetchProject();
    }
  }, [params.id, fetchProject]);

  useEffect(() => {
    if (project) {
      applyFilters();
    }
  }, [project, statusFilter, priorityFilter, memberFilter, applyFilters]);

  const handleOpenDialog = (task?: Task) => {
    if (task) {
      setEditTask(task);
      setFormData({
        title: task.title,
        description: task.description || "",
        assignedToId: task.assignedToId || "",
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
        autoAssign: false,
      });
    } else {
      setEditTask(null);
      setFormData({
        title: "",
        description: "",
        assignedToId: "",
        priority: "MEDIUM",
        status: "PENDING",
        dueDate: "",
        autoAssign: false,
      });
    }
    setError("");
    setDialogOpen(true);
  };

  const handleSubmit = async (forceAssign = false) => {
    if (!formData.title.trim()) {
      setError("Task title is required");
      return;
    }

    try {
      const url = editTask ? `/api/tasks/${editTask.id}` : "/api/tasks";
      const method = editTask ? "PUT" : "POST";

      const body: Record<string, unknown> = {
        ...formData,
        projectId: params.id,
        forceAssign,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 409 && data.warning) {
        // Capacity warning
        setWarningMessage(data.message);
        setPendingFormData({
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          dueDate: formData.dueDate,
          assignedToId: formData.assignedToId,
          autoAssign: formData.autoAssign,
          forceAssign: true,
        });
        setWarningDialog(true);
        return;
      }

      if (res.ok) {
        setDialogOpen(false);
        setError("");
        fetchProject();
      } else {
        setError(data.error || "Failed to save task");
      }
    } catch (error) {
      console.error("Error saving task:", error);
      setError("Failed to save task");
    }
  };

  const handleForceAssign = async () => {
    setWarningDialog(false);
    if (pendingFormData) {
      await handleSubmit(true);
      setPendingFormData(null);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchProject();
      }
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "destructive";
      case "MEDIUM":
        return "default";
      case "LOW":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "DONE":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "IN_PROGRESS":
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-auto p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/projects")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold md:text-3xl">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.team.name} · {project.tasks.length} tasks
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Status: {statusFilter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <DropdownMenuRadioItem value="ALL">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="PENDING">
                Pending
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="IN_PROGRESS">
                In Progress
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="DONE">Done</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Priority: {priorityFilter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={priorityFilter}
              onValueChange={setPriorityFilter}
            >
              <DropdownMenuRadioItem value="ALL">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="HIGH">High</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="MEDIUM">
                Medium
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="LOW">Low</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Member:{" "}
              {memberFilter === "ALL"
                ? "All"
                : memberFilter === "UNASSIGNED"
                ? "Unassigned"
                : project.team.members.find((m) => m.id === memberFilter)?.name}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Filter by Member</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={memberFilter}
              onValueChange={setMemberFilter}
            >
              <DropdownMenuRadioItem value="ALL">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="UNASSIGNED">
                Unassigned
              </DropdownMenuRadioItem>
              {project.team.members.map((member) => (
                <DropdownMenuRadioItem key={member.id} value={member.id}>
                  {member.name} ({member._count.tasks}/{member.capacity})
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Tasks Grid */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {project.tasks.length === 0
                ? "Create your first task to get started"
                : "Try adjusting your filters"}
            </p>
            {project.tasks.length === 0 && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <Card key={task.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 flex items-start gap-2">
                    {getStatusIcon(task.status)}
                    <div className="flex-1">
                      <CardTitle className="text-lg">{task.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {task.assignedTo?.name || "Unassigned"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(task)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {task.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {task.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                  <Badge variant="outline">
                    {task.status.replace("_", " ")}
                  </Badge>
                  {task.dueDate && (
                    <Badge variant="secondary">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editTask ? "Edit Task" : "Create New Task"}
            </DialogTitle>
            <DialogDescription>
              {editTask
                ? "Update task information"
                : "Add a new task to this project"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Task title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Task description..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignee">Assign To</Label>
              <Select
                value={formData.assignedToId}
                onValueChange={(value) =>
                  setFormData({ ...formData, assignedToId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {project.team.members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member._count.tasks}/{member.capacity})
                      {member._count.tasks >= member.capacity && " ⚠️"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (Optional)</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSubmit(false)}>
              {editTask ? "Update" : "Create"} Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Capacity Warning Dialog */}
      <Dialog open={warningDialog} onOpenChange={setWarningDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Capacity Warning</DialogTitle>
            <DialogDescription>{warningMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarningDialog(false)}>
              Choose Another
            </Button>
            <Button onClick={handleForceAssign}>Assign Anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
