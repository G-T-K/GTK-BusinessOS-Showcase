"use client";

import type { ChangeEvent } from "react";

type UserRoleSelectProps = {
  role: string;
  roles: readonly string[];
};

export function UserRoleSelect({ role, roles }: UserRoleSelectProps) {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    event.currentTarget.form?.requestSubmit();
  };

  return (
    <select
      name="role"
      defaultValue={role}
      onChange={handleChange}
      className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
    >
      {roles.filter((r) => r !== "OWNER").map((r) => (
        <option key={r} value={r}>
          {r.replace("_", " ")}
        </option>
      ))}
    </select>
  );
}
