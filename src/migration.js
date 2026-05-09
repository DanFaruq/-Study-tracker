/**
 * ReadTrack Data Migration
 * Migrates localStorage data from any previous version (rpt-v1, rpt-v2, rpt-v3)
 * into the current rpt-v4 schema — preserving all subjects, topics,
 * assignments, exams, and MCQ sessions.
 *
 * Safe to run on every app load — it's idempotent.
 */

export const STORAGE_KEY = 'rpt-v4';
const LEGACY_KEYS = ['rpt-v3', 'rpt-v2', 'rpt-v1', 'readProgressTracker'];

/** Generate a short unique id */
export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Attempt to load and parse JSON from localStorage.
 * Returns null on any error.
 */
function tryLoad(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Normalise a legacy topic into the v4 schema.
 * Old topics may have numberOfPages / pagesCompleted — we keep them for
 * reference but they no longer drive the UI.
 */
function migrateTopic(t) {
  return {
    id:             t.id             || uid(),
    title:          t.title          || t.name || 'Untitled Topic',
    subjectId:      t.subjectId      || '',
    lecturerName:   t.lecturerName   || '',
    lectureDate:    t.lectureDate    || '',
    status:         t.status         || (t.isCompleted ? 'completed' : 'not_started'),
    isCompleted:    t.isCompleted    ?? (t.status === 'completed'),
    priority:       t.priority       || 'medium',
    notes:          t.notes          || '',
    summary:        t.summary        || '',
    tags:           Array.isArray(t.tags) ? t.tags : (t.tags ? t.tags.split(',').map(x => x.trim()).filter(Boolean) : []),
    documentId:     t.documentId     || '',
    docPageCount:   t.docPageCount   || t.numberOfPages || 0,
    // Keep legacy page fields so nothing is lost
    numberOfPages:  t.numberOfPages  || 0,
    pagesCompleted: t.pagesCompleted || 0,
    createdAt:      t.createdAt      || new Date().toISOString(),
    updatedAt:      t.updatedAt      || t.createdAt || new Date().toISOString(),
  };
}

function migrateSubject(s) {
  return {
    id:          s.id          || uid(),
    name:        s.name        || 'Untitled Subject',
    courseCode:  s.courseCode  || '',
    semester:    s.semester    || '',
    session:     s.session     || '',
    color:       s.color       || '#6366f1',
    description: s.description || '',
    notes:       s.notes       || '',
    createdAt:   s.createdAt   || new Date().toISOString(),
    updatedAt:   s.updatedAt   || s.createdAt || new Date().toISOString(),
  };
}

function migrateAssignment(a) {
  return {
    id:           a.id           || uid(),
    title:        a.title        || 'Untitled',
    subjectId:    a.subjectId    || '',
    topicId:      a.topicId      || '',
    lecturerName: a.lecturerName || '',
    dateGiven:    a.dateGiven    || '',
    dueDate:      a.dueDate      || '',
    priority:     a.priority     || 'medium',
    notes:        a.notes        || '',
    isSubmitted:  a.isSubmitted  ?? false,
    status:       a.status       || 'pending',
    createdAt:    a.createdAt    || new Date().toISOString(),
    updatedAt:    a.updatedAt    || a.createdAt || new Date().toISOString(),
  };
}

function migrateExam(e) {
  return {
    id:        e.id        || uid(),
    name:      e.name      || 'Untitled Exam',
    subjectId: e.subjectId || '',
    date:      e.date      || '',
    time:      e.time      || '09:00',
    venue:     e.venue     || '',
    notes:     e.notes     || '',
    type:      e.type      || 'exam',
  };
}

function migrateMCQSession(s) {
  return {
    id:           s.id           || uid(),
    subjectId:    s.subjectId    || '',
    topicId:      s.topicId      || '',
    subjectName:  s.subjectName  || '',
    topicName:    s.topicName    || '',
    questions:    Array.isArray(s.questions) ? s.questions : [],
    numQuestions: s.numQuestions || s.questions?.length || 0,
    score:        s.score        ?? null,
    completed:    s.completed    ?? false,
    createdAt:    s.createdAt    || new Date().toISOString(),
    completedAt:  s.completedAt  || null,
  };
}

/**
 * Run migration.
 * 1. If rpt-v4 already exists → just return it (already migrated).
 * 2. Otherwise search for any legacy key, migrate the data, save as rpt-v4,
 *    and optionally remove legacy keys.
 */
export function runMigration(defaultData) {
  // Already on v4 — return as-is
  const existing = tryLoad(STORAGE_KEY);
  if (existing) {
    // Still ensure all required keys exist (forward-compat for older v4 saves)
    const merged = {
      ...defaultData,
      ...existing,
      documents:   existing.documents   || [],
      mcqSessions: existing.mcqSessions || [],
      exams:       existing.exams       || [],
      chatHistory: existing.chatHistory || [],
    };
    return merged;
  }

  // Try each legacy key in order of preference
  let legacy = null;
  let legacyKey = null;
  for (const key of LEGACY_KEYS) {
    const data = tryLoad(key);
    if (data) { legacy = data; legacyKey = key; break; }
  }

  if (!legacy) {
    // No previous data at all — fresh install
    return defaultData;
  }

  console.info(`[ReadTrack] Migrating data from ${legacyKey} → ${STORAGE_KEY}`);

  const migrated = {
    profile: {
      name:  legacy.profile?.name  || defaultData.profile.name,
      theme: legacy.profile?.theme || defaultData.profile.theme,
    },
    subjects:    (legacy.subjects    || []).map(migrateSubject),
    topics:      (legacy.topics      || []).map(migrateTopic),
    assignments: (legacy.assignments || []).map(migrateAssignment),
    exams:       (legacy.exams       || []).map(migrateExam),
    mcqSessions: (legacy.mcqSessions || []).map(migrateMCQSession),
    documents:   [],        // documents are binary-ish — can't migrate from old storage
    chatHistory: [],
    _migratedFrom: legacyKey,
    _migratedAt:   new Date().toISOString(),
  };

  // Persist to new key
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    // Keep the legacy key around for safety — don't delete it
    console.info(`[ReadTrack] Migration complete. ${migrated.subjects.length} subjects, ${migrated.topics.length} topics, ${migrated.assignments.length} assignments, ${migrated.exams.length} exams migrated.`);
  } catch (e) {
    console.error('[ReadTrack] Migration save failed:', e);
  }

  return migrated;
}

/** Persist current app data to localStorage */
export function persist(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[ReadTrack] Could not persist data:', e);
  }
}
