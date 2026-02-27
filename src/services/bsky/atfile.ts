//  Upload, list, and manage files on AT Protocol PDS

import { AtpAgent, AtpSessionData, BlobRef } from "@atproto/api";
import type { AtBook, AtData } from "./types";
import { refreshSession, resolveDid, User } from "./auth";
import { Book } from "@/types/book";
import { ProgressHandler, webDownload } from "@/utils/transfer";

// Create record according to lexicon
const RBOOK_COLLECTION = "cc.readup.rbook";
const RDATA_COLLECTION = "cc.readup.rdata";

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

/**
 * Upload a file to AT Protocol PDS
 *
 * @returns A promise that resolves to the upload result containing blob and record info or null
 *
 */
export async function uploadFile(file: File, agent: AtpAgent): Promise<BlobRef| undefined> {
  // const data = await file.bytes(); // limited availability
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const mimeType = file.type || "application/octet-stream";

  // Upload blob
  console.log(`⬆ Uploading ${file.name} (${data.length} bytes, ${mimeType})...`);
  const uploadRes = await agent.uploadBlob(data, { encoding: mimeType });
  const blob = uploadRes.data?.blob;

  const blobCid = blob.ref?.["$link"] ?? blob.ref;
  console.log(`✓ Blob uploaded: ${blobCid}`);
  console.log("Blob structure:", JSON.stringify(blob, null, 2));

  if (!blob) {
    console.error("Upload failed: no blob returned");
    return undefined;
  }

  return blob;
}

export async function xhrUploadFile(
  file: File, 
  usr: User,
  onProgress?: ProgressHandler,
): Promise<BlobRef | undefined> {
  const startTime = Date.now();
  const mimeType = file.type || "application/octet-stream";
  // Upload url
  const pdsUrl = `${usr.service}/xrpc/com.atproto.repo.uploadBlob`;

  return new Promise(async (resolve, reject) => {
    try {
      // Convert file to ArrayBuffer to ensure compatibility with Tauri and web platforms
      // This is necessary because Tauri's NativeFile/RemoteFile implementations
      // don't work properly with xhr.send() directly
      const arrayBuffer = await file.arrayBuffer();
      const fileblob = new Blob([arrayBuffer], { type: mimeType });

      const xhr = new XMLHttpRequest();
      xhr.open('POST', pdsUrl, true);

      // Set necessary headers
      xhr.setRequestHeader('Authorization', 'Bearer ' + usr.accessJwt);
      xhr.setRequestHeader('Content-Type', mimeType); 

      xhr.upload.onprogress = (event) => {
        if (onProgress && event.lengthComputable) {
          onProgress({
            progress: event.loaded,
            total: event.total,
            transferSpeed: event.loaded / ((Date.now() - startTime) / 1000),
          });
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log("xhr upload resp: ", JSON.stringify(xhr.response, null, 2));
          const resp: BlobResp = JSON.parse(xhr.responseText); 
          const blob = resp.blob;
          const blobCid = blob.ref?.["$link"] ?? blob.ref;
          console.log(`✓ Blob uploaded: ${blobCid}`);
          console.log("Blob structure:", JSON.stringify(blob, null, 2));

          if (!blob) {
            console.error("Upload failed: no blob returned");
            reject(new Error(`Upload failed: no blob returned. ${xhr.status}`));
          }

          resolve(blob);
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Upload failed'));

      xhr.send(fileblob);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Upload book and cover file to PDS and create a book record
 * @returns A promise that resolves to result containing blobs, record and if success
 */
export async function uploadBookFile(
  book: Book,
  bookFile?: File,
  coverFile?: File,
  configFile?: File,
  onProgress?: ProgressHandler,
): Promise<UploadBookResult> {
  const usr = await refreshSession();
  // Initialize agent
  const agent = new AtpAgent({ service: `https://${usr.host}` });
  await agent.resumeSession(usr as AtpSessionData);
  
  console.log("Agent: ", agent);
  // upload cover
  // const coverBlob = coverFile ? await uploadFile(coverFile, agent) : undefined;
  const coverBlob = coverFile ? await xhrUploadFile(coverFile, usr, onProgress) : undefined;

  // upload book doc
  // const bookBlob = bookFile ? await uploadFile(bookFile, agent) : undefined;
  const bookBlob = bookFile ? await xhrUploadFile(bookFile, usr, onProgress) : undefined;

  // upload book config
  const configBlob = configFile ? await xhrUploadFile(configFile, usr, onProgress) : undefined;

  // Get DID
  const did = agent.session?.did;
  if (!did) {
    throw new Error("Could not determine DID from session");
  }

  // Build the record with proper typing
  // The blob from uploadBlob already has the correct structure
  const bookmeta: AtBook.MetaData = {
    $type: "cc.readup.rbook#metadata",
    hash: book.hash,
    format: book.format,
    title: book.title,
    sourceTitle: book.sourceTitle,
    author: book.author,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    // file size in bytes
    fileSize: book.fileSize,
    primaryLanguage: book.primaryLanguage,
    metadata: book.metadata,
    metaHash: book.metaHash,
    progress: book.progress, 
  }; 

  const recordData: AtBook.RBook = {
    $type: RBOOK_COLLECTION,
    name: book.title,
    bookmeta,
    coverblob: coverBlob,
    docblob: bookBlob,
    config: configBlob,
    checksum: book.hash,
    createdAt: new Date().toISOString(),
  };

  console.log("Record data:", JSON.stringify(recordData, null, 2));
  console.log(`Creating record in ${RBOOK_COLLECTION}...`);
  const createRes = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: RBOOK_COLLECTION,
    rkey: book.hash,
    record: recordData,
  });

  console.log("put record resp: ", createRes);
  console.log(`✓ Record created: URI: ${createRes.data.uri} | CID: ${createRes.data.cid}`);

  return {
    success: createRes.success,
    coverblob: coverBlob,
    bookblob: bookBlob,
    config: configBlob,
    record: createRes.data,
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
 * Retrieve book file content from a record
 *
 * Downloads the blob contents(cover, doc, ) associated with a book record
 *
 * @param rkey - usually, it is book hash
 * @returns A promise that resolves when the content is retrieved
 * @throws {Error} If authentication fails, record is not found, or download fails
 *
 */
export async function downloadBookFile(
  rkey: string,
  needCover: boolean,
  needDoc: boolean,
  needConfig: boolean,
  onProgress?: ProgressHandler,
): Promise<DownloadBookResult> {
  const usr = await refreshSession();
  const serv = usr.service;
  // Initialize agent
  const agent = new AtpAgent({ service: `https://${usr.host}` });
  await agent.resumeSession(usr as AtpSessionData);

  // Get DID
  const did = agent.session?.did;
  if (!did) {
    throw new Error("Could not determine DID from session");
  }

  // Get the record
  let coverCid: string = '';
  let docCid: string = '';
  let configCid: string = '';

  const recordResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: RBOOK_COLLECTION,
    rkey,
  });

  const record = recordResponse.data.value as AtBook.RBook;

  // Extract cover blob CID
  const coverblob = record.coverblob;
  if (!needCover) {
    console.log("No cover blob needed");
  } else if (!coverblob || typeof coverblob !== "object" || !("ref" in coverblob)) {
    console.error("No Cover blob found in record");
  } else {
    const coverRef = coverblob.ref;
    coverCid = typeof coverRef === "object" && coverRef && "$link" in coverRef
      ? coverRef.$link as string
      : coverRef as string;
  }

  // Download the cover blob
  const coverUrl = coverCid
    ? `${serv}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${coverCid}`
    : undefined;
  const coverData = coverUrl 
    ? (await webDownload(coverUrl, onProgress)).blob 
    : undefined;

  // Extract book doc blob CID
  const docblob = record.docblob;
  if (!needDoc) {
    console.log("No Doc blob needed");
  } else if (!docblob || typeof docblob !== "object" || !("ref" in docblob)) {
    console.error("No Doc blob found in record");
  } else {
    const docRef = docblob.ref;
    docCid = typeof docRef === "object" && docRef && "$link" in docRef
      ? docRef.$link as string
      : docRef as string;
  }

  // Download the book doc blob
  const docUrl = docCid
    ? `${serv}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${docCid}`
    : undefined;
  const docData = docUrl 
    ? (await webDownload(docUrl, onProgress)).blob 
    : undefined;

  // Extract book config blob CID
  const configblob = record.config;
  if (!needConfig) {
    console.log("No config blob needed");
  } else if (!configblob || typeof configblob !== "object" || !("ref" in configblob)) {
    console.error("No config blob found in record");
  } else {
    const configRef = configblob.ref;
    configCid = typeof configRef === "object" && configRef && "$link" in configRef
      ? configRef.$link as string
      : configRef as string;
  }

  // Download the book config blob
  const configUrl = configCid
    ? `${serv}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${configCid}`
    : undefined;
  const configData = configUrl 
    ? (await webDownload(configUrl, onProgress)).blob 
    : undefined;

  return {
    rkey,
    coverData,
    docData,
    configData,
    record,
  };
}

export async function downloadPdsBook(
  rkey: string,
  did: string,
  onProgress?: ProgressHandler,
): Promise<DownloadBookResult> {
  if (!did || !rkey) {
    throw new Error("No DID or rkey provided");
  }

  const serv = await resolveDid(did);

  // Get the record
  let coverCid: string = '';
  let docCid: string = '';

  const agent = new AtpAgent({ service: serv });
  const recordResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection: RBOOK_COLLECTION,
    rkey,
  });

  const record = recordResponse.data.value as AtBook.RBook;

  // Extract cover blob CID
  const coverblob = record.coverblob;
  if (!coverblob || typeof coverblob !== "object" || !("ref" in coverblob)) {
    console.error("No Cover blob found in record");
  } else {
    const coverRef = coverblob.ref;
    coverCid = typeof coverRef === "object" && coverRef && "$link" in coverRef
      ? coverRef.$link as string
      : coverRef as string;
  }

  // Download the cover blob
  const coverUrl = coverCid
    ? `${serv}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${coverCid}`
    : undefined;
  const coverData = coverUrl 
    ? (await webDownload(coverUrl, onProgress)).blob 
    : undefined;

  // Extract book doc blob CID
  const docblob = record.docblob;
  if (!docblob || typeof docblob !== "object" || !("ref" in docblob)) {
    console.error("No Doc blob found in record");
  } else {
    const docRef = docblob.ref;
    docCid = typeof docRef === "object" && docRef && "$link" in docRef
      ? docRef.$link as string
      : docRef as string;
  }

  // Download the book doc blob
  const docUrl = docCid
    ? `${serv}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${docCid}`
    : undefined;
  const docData = docUrl 
    ? (await webDownload(docUrl, onProgress)).blob 
    : undefined;

  return {
    rkey,
    coverData,
    docData,
    record,
  };
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
 * List all rbook records for the authenticated user
 *
 * Retrieves and displays all file records stored under the cc.readup.rbook
 *
 * @param limit - Maximum number of records to retrieve. Defaults to 100
 * @returns A promise that resolves when the list is displayed
 * @throws {Error} If authentication fails or the PDS is unreachable
 */
export async function listBookRecords(limit = 100): Promise<RbookRecordItem[]> {
  const usr = await refreshSession();
  // Initialize agent
  const agent = new AtpAgent({ service: `https://${usr.host}` });
  await agent.resumeSession(usr as AtpSessionData);

  // Get DID
  const did = agent.session?.did;
  if (!did) {
    throw new Error("Could not determine DID from session");
  }

  // List records
  const response = await agent.com.atproto.repo.listRecords({
    repo: did,
    collection: RBOOK_COLLECTION,
    limit,
  });

  const records = response.data.records as RbookRecordItem[];

  if (records.length === 0) {
    console.log("No rbook records found.");
    return [];
  }

  return records;
}

/**
 * Get an atproto record without authentication
 *
 * Retrieves a record from any user's repository using their DID and the record key.
 * No authentication is required as this uses the public read API.
 *
 * @param rkey - The record key
 * @param did - The DID (Decentralized Identifier) of the record owner
 * @returns A promise that resolves to the record data
 * @throws {Error} If the record is not found or retrieval fails
 */
export async function getPublicBookRecord(rkey: string, did: string): Promise<AtBook.RBook> {
  // Create an unauthenticated agent
  const agent = new AtpAgent({ service: "https://public.api.bsky.app" });

  try {
    const recordResponse = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: RBOOK_COLLECTION,
      rkey,
    });

    const record = recordResponse.data.value as AtBook.RBook;
    console.log(`✓ Record retrieved: ${rkey} from ${did}`);
    return record;
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      throw new Error(`Record not found: ${rkey} in repository ${did}`);
    }
    throw error;
  }
}

/**
 * Delete an rbook record and its associated blob
 *
 * Removes a rbook record from the PDS by its record key (rkey). The associated
 * blob will be marked for garbage collection by the PDS. Note that the actual
 * blob deletion is handled by the PDS garbage collector and occurs when no other
 * records reference the blob.
 *
 * @param rkey
 * @returns A promise that resolves when the record is deleted
 * @throws {Error} If authentication fails, record is not found, or deletion fails
 */
export async function deleteRecord(rkey: string, col = RBOOK_COLLECTION): Promise<void> {
  const usr = await refreshSession();
  // Initialize agent
  const agent = new AtpAgent({ service: `https://${usr.host}` });
  await agent.resumeSession(usr as AtpSessionData);

  // Get DID
  const did = agent.session?.did;
  if (!did) {
    throw new Error("Could not determine DID from session");
  }

  // Get the record first to extract blob reference
  try {
    const recordResponse = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: col,
      rkey,
    });

    const record = recordResponse.data.value as AtBook.RBook;
    const docblob = record.docblob;
    const coverblob = record.coverblob;

    // Delete the record
    console.log(`🗑  Deleting record ${rkey}...`);
    await agent.com.atproto.repo.deleteRecord({
      repo: did,
      collection: col,
      rkey,
    });

    console.log(`✓ Record deleted`);

    // Note: Blob deletion is handled automatically by PDS when no records reference it
    // Individual blob deletion API is not available in @atproto/api
    if (coverblob && typeof coverblob === "object" && "ref" in coverblob) {
      const cblobRef = coverblob.ref;
      const coverCid = typeof cblobRef === "object" && cblobRef && "$link" in cblobRef
        ? cblobRef.$link
        : cblobRef;
      console.log(
        `ℹ  Cover Blob ${coverCid} will be cleaned up by PDS garbage collection`,
      );
    }
    if (docblob && typeof docblob === "object" && "ref" in docblob) {
      const dblobRef = docblob.ref;
      const docCid = typeof dblobRef === "object" && dblobRef && "$link" in dblobRef
        ? dblobRef.$link
        : dblobRef;
      console.log(
        `ℹ  Doc Blob ${docCid} will be cleaned up by PDS garbage collection`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      throw new Error(`Record not found: ${rkey}`);
    }
    throw error;
  }
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
  const usr = await refreshSession();
  const agent = new AtpAgent({ service: `https://${usr.host}` });
  await agent.resumeSession(usr as AtpSessionData);

  let blob: BlobRef | undefined;
  if (file) {
    blob = await xhrUploadFile(file, usr, onProgress);
  } else {
    throw new Error(`no file`);
  }

  const now = new Date().toISOString();
  const recordData: any = {
    $type: collection,
    name,
    updatedAt: now,
  };

  if (blob) {
    recordData.docblob = blob;
  } else {
    throw new Error("no blob"); 
  }

  const did = agent.session?.did;
  if (!did) { 
    throw new Error("Could not determine DID from session"); 
  }

  const putRes = await agent.com.atproto.repo.putRecord({
    repo: did,
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
  const usr = await refreshSession();
  const serv = usr.service;
  const agent = new AtpAgent({ service: `https://${usr.host}` });
  await agent.resumeSession(usr as AtpSessionData);

  const did = agent.session?.did;
  if (!did) throw new Error("Could not determine DID from session");

  const recordResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection,
    rkey,
  });

  const record = recordResponse.data.value as any;

  let docCid = "";
  const docblob = record.docblob;

  if (!docblob || typeof docblob !== "object" || !("ref" in docblob)) {
    console.error("No Doc blob found in record");
  } else {
    const docRef = docblob.ref;
    docCid = typeof docRef === "object" && docRef && "$link" in docRef
      ? docRef.$link as string
      : docRef as string;
  }

  const docUrl = docCid 
    ? `${serv}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${docCid}` 
    : undefined;
  const docData = docUrl ? (await webDownload(docUrl, onProgress)).blob : undefined;

  return { rkey, docData, record };
}
