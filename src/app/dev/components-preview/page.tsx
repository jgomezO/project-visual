// DEV ONLY — components preview / visual regression bench.
// Not linked from production. Reach it by typing the URL directly.
// Add new sections here when validating new component variants.

import {
  BookmarkPlus,
  BookOpen,
  Bug,
  CheckSquare,
  Circle,
  CornerDownRight,
  Crown,
  FileText,
  Flag,
  Target,
  Zap,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { StatusChip } from "@/components/project/StatusChip";

export const dynamic = "force-static";

type StatusCategory = "To Do" | "In Progress" | "Done";

interface DemoChipProps {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClass: string;
  typeLabel: string;
  issueKey: string;
  summary: string;
  status: StatusCategory;
}

// Mirrors the layout the production IssueChip will land on in commit 2.
// Kept inline (not exported) so this page is self-contained — easy to
// duplicate-and-tweak when validating future variants.
function DemoChip({
  Icon,
  iconClass,
  typeLabel,
  issueKey,
  summary,
  status,
}: DemoChipProps) {
  return (
    <li className="flex items-start gap-2.5 rounded-md border border-default-200 bg-default-50/60 px-3 py-2 text-sm">
      <span
        title={typeLabel}
        aria-label={typeLabel}
        className={`inline-flex shrink-0 items-center ${iconClass}`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="font-mono text-xs text-muted">{issueKey}</span>
      <span className="flex-1 min-w-0 truncate text-foreground">{summary}</span>
      <StatusChip category={status} />
    </li>
  );
}

interface ChipRow extends Omit<DemoChipProps, "issueKey" | "summary" | "status"> {
  issueKey: string;
  summary: string;
  status: StatusCategory;
}

const CANONICAL: ChipRow[] = [
  {
    Icon: Zap,
    iconClass: "text-purple-700",
    typeLabel: "Épica",
    issueKey: "NOX-100",
    summary: "Implementar autenticación con SSO",
    status: "In Progress",
  },
  {
    Icon: BookmarkPlus,
    iconClass: "text-green-700",
    typeLabel: "Historia",
    issueKey: "NOX-101",
    summary: "Login con Google funcionando end-to-end",
    status: "Done",
  },
  {
    Icon: CheckSquare,
    iconClass: "text-blue-700",
    typeLabel: "Tarea",
    issueKey: "NOX-102",
    summary: "Validar tokens JWT en el backend",
    status: "To Do",
  },
  {
    Icon: Bug,
    iconClass: "text-red-700",
    typeLabel: "Bug",
    issueKey: "NOX-103",
    summary: "Sesión no expira tras logout en Safari",
    status: "In Progress",
  },
  {
    Icon: CornerDownRight,
    iconClass: "text-gray-500",
    typeLabel: "Subtarea",
    issueKey: "NOX-104",
    summary: "Configurar variable SSO_CLIENT_ID en staging",
    status: "Done",
  },
  {
    Icon: Circle,
    iconClass: "text-gray-400",
    typeLabel: "Otro",
    issueKey: "NOX-105",
    summary: "Tipo no mapeado (fallback)",
    status: "To Do",
  },
];

const EPIC_VARIANTS: ChipRow[] = [
  {
    Icon: Zap,
    iconClass: "text-purple-700",
    typeLabel: "Épica (Zap — canónico)",
    issueKey: "NOX-200",
    summary: "Migración del checkout a la nueva pasarela de pagos",
    status: "In Progress",
  },
  {
    Icon: Flag,
    iconClass: "text-purple-700",
    typeLabel: "Épica (Flag)",
    issueKey: "NOX-201",
    summary: "Migración del checkout a la nueva pasarela de pagos",
    status: "In Progress",
  },
  {
    Icon: Crown,
    iconClass: "text-purple-700",
    typeLabel: "Épica (Crown)",
    issueKey: "NOX-202",
    summary: "Migración del checkout a la nueva pasarela de pagos",
    status: "In Progress",
  },
  {
    Icon: Target,
    iconClass: "text-purple-700",
    typeLabel: "Épica (Target)",
    issueKey: "NOX-203",
    summary: "Migración del checkout a la nueva pasarela de pagos",
    status: "In Progress",
  },
];

const STORY_VARIANTS: ChipRow[] = [
  {
    Icon: BookmarkPlus,
    iconClass: "text-green-700",
    typeLabel: "Historia (BookmarkPlus — canónico)",
    issueKey: "NOX-300",
    summary: "Como cliente quiero ver el historial de mis compras",
    status: "Done",
  },
  {
    Icon: BookOpen,
    iconClass: "text-green-700",
    typeLabel: "Historia (BookOpen)",
    issueKey: "NOX-301",
    summary: "Como cliente quiero ver el historial de mis compras",
    status: "Done",
  },
  {
    Icon: FileText,
    iconClass: "text-green-700",
    typeLabel: "Historia (FileText)",
    issueKey: "NOX-302",
    summary: "Como cliente quiero ver el historial de mis compras",
    status: "Done",
  },
];

export default function ComponentsPreviewPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-12 px-6 py-10">
      <header className="space-y-2 border-b border-default-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Dev tool
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Components preview
        </h1>
        <p className="text-sm text-muted">
          Página interna de validación visual. No linkeada desde producción.
          Sumá secciones acá cuando necesites validar nuevos componentes o
          variantes antes de meterlos en la vista pública.
        </p>
      </header>

      <Section
        title="Issue Chips · canónicos"
        caption="Mapping de tipos de issue propuesto para la vista pública (4c.1)."
      >
        <ul className="flex flex-col gap-2">
          {CANONICAL.map((c) => (
            <DemoChip key={c.issueKey} {...c} />
          ))}
        </ul>
      </Section>

      <Section
        title="Issue Chips · variantes para Épica"
        caption="Misma issue, distintos íconos. Validá cuál comunica mejor 'épica' al lector no técnico."
      >
        <ul className="flex flex-col gap-2">
          {EPIC_VARIANTS.map((c) => (
            <DemoChip key={c.typeLabel} {...c} />
          ))}
        </ul>
      </Section>

      <Section
        title="Issue Chips · variantes para Historia"
        caption="BookmarkPlus tiene un '+' que sugiere acción de agregar más que 'historia'. Comparalas."
      >
        <ul className="flex flex-col gap-2">
          {STORY_VARIANTS.map((c) => (
            <DemoChip key={c.typeLabel} {...c} />
          ))}
        </ul>
      </Section>
    </main>
  );
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted">{caption}</p>
      </div>
      {children}
    </section>
  );
}
