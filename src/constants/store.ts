export const FIELDS = {
	// status
	STATUS: 'STATUS',
	COURSE_TITLE: 'COURSE_TITLE',
	COURSE_TYPE: 'COURSE_TYPE',
	COURSES_ADDED: 'COURSES_ADDED',
	MODULES_COMPLETED: 'MODULES_COMPLETED',
	VIDEOS_COMPLETED: 'VIDEOS_COMPLETED',

	// settings
	LEADING_ZERO: 'LEADING_ZERO',
	SECONDARY_LANGUAGE: 'SECONDARY_LANGUAGE',

	DOWNLOAD_DELAY: 'DOWNLOAD_DELAY',
	MAX_DELAY: 'MAX_DELAY',
} as const

export const STATUS_FIELDS = [
  FIELDS.STATUS,
	FIELDS.COURSES_ADDED,
]

export const SETTINGS_FIELDS = [
	FIELDS.LEADING_ZERO,
	FIELDS.SECONDARY_LANGUAGE,
	FIELDS.DOWNLOAD_DELAY,
	FIELDS.MAX_DELAY,
]

export const ACTIONS = {
	DOWNLOAD_CURRENT: 'DOWNLOAD_CURRENT',
	DOWNLOAD_ALL: 'DOWNLOAD_ALL',
	ADD_COURSE: 'ADD_COURSE',
	SKIP_VIDEO: 'SKIP_VIDEO',
	STOP: 'STOP',
} as const

export const LINKS = {
	PLURALSIGHT: 'PLURALSIGHT',
	REPOSITORY: 'REPOSITORY',
	REPOSITORY_ISSUES: 'REPOSITORY_ISSUES',
} as const

export const STATUSES = {
	READY: 'READY',
	WAITING: 'WAITING',
	STOPPED: 'STOPPED',
	DOWNLOADING: 'DOWNLOADING',
	ERROR: 'ERROR',
	DONE: 'DONE',
	CANCELLED: 'CANCELLED',
} as const

export const COURSE_TYPES = {
	NEW: 'NEW',
	OLD: 'OLD',
} as const

export const LEADING_ZERO_OPTIONS = {
	ALWAYS: 'ALWAYS',
	TEN_OR_MORE: 'TEN_OR_MORE',
}

export const FIELD_X_KEY = {
	[FIELDS.STATUS]: 'extensionStatus',
	[FIELDS.COURSE_TITLE]: 'courseTitle',
	[FIELDS.COURSE_TYPE]: 'courseType',
	[FIELDS.COURSES_ADDED]: 'noOfCoursesAdded',
	[FIELDS.MODULES_COMPLETED]: 'modulesCompleted',
	[FIELDS.VIDEOS_COMPLETED]: 'videosCompleted',
	[FIELDS.LEADING_ZERO]: 'isAlwaysLeadingZero',
	[FIELDS.SECONDARY_LANGUAGE]: 'secondaryLanguage',
	[FIELDS.DOWNLOAD_DELAY]: 'speedPercent',
	[FIELDS.MAX_DELAY]: 'maxDuration',
} as const

export const ACTION_X_KEY = {
	[ACTIONS.DOWNLOAD_CURRENT]: 'downloadCurrent',
	[ACTIONS.DOWNLOAD_ALL]: 'downloadAll',
	[ACTIONS.ADD_COURSE]: 'addCourse',
	[ACTIONS.SKIP_VIDEO]: 'skip',
	[ACTIONS.STOP]: 'stop',
} as const

export const BG_ACTIONS = {
	DOWNLOAD: 'download',
	DOWNLOAD_SYNC: 'download-sync',
	// ...?
	BADGE: 'badge',
} as const