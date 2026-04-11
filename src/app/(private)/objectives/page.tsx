import { listObjectives } from "@/lib/queries/objectives";
import { SOURCE_INFO } from "@/lib/queries/okr-sources";

import ObjectivesClient from "./ObjectivesClient";

export const dynamic = "force-dynamic";

export default async function ObjectivesPage() {
  const objectives = await listObjectives(1);
  return (
    <ObjectivesClient
      initial={objectives}
      availableSources={Object.entries(SOURCE_INFO).map(([key, info]) => ({
        key,
        label: info.label,
        description: info.description,
      }))}
    />
  );
}
