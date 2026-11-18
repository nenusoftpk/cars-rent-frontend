
/** Durable, tenant-scoped offline mutation queue. Compatible with db.js v1. */
import { db, createLocalId, isLocalId, OUTBOX_STATUS, OUTBOX_ACTIONS, OUTBOX_ENTITIES } from './db';

export const ENTITY_TABLE = Object.freeze({ car:'cars', booking:'bookings', customer:'customers', driver:'drivers', payment:'payments', expense:'expenses', inspection:'inspections', settings:'settings' });
const now = () => new Date().toISOString();
const same = (a,b) => String(a) === String(b);
const tableFor = (entity) => {
  const name = ENTITY_TABLE[entity];
  if (!name) throw new Error(`Unsupported offline entity: ${entity}`);
  return db.table(name);
};
const validate = (entity, action, businessId) => {
  tableFor(entity);
  if (!Object.values(OUTBOX_ACTIONS).includes(action)) throw new Error(`Unsupported offline action: ${action}`);
  if (!businessId) throw new Error('businessId is required');
};
const newItem = ({entity,action,businessId,localId=null,serverId=null,payload={}}) => ({
  entity, action, status:OUTBOX_STATUS.PENDING, businessId:String(businessId), localId,
  serverId, payload, createdAt:now(), updatedAt:now(), attempts:0, lastError:null,
});

