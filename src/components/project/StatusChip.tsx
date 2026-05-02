import { CheckCircle2, Circle, Loader } from "lucide-react";

type Category = "To Do" | "In Progress" | "Done";

const STYLES: Record<
  Category,
  { bg: string; text: string; Icon: typeof Circle }
> = {
  "To Do": { bg: "bg-zinc-200", text: "text-zinc-700", Icon: Circle },
  "In Progress": { bg: "bg-blue-100", text: "text-blue-700", Icon: Loader },
  Done: { bg: "bg-emerald-100", text: "text-emerald-700", Icon: CheckCircle2 },
};

export function StatusChip({
  category,
  statusName,
}: {
  category: Category;
  statusName?: string | null;
}) {
  const { bg, text, Icon } = STYLES[category];
  const tooltip = statusName && statusName !== category ? statusName : category;
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${text}`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {category}
    </span>
  );
}
