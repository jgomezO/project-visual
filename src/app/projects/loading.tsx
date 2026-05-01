import { Card, Skeleton } from "@heroui/react";

export default function ProjectsLoading() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-8 space-y-2">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-4 w-40 rounded" />
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </main>
  );
}

function ProjectCardSkeleton() {
  return (
    <Card>
      <Card.Header>
        <Card.Title>
          <Skeleton className="h-5 w-3/4 rounded-lg" />
        </Card.Title>
        <Card.Description>
          <Skeleton className="h-3 w-1/2 rounded" />
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-7 w-14 rounded" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-7 w-14 rounded" />
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
