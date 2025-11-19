Task Title: Smart Task Manager
Build a simple web app to manage projects, teams, and tasks.
Users can assign tasks to team members, track workload capacity, and balance tasks using a “Reassign Tasks” button.

1. User & Team Setup
   Users can register and log in.
   Each user can create teams and add members manually (no email needed).
   Each team member has:
   Name
   Role
   Capacity (0–5 tasks they can handle comfortably)
2. Project & Task Management
   Users can:
   Create projects and link them to a specific team.
   Add tasks under a project.
   Each task includes:
   Title
   Description
   Assigned Member (from project’s team or “Unassigned”)
   Priority: Low / Medium / High
   Status: Pending / In Progress / Done
   Users can Add, Edit, Delete, and Filter tasks by Project or Member.
3. Task Assignment Flow
   When creating a task:
   Select the Project (and team auto-links).
   Choose an Assigned Member from the team (dropdown).
   Show each member’s (currentTasks / capacity) beside their name.
   If a member is already over capacity, show a warning, e.g.:
   Riya has 4 tasks but capacity is 3. Assign anyway?
   Options: [Assign Anyway] or [Choose Another]
   Optionally click “Auto-assign” to pick the member with the least load.
4. Auto Reassignment
   When user clicks “Reassign Tasks”:
   Check if any member has more tasks than their capacity.
   Move extra tasks to members with free capacity.
   Rules:
   Keep High Priority tasks with current assignee.
   Only move Low and Medium priority tasks.
   Update assigned members automatically.
   Record all changes in the Activity Log.
5. Dashboard
   Show:
   Total Projects
   Total Tasks
   Team Summary: Each member’s current tasks vs. capacity (mark red if overloaded)
   “Reassign Tasks” button
   Recent Reassignments: Last 5 moved tasks
6. Activity Log
   Record each reassignment, e.g.:
   10:30 AM — Task “UI Design” reassigned from Riya to Farhan.
   Show the latest 5–10 logs on the dashboard (newest first).
