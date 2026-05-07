import { Card } from "@heroui/react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function ProjectNotFound() {
  const t = await getTranslations("projectDetail.notFound");
  return (
    <main className="mx-auto max-w-2xl p-8">
      <Card>
        <Card.Header>
          <Card.Title>{t("title")}</Card.Title>
          <Card.Description>{t("description")}</Card.Description>
        </Card.Header>
        <Card.Footer>
          <Link href="/projects" className="underline">
            {t("backToList")}
          </Link>
        </Card.Footer>
      </Card>
    </main>
  );
}
