"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { createTask } from "@/actions/tasks";
import { Button, Field, Input, Select } from "@/components/ui";

export function TeamAssignForm({
  employees,
  projects,
}: {
  employees: { id: string; name: string }[];
  projects: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    const projectId = String(formData.get("projectId") ?? "");
    if (!projectId) {
      toast.error("Select a project.");
      return;
    }
    start(async () => {
      const result = await createTask(projectId, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Task assigned.");
      router.refresh();
    });
  }

  if (employees.length === 0 || projects.length === 0) {
    return (
      <p className="text-sm text-muted">
        Assign people to a project first, then you can give them a task from here.
      </p>
    );
  }

  return (
    <form action={onSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Field label="Project">
        <Select name="projectId" required defaultValue={projects[0]?.id}>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.code} · {project.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Employee">
        <Select name="assignedEmployeeId" required defaultValue={employees[0]?.id}>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Task name">
        <Input name="name" required placeholder="QA pass, live fixes…" />
      </Field>
      <Field label="Due date">
        <Input name="dueDate" type="date" />
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Assigning..." : "Assign task"}
        </Button>
      </div>
    </form>
  );
}
