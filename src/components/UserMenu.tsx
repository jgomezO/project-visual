"use client";

import { useTransition } from "react";
import { Button, Dropdown, Label } from "@heroui/react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

interface Props {
  email: string;
  displayName: string;
}

// Avatar-style trigger + dropdown with the current user's identity and
// a logout action. Mounted in every primary header (editor, projects
// list, project detail, narratives list). The /preview view stays
// chrome-free and doesn't get this.
//
// onAction routes to logoutAction via useTransition so the menu can
// surface "Cerrando sesión…" while the round-trip + redirect happen.
// Same pattern used elsewhere in the app for menu-driven actions
// (StructureSidebar, ActiveFormPanel).
export function UserMenu({ email, displayName }: Props) {
  const [isPending, startTransition] = useTransition();
  const initial = (displayName || email).slice(0, 1).toUpperCase();

  return (
    <Dropdown>
      <Button
        isIconOnly
        size="sm"
        aria-label={`Menú de usuario (${email})`}
        isDisabled={isPending}
        className="size-9 rounded-full bg-default-200 text-sm font-semibold text-foreground hover:bg-default-300"
      >
        {initial}
      </Button>
      <Dropdown.Popover className="min-w-[16rem]">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === "logout") {
              startTransition(async () => {
                await logoutAction();
              });
            }
          }}
        >
          <Dropdown.Item id="info" textValue={email} isDisabled>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {displayName}
              </span>
              <span className="text-xs text-muted">{email}</span>
            </div>
          </Dropdown.Item>
          <Dropdown.Item id="logout" textValue="Cerrar sesión" variant="danger">
            <LogOut className="size-4" aria-hidden="true" />
            <Label>{isPending ? "Cerrando sesión…" : "Cerrar sesión"}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
