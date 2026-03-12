import * as entityStorage from "./storage.js";

export function processHourlyDecay(userId: string): number {
  const entities = entityStorage.getEntitiesByUser(userId);
  let decayedCount = 0;
  
  for (const entity of entities) {
    const result = entityStorage.decayEntity(entity.id);
    if (result === null || (result && result.remainingDays <= 0)) {
      decayedCount++;
    }
  }
  
  return decayedCount;
}

export function processDecayOnAccess(userId: string): number {
  const entities = entityStorage.getEntitiesByUser(userId);
  let decayedCount = 0;
  
  for (const entity of entities) {
    if (entity.isPermanent) { continue; }
    
    const result = entityStorage.decayEntity(entity.id);
    if (result === null) {
      decayedCount++;
    }
  }
  
  return decayedCount;
}

export function refreshOnQuery(userId: string, query: string): void {
  const entities = entityStorage.searchEntities(userId, query);

  for (const entity of entities) {
    if (entity.isPermanent) { continue; }
    entityStorage.strengthenEntity(entity.id);
  }
}

export function decayAllIfNeeded(userId: string): number {
  return processDecayOnAccess(userId);
}
