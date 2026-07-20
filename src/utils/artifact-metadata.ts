import type { TemplateContext } from "../types.js";
import { currentDateString } from "./runtime-context.js";

export interface ArtifactMetadataInput {
  version: string;
  author: string;
  status: string;
}

export function artifactMetadata(
  input: ArtifactMetadataInput,
): Pick<TemplateContext, "version" | "date" | "author" | "status"> {
  return {
    version: input.version,
    date: currentDateString(),
    author: input.author,
    status: input.status,
  };
}
