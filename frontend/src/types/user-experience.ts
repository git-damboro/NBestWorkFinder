export type UserExperienceType = 'SELF_INTRO' | 'PROJECT' | 'WORK' | 'SKILL' | 'PREFERENCE';

export interface UserExperience {
  id: number;
  type: UserExperienceType;
  title: string;
  content: string;
  tags: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserExperienceForm {
  type: UserExperienceType;
  title: string;
  content: string;
  tags: string[];
  enabled: boolean;
}

export const userExperienceTypeLabelMap: Record<UserExperienceType, string> = {
  SELF_INTRO: '自我介绍',
  PROJECT: '项目经历',
  WORK: '实习/工作经历',
  SKILL: '技能亮点',
  PREFERENCE: '求职偏好',
};

export const userExperienceTypeOptions: Array<{ value: UserExperienceType; label: string }> = [
  { value: 'SELF_INTRO', label: userExperienceTypeLabelMap.SELF_INTRO },
  { value: 'PROJECT', label: userExperienceTypeLabelMap.PROJECT },
  { value: 'WORK', label: userExperienceTypeLabelMap.WORK },
  { value: 'SKILL', label: userExperienceTypeLabelMap.SKILL },
  { value: 'PREFERENCE', label: userExperienceTypeLabelMap.PREFERENCE },
];
