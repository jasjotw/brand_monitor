import { ContentPage } from "@/components/dashboard/pages/content-page";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading content...</div>}>
      <ContentPage />
    </Suspense>
  );
}
