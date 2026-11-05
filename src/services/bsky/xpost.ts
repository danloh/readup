/**
 * Post to Bluesky using AT Protocol
 *
 * All helpers take an `Agent` (works for both OAuth and app-password
 * sessions) and share one record builder:
 *   - facets (#tags, links, @mentions) come from `RichText.detectFacets`, which
 *     computes UTF-8 byte offsets correctly for CJK / emoji text;
 *   - images are downscaled / re-encoded to fit the 1 MB blob limit of
 *     `app.bsky.embed.images` and carry an aspect ratio so clients lay them
 *     out without cropping.
 */

import { Agent, RichText, UnicodeString, type AppBskyFeedPost } from "@atproto/api";

/** Bluesky rejects images above 1,000,000 bytes. */
export const MAX_IMAGE_BYTES = 1_000_000;
const MAX_IMAGE_DIMENSION = 2000;
const POST_COLLECTION = "app.bsky.feed.post";
export const MAX_POST_GRAPHEMES = 300;

type PostRecord = AppBskyFeedPost.Record;
type Facet = NonNullable<PostRecord["facets"]>[number];
type ReplyRef = { uri: string; cid: string };

/**
 * Convert a data URL string to Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header = "", data = ""] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const bstr = atob(data);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

const toBlob = (data: string | Blob) => (typeof data === "string" ? dataUrlToBlob(data) : data);

interface PreparedImage {
  blob: Blob;
  aspectRatio?: { width: number; height: number };
}

/**
 * Read the image size and, if it is over the blob limit, scale it down and
 * re-encode it as JPEG until it fits. Falls back to the original blob where
 * image decoding is unavailable (e.g. tests).
 */
export async function prepareImage(input: Blob, maxBytes = MAX_IMAGE_BYTES): Promise<PreparedImage> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return { blob: input };
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(input);
  } catch {
    return { blob: input };
  }
  const aspectRatio = { width: bitmap.width, height: bitmap.height };
  try {
    if (input.size <= maxBytes) {
      return { blob: input, aspectRatio };
    }
    let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let quality = 0.9;
    for (let attempt = 0; attempt < 8; attempt++) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      // JPEG has no alpha: paint white under transparent quote cards
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(bitmap, 0, 0, width, height);
      const out = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (out && out.size <= maxBytes) {
        return { blob: out, aspectRatio: { width, height } };
      }
      if (quality > 0.7) quality -= 0.1;
      else scale *= 0.8;
    }
    throw new Error("Image is too large to post (over 1 MB after compression)");
  } finally {
    bitmap.close();
  }
}

async function uploadImage(agent: Agent, data: string | Blob) {
  const { blob, aspectRatio } = await prepareImage(toBlob(data));
  const res = await agent.uploadBlob(new Uint8Array(await blob.arrayBuffer()), {
    encoding: blob.type || "image/png",
  });
  if (!res.data?.blob) {
    throw new Error("Failed to upload image blob");
  }
  return { image: res.data.blob, aspectRatio };
}

/**
 * Build a facet for `uri` rendered as `label` at the last occurrence of
 * `label` in `text` (byte offsets are UTF-8).
 */
export function linkFacet(text: string, label: string, uri: string): Facet | undefined {
  const index = text.lastIndexOf(label);
  if (index < 0) return undefined;
  const ustr = new UnicodeString(text);
  return {
    $type: "app.bsky.richtext.facet",
    index: {
      byteStart: ustr.utf16IndexToUtf8Index(index),
      byteEnd: ustr.utf16IndexToUtf8Index(index + label.length),
    },
    features: [{ $type: "app.bsky.richtext.facet#link", uri }],
  };
}

const overlaps = (a: Facet, b: Facet) =>
  a.index.byteStart < b.index.byteEnd && b.index.byteStart < a.index.byteEnd;

/** Detect facets in `text`, plus optional explicit (e.g. titled link) facets. */
export async function buildFacets(
  agent: Agent,
  text: string,
  extra: Facet[] = [],
): Promise<{ text: string; facets?: Facet[] }> {
  const rt = new RichText({ text });
  if (rt.graphemeLength > MAX_POST_GRAPHEMES) {
    throw new Error(
      `Post is too long (${rt.graphemeLength}/${MAX_POST_GRAPHEMES} characters)`,
    );
  }
  await rt.detectFacets(agent);
  const detected = (rt.facets ?? []).filter((f) => !extra.some((e) => overlaps(e, f)));
  const facets = [...detected, ...extra].sort((a, b) => a.index.byteStart - b.index.byteStart);
  return { text: rt.text, facets: facets.length ? facets : undefined };
}

