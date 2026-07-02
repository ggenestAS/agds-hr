import type { CareerLevel, CareerPath } from "@agds-hr/people";

// Pure, client-importable shapes for the people server fns (§9.3). The directory
// entry is the display view rendered by /people — the Inside roster merged with
// agds-hr-native level/path (by email) when assigned; rating/band position layer
// on with the review + comp slices.
export type DirectoryEntry = {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly title: string | undefined;
  readonly campus: string | undefined;
  readonly country: string | undefined;
  readonly managerName: string | undefined;
  readonly active: boolean;
  readonly level: CareerLevel | undefined;
  readonly path: CareerPath | undefined;
  readonly rating: number | undefined;
};
