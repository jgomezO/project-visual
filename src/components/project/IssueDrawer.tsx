"use client";

import { useEffect, useState } from "react";
import { Button, Drawer } from "@heroui/react";
import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import type { IssueRow, StatusCategory } from "./ProjectTable";
import { StatusChip } from "./StatusChip";
import { DueDateCell } from "./DueDateCell";
import { AssigneeCell } from "./AssigneeCell";
import { getAnonSupabase } from "@/lib/supabase/anon";

interface RelatedIssue {
  id: string;
  key: string;
  summary: string;
  status_category: StatusCategory;
}

interface LinkedIssue {
  target_key: string;
  target_summary: string | null;
  target_status: StatusCategory | null;
}

interface IssueDetail {
  parent: { id: string; key: string; summary: string } | null;
  children: RelatedIssue[];
  subtasks: RelatedIssue[];
  blockedBy: LinkedIssue[];
  blocks: LinkedIssue[];
}

const SUBTASK_RE = /sub-?task/i;

function jiraBrowseUrl(key: string): string | null {
  const base = process.env.NEXT_PUBLIC_JIRA_BASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/browse/${key}`;
}

export function IssueDrawer({
  issue,
  onClose,
}: {
  issue: IssueRow | null;
  onClose: () => void;
}) {
  const t = useTranslations("projectDetail.drawer");
  const [detail, setDetail] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!issue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear drawer detail when the parent deselects the issue (selection → null transition). TODO post-iter-8: derive `detail` directly from `issue` via a useDeferredValue + lazy fetcher pattern so the null branch needs no setState.
      setDetail(null);
      return;
    }
    let cancelled = false;
    const supabase = getAnonSupabase();
    setLoading(true);
    setDetail(null);

    void (async () => {
      const parentPromise = issue.parent_id
        ? supabase
            .from("issues")
            .select("id, key, summary")
            .eq("id", issue.parent_id)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const kidsPromise = supabase
        .from("issues")
        .select("id, key, summary, issue_type, status_category")
        .eq("parent_id", issue.id)
        .order("key", { ascending: true });

      const linksPromise = supabase
        .from("issue_links")
        .select("link_type, target_issue_key, target_issue_id")
        .eq("source_issue_id", issue.id);

      const [parentRes, kidsRes, linksRes] = await Promise.all([
        parentPromise,
        kidsPromise,
        linksPromise,
      ]);
      if (cancelled) return;

      const links = linksRes.data ?? [];
      const targetIds = links
        .map((l) => l.target_issue_id)
        .filter((x): x is string => x !== null);

      const targetsRes = targetIds.length
        ? await supabase
            .from("issues")
            .select("id, summary, status_category")
            .in("id", targetIds)
        : { data: [] };
      if (cancelled) return;

      const targetById = new Map<
        string,
        { summary: string; status: StatusCategory }
      >();
      for (const tgt of targetsRes.data ?? []) {
        targetById.set(tgt.id, {
          summary: tgt.summary,
          status: tgt.status_category as StatusCategory,
        });
      }

      const allKids = kidsRes.data ?? [];
      const subtasks: RelatedIssue[] = [];
      const children: RelatedIssue[] = [];
      for (const k of allKids) {
        const r: RelatedIssue = {
          id: k.id,
          key: k.key,
          summary: k.summary,
          status_category: k.status_category as StatusCategory,
        };
        if (SUBTASK_RE.test(k.issue_type)) subtasks.push(r);
        else children.push(r);
      }

      const blockedBy: LinkedIssue[] = [];
      const blocks: LinkedIssue[] = [];
      for (const l of links) {
        const enriched = l.target_issue_id
          ? targetById.get(l.target_issue_id) ?? null
          : null;
        const item: LinkedIssue = {
          target_key: l.target_issue_key,
          target_summary: enriched?.summary ?? null,
          target_status: enriched?.status ?? null,
        };
        const lt = l.link_type.toLowerCase();
        if (lt === "is blocked by") blockedBy.push(item);
        else if (lt === "blocks") blocks.push(item);
      }

      setDetail({
        parent: parentRes.data ?? null,
        children,
        subtasks,
        blockedBy,
        blocks,
      });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [issue]);

  const isOpen = issue !== null;
  const jiraUrl = issue ? jiraBrowseUrl(issue.key) : null;

  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Content placement="right">
        <Drawer.Dialog>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs text-muted">
                {issue?.key}
              </span>
              <Drawer.Heading>{issue?.summary}</Drawer.Heading>
            </div>
          </Drawer.Header>
          <Drawer.Body>
            {issue && (
              <div className="flex flex-col gap-5">
                <Section label={t("sections.status")}>
                  <StatusChip
                    category={issue.status_category}
                    statusName={issue.status_name}
                  />
                </Section>
                <Section label={t("sections.assignee")}>
                  <AssigneeCell displayName={issue.assignee_display_name} />
                </Section>
                <Section label={t("sections.dueDate")}>
                  <DueDateCell
                    date={issue.due_date}
                    isDone={issue.status_category === "Done"}
                  />
                </Section>
                {issue.priority ? (
                  <Section label={t("sections.priority")}>
                    <span className="text-sm">{issue.priority}</span>
                  </Section>
                ) : null}

                {detail?.parent ? (
                  <Section label={t("sections.parent")}>
                    <RelatedLine
                      keyText={detail.parent.key}
                      summary={detail.parent.summary}
                    />
                  </Section>
                ) : null}

                {detail && detail.children.length > 0 ? (
                  <Section
                    label={t("sections.children", {
                      count: detail.children.length,
                    })}
                  >
                    <RelatedList items={detail.children} />
                  </Section>
                ) : null}

                {detail && detail.subtasks.length > 0 ? (
                  <Section
                    label={t("sections.subtasks", {
                      count: detail.subtasks.length,
                    })}
                  >
                    <RelatedList items={detail.subtasks} />
                  </Section>
                ) : null}

                {detail && detail.blockedBy.length > 0 ? (
                  <Section
                    label={t("sections.blockedBy", {
                      count: detail.blockedBy.length,
                    })}
                  >
                    <LinkedList items={detail.blockedBy} />
                  </Section>
                ) : null}

                {detail && detail.blocks.length > 0 ? (
                  <Section
                    label={t("sections.blocks", {
                      count: detail.blocks.length,
                    })}
                  >
                    <LinkedList items={detail.blocks} />
                  </Section>
                ) : null}

                {loading ? (
                  <span className="text-sm text-muted">{t("loading")}</span>
                ) : null}
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <Button slot="close" variant="secondary">
              {t("actions.close")}
            </Button>
            {jiraUrl ? (
              <a
                href={jiraUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
              >
                {t("actions.openInJira")}
                <ExternalLink className="size-4" />
              </a>
            ) : null}
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

function RelatedList({ items }: { items: RelatedIssue[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex items-center justify-between gap-2 rounded-md bg-default-50 px-2 py-1.5"
        >
          <RelatedLine keyText={it.key} summary={it.summary} />
          <StatusChip category={it.status_category} />
        </li>
      ))}
    </ul>
  );
}

function LinkedList({ items }: { items: LinkedIssue[] }) {
  const t = useTranslations("projectDetail.drawer.linked");
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((it) => (
        <li
          key={it.target_key}
          className="flex items-center justify-between gap-2 rounded-md bg-default-50 px-2 py-1.5"
        >
          <RelatedLine
            keyText={it.target_key}
            summary={it.target_summary ?? t("outOfScope")}
            muted={it.target_summary === null}
          />
          {it.target_status ? (
            <StatusChip category={it.target_status} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function RelatedLine({
  keyText,
  summary,
  muted,
}: {
  keyText: string;
  summary: string;
  muted?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-sm">
      <span className="font-mono text-xs text-muted">{keyText}</span>
      <span className={`truncate ${muted ? "italic text-muted" : ""}`}>
        {summary}
      </span>
    </span>
  );
}
