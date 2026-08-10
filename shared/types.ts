export type UserRole =
  | "candidate"
  | "employer"
  | "super_admin"
  | "admin"
  | "coordinator";

/** Roles on a business team (legacy owner/recruiter still accepted in data). */
export type BusinessMemberRole = "company_admin" | "manager";

export type ApplicationStatus =
  | "applied"
  | "under_review"
  | "shortlisted"
  | "interview"
  | "selected"
  | "rejected"
  | "withdrawn";

export type JobStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "closed"
  | "filled"
  | "expired";

export type BusinessStatus =
  | "draft"
  | "verification_pending"
  | "verified"
  | "suspended"
  | "deletion_pending";

/** Statuses a business can return to after soft-delete restore. */
export type BusinessStatusBeforeDeletion = Exclude<BusinessStatus, "deletion_pending">;

export type JobType =
  | "full_time"
  | "part_time"
  | "internship"
  | "apprenticeship"
  | "fellowship"
  | "contract"
  | "freelance";

export type WorkplaceType = "remote" | "hybrid" | "on_site";

export type QuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multiple_choice"
  | "yes_no"
  | "number"
  | "date"
  | "url"
  | "file";

export type QuestionScope = "platform" | "employer" | "job";

export type ReportReason =
  | "fake_job"
  | "spam"
  | "misrepresentation"
  | "employer_misconduct"
  | "other";

export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export type NotificationType =
  | "application_submitted"
  | "application_status_changed"
  | "application_received"
  | "interview_update"
  | "matching_opportunity"
  | "job_approved"
  | "job_rejected"
  | "change_request_update"
  | "business_verification"
  | "business_deletion"
  | "admin_queue_digest"
  | "team_invite"
  | "platform_announcement";

export type AnnouncementAudience = "candidates" | "employers" | "everyone";

export interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

export interface UserDoc extends Timestamps {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  roles: UserRole[];
  phone?: string;
  country?: string;
  city?: string;
  suspended?: boolean;
  fcmTokens?: string[];
  /** Last-selected employer company for multi-business accounts. */
  activeBusinessId?: string;
}

export interface CandidateProfile extends Timestamps {
  userId: string;
  headline?: string;
  about?: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  certifications: string[];
  languages: string[];
  portfolioUrl?: string;
  linkedInUrl?: string;
  rotaractClub?: string;
  rotaractDistrict?: string;
  membershipVerified?: boolean;
  discoverable?: boolean;
  primaryResumeId?: string;
  completionScore: number;
}

export interface ExperienceItem {
  id: string;
  title: string;
  company: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface EducationItem {
  id: string;
  school: string;
  degree?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
}

export interface Business extends Timestamps {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  coverUrl?: string;
  description?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  socialLinks?: Record<string, string>;
  /** Rotary / Rotaract network contact — not necessarily the registering company_admin. */
  rotaryContactName?: string;
  rotaryContactClub?: string;
  /** Admin / verification ops only — not shown on public company page. */
  rotaryContactEmail?: string;
  rotaryContactPhone?: string;
  status: BusinessStatus;
  verifiedAt?: number;
  ownerId: string;
  /** Soft-delete request metadata (admin restore / permanent purge). */
  deletionRequestedAt?: number;
  deletionRequestedBy?: string;
  statusBeforeDeletion?: BusinessStatusBeforeDeletion;
  deletionCompanyNameSnapshot?: string;
  purgeStatus?: "running" | "failed";
  purgeError?: string;
}

export interface BusinessMember extends Timestamps {
  id: string;
  businessId: string;
  userId: string;
  /** Prefer company_admin | manager. Legacy: owner → company_admin, recruiter/viewer → manager. */
  role: BusinessMemberRole | "owner" | "recruiter" | "viewer";
  email?: string;
  displayName?: string;
  invitedBy?: string;
  status?: "active" | "invited" | "revoked";
}

export interface BusinessVerification extends Timestamps {
  id: string;
  businessId: string;
  submittedBy: string;
  affiliationType: "rotarian" | "rotaractor" | "rotary_club" | "other";
  affiliationDetails: string;
  supportingInfo?: string;
  status: "pending" | "approved" | "rejected" | "info_requested";
  adminNote?: string;
  reviewedBy?: string;
  reviewedAt?: number;
}

export interface Job extends Timestamps {
  id: string;
  businessId: string;
  title: string;
  slug: string;
  description: string;
  responsibilities?: string;
  requirements?: string;
  benefits?: string;
  skills: string[];
  type: JobType;
  workplace: WorkplaceType;
  location?: string;
  salaryDisplay?: string;
  salaryMin?: number;
  salaryMax?: number;
  experienceMin?: number;
  experienceMax?: number;
  industry?: string;
  categoryIds: string[];
  status: JobStatus;
  deadline?: number;
  featured?: boolean;
  postedAt?: number;
  closedAt?: number;
  createdBy: string;
  /** Set when company soft-delete closes a public/pending job for later restore. */
  statusBeforeDeletion?: JobStatus;
}

export interface Question extends Timestamps {
  id: string;
  scope: QuestionScope;
  businessId?: string;
  jobId?: string;
  type: QuestionType;
  prompt: string;
  version: number;
  options?: string[];
  required: boolean;
  active: boolean;
  platformKey?: string;
}

export interface JobQuestion {
  jobId: string;
  questionId: string;
  questionVersion: number;
  order: number;
  required: boolean;
}

export interface DocumentMeta extends Timestamps {
  id: string;
  candidateId: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  isPrimary: boolean;
  kind: "resume" | "portfolio" | "certificate" | "other";
}

export interface Application extends Timestamps {
  id: string;
  jobId: string;
  businessId: string;
  candidateId: string;
  status: ApplicationStatus;
  resumeDocumentId: string;
  resumeStorageKey: string;
  resumeFileName: string;
  submittedAt: number;
  statusUpdatedAt: number;
  /** Frozen at submit — employers read these instead of users/{uid}. */
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  /** After permanent company purge — candidate-facing history only. */
  companyRemoved?: boolean;
  companyNameSnapshot?: string;
  jobTitleSnapshot?: string;
}

export interface ApplicationAnswer {
  id: string;
  applicationId: string;
  questionId: string;
  questionVersion: number;
  promptSnapshot: string;
  type: QuestionType;
  value: string | string[] | number | boolean | null;
}

export interface ApplicationEvent extends Timestamps {
  id: string;
  applicationId: string;
  fromStatus?: ApplicationStatus;
  toStatus: ApplicationStatus;
  actorId: string;
  note?: string;
}

export interface SavedJob extends Timestamps {
  id: string;
  userId: string;
  jobId: string;
}

export interface NotificationDoc extends Timestamps {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href?: string;
  read: boolean;
  meta?: Record<string, string>;
  audience?: AnnouncementAudience;
  entityType?: string;
  entityId?: string;
  dedupeKey?: string;
}

export interface Announcement extends Timestamps {
  id: string;
  title: string;
  body: string;
  href?: string;
  audience: AnnouncementAudience;
  createdBy: string;
}

export interface Category extends Timestamps {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export interface Skill extends Timestamps {
  id: string;
  name: string;
  slug: string;
  active: boolean;
}

export interface Report extends Timestamps {
  id: string;
  reporterId: string;
  reason: ReportReason;
  targetType: "job" | "business" | "user";
  targetId: string;
  details?: string;
  status: ReportStatus;
  resolvedBy?: string;
  resolvedAt?: number;
}

export interface AdminAction extends Timestamps {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  note?: string;
}

export interface SystemCounters {
  registeredUsers: number;
  businesses: number;
  activeJobs: number;
  applications: number;
  pendingBusinesses: number;
  pendingJobs: number;
  pendingBusinessDeletions: number;
  placements: number;
  updatedAt: number;
  readModelVersion: number;
}

/** Public feed card - no private fields */
export interface JobFeedItem {
  id: string;
  title: string;
  company: string;
  companyLogo?: string;
  businessId: string;
  location?: string;
  workplace: WorkplaceType;
  type: JobType;
  salary?: string;
  skills: string[];
  postedAt: number;
  deadline?: number;
  featured?: boolean;
  readModelVersion: number;
}

export interface JobDetailReadModel extends JobFeedItem {
  description: string;
  responsibilities?: string;
  requirements?: string;
  benefits?: string;
  industry?: string;
  applicationConfig?: {
    questionCount: number;
  };
  companySummary?: string;
  readModelVersion: number;
}

export interface BusinessPublicReadModel {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  coverUrl?: string;
  description?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  rotaryContactName?: string;
  rotaryContactClub?: string;
  verified: boolean;
  openJobsCount: number;
  readModelVersion: number;
}

export interface EmployerDashboardProjection {
  activeJobs: number;
  applications: number;
  newApplications: number;
  shortlisted: number;
  interviews: number;
  selected: number;
  readModelVersion: number;
}

export interface CandidateDashboardProjection {
  applications: number;
  underReview: number;
  interviews: number;
  savedJobs: number;
  profileCompletion: number;
  readModelVersion: number;
}

export interface JobSearchFilters {
  q?: string;
  type?: JobType;
  workplace?: WorkplaceType;
  location?: string;
  skill?: string;
  industry?: string;
  experienceMin?: number;
  sort?: "relevance" | "newest" | "deadline" | "salary";
}

export type ChangeRequestStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "info_requested";

export type ChangeRequestTarget = "business" | "job";
export type ChangeRequestAction = "create" | "update" | "close";

/** Employer proposal; live docs only update on admin approve */
export interface ChangeRequest extends Timestamps {
  id: string;
  targetType: ChangeRequestTarget;
  targetId: string;
  businessId: string;
  action: ChangeRequestAction;
  proposed: Record<string, unknown>;
  liveSnapshot?: Record<string, unknown>;
  status: ChangeRequestStatus;
  submittedBy: string;
  reviewedBy?: string;
  reviewedAt?: number;
  adminNote?: string;
  title?: string;
}

export type BusinessProposedFields = Partial<
  Pick<
    Business,
    | "name"
    | "description"
    | "website"
    | "industry"
    | "companySize"
    | "location"
    | "logoUrl"
    | "coverUrl"
    | "socialLinks"
    | "rotaryContactName"
    | "rotaryContactClub"
    | "rotaryContactEmail"
    | "rotaryContactPhone"
  >
>;

export type JobProposedFields = Partial<
  Pick<
    Job,
    | "title"
    | "description"
    | "responsibilities"
    | "requirements"
    | "benefits"
    | "skills"
    | "type"
    | "workplace"
    | "location"
    | "salaryDisplay"
    | "deadline"
    | "industry"
    | "categoryIds"
  >
>;
