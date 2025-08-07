export interface Thread {
  id: string;
  title: string;
  body?: string;
  number?: number;
  node_id?: string;
  appliedTags?: string[];
  locked: boolean;
  archived: boolean;
  comments: Comment[];
  lockArchiving?: boolean;
  lockLocking?: boolean;
  mappingId?: string;
}

export interface Comment {
  id: string;
  git_id: number;
}