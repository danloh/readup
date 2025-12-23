//  Upload, list, and manage files on AT Protocol PDS

import { lookup } from "mime-types";
import { AtpAgent, AtpSessionData } from "@atproto/api";
import { getBaseFilename } from "@/utils/path";
import { calculateChecksum, getFileMetadata } from "./utils";
import type { AtFile } from "./types";
import { AuthToken } from "./auth";

/**
 * Options for uploading a file to the PDS
 */
export interface UploadOptions {
  /** The URL of the PDS service (e.g., "https://bsky.social") */
  serviceUrl: string;
  /** sessionData */
  session: AuthToken;
  /** Path to the file to upload */
  filePath: string;
}

/**
 * Result returned after successfully uploading a file
 */
export interface UploadResult {
  /** The uploaded blob reference */
  blob: unknown;
  /** The created record information */
  record: {
    /** The AT URI of the created record */
    uri: string;
    /** The CID (Content Identifier) of the record */
    cid: string;
  };
}

/**
 * Upload a file to AT Protocol PDS and create a record
 *
 * This function handles the complete upload workflow:
 * 1. Authenticates with the PDS
 * 2. Reads and uploads the file as a blob
 * 3. Calculates file checksum (SHA256)
 * 4. Gathers file metadata
 * 5. Creates a record with all information
 *
 * @param options - Upload configuration options
 * @returns A promise that resolves to the upload result containing blob and record info
 * @throws {Error} If authentication fails, file is not found, or record creation fails
 *
 * @example
 * ```ts
 * const result = await uploadFile({
 *   serviceUrl: "https://bsky.social",
 *   identifier: "alice.bsky.social",
 *   password: "app-password",
 *   filePath: "./photo.jpg"
 * });
 * console.log(`Uploaded: ${result.record.uri}`);
 * ```
 */
export async function uploadFile(
  options: UploadOptions, 
  data: Uint8Array
): Promise<UploadResult> {
  const { serviceUrl, session, filePath } = options;

  // Initialize agent
  const agent = new AtpAgent({ service: serviceUrl });
  await agent.resumeSession(session as AtpSessionData);

  // Read file  FIXME
  // const data = await fs.readFile(filePath);
  const fileName = getBaseFilename(filePath);
  const mimeType = lookup(filePath) || "application/octet-stream";

  // Upload blob
  console.log(`⬆ Uploading ${fileName} (${data.length} bytes, ${mimeType})...`);
  const uploadRes = await agent.uploadBlob(data, { encoding: mimeType });
  const blob = uploadRes.data?.blob;

  if (!blob) {
    throw new Error("Upload failed: no blob returned");
  }

  const blobCid = blob.ref?.["$link"] ?? blob.ref;
  console.log(`✓ Blob uploaded: ${blobCid}`);

  console.log("Blob structure:", JSON.stringify(blob, null, 2));

  // Calculate checksum
  const checksum = calculateChecksum(data);

  // Get file metadata
  const fileMetadata = await getFileMetadata(filePath, fileName, mimeType);

  // Get DID
  const did = agent.session?.did;
  if (!did) {
    throw new Error("Could not determine DID from session");
  }

  // Create record according to cc.readup.rfile lexicon (corrected collection name)
  const collection = "cc.readup.rfile";

  // Build the record with proper typing
  // The blob from uploadBlob already has the correct structure
  const recordData: AtFile.Main = {
    $type: "cc.readup.rfile",
    blob: blob as unknown as AtFile.Main["blob"],
    // checksum,
    createdAt: new Date().toISOString(),
    file: fileMetadata,
  };

  console.log("Record data:", JSON.stringify(recordData, null, 2));

  console.log(`📝 Creating record in ${collection}...`);
  const createRes = await agent.com.atproto.repo.createRecord({
    repo: did,
    collection,
    // rkey: book.hash,
    record: recordData,
  });

  console.log(`✓ Record created: ${createRes.data.uri}`);
  console.log(`  CID: ${createRes.data.cid}`);

  // Show inspection links
  console.log(`\n🔍 Inspect your upload:`);
  console.log(`   https://pdsls.dev/${createRes.data.uri}`);
  console.log(
    `   https://atproto-browser.vercel.app/${
      createRes.data.uri.replace("at://", "at/")
    }`,
  );

  return {
    blob,
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
    const value = record.value as AtFile.Main;

    // Extract relevant info
    const fileName = value.file?.name || "unknown";
    const fileSize = value.file?.size || 0;
    const mimeType = value.file?.mimeType || "unknown";

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

    const record = recordResponse.data.value as AtFile.Main;
    const uri = recordResponse.data.uri;
    const cid = recordResponse.data.cid;

    // Display metadata
    console.log(`\n📄 File Record: ${rkey}\n`);
    console.log(`URI:          ${uri}`);
    console.log(`CID:          ${cid}`);
    console.log(`Created:      ${record.createdAt}`);

    if (record.file) {
      console.log(`\nFile Information:`);
      console.log(`  Name:       ${record.file.name}`);
      console.log(`  Size:       ${record.file.size} bytes`);
      if (record.file.mimeType) {
        console.log(`  MIME Type:  ${record.file.mimeType}`);
      }
      if (record.file.modifiedAt) {
        console.log(`  Modified:   ${record.file.modifiedAt}`);
      }
    }

    if (record.checksum) {
      console.log(`\nChecksum:`);
      console.log(`  Algorithm:  ${record.checksum.algo}`);
      console.log(`  Hash:       ${record.checksum.hash}`);
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
async function getRecord(options: GetOptions): Promise<void> {
  const { serviceUrl, session, rkey, outputPath } = options;

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
  let record: AtFile.Main;
  let blobCid: string;

  try {
    const recordResponse = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection,
      rkey,
    });

    record = recordResponse.data.value as AtFile.Main;

    // Extract blob CID
    const blob = record.blob;
    if (!blob || typeof blob !== "object" || !("ref" in blob)) {
      throw new Error("No blob found in record");
    }

    const blobRef = blob.ref;
    blobCid = typeof blobRef === "object" && blobRef && "$link" in blobRef
      ? blobRef.$link as string
      : blobRef as string;
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      throw new Error(`Record not found: ${rkey}`);
    }
    throw error;
  }

  // Download the blob
  const blobUrl =
    `${serviceUrl}/xrpc/com.atproto.sync.getBlob?did=${did}&cid=${blobCid}`;
  const response = await fetch(blobUrl);

  if (!response.ok) {
    throw new Error(`Failed to download blob: ${response.statusText}`);
  }

  const blobData = new Uint8Array(await response.arrayBuffer());

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

  const isContentBinary = isBinary(blobData);
  const mimeType = record.file?.mimeType || "application/octet-stream";
  const fileName = record.file?.name || rkey;
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

    const record = recordResponse.data.value as AtFile.Main;
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
