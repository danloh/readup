//  Upload, list, and manage files on AT Protocol PDS

import { Agent, AtpAgent, BlobRef, XRPCError } from "@atproto/api";
import { Book, BookConfig } from "@/types/book";
import { ProgressHandler, webDownload } from "@/utils/transfer";
import { mergeBookConfig } from "@/utils/merge";
import type { AtBook, AtData } from "./types";
import { getAgent, resolveDid } from "./auth";

// Create record according to lexicon
const RBOOK_COLLECTION = "cc.readup.rbook";
const RDATA_COLLECTION = "cc.readup.rdata";
const LIST_PAGE_SIZE = 100;

export interface BlobResp {
  blob: BlobRef;
}

/**
 * Result returned after successfully uploading a book
 */
export interface UploadBookResult {
  success: boolean;
  /** The uploaded blob reference */
  coverblob: unknown; // book's cover image
  bookblob: unknown;  // book document
  config: unknown;    // book config including setting, reading process, notes...
  /** The created record information */
  record: {
    /** The AT URI of the created record */
    uri: string;
    /** The CID (Content Identifier) of the record */
    cid: string;
  };
}

// ==========================================================================
// Helpers

/**
 * Extract the CID of a blob reference. Handles `BlobRef` instances (CID
 * object in `ref`), their JSON form (`{ ref: { $link } }`) and the legacy
 * `{ cid }` shape.
 */
export function getBlobCid(blob: unknown): string | undefined {
  if (!blob || typeof blob !== "object") return undefined;
  const b = blob as { ref?: unknown; cid?: unknown };
  const ref = b.ref;
  if (ref && typeof ref === "object") {
    if ("$link" in ref && typeof (ref as { $link: unknown }).$link === "string") {
      return (ref as { $link: string }).$link;
    }
    const str = String(ref);
    return str && str !== "[object Object]" ? str : undefined;
  }
  if (typeof ref === "string") return ref;
  if (typeof b.cid === "string") return b.cid;
  return undefined;
}

/** Public, unauthenticated blob URL on the owner's PDS. */
export function getBlobUrl(pds: string, did: string, cid: string): string {
  return `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}

async function downloadBlob(
  pds: string,
  did: string,
  blob: unknown,
  onProgress?: ProgressHandler,
): Promise<Blob | undefined> {
  const cid = getBlobCid(blob);
  if (!cid) return undefined;
  return (await webDownload(getBlobUrl(pds, did, cid), onProgress)).blob;
}

function isRecordNotFound(error: unknown): boolean {
  if (error instanceof XRPCError) {
    return error.error === "RecordNotFound" || error.status === 404 ||
      /could not locate record/i.test(error.message);
  }
  return error instanceof Error && /not found|could not locate record/i.test(error.message);
}

/** Get a record from the user's repo, or `undefined` if it doesn't exist. */
async function getOwnRecord<T>(
  agent: Agent,
  collection: string,
  rkey: string,
): Promise<{ value: T; cid?: string } | undefined> {
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo: agent.assertDid,
      collection,
      rkey,
    });
    return { value: res.data.value as T, cid: res.data.cid };
  } catch (error) {
    if (isRecordNotFound(error)) return undefined;
    throw error;
  }
}

/**
 * Upload a file to AT Protocol PDS
 */
export async function uploadFile(file: Blob, agent: Agent): Promise<BlobRef> {
  const data = new Uint8Array(await file.arrayBuffer());
  const mimeType = file.type || "application/octet-stream";
  const uploadRes = await agent.com.atproto.repo.uploadBlob(data, { encoding: mimeType });
  const blob = uploadRes.data?.blob;
  if (!blob) {
    throw new Error("Upload failed: no blob returned");
  }
  return blob;
}

function xhrUpload(
  url: string,
  body: Blob,
  accessJwt: string,
  onProgress?: ProgressHandler,
): Promise<{ status: number; text: string }> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${accessJwt}`);
    xhr.setRequestHeader("Content-Type", body.type);
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress({
          progress: event.loaded,
          total: event.total,
          transferSpeed: event.loaded / Math.max((Date.now() - startTime) / 1000, 0.001),
        });
      }
    };
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.send(body);
  });
}

/**
 * Upload a blob, reporting progress.
 *
 * App-password sessions upload through XHR straight to the PDS so progress
 * can be reported, refreshing the token once on `ExpiredToken`. OAuth
 * sessions need a DPoP proof per request, so they go through the agent and
 * report completion only.
 */
