import { getDb } from "../shared/db.js";
import type { EntityCategory, ExtractedEntity, InfoType } from "../types.js";
import { INITIAL_DAYS, CATEGORY_TO_INFO_TYPE, getTier, getPreviousTierDiff, isWeakMemory } from "./memory-tier.js";

function generateId(): string {
  return crypto.randomUUID();
}

export function createEntity(
  userId: string,
  category: EntityCategory,
  key: string,
  value: string,
  sourceMessage: string
): ExtractedEntity {
  const now = Date.now();
  const infoType = CATEGORY_TO_INFO_TYPE[category] || "temporary";
  const remainingDays = INITIAL_DAYS[infoType];

  const entity: ExtractedEntity = {
    id: generateId(),
    userId,
    category,
    infoType,
    key,
    value,
    sourceMessage,
    remainingDays,
    isPermanent: false,
    negativeFeedbackCount: 0,
    accessCount: 0,
    createdAt: now,
    lastAccessed: now,
    lastDecayAt: now,
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO entities (id, user_id, category, info_type, key, value, source_message, remaining_days, is_permanent, negative_feedback_count, access_count, created_at, last_accessed, last_decay_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entity.id,
    entity.userId,
    entity.category,
    entity.infoType,
    entity.key,
    entity.value,
    entity.sourceMessage,
    entity.remainingDays,
    entity.isPermanent ? 1 : 0,
    entity.negativeFeedbackCount,
    entity.accessCount,
    entity.createdAt,
    entity.lastAccessed,
    entity.lastDecayAt
  );

  return entity;
}

export function getEntity(id: string): ExtractedEntity | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM entities WHERE id = ?").get(id) as EntityRow | undefined;

  if (!row) {
    return null;
  }

  return mapRowToEntity(row);
}

export function getEntitiesByUser(userId: string): ExtractedEntity[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM entities WHERE user_id = ? ORDER BY last_accessed DESC")
    .all(userId) as unknown as EntityRow[];
  return rows.map(mapRowToEntity);
}

export function getStrongEntities(userId: string, minDays: number = 7): ExtractedEntity[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM entities WHERE user_id = ? AND remaining_days >= ? ORDER BY remaining_days DESC")
    .all(userId, minDays) as unknown as EntityRow[];
  return rows.map(mapRowToEntity);
}

export function getEntityByKey(userId: string, key: string): ExtractedEntity | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM entities WHERE user_id = ? AND key = ?")
    .get(userId, key) as EntityRow | undefined;

  if (!row) {
    return null;
  }

  return mapRowToEntity(row);
}

export function getEntitiesByKeys(userId: string, keys: string[]): ExtractedEntity[] {
  if (keys.length === 0) { return []; }
  
  const placeholders = keys.map(() => "?").join(", ");
  const db = getDb();
  const rows = db
    .prepare(`SELECT * FROM entities WHERE user_id = ? AND key IN (${placeholders})`)
    .all(userId, ...keys) as unknown as EntityRow[];
  return rows.map(mapRowToEntity);
}

export function updateEntityDays(id: string, days: number): void {
  const db = getDb();
  const now = Date.now();
  db.prepare("UPDATE entities SET remaining_days = ?, last_decay_at = ? WHERE id = ?").run(days, now, id);
}

export function updateEntityDaysAndNegFeedback(id: string, days: number, negCount: number): void {
  const db = getDb();
  const now = Date.now();
  db.prepare("UPDATE entities SET remaining_days = ?, negative_feedback_count = ?, last_decay_at = ? WHERE id = ?")
    .run(days, negCount, now, id);
}

export function refreshEntityOnAccess(id: string): ExtractedEntity | null {
  const entity = getEntity(id);
  if (!entity) {
    return null;
  }

  const db = getDb();
  const now = Date.now();
  db.prepare("UPDATE entities SET last_accessed = ?, access_count = access_count + 1 WHERE id = ?")
    .run(now, id);

  return {
    ...entity,
    lastAccessed: now,
    accessCount: entity.accessCount + 1,
  };
}

export function deleteEntity(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM entities WHERE id = ?").run(id);
}

export function deleteWeakEntities(userId: string): number {
  const db = getDb();
  const result = db.prepare("DELETE FROM entities WHERE user_id = ? AND remaining_days < 7 AND is_permanent = 0")
    .run(userId);

  return Number(result.changes);
}

