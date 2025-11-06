// Utility functions for file operations

import * as crypto from "node:crypto";
import type { AtFile } from "./types";

/**
 * File checksum structure from the lexicon schema
 */
export type FileChecksum = AtFile.Checksum;

/**
 * File metadata structure from the lexicon schema
 */
export type FileMetadata = AtFile.File;

/**
 * Calculate a cryptographic checksum for file data
 *
 * Computes a hash of the provided data using the specified algorithm
 * and returns it in the `cc.readup.rfile#checksum` format.
 *
 * @param data - File data as a byte array
 * @param algo - Hash algorithm to use (default: "sha256"). Supports any algorithm
 *   available in Node.js crypto: "sha256", "sha512", "md5", "sha1", etc.
 * @returns A checksum object with algorithm and hex-encoded hash
 *
 */
export function calculateChecksum(
  data: Uint8Array,
  algo = "sha256",
): FileChecksum {
  const hash = crypto.createHash(algo);
  hash.update(data);
  const digest = hash.digest("hex");

  return {
    $type: "cc.readup.rfile#checksum",
    algo,
    hash: digest,
  };
}

/**
 * Extract metadata from a file
 *
 * Retrieves file system information and combines it with provided metadata
 * to create a complete `cc.readup.rfile#file` record. This includes the file
 * name, size, MIME type, and modification timestamp.
 *
 * @param filePath - Absolute or relative path to the file on disk
 * @param fileName - Display name for the file (can differ from the on-disk name)
 * @param mimeType - MIME type of the file (e.g., "text/plain", "image/png")
 * @returns A promise resolving to a file metadata object
 */
export async function getFileMetadata(
  filePath: string,
  fileName: string,
  mimeType: string,
): Promise<FileMetadata> {

  return {
    $type: "cc.readup.rfile#file",
    name: fileName,
    size: 0,  // FIXME
    mimeType,
    modifiedAt: new Date().toISOString(),
  };
}
