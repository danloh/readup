//  Upload, list, and manage files on AT Protocol PDS

import { AtpAgent, AtpSessionData, BlobRef } from "@atproto/api";
import type { AtBook, AtFile } from "./types";
import { AuthToken, refreshSession, User } from "./auth";
import { Book } from "@/types/book";
import { ProgressHandler, webDownload } from "@/utils/transfer";

export interface BlobResp {
  blob: BlobRef;
}

/**
 * Result returned after successfully uploading a book
 */
export interface UploadResult {
  success: boolean;
  /** The uploaded blob reference */
  coverblob: unknown;
  bookblob: unknown;
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
  // const data = await file.bytes(); // limited availability
  // const arrayBuffer = await file.arrayBuffer();
  // const data = new Uint8Array(arrayBuffer);
  console.log("User info: ", usr);
  const mimeType = file.type || "application/octet-stream";
  // Upload url
  const pdsUrl = `${usr.service}/xrpc/com.atproto.repo.uploadBlob`;

  return new Promise((resolve, reject) => {
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
        console.log("xhr upload resp: ", xhr.response);
        console.log("xhr upload resp text: ", xhr.responseText);
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

    xhr.send(file);
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
  onProgress?: ProgressHandler,
): Promise<UploadResult> {
  const usr = await refreshSession();
  // Initialize agent
  const agent = new AtpAgent({ service: `https://${usr.host}` });
  await agent.resumeSession(usr as AtpSessionData);
  
  console.log("Agent: ", agent);
  // upload cover
  const coverBlob = coverFile ? await uploadFile(coverFile, agent) : undefined;
  //const coverBlob = coverFile ? await xhrUploadFile(coverFile, usr, onProgress) : undefined;
  // upload book doc
  //const bookBlob = bookFile ? await uploadFile(bookFile, agent) : undefined;
  const bookBlob = bookFile ? await xhrUploadFile(bookFile, usr, onProgress) : undefined;

  // Get DID
  const did = agent.session?.did;
  if (!did) {
    throw new Error("Could not determine DID from session");
  }

  // Create record according to cc.readup.rbook lexicon (corrected collection name)
  const collection = "cc.readup.rbook";

  // Build the record with proper typing
  // The blob from uploadBlob already has the correct structure
  const recordData: AtBook.RBook = {
    $type: collection,
    name: book.title,
    coverblob: coverBlob,
    docblob: bookBlob,
    // metadata: bookmetadata
    // config: book cofig
    checksum: book.hash,
    createdAt: new Date().toISOString(),
  };

  console.log("Record data:", JSON.stringify(recordData, null, 2));
  console.log(`Creating record in ${collection}...`);
  const createRes = await agent.com.atproto.repo.putRecord({
    repo: did,
    collection,
    rkey: book.hash,
    record: recordData,
  });

  console.log("put record resp: ", createRes);
  console.log(`✓ Record created: URI: ${createRes.data.uri} | CID: ${createRes.data.cid}`);

  return {
    success: createRes.success,
    coverblob: coverBlob,
    bookblob: bookBlob,
    record: createRes.data,
  };
}

/**
 * Options for listing file records from the PDS
 */
interface ListOptions {
  /** The URL of the PDS service */
  serviceUrl: string;
  /** sessionData */
  session: AuthToken;
  /** Maximum number of records to retrieve. Defaults to 100 */
  limit?: number;
}

/**
 * List all aqfile records for the authenticated user
 *
 * Retrieves and displays all file records stored under the cc.readup.rfile
 * collection for the authenticated user. The output is formatted as a table
 * showing the record key, file size, MIME type, and filename.
 *
 * @param options - List configuration options including authentication and limit
 * @returns A promise that resolves when the list is displayed
 * @throws {Error} If authentication fails or the PDS is unreachable
 */
async function listRecords(options: ListOptions): Promise<void> {
  const { serviceUrl, session, limit = 100 } = options;

  // Initialize agent
  const agent = new AtpAgent({ service: serviceUrl });
  await agent.resumeSession(session as AtpSessionData);

  // Get DID
  const did = agent.session?.did;
  if (!did) {
    throw new Error("Could not determine DID from session");
  }

  const collection = "cc.readup.rfile";

  // List records
  const response = await agent.com.atproto.repo.listRecords({
    repo: did,
    collection,
    limit,
  });

  const records = response.data.records;

  if (records.length === 0) {
    console.log("No aqfile records found.");
    return;
  }

  // Print each record
  for (const record of records) {
    const rkey = record.uri.split("/").pop() || "unknown";
    const value = record.value as AtFile.RFile;

    // Extract relevant info
    const fileName = value.metadata?.name || "unknown";
    const fileSize = value.metadata?.size || 0;
    const mimeType = value.metadata?.mimeType || "unknown";

    // Format size for readability
    const formatSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
      if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
      }
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
    };

    // Print row with fixed widths
    const rkeyStr = rkey.padEnd(13);
    const sizeStr = formatSize(fileSize).padEnd(11);
    const mimeStr = mimeType.slice(0, 28).padEnd(29);
    const nameStr = fileName.slice(0, 40);

    console.log(`${rkeyStr} ${sizeStr} ${mimeStr} ${nameStr}`);
  }
}