async function createPost(
  agent: Agent,
  text: string,
  options: { embed?: PostRecord["embed"]; extraFacets?: Facet[]; replyTo?: ReplyRef } = {},
) {
  const { text: postText, facets } = await buildFacets(agent, text, options.extraFacets);
  const record: PostRecord = {
    $type: POST_COLLECTION,
    text: postText,
    createdAt: new Date().toISOString(),
    ...(facets && { facets }),
    ...(options.embed && { embed: options.embed }),
    ...(options.replyTo && { reply: { root: options.replyTo, parent: options.replyTo } }),
  };
  const response = await agent.com.atproto.repo.createRecord({
    repo: agent.assertDid,
    collection: POST_COLLECTION,
    record,
  });
  console.log("✅ Post created:", response.data?.uri);
  return response;
}

export interface PostWithImageOptions {
  /** The text content of the post */
  text: string;
  /** Image data URL or blob */
  imageData: string | Blob;
  /** Optional alt text for the image */
  altText?: string;
  /** Optional reply reference (URI of post being replied to) */
  replyTo?: ReplyRef;
}

/**
 * Post simple text to Bluesky (hashtags, links and mentions are detected)
 */
export async function postText(agent: Agent, text: string) {
  return createPost(agent, text);
}

/**
 * Post to Bluesky with 1-4 embedded images
 */
export async function postWithMultipleImages(
  agent: Agent,
  text: string,
  images: Array<{ data: string | Blob; alt?: string }>,
  replyTo?: ReplyRef,
) {
  if (images.length === 0 || images.length > 4) {
    throw new Error("Must provide 1-4 images");
  }
  const uploaded = await Promise.all(
    images.map(async (img) => ({ ...(await uploadImage(agent, img.data)), alt: img.alt || "" })),
  );
  return createPost(agent, text, {
    embed: { $type: "app.bsky.embed.images", images: uploaded },
    replyTo,
  });
}

/**
 * Post to Bluesky with an embedded image
 */
export async function postWithImage(agent: Agent, options: PostWithImageOptions) {
  const { text, imageData, altText = "", replyTo } = options;
  return postWithMultipleImages(agent, text, [{ data: imageData, alt: altText }], replyTo);
}

export interface PostWithExternalLinkOptions {
  /** The text content of the post */
  text: string;
  /** URL to embed */
  url: string;
  /** Title for the link preview */
  title?: string;
  /** Description for the link preview */
  description?: string;
  /** Thumbnail image data URL or blob */
  thumb?: string | Blob;
}

/**
 * Post to Bluesky with an embedded external link card
 */
export async function postWithExternalLink(agent: Agent, options: PostWithExternalLinkOptions) {
  const { text, url, title = "", description = "", thumb } = options;

  let thumbBlob = undefined;
  if (thumb) {
    try {
      thumbBlob = (await uploadImage(agent, thumb)).image;
    } catch (error) {
      // a missing thumbnail shouldn't block the post
      console.warn("⚠ Failed to upload link thumbnail:", error);
    }
  }

  return createPost(agent, text, {
    embed: {
      $type: "app.bsky.embed.external",
      external: { uri: url, title, description, ...(thumbBlob && { thumb: thumbBlob }) },
    },
  });
}

export interface PostWithImageAndLinkOptions {
  /** The text content of the post */
  text: string;
  /** Image data URL or blob */
  imageData: string | Blob;
  /** Optional alt text for the image */
  altText?: string;
  url: string;
  /** Show this label in the text instead of the raw URL */
  linkTitle?: string;
  /** Optional reply reference (URI of post being replied to) */
  replyTo?: ReplyRef;
}

/**
 * Post with an image embed and a link in the text.
 * AT Protocol allows only one embed per post, so the link is a rich-text
 * facet, shown as `📖 linkTitle` when a title is given.
 */
export async function postWithImageAndLink(agent: Agent, options: PostWithImageAndLinkOptions) {
  const { text, imageData, altText = "", url, linkTitle, replyTo } = options;
  const displayText = linkTitle ? `${text}\n📖 ${linkTitle}` : `${text}\n${url}`;
  const { image, aspectRatio } = await uploadImage(agent, imageData);
  // a raw URL is picked up by detectFacets; a title needs an explicit facet
  const titled = linkTitle ? linkFacet(displayText, linkTitle, url) : undefined;
  return createPost(agent, displayText, {
    embed: { $type: "app.bsky.embed.images", images: [{ image, alt: altText, aspectRatio }] },
    extraFacets: titled ? [titled] : [],
    replyTo,
  });
}
