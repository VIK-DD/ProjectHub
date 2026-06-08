// Serializable shapes passed from server components into client components.
// (Prisma rows are structurally compatible, so pages can pass rows directly.)

export type ProjectOption = { id: string; name: string };

export type UserLite = {
  id: string;
  name: string | null;
  image: string | null;
};

export type MemberDTO = {
  id: string; // membership id ("owner" for the owner pseudo-row)
  userId: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string; // OWNER | ADMIN | MEMBER | VIEWER
  isOwner: boolean;
};

export type CommentDTO = {
  id: string;
  body: string;
  createdAt: Date | string;
  author: UserLite;
};

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: Date | string;
};

export type ProjectDTO = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  tags: string;
  color: string | null;
  startDate: Date | null;
  dueDate: Date | null;
};

export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  projectId: string | null;
  dueDate: Date | null;
  notes: string | null;
  recurrence: string | null;
  recurrenceInterval?: number;
  recurrenceUntil?: Date | null;
  timeSpent: number;
  timerStartedAt: Date | null;
  assigneeId?: string | null;
  assignee?: UserLite | null;
};

export type MilestoneDTO = {
  id: string;
  title: string;
  completed: boolean;
  dueDate: Date | null;
};

export type SubtaskDTO = {
  id: string;
  title: string;
  completed: boolean;
};

export type BugDTO = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  projectId: string | null;
  stepsToReproduce: string | null;
  fixNotes: string | null;
};

export type NoteDTO = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  projectId: string | null;
};