/**
 * Options for showing file record metadata
 */
interface ShowOptions {
  /** The URL of the PDS service */
  serviceUrl: string;
  /** sessionData */
  session: AuthToken;
  /** The record key (rkey) of the file to show */
  rkey: string;
}

/**
 * Show detailed metadata for a file record
 *
 * Retrieves and displays comprehensive information about a file record including
 * file metadata, checksum, creation time, and inspection links to external tools.
 *
 * @param options - Show configuration options including authentication and rkey
 * @returns A promise that resolves when the metadata is displayed
 * @throws {Error} If authentication fails or record is not found
 *
 * @example
 * ```ts
 * await showRecord({
 *   serviceUrl: "https://bsky.social",
 *   handle: "alice.bsky.social",
 *   password: "app-password",
 *   rkey: "3m35jjrc5b62d"
 * });
 * ```
 */
async function showRecord(options: ShowOptions): Promise<void> {
  const { serviceUrl, session, rkey } = options;

  // Initialize agent
  const agent = new AtpAgent({ service: serviceUrl });
  await agent.resumeSession(session as AtpSessionData);

  // Get DID
  const did = agent.session?.did;
  if (!did) {
    throw new Error("Could not determine DID from session");
  }

  const collection = "cc.readup.rfile";

  // Get the record
  try {
    const recordResponse = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection,
      rkey,
    });

    const record = recordResponse.data.value as AtFile.RFile;
    const uri = recordResponse.data.uri;
    const cid = recordResponse.data.cid;

    // Display metadata
    console.log(`\n📄 File Record: ${rkey}\n`);
    console.log(`URI:          ${uri}`);
    console.log(`CID:          ${cid}`);
    console.log(`Created:      ${record.createdAt}`);

    if (record.metadata) {
      console.log(`\nFile Information:`);
      console.log(`  Name:       ${record.metadata.name}`);
      console.log(`  Size:       ${record.metadata.size} bytes`);
      if (record.metadata.mimeType) {
        console.log(`  MIME Type:  ${record.metadata.mimeType}`);
      }
      if (record.metadata.modifiedAt) {
        console.log(`  Modified:   ${record.metadata.modifiedAt}`);
      }
    }

    if (record.checksum) {
      console.log(`\nChecksum:`);
      console.log(`  Hash:       ${record.checksum}`);
    }

    if (record.attribution) {
      console.log(`\nAttribution:  ${record.attribution}`);
    }

    // Extract blob CID
    const blob = record.blob;
    if (blob && typeof blob === "object" && "ref" in blob) {
      const blobRef = blob.ref;
      const blobCid =
        typeof blobRef === "object" && blobRef && "$link" in blobRef
          ? blobRef.$link
          : blobRef;
      console.log(`\nBlob CID:     ${blobCid}`);
    }

    // Show inspection links
    console.log(`\n🔍 Inspect this record:`);
    console.log(`   https://pdsls.dev/${uri}`);
    console.log(
      `   https://atproto-browser.vercel.app/${uri.replace("at://", "at/")}`,
    );
    console.log();
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      throw new Error(`Record not found: ${rkey}`);
    }
    throw error;
  }
}

/**
 * Options for retrieving file content
 */
interface GetOptions {
  /** The URL of the PDS service */
  serviceUrl: string;
  /** sessionData */
  session: AuthToken;
  /** The record key (rkey) of the file to retrieve */
  rkey: string;
  /** Optional output file path. If not provided, outputs to stdout */
  outputPath?: string;
}

/**
 * Result returned after successfully uploading a book
 */
export interface DownloadResult {
  rkey: string;
  /** The download data */
  coverData?: Blob;
  docData?: Blob;
  /** The download record information */
  record: AtBook.RBook;
}

// Determine if content is binary
const isBinary = (data: Uint8Array): boolean => {
  // Check first 8KB for null bytes or high proportion of non-text chars
  const sample = data.slice(0, Math.min(8192, data.length));
  let nonTextCount = 0;

  for (let i = 0; i < sample.length; i++) {
    const byte = sample[i];
    // Null byte is definite binary
    if (!byte || byte === 0) return true;
    // Count non-printable, non-whitespace characters
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
      nonTextCount++;
    }
  }

  // If more than 30% non-text characters, consider it binary
  return (nonTextCount / sample.length) > 0.3;
};

export async function downloadFile(blobUrl: string): Promise<ArrayBuffer | undefined> {
  const response = await fetch(blobUrl);

  if (!response.ok) {
    throw new Error(`Failed to download blob: ${response.statusText}`);
  }

  const blobData = await response.arrayBuffer();

  // const isContentBinary = isBinary(blobData);
  // const mimeType = record.metadata?.mimeType || "application/octet-stream";
  // const fileName = record.metadata?.name || rkey;

  return blobData;
}

