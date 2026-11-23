import type { DeviceId, FamilyTreeId } from "../shared/ids";
import type { HlcTimestamp } from "../shared/hlc";

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

/** Identifies one remote file and the version we last saw (GitHub blob SHA). */
export interface RemoteFileRef {
  readonly path: string;
  readonly sha: string;
}

/**
 * Local bookkeeping for one tree on one device. Persisted in IndexedDB, never synced.
 */
export interface TreeSyncState {
  readonly treeId: FamilyTreeId;
  readonly deviceId: DeviceId;
  /** Highest seq this device has written. The next operation uses localSeq + 1. */
  readonly localSeq: number;
  /** Highest seq already applied, per author device (keys are DeviceId strings). */
  readonly appliedSeqByDevice: Readonly<Record<string, number>>;
  /** Last seen SHA per remote file, for optimistic-locking writes and cheap change checks. */
  readonly remoteFiles: Readonly<Record<string, RemoteFileRef>>;
  /** Latest clock this device has issued or observed (HLC state). */
  readonly lastHlc: HlcTimestamp;
  /** ISO-8601 instant of the last successful sync, or null if never synced. */
  readonly lastSyncedAt: string | null;
  readonly status: SyncStatus;
}

/**
 * Describes a compacted snapshot that replaces old log entries.
 * Logs may only be truncated once every known device has applied past `coversUpTo`.
 */
export interface SnapshotMeta {
  readonly treeId: FamilyTreeId;
  readonly createdByDevice: DeviceId;
  readonly createdAt: HlcTimestamp;
  /** Per-device seq included in the snapshot. Operations at or below it are redundant. */
  readonly coversUpTo: Readonly<Record<string, number>>;
  readonly keyVersion: number;
}

/** A device registered to sync a tree (shown in settings, used for compaction safety). */
export interface DeviceInfo {
  readonly deviceId: DeviceId;
  readonly label: string;
  readonly registeredAt: string;
}
