"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Role } from "@prisma/client";
import { createUser, importEmployees, resetUserPassword, updateUser } from "@/actions/users";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/constants";

type Person = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

export function PeopleManager({ people }: { people: Person[] }) {
  return (
    <div className="grid gap-6">
      <Card className="p-6">
        <h2 className="mb-1 font-display text-xl">Add from Excel</h2>
        <p className="mb-4 text-sm text-muted">
          Upload an .xlsx file with Name, Email, and optional Role. New people get the default password
          Digitix@123. Existing emails are updated.
        </p>
        <ImportEmployeesForm />
      </Card>
      <Card className="p-6">
        <h2 className="mb-4 font-display text-xl">Add person</h2>
        <AddPersonForm />
      </Card>
      <div className="grid gap-4">
        {people.map((person) => (
          <PersonRow key={person.id} person={person} />
        ))}
      </div>
    </div>
  );
}

function RoleOptions() {
  return (
    <>
      {(Object.entries(ROLE_LABEL) as [Role, string][]).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </>
  );
}

function ImportEmployeesForm() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await importEmployees(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "People imported.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-3">
      <Field label="Excel file" className="min-w-[220px] flex-1">
        <Input name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
      </Field>
      <a
        href="/api/employees/template"
        className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm hover:bg-black/5 dark:hover:bg-white/5"
      >
        Download template
      </a>
      <Button type="submit" disabled={pending}>
        {pending ? "Importing..." : "Import"}
      </Button>
    </form>
  );
}

function AddPersonForm() {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSubmit(formData: FormData) {
    start(async () => {
      const result = await createUser(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Person added. Default password is Digitix@123 unless you set one.");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="grid gap-4 md:grid-cols-2">
      <Field label="Name">
        <Input name="name" required autoComplete="off" />
      </Field>
      <Field label="Email">
        <Input name="email" type="email" required autoComplete="off" />
      </Field>
      <Field label="Role">
        <Select name="role" defaultValue="EMPLOYEE">
          <RoleOptions />
        </Select>
      </Field>
      <Field label="Temporary password">
        <Input
          name="password"
          type="password"
          minLength={8}
          placeholder="Leave blank for Digitix@123"
          autoComplete="new-password"
        />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add"}
        </Button>
      </div>
    </form>
  );
}

function PersonRow({ person }: { person: Person }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onSave(formData: FormData) {
    start(async () => {
      const result = await updateUser(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved.");
      router.refresh();
    });
  }

  function onReset() {
    start(async () => {
      const result = await resetUserPassword(person.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Password reset to ${result.password}.`);
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <form action={onSave} className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <input type="hidden" name="userId" value={person.id} />
        <Field label="Name">
          <Input name="name" defaultValue={person.name} required autoComplete="off" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={person.email} required autoComplete="off" />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue={person.role}>
            <RoleOptions />
          </Select>
        </Field>
        <Field label="Status">
          <Select name="active" defaultValue={person.active ? "true" : "false"}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </Field>
        <Field label="New password">
          <Input
            name="password"
            type="password"
            placeholder="Optional"
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onReset}>
            Reset password
          </Button>
        </div>
      </form>
    </Card>
  );
}
