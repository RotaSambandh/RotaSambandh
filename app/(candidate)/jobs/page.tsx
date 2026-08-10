import { Suspense } from "react";
import { JobsBrowser } from "@/components/jobs/jobs-browser";
import { LoadingBlock, PageHeader } from "@/components/ui";

export default function JobsPage() {
  return (
    <main>
      <PageHeader
        title="Opportunities"
        description="Verified roles from Rotary-linked businesses. Use filters to narrow the list."
      />
      <Suspense fallback={<LoadingBlock label="Loading opportunities..." />}>
        <JobsBrowser />
      </Suspense>
    </main>
  );
}