export function searchEntities(userId: string, query: string): ExtractedEntity[] {
  const entities = getEntitiesByUser(userId);
  const lowerQuery = query.toLowerCase();

  return entities.filter(
    (e) =>
      e.key.toLowerCase().includes(lowerQuery) ||
      e.value.toLowerCase().includes(lowerQuery) ||
      e.category.toLowerCase().includes(lowerQuery)
  );
}

export function getOrCreateEntity(
  userId: string,
  category: EntityCategory,
  key: string,
  value: string,
  sourceMessage: string
): ExtractedEntity {
  const existing = getEntityByKey(userId, key);

  if (existing) {
    refreshEntityOnAccess(existing.id);
    return existing;
  }

  return createEntity(userId, category, key, value, sourceMessage);
}

export function getOrUpdateEntity(
  userId: string,
  category: EntityCategory,
  key: string,
  value: string,
  sourceMessage: string
): ExtractedEntity {
  const existing = getEntityByKey(userId, key);
  const infoType = CATEGORY_TO_INFO_TYPE[category] || "temporary";
  const initialDays = INITIAL_DAYS[infoType];

  if (existing) {
    const db = getDb();
    const now = Date.now();

    db.prepare(`
      UPDATE entities 
      SET value = ?, source_message = ?, remaining_days = ?, last_accessed = ?, info_type = ?
      WHERE id = ?
    `).run(value, sourceMessage, initialDays, now, infoType, existing.id);

    return {
      ...existing,
      value,
      sourceMessage,
      remainingDays: initialDays,
      lastAccessed: now,
      infoType,
    };
  }

  return createEntity(userId, category, key, value, sourceMessage);
}

interface EntityRow {
  id: string;
  user_id: string;
  category: string;
  info_type: string;
  key: string;
  value: string;
  source_message: string;
  remaining_days: number;
  is_permanent: number;
  negative_feedback_count: number;
  access_count: number;
  created_at: number;
  last_accessed: number;
  last_decay_at: number;
}

function mapRowToEntity(row: EntityRow): ExtractedEntity {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category as EntityCategory,
    infoType: row.info_type as InfoType,
    key: row.key,
    value: row.value,
    sourceMessage: row.source_message,
    remainingDays: row.remaining_days,
    isPermanent: row.is_permanent === 1,
    negativeFeedbackCount: row.negative_feedback_count,
    accessCount: row.access_count,
    createdAt: row.created_at,
    lastAccessed: row.last_accessed,
    lastDecayAt: row.last_decay_at,
  };
}

export function strengthenEntity(id: string): ExtractedEntity | null {
  const entity = getEntity(id);
  if (!entity || entity.isPermanent) {
    return entity;
  }

  const tierDiff = getPreviousTierDiff(entity.remainingDays, false);
  const newDays = Math.min(60, entity.remainingDays + tierDiff);
  
  updateEntityDays(id, newDays);
  refreshEntityOnAccess(id);
  
  return getEntity(id);
}

export function decayEntity(id: string): ExtractedEntity | null {
  const entity = getEntity(id);
  if (!entity || entity.isPermanent) {
    return entity;
  }

  const now = Date.now();
  const hoursSinceLastDecay = (now - entity.lastDecayAt) / (1000 * 60 * 60);

  if (hoursSinceLastDecay >= 24) {
    if (entity.remainingDays > 0) {
      const newDays = entity.remainingDays - 1;
      
      if (newDays <= 0) {
        deleteEntity(id);
        return null;
      }
      
      updateEntityDays(id, newDays);
      return getEntity(id);
    }
  }
  
  return entity;
}

export function applyNegativeFeedback(id: string): ExtractedEntity | null {
  const entity = getEntity(id);
  if (!entity || entity.isPermanent) {
    return entity;
  }

  let newDays = Math.floor(entity.remainingDays / 2);
  
  const currentTier = getTier(entity.remainingDays, false);
  const newTier = Math.min(6, currentTier + 2);
  const tierMins = [60, 60, 40, 25, 15, 7, 0];
  newDays = Math.min(newDays, tierMins[newTier] - 1);
  
  const newNegCount = Math.min(2, entity.negativeFeedbackCount + 1);
  
  if (newNegCount >= 2) {
    newDays = Math.min(newDays, 6);
  }
  
  updateEntityDaysAndNegFeedback(id, newDays, newNegCount);
  return getEntity(id);
}

