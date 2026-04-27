export type JobApplicationWorkflowStatus =
  | 'RUNNING'
  | 'WAITING_HUMAN'
  | 'COMPLETED'
  | 'FAILED'
  | 'CLOSED';

export type JobApplicationWorkflowNode =
  | 'JOB_IMPORTED'
  | 'OPENER_GENERATED'
  | 'OPENER_COPIED'
  | 'APPLICATION_SENT'
  | 'FOLLOW_UP_SCHEDULED'
  | 'WORKFLOW_CLOSED';

export type JobApplicationWorkflowEventType =
  | 'NODE_COMPLETED'
  | 'WAITING_HUMAN'
  | 'NODE_FAILED'
  | 'WORKFLOW_CLOSED';

export interface JobApplicationWorkflowEvent {
  id: number;
  workflowId: number;
  jobId: number;
  nodeKey: JobApplicationWorkflowNode;
  eventType: JobApplicationWorkflowEventType;
  status: JobApplicationWorkflowStatus;
  title: string;
  content: string | null;
  inputSnapshot: string | null;
  outputSnapshot: string | null;
  errorMessage: string | null;
  requiresHumanAction: boolean;
  createdAt: string;
}

export interface JobApplicationWorkflow {
  id: number;
  jobId: number;
  status: JobApplicationWorkflowStatus;
  currentNode: JobApplicationWorkflowNode;
  nextAction: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  events: JobApplicationWorkflowEvent[];
}

export interface CreateWorkflowEventForm {
  nodeKey: JobApplicationWorkflowNode;
  title?: string;
  content?: string;
  inputSnapshot?: string;
  outputSnapshot?: string;
  requiresHumanAction?: boolean;
}

export const workflowNodeLabelMap: Record<JobApplicationWorkflowNode, string> = {
  JOB_IMPORTED: '岗位导入',
  OPENER_GENERATED: '开场白生成',
  OPENER_COPIED: '开场白复制',
  APPLICATION_SENT: '确认投递',
  FOLLOW_UP_SCHEDULED: '跟进计划',
  WORKFLOW_CLOSED: '流程结束',
};

export const workflowStatusLabelMap: Record<JobApplicationWorkflowStatus, string> = {
  RUNNING: '执行中',
  WAITING_HUMAN: '等待人工确认',
  COMPLETED: '已完成',
  FAILED: '执行失败',
  CLOSED: '已关闭',
};
