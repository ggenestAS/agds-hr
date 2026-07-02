// Pure, client-importable shapes for the people server fns (§9.3). The directory
// entry is the display view rendered by /people — sourced from the Inside roster
// this slice; agds-hr level/path/rating layer on later.
export type DirectoryEntry = {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly title: string | undefined;
  readonly campus: string | undefined;
  readonly country: string | undefined;
  readonly managerName: string | undefined;
  readonly active: boolean;
};