/**
 * Retrieve file content from a record
 *
 * Downloads the blob content associated with a file record and either outputs
 * it to stdout or saves it to a file. In interactive mode, warns if attempting
 * to output binary content to the terminal.
 *
 * @param options - Get configuration options including authentication, rkey, and output path
 * @returns A promise that resolves when the content is retrieved
 * @throws {Error} If authentication fails, record is not found, or download fails
 *
 * @example
 * ```ts
 * // Output to stdout
 * await getRecord({
 *   serviceUrl: "https://bsky.social",
 *   handle: "alice.bsky.social",
 *   password: "app-password",
 *   rkey: "3m35jjrc5b62d"
 * });
 *
 * // Save to file
 * await getRecord({
 *   serviceUrl: "https://bsky.social",
 *   handle: "alice.bsky.social",
 *   password: "app-password",
 *   rkey: "3m35jjrc5b62d",
 *   outputPath: "downloaded.txt"
 * });
 * ```
 */
async function getRecord(rkey: string): Promise<DownloadResult> {
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

  const collection = "cc.readup.rbook";

  // Get the record
  let coverCid: string = '';
  let docCid: string = '';

  const recordResponse = await agent.com.atproto.repo.getRecord({
    repo: did,
    collection,
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

  // Extract cover blob CID
  const docblob = record.docblob;
  if (!docblob || typeof docblob !== "object" || !("ref" in docblob)) {
    console.error("No Doc blob found in record");
  } else {
    const docRef = docblob.ref;
    docCid = typeof docRef === "object" && docRef && "$link" in docRef
      ? docRef.$link as string
      : docRef as string;
  }

  // Download the cover blob
  const coverUrl = coverCid
    ? `${serv}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${coverCid}`
    : undefined;
  const coverData = coverUrl ? await webDownload(coverUrl) : undefined;
  // Download the book doc blob
  const docUrl = docCid
    ? `${serv}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${docCid}`
    : undefined;
  const docData = docUrl ? await webDownload(docUrl) : undefined;

  return {
    rkey,
    coverData,
    docData,
    record,
  };
}

/**
 * Options for deleting a file record from the PDS
 */
interface DeleteOptions {
  /** The URL of the PDS service */
  serviceUrl: string;
  /** sessionData */
  session: AuthToken;
  /** The record key (rkey) of the file to delete */
  rkey: string;
}

/**
 * Delete an aqfile record and its associated blob
 *
 * Removes a file record from the PDS by its record key (rkey). The associated
 * blob will be marked for garbage collection by the PDS. Note that the actual
 * blob deletion is handled by the PDS garbage collector and occurs when no other
 * records reference the blob.
 *
 * @param options - Delete configuration options including authentication and rkey
 * @returns A promise that resolves when the record is deleted
 * @throws {Error} If authentication fails, record is not found, or deletion fails
 *
 * @example
 * ```ts
 * await deleteRecord({
 *   serviceUrl: "https://bsky.social",
 *   identifier: "alice.bsky.social",
 *   password: "app-password",
 *   rkey: "3m35jjrc5b62d"
 * });
 * // Outputs:
 * // ✓ Logged in as alice.bsky.social
 * // 🗑  Deleting record 3m35jjrc5b62d...
 * // ✓ Record deleted
 * // ℹ  Blob bafkreic... will be cleaned up by PDS garbage collection
 * ```
 */
async function deleteRecord(options: DeleteOptions): Promise<void> {
  const { serviceUrl, session, rkey } = options;

  // Initialize agent
  const agent = new AtpAgent({ service: serviceUrl });
  await agent.resumeSession(session as AtpSessionData);

  // Get DID
  const did = agent.session?.did;
  if (!did) {
    throw new Error("Could not determine DID from session");
  }

  const collection = "cc.readup.rfile";

  // Get the record first to extract blob reference
  try {
    const recordResponse = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection,
      rkey,
    });

    const record = recordResponse.data.value as AtFile.RFile;
    const blob = record.blob;

    // Delete the record
    console.log(`🗑  Deleting record ${rkey}...`);
    await agent.com.atproto.repo.deleteRecord({
      repo: did,
      collection,
      rkey,
    });
    console.log(`✓ Record deleted`);

    // Note: Blob deletion is handled automatically by PDS when no records reference it
    // Individual blob deletion API is not available in @atproto/api
    if (blob && typeof blob === "object" && "ref" in blob) {
      const blobRef = blob.ref;
      const cid = typeof blobRef === "object" && blobRef && "$link" in blobRef
        ? blobRef.$link
        : blobRef;
      console.log(
        `ℹ  Blob ${cid} will be cleaned up by PDS garbage collection`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      throw new Error(`Record not found: ${rkey}`);
    }
    throw error;
  }
}
