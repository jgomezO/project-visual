import { CheckCircle2, Circle, Loader } from "lucide-react";
import { Chip } from "@/components/ui";
import type { ChipProps } from "@/components/ui";

type Category = "To Do" | "In Progress" | "Done";

const VARIANT_BY_CATEGORY: Record<Category, ChipProps["variant"]> = {
  "To Do": "status-todo",
  "In Progress": "status-progress",
  Done: "status-done",
};

const ICON_BY_CATEGORY: Record<Category, typeof Circle> = {
  "To Do": Circle,
  "In Progress": Loader,
  Done: CheckCircle2,
};

export function StatusChip({
  category,
  statusName,
}: {
  category: Category;
  statusName?: string | null;
}) {
  const Icon = ICON_BY_CATEGORY[category];
  const tooltip = statusName && statusName !== category ? statusName : category;
  return (
    <Chip variant={VARIANT_BY_CATEGORY[category]} title={tooltip}>
      <Icon className="size-3" aria-hidden="true" />
      {category}
    </Chip>
  );
}
