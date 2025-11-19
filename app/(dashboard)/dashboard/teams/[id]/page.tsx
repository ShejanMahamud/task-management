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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Edit, Plus, Trash2, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  capacity: number;
  _count: {
    tasks: number;
  };
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
  projects: Array<{ id: string; name: string }>;
}

export default function TeamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    capacity: 3,
  });
  const [error, setError] = useState("");

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      } else {
        router.push("/dashboard/teams");
      }
    } catch (error) {
      console.error("Error fetching team:", error);
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    if (params.id) {
      fetchTeam();
    }
  }, [params.id, fetchTeam]);

  const handleOpenDialog = (member?: TeamMember) => {
    if (member) {
      setEditMember(member);
      setFormData({
        name: member.name,
        role: member.role,
        capacity: member.capacity,
      });
    } else {
      setEditMember(null);
      setFormData({ name: "", role: "", capacity: 3 });
    }
    setError("");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.role.trim()) {
      setError("Name and role are required");
      return;
    }

    try {
      const url = editMember
        ? `/api/teams/${params.id}/members/${editMember.id}`
        : `/api/teams/${params.id}/members`;

      const res = await fetch(url, {
        method: editMember ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setDialogOpen(false);
        setError("");
        fetchTeam();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save member");
      }
    } catch (error) {
      console.error("Error saving member:", error);
      setError("Failed to save member");
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to delete this member?")) return;

    try {
      const res = await fetch(`/api/teams/${params.id}/members/${memberId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchTeam();
      }
    } catch (error) {
      console.error("Error deleting member:", error);
      alert("Failed to delete member");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Loading team...</p>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-auto p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/teams")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold md:text-3xl">{team.name}</h1>
          <p className="text-sm text-muted-foreground">
            {team.members.length} members · {team.projects.length} projects
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editMember ? "Edit Member" : "Add New Member"}
              </DialogTitle>
              <DialogDescription>
                {editMember
                  ? "Update member information"
                  : "Add a new member to your team"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  placeholder="Developer"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (0-5 tasks)</Label>
                <Select
                  value={formData.capacity.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, capacity: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num === 1 ? "task" : "tasks"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Button onClick={handleSubmit}>
                {editMember ? "Update" : "Add"} Member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {team.members.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No members yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add team members to start assigning tasks
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {team.members.map((member) => (
            <Card key={member.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{member.name}</CardTitle>
                    <CardDescription>{member.role}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(member)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteMember(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Capacity:
                    </span>
                    <Badge variant="secondary">{member.capacity} tasks</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Current Load:
                    </span>
                    <Badge
                      variant={
                        member._count.tasks > member.capacity
                          ? "destructive"
                          : member._count.tasks === member.capacity
                          ? "default"
                          : "secondary"
                      }
                    >
                      {member._count.tasks}/{member.capacity}
                    </Badge>
                  </div>
                  {member._count.tasks > member.capacity && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription className="text-xs">
                        Over capacity!
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
