import { ApplicantStatus } from '@prisma/client';

/**
 * Allowed transitions for the verification pipeline.
 * Encodes the same state graph the frontend Kanban renders.
 */
export const TRANSITIONS: Record<ApplicantStatus, ApplicantStatus[]> = {
  PENDING: [ApplicantStatus.DOCS_REVIEW, ApplicantStatus.NEEDS_REVIEW, ApplicantStatus.REJECTED],
  NEEDS_REVIEW: [ApplicantStatus.DOCS_REVIEW, ApplicantStatus.REJECTED],
  DOCS_REVIEW: [
    ApplicantStatus.NEEDS_REVIEW,
    ApplicantStatus.TEST_SCHEDULED,
    ApplicantStatus.REJECTED,
  ],
  TEST_SCHEDULED: [ApplicantStatus.TEST_COMPLETED, ApplicantStatus.REJECTED],
  TEST_COMPLETED: [ApplicantStatus.FINAL_APPROVAL, ApplicantStatus.REJECTED],
  FINAL_APPROVAL: [ApplicantStatus.APPROVED, ApplicantStatus.REJECTED],
  APPROVED: [],
  REJECTED: [],
};

export function canTransition(from: ApplicantStatus, to: ApplicantStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}