export async function uploadBlobWithProgress(
  file: Blob,
  agent: Agent,
  onProgress?: ProgressHandler,
): Promise<BlobRef> {
  // Tauri's NativeFile/RemoteFile don't work with xhr.send() directly
  const mimeType = file.type || "application/octet-stream";
  const body = new Blob([await file.arrayBuffer()], { type: mimeType });

  if (!(agent instanceof AtpAgent) || !agent.session) {
    const blob = await uploadFile(body, agent);
    onProgress?.({ progress: body.size, total: body.size, transferSpeed: 0 });
    return blob;
  }

  const pds = (agent.pdsUrl ?? agent.serviceUrl).toString().replace(/\/+$/, "");
  const url = `${pds}/xrpc/com.atproto.repo.uploadBlob`;
  let res = await xhrUpload(url, body, agent.session.accessJwt, onProgress);
  if (res.status === 400 || res.status === 401) {
    const err = (() => { try { return JSON.parse(res.text).error; } catch { return undefined; } })();
    if (err === "ExpiredToken" || res.status === 401) {
      await agent.sessionManager.refreshSession();
      if (!agent.session) throw new Error("Session expired, please sign in again");
      res = await xhrUpload(url, body, agent.session.accessJwt, onProgress);
    }
  }
  if (res.status < 200 || res.status >= 300) {
    let detail = "";
    try { const j = JSON.parse(res.text); detail = j.message || j.error || ""; } catch { /* empty */ }
    throw new Error(`Upload failed with status ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const blob = (JSON.parse(res.text) as BlobResp).blob;
  if (!blob) {
    throw new Error(`Upload failed: no blob returned. ${res.status}`);
  }
  return blob;
}

// ==========================================================================
// Books

/**
 * Upload book and cover file to PDS and create (or update) a book record.
 *
 * Blobs that are not re-uploaded this time (cover, document, config) are
 * carried over from the existing record so a partial sync never drops them.
 */
export async function uploadBookFile(
  book: Book,
  bookFile?: File,
  coverFile?: File,
  configFile?: File,
  onProgress?: ProgressHandler,
  onlyConfig?: boolean,
): Promise<UploadBookResult> {
  const agent = await getAgent();
  const did = agent.assertDid;

  const existing = await getOwnRecord<AtBook.RBook>(agent, RBOOK_COLLECTION, book.hash);
  const pdsRecord = existing?.value;

  const coverBlob = coverFile && !onlyConfig
    ? await uploadBlobWithProgress(coverFile, agent, onProgress)
    : undefined;

  const bookBlob = bookFile && !onlyConfig
    ? await uploadBlobWithProgress(bookFile, agent, onProgress)
    : undefined;

  // merge config in PDS and local: 1- get from pds; 2- merge; 3- re-upload
  let configBlob: BlobRef | undefined = undefined;
  if (configFile) {
    let cfgFile: Blob = configFile;
    const pdsCfgData = pdsRecord?.config
      ? await downloadBlob(await resolveDid(did), did, pdsRecord.config, onProgress)
      : undefined;
    if (pdsCfgData) {
      const newCfgJson = JSON.parse(await configFile.text()) as BookConfig;
      const pdsCfgJson = JSON.parse(await pdsCfgData.text()) as BookConfig;
      const mergedCfg = mergeBookConfig(newCfgJson, pdsCfgJson).config;
      cfgFile = new File([JSON.stringify(mergedCfg, null, 2)], "config.json", {
        type: "application/json",
      });
    }
    configBlob = await uploadBlobWithProgress(
      new Blob([await cfgFile.arrayBuffer()], { type: "application/json" }),
      agent,
      onProgress,
    );
  }

  const bookmeta: AtBook.MetaData = {
    $type: "cc.readup.rbook#metadata",
    hash: book.hash,
    format: book.format,
    title: book.title,
    sourceTitle: book.sourceTitle,
    author: book.author,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    fileSize: book.fileSize ?? pdsRecord?.bookmeta?.fileSize, // file size in bytes
    primaryLanguage: book.primaryLanguage,
    metadata: book.metadata,
    metaHash: book.metaHash,
    progress: book.progress,
  };

  const recordData: AtBook.RBook = {
    $type: RBOOK_COLLECTION,
    name: book.title,
    bookmeta,
    coverblob: coverBlob ?? pdsRecord?.coverblob,
    docblob: bookBlob ?? pdsRecord?.docblob,
    config: configBlob ?? pdsRecord?.config,
    checksum: book.hash,
    createdAt: pdsRecord?.createdAt ?? new Date().toISOString(),
  };

  const putRes = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: RBOOK_COLLECTION,
    rkey: book.hash,
    record: recordData,
  });

  return {
    success: putRes.success,
    coverblob: coverBlob,
    bookblob: bookBlob,
    config: configBlob,
    record: putRes.data,
  };
}


/**
 * Result returned after successfully download a book
 */
export interface DownloadBookResult {
  rkey: string;
  coverData?: Blob;
  docData?: Blob;
  configData?: Blob;
  record: AtBook.RBook;
}

/**
 * Download the blobs (cover, doc, config) of one of the user's book records
 *
 * @param rkey - usually, it is book hash
 * @throws {Error} If authentication fails, record is not found, or download fails
 */
export async function downloadBookFile(
  rkey: string,
  needCover: boolean,
  needDoc: boolean,
  needConfig: boolean,
  onProgress?: ProgressHandler,
): Promise<DownloadBookResult> {
  const agent = await getAgent();
  const did = agent.assertDid;
  const pds = await resolveDid(did);

  const found = await getOwnRecord<AtBook.RBook>(agent, RBOOK_COLLECTION, rkey);
  if (!found) {
    throw new Error(`Record not found: ${rkey}`);
  }
  const record = found.value;

  const coverData = needCover
    ? await downloadBlob(pds, did, record.coverblob, onProgress)
    : undefined;
  const docData = needDoc
    ? await downloadBlob(pds, did, record.docblob, onProgress)
    : undefined;
  const configData = needConfig
    ? await downloadBlob(pds, did, record.config, onProgress)
    : undefined;

  return { rkey, coverData, docData, configData, record };
}

/**
 * Download a (shared) book from anyone's repo. No authentication needed.
 */
export async function downloadPdsBook(
  rkey: string,
  did: string,
  onProgress?: ProgressHandler,
): Promise<DownloadBookResult> {
  if (!did || !rkey) {
    throw new Error("No DID or rkey provided");
  }

  const pds = await resolveDid(did);
  const record = await getBookRecord(rkey, did);

  const coverData = await downloadBlob(pds, did, record.coverblob, onProgress);
  const docData = await downloadBlob(pds, did, record.docblob, onProgress);

  return { rkey, coverData, docData, record };
}

/**
 * item of the list record
 */
export interface RbookRecordItem {
  uri: string;  // at-uri
  cid: string;
  value: AtBook.RBook;
}

/**
 * List all rbook records for the authenticated user (follows the cursor).
 *
 * @param limit - Maximum number of records to retrieve. Defaults to all
 * @throws {Error} If authentication fails or the PDS is unreachable
 */
export async function listBookRecords(limit = Infinity): Promise<RbookRecordItem[]> {
  const agent = await getAgent();
  const repo = agent.assertDid;

  const records: RbookRecordItem[] = [];
  let cursor: string | undefined = undefined;
  do {
    const response = await agent.com.atproto.repo.listRecords({
      repo,
      collection: RBOOK_COLLECTION,
      limit: Math.min(LIST_PAGE_SIZE, limit - records.length),
      cursor,
    });
    records.push(...(response.data.records as RbookRecordItem[]));
    // stop on an empty page too, in case a PDS keeps returning a cursor
    cursor = response.data.records.length > 0 ? response.data.cursor : undefined;
  } while (cursor && records.length < limit);

  return records;
}

/**
 * Get an atproto record without authentication
 *
 * @param rkey - The record key
 * @param did - The DID of the record owner
 * @throws {Error} If the record is not found or retrieval fails
 */
export async function getBookRecord(rkey: string, did: string): Promise<AtBook.RBook> {
  const agent = new Agent({ service: await resolveDid(did) });
  try {
    const recordResponse = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: RBOOK_COLLECTION,
      rkey,
    });
    return recordResponse.data.value as AtBook.RBook;
  } catch (error) {
    if (isRecordNotFound(error)) {
      throw new Error(`Record not found: ${rkey} in repository ${did}`);
    }
    throw error;
  }
}

/**
 * Delete a record. Blobs it referenced are garbage-collected by the PDS once
 * no record points at them. Deleting a missing record is a no-op.
 *
 * @throws {Error} If authentication or deletion fails
 */
export async function deleteRecord(rkey: string, col = RBOOK_COLLECTION): Promise<void> {
  const agent = await getAgent();
  await agent.com.atproto.repo.deleteRecord({
    repo: agent.assertDid,
    collection: col,
    rkey,
  });
}

// ==========================================================================================
// ========= Data ===========================================================================
// ==========================================================================================

/**
 * Upload a file and create an AtData record that references the uploaded blob
 * The created record will include `docblob` pointing to the uploaded blob.
 */
export async function uploadDataFile(
  name: string,
  file: File | undefined,
  collection = RDATA_COLLECTION,
  onProgress?: ProgressHandler,
): Promise<{
  success: boolean;
  blob?: BlobRef;
  record?: { uri: string; cid: string }
}> {
  if (!file) {
    throw new Error("no file");
  }
  const agent = await getAgent();
  const blob = await uploadBlobWithProgress(file, agent, onProgress);

  const recordData: AtData.RData = {
    $type: collection as AtData.RData["$type"],
    name,
    updatedAt: new Date().toISOString(),
    docblob: blob,
  };

  const putRes = await agent.com.atproto.repo.putRecord({
    repo: agent.assertDid,
    collection,
    rkey: name,
    record: recordData,
  });

  return {
    success: putRes.success,
    blob,
    record: putRes.data,
  };
}

/**
 * Result returned after successfully download a book
 */
export interface DownloadDataResult {
  rkey: string;
  docData?: Blob;
  record: AtData.RData;
}

/**
 * Download the `docblob` from a generic AtData record for the authenticated user
 */
export async function downloadDataFile(
  rkey: string,
  collection = RDATA_COLLECTION,
  onProgress?: ProgressHandler,
): Promise<DownloadDataResult> {
  const agent = await getAgent();
  const did = agent.assertDid;

  const found = await getOwnRecord<AtData.RData>(agent, collection, rkey);
  if (!found) {
    throw new Error(`Record not found: ${rkey}`);
  }
  const record = found.value;
  const docData = await downloadBlob(await resolveDid(did), did, record.docblob, onProgress);

  return { rkey, docData, record };
}