export async function addToOutbox({entity,action,businessId,localId=null,serverId=null,payload={}}) {
  validate(entity,action,businessId);
  if (!localId && !serverId && action !== OUTBOX_ACTIONS.CREATE) throw new Error('Update/delete needs a record ID');
  const id = localId || (action === OUTBOX_ACTIONS.CREATE ? createLocalId('local') : null);
  return db.outbox.add(newItem({entity,action,businessId,localId:id,serverId,payload}));
}
export async function getPendingItems(businessId=null) {
  const items = await db.outbox.where('status').anyOf([OUTBOX_STATUS.PENDING,OUTBOX_STATUS.FAILED]).toArray();
  return items.filter(x => !businessId || same(x.businessId,businessId)).sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id-b.id);
}
export async function getPendingCount(businessId=null) {
  return (await getPendingItems(businessId)).length;
}
export const getOutboxItem = (id) => db.outbox.get(id);
export const markSyncing = (id) => db.outbox.update(id,{status:OUTBOX_STATUS.SYNCING,updatedAt:now()});
export const markSynced = (id,serverId=null) => db.outbox.update(id,{status:OUTBOX_STATUS.SYNCED,...(serverId ? {serverId:String(serverId)} : {}),updatedAt:now(),lastError:null});
export async function markFailed(id,errorMessage='') {
  return db.transaction('rw',db.outbox,async()=>{
    const item=await db.outbox.get(id);
    if (!item) return 0;
    return db.outbox.update(id,{status:OUTBOX_STATUS.FAILED,attempts:(item.attempts||0)+1,lastError:String(errorMessage).slice(0,500),updatedAt:now()});
  });
}
export const retryItem = (id) => db.outbox.update(id,{status:OUTBOX_STATUS.PENDING,attempts:0,lastError:null,updatedAt:now()});
export const clearSyncedItems = () => db.outbox.where('status').equals(OUTBOX_STATUS.SYNCED).delete();
/** Dangerous: only call after confirming no unsynced changes are needed. */
export const clearAllOutbox = () => db.outbox.clear();
/** Reset interrupted sends. The server may already have committed them; idempotent server operations are required. */
export async function recoverInterruptedItems(businessId) {
  if (!businessId) throw new Error('businessId is required');
  return db.transaction('rw',db.outbox,async()=>{
    const items=await db.outbox.where('status').equals(OUTBOX_STATUS.SYNCING).toArray();
    for(const item of items) if(same(item.businessId,businessId)) {
      await db.outbox.update(item.id,{status:OUTBOX_STATUS.FAILED,lastError:'Previous sync interrupted; verify server outcome before retrying non-idempotent operations.',updatedAt:now()});
    }
  });
}
function ensureOwned(record,businessId) {
  if (!record || !same(record.businessId,businessId)) throw new Error('Record not found for this business');
}
function cleanChanges(changes) {
  const result={...changes};
  for(const key of ['id','_id','businessId','createdAt','_isLocal','_deleted']) delete result[key];
  return result;
}
/** Record + outbox are committed together, never separately. */
export async function createOffline(entity,businessId,data={}) {
  validate(entity,OUTBOX_ACTIONS.CREATE,businessId);
  if(entity==='payment' && !data.idempotencyKey) throw new Error('Offline payment requires a stable idempotencyKey');
  const table=tableFor(entity), localId=createLocalId('local'), stamp=now();
  const record={...data,id:localId,businessId:String(businessId),createdAt:data.createdAt||stamp,updatedAt:stamp,_isLocal:true};
  await db.transaction('rw',table,db.outbox,async()=>{
    await table.put(record);
    await db.outbox.add(newItem({entity,action:OUTBOX_ACTIONS.CREATE,businessId,localId,payload:{...data}}));
  });
  return record;
}
export async function updateOffline(entity,businessId,id,changes={}) {
  validate(entity,OUTBOX_ACTIONS.UPDATE,businessId);
  if(entity==='payment'||entity==='inspection') throw new Error(`${entity} updates are not supported by this offline queue`);
  const table=tableFor(entity);
  return db.transaction('rw',table,db.outbox,async()=>{
    const existing=await table.get(id); ensureOwned(existing,businessId);
    if(existing._deleted) throw new Error('Cannot update a deleted record');
    const delta=cleanChanges(changes);
    const updated={...existing,...delta,updatedAt:now()};
    await table.put(updated);
    // Combine edits into a not-yet-sent create when possible.
    const entries=(await db.outbox.where('businessId').equals(String(businessId)).toArray())
      .filter(x=>x.entity===entity && x.localId===id && x.action===OUTBOX_ACTIONS.CREATE && x.status===OUTBOX_STATUS.PENDING);
    if(isLocalId(id) && entries.length) {
      const item=entries[entries.length-1];
      await db.outbox.update(item.id,{payload:{...item.payload,...delta},updatedAt:now()});
    } else {
      await db.outbox.add(newItem({entity,action:OUTBOX_ACTIONS.UPDATE,businessId,localId:isLocalId(id)?id:null,serverId:isLocalId(id)?null:id,payload:delta}));
    }
    return updated;
  });
}
export async function deleteOffline(entity,businessId,id) {
  validate(entity,OUTBOX_ACTIONS.DELETE,businessId);
  if(['payment','inspection','settings'].includes(entity)) throw new Error(`Offline delete is not supported for ${entity}`);
  const table=tableFor(entity);
  return db.transaction('rw',table,db.outbox,async()=>{
    const existing=await table.get(id);
    if(!existing) return false;
    ensureOwned(existing,businessId);
    if(existing._deleted) return true;
    const entries=(await db.outbox.where('businessId').equals(String(businessId)).toArray())
      .filter(x=>x.entity===entity && (x.localId===id || x.serverId===id) && x.status!==OUTBOX_STATUS.SYNCED);
    // A never-sent create can be discarded only if it has not started syncing.
    if(isLocalId(id) && entries.some(x=>x.action===OUTBOX_ACTIONS.CREATE && x.status===OUTBOX_STATUS.PENDING) && entries.every(x=>x.status===OUTBOX_STATUS.PENDING)) {
      await db.outbox.bulkDelete(entries.map(x=>x.id));
      await table.delete(id);
      return true;
    }
    // Keep tombstone to stop pull from restoring a pending delete.
    await table.put({...existing,_deleted:true,updatedAt:now()});
    await db.outbox.add(newItem({entity,action:OUTBOX_ACTIONS.DELETE,businessId,localId:isLocalId(id)?id:null,serverId:isLocalId(id)?null:id,payload:{id}}));
    return true;
  });
}
