export enum MeetingStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  READY = "READY",
  FAILED = "FAILED",
}

export interface Meeting {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  status: MeetingStatus;
  chunks: number;
  sources: MeetingSource[];
}

export interface MeetingSource {
  id: string;
  meetingId: string;
  fileName: string;
  createdAt: string;
}