export function setPermanent(id: string): void {
  const db = getDb();
  db.prepare("UPDATE entities SET is_permanent = 1 WHERE id = ?").run(id);
}

export function removePermanent(id: string, infoType: InfoType): void {
  const initialDays = INITIAL_DAYS[infoType] || 60;
  const db = getDb();
  db.prepare(`
    UPDATE entities 
    SET is_permanent = 0, remaining_days = ?
    WHERE id = ?
  `).run(initialDays, id);
}

export function updateEntityValue(id: string, newValue: string, sourceMessage: string): ExtractedEntity | null {
  const entity = getEntity(id);
  if (!entity) {
    return null;
  }

  const db = getDb();
  const now = Date.now();
  db.prepare("UPDATE entities SET value = ?, source_message = ?, last_accessed = ? WHERE id = ?")
    .run(newValue, sourceMessage, now, id);

  return getEntity(id);
}

export function getPreference(category: string): { category: string; score: number; totalExtracted: number; totalQueried: number; lastQueried?: number; lastExtracted?: number } | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM extraction_preferences WHERE category = ?").get(category) as PreferenceRow | undefined;

  if (!row) {
    return null;
  }

  return {
    category: row.category,
    score: row.score,
    totalExtracted: row.total_extracted,
    totalQueried: row.total_queried,
    lastQueried: row.last_queried ?? undefined,
    lastExtracted: row.last_extracted ?? undefined,
  };
}

export function getAllPreferences(): { category: string; score: number; totalExtracted: number; totalQueried: number; lastQueried?: number; lastExtracted?: number }[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM extraction_preferences").all() as unknown as PreferenceRow[];
  return rows.map((row) => ({
    category: row.category,
    score: row.score,
    totalExtracted: row.total_extracted,
    totalQueried: row.total_queried,
    lastQueried: row.last_queried ?? undefined,
    lastExtracted: row.last_extracted ?? undefined,
  }));
}

export function updatePreference(category: string, updates: { score?: number; totalExtracted?: number; totalQueried?: number; lastQueried?: number; lastExtracted?: number }): void {
  const db = getDb();

  const existing = getPreference(category);

  if (!existing) {
    db.prepare(`
      INSERT INTO extraction_preferences (category, score, total_extracted, total_queried, last_queried, last_extracted)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      category,
      updates.score ?? 0.5,
      updates.totalExtracted ?? 0,
      updates.totalQueried ?? 0,
      updates.lastQueried ?? null,
      updates.lastExtracted ?? null
    );
    return;
  }

  const newScore = updates.score ?? existing.score;
  const newTotalExtracted = updates.totalExtracted ?? existing.totalExtracted;
  const newTotalQueried = updates.totalQueried ?? existing.totalQueried;
  const newLastQueried = updates.lastQueried ?? existing.lastQueried;
  const newLastExtracted = updates.lastExtracted ?? existing.lastExtracted;

  db.prepare(`
    UPDATE extraction_preferences
    SET score = ?, total_extracted = ?, total_queried = ?, last_queried = ?, last_extracted = ?
    WHERE category = ?
  `).run(newScore, newTotalExtracted, newTotalQueried, newLastQueried ?? null, newLastExtracted ?? null, category);
}

interface PreferenceRow {
  category: string;
  score: number;
  total_extracted: number;
  total_queried: number;
  last_queried: number | null;
  last_extracted: number | null;
}

export function compareByPriority(a: ExtractedEntity, b: ExtractedEntity): number {
  if (a.isPermanent !== b.isPermanent) {
    return a.isPermanent ? -1 : 1;
  }
  
  if (a.isPermanent) {
    const typeOrder: Record<InfoType, number> = { core: 0, preference: 1, temporary: 2 };
    return typeOrder[a.infoType] - typeOrder[b.infoType];
  }
  
  return b.remainingDays - a.remainingDays;
}

export function shouldUseMemory(entity: ExtractedEntity, isUserInitiated: boolean): boolean {
  if (entity.isPermanent) { return true; }
  if (isWeakMemory(entity.remainingDays, false)) {
    return isUserInitiated;
  }
  return true;
}
