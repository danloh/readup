/**
 * Post to Bluesky using AT Protocol
 */

import { AtpAgent, RichText } from "@atproto/api";

/**
 * Convert a data URL string to Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(",");
  const mime = arr[0]?.match(/:(.*?);/)?.[1] ?? "image/png";
  const bstr = atob(arr[1] ?? "");
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Extract hashtags from text
 * Hashtags are identified as words starting with # followed by alphanumeric characters
 *
 * @param text - Text to search for hashtags
 * @returns Array of hashtag objects with tag name and start/end positions
 */
function extractHashtags(text: string): Array<{ tag: string; index: number }> {
  const hashtagRegex = /#[\p{L}\p{N}_]{1,}/gu;
  const hashtags: Array<{ tag: string; index: number }> = [];
  let match;

  while ((match = hashtagRegex.exec(text)) !== null) {
    hashtags.push({
      tag: match[0].slice(1), // Remove the # prefix
      index: match.index,
    });
  }

  return hashtags;
}

/**
 * Create hashtag facets for a RichText object
 * Hashtags are automatically detected and formatted as clickable facets
 *
 * @param rt - RichText object to add hashtag facets to
 * @param text - The text content
 */
function addHashtagFacets(rt: RichText, text: string): void {
  const hashtags = extractHashtags(text);

  if (hashtags.length === 0) {
    return;
  }

  if (!rt.facets) {
    rt.facets = [];
  }

  for (const hashtag of hashtags) {
    const hashtagWithHash = `#${hashtag.tag}`;
    const byteStart = Buffer.from(text.slice(0, hashtag.index)).length;
    const byteEnd = Buffer.from(
      text.slice(0, hashtag.index + hashtagWithHash.length)
    ).length;

    // Only add if not already present
    const exists = rt.facets.some(
      (f: any) =>
        f.index.byteStart === byteStart &&
        f.index.byteEnd === byteEnd &&
        f.features.some((feat: any) => feat.$type === "app.bsky.richtext.facet#tag")
    );

    if (!exists) {
      const hashtagFacet = {
        $type: "app.bsky.richtext.facet",
        features: [
          {
            $type: "app.bsky.richtext.facet#tag",
            tag: hashtag.tag,
          },
        ],
        index: {
          byteStart,
          byteEnd,
        },
      };

      rt.facets.push(hashtagFacet as any);
    }
  }
}

export interface PostWithImageOptions {
  /** The text content of the post */
  text: string;
  /** Image data URL or file path */
  imageData: string | Blob;
  /** Optional alt text for the image */
  altText?: string;
  /** Optional reply reference (URI of post being replied to) */
  replyTo?: {
    uri: string;
    cid: string;
  };
}

/**
 * Post to Bluesky with an embedded image
 *
 * @param agent - The ATP agent with active session
 * @param options - Post content and image options
 * @returns The created post record
 */
export async function postWithImage(
  agent: AtpAgent,
  options: PostWithImageOptions
) {
  const { text, imageData, altText = "", replyTo } = options;

  try {
    // Convert image data to Blob if it's a data URL
    const imageBlob =
      typeof imageData === "string" ? dataUrlToBlob(imageData) : imageData;

    // Determine MIME type
    const mimeType = imageBlob.type || "image/png";

    // Upload the image blob
    console.log("⬆ Uploading image...");
    const uploadResponse = await agent.uploadBlob(
      new Uint8Array(await imageBlob.arrayBuffer()),
      { encoding: mimeType }
    );

    if (!uploadResponse.data?.blob) {
      throw new Error("Failed to upload image blob");
    }

    const imageBlobRef = uploadResponse.data.blob;

    // Create the embed
    const embed = {
      $type: "app.bsky.embed.images",
      images: [
        {
          image: imageBlobRef,
          alt: altText,
        },
      ],
    };

    // Create the record
    const rt = new RichText({ text });
    
    // Add hashtag facets
    addHashtagFacets(rt, text);

    const record: {
      $type: string;
      text: string;
      createdAt: string;
      embed: any;
      reply?: any;
      facets?: any;
    } = {
      $type: "app.bsky.feed.post",
      text: rt.text,
      createdAt: new Date().toISOString(),
      embed: embed,
    };

    // Add facets if present
    if (rt.facets && rt.facets.length > 0) {
      record.facets = rt.facets;
    }

    // Remove undefined reply field if not replying
    if (replyTo) {
      record.reply = { root: replyTo, parent: replyTo };
    }

    // Post to the repository
    console.log("📝 Creating post...");
    const response = await agent.com.atproto.repo.createRecord({
      repo: agent.session?.did!,
      collection: "app.bsky.feed.post",
      record: record,
    });

    console.log("✅ Post created:", response.data?.uri);
    return response;
  } catch (error) {
    console.error("❌ Error posting with image:", error);
    throw error;
  }
}

/**
 * Post to Bluesky with multiple embedded images
 *
 * @param agent - The ATP agent with active session
 * @param text - The post text content
 * @param images - Array of {data: string|Blob, alt?: string}
 * @returns The created post record
 */
export async function postWithMultipleImages(
  agent: AtpAgent,
  text: string,
  images: Array<{ data: string | Blob; alt?: string }>
) {
  // Bluesky supports up to 4 images per post
  if (images.length === 0 || images.length > 4) {
    throw new Error("Must provide 1-4 images");
  }

  try {
    // Upload all images
    const uploadedImages = await Promise.all(
      images.map(async (img) => {
        const imageBlob =
          typeof img.data === "string" ? dataUrlToBlob(img.data) : img.data;
        const mimeType = imageBlob.type || "image/png";

        const uploadResponse = await agent.uploadBlob(
          new Uint8Array(await imageBlob.arrayBuffer()),
          { encoding: mimeType }
        );

        if (!uploadResponse.data?.blob) {
          throw new Error("Failed to upload image blob");
        }

        return {
          image: uploadResponse.data.blob,
          alt: img.alt || "",
        };
      })
    );

    // Create the embed
    const embed = {
      $type: "app.bsky.embed.images",
      images: uploadedImages,
    };

    // Create RichText with hashtag facets
    const rt = new RichText({ text });
    addHashtagFacets(rt, text);

    // Create the record
    const record: any = {
      $type: "app.bsky.feed.post",
      text: rt.text,
      createdAt: new Date().toISOString(),
      embed: embed,
    };

    // Add facets if present
    if (rt.facets && rt.facets.length > 0) {
      record.facets = rt.facets;
    }

    // Post to the repository
    console.log("📝 Creating post with multiple images...");
    const response = await agent.com.atproto.repo.createRecord({
      repo: agent.session?.did!,
      collection: "app.bsky.feed.post",
      record: record,
    });

    console.log("✅ Post created:", response.data?.uri);
    return response;
  } catch (error) {
    console.error("❌ Error posting with multiple images:", error);
    throw error;
  }
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
 * Post to Bluesky with an embedded external link
 *
 * @param agent - The ATP agent with active session
 * @param options - Post content and link options
 * @returns The created post record
 */
export async function postWithExternalLink(
  agent: AtpAgent,
  options: PostWithExternalLinkOptions
) {
  const { text, url, title = "", description = "", thumb } = options;

  try {
    let thumbBlob: any = undefined;

    // Upload thumbnail if provided
    if (thumb) {
      const thumbBlobData =
        typeof thumb === "string" ? dataUrlToBlob(thumb) : thumb;
      const mimeType = thumbBlobData.type || "image/png";

      const uploadResponse = await agent.uploadBlob(
        new Uint8Array(await thumbBlobData.arrayBuffer()),
        { encoding: mimeType }
      );

      if (uploadResponse.data?.blob) {
        thumbBlob = uploadResponse.data.blob;
      }
    }

    // Create the embed
    const embed: any = {
      $type: "app.bsky.embed.external",
      external: {
        uri: url,
        title: title,
        description: description,
      },
    };

    if (thumbBlob) {
      embed.external.thumb = thumbBlob;
    }

    // Create RichText with hashtag facets
    const rt = new RichText({ text });
    addHashtagFacets(rt, text);

    // Create the record
    const record: any = {
      $type: "app.bsky.feed.post",
      text: rt.text,
      createdAt: new Date().toISOString(),
      embed: embed,
    };

    // Add facets if present
    if (rt.facets && rt.facets.length > 0) {
      record.facets = rt.facets;
    }

    // Post to the repository
    console.log("📝 Creating post with external link...");
    const response = await agent.com.atproto.repo.createRecord({
      repo: agent.session?.did!,
      collection: "app.bsky.feed.post",
      record: record,
    });

    console.log("✅ Post created:", response.data?.uri);
    return response;
  } catch (error) {
    console.error("❌ Error posting with external link:", error);
    throw error;
  }
}

export interface PostWithImageAndLinkOptions {
  /** The text content of the post */
  text: string;
  /** Image data URL or file path */
  imageData: string | Blob;
  /** Optional alt text for the image */
  altText?: string;
  url: string;
  linkTitle?: string;
  /** Optional reply reference (URI of post being replied to) */
  replyTo?: {
    uri: string;
    cid: string;
  };
}

/**
 * Post to Bluesky with both image and external link with RichText formatting
 * Note: AT Protocol allows only one embed type per post. This function
 * embeds the image and includes a clickable link in the post text using RichText.
 *
 * @param agent - The ATP agent with active session
 * @param options - Post options including text, image, and link details
 * @returns The created post record
 */
export async function postWithImageAndLink(
  agent: AtpAgent,
  options: PostWithImageAndLinkOptions
) {
  const { text, imageData, altText = "", url, linkTitle = "" } = options;

  try {
    // Convert image data to Blob if it's a data URL
    const imageBlob =
      typeof imageData === "string" ? dataUrlToBlob(imageData) : imageData;

    // Determine MIME type
    const mimeType = imageBlob.type || "image/png";

    // Upload the image blob
    console.log("⬆ Uploading image...");
    const uploadResponse = await agent.uploadBlob(
      new Uint8Array(await imageBlob.arrayBuffer()),
      { encoding: mimeType }
    );

    if (!uploadResponse.data?.blob) {
      throw new Error("Failed to upload image blob");
    }

    const imageBlobRef = uploadResponse.data.blob;

    // Create the image embed
    const embed = {
      $type: "app.bsky.embed.images",
      images: [
        {
          image: imageBlobRef,
          alt: altText,
        },
      ],
    };

    // Construct post text with image and link using RichText
    const displayText = linkTitle
      ? `${text}\n\n🔗 ${linkTitle}`
      : `${text}\n\n${url}`;

    // Create RichText with link and hashtag facets
    const rt = new RichText({
      text: displayText,
    });

    // Add hashtag facets first
    addHashtagFacets(rt, displayText);

    // Add link facet
    // Find where the link text starts (either the URL or the linkTitle)
    const linkDisplayText = linkTitle || url;
    const linkStartIndex = displayText.indexOf(linkDisplayText);

    if (linkStartIndex !== -1) {
      await rt.detectFacets(agent);
      
      // Create link facet manually if needed
      const linkFacet = {
        $type: "app.bsky.richtext.facet",
        features: [
          {
            $type: "app.bsky.richtext.facet#link",
            uri: url,
          },
        ],
        index: {
          byteStart: Buffer.from(displayText.slice(0, linkStartIndex)).length,
          byteEnd: Buffer.from(
            displayText.slice(0, linkStartIndex + linkDisplayText.length)
          ).length,
        },
      };

      // Initialize facets array if not present
      if (!rt.facets) {
        rt.facets = [];
      }

      // Check if detectFacets already added link facets, if not add manually
      const hasLinkFacet = rt.facets.some((f: any) =>
        f.features.some((feat: any) => feat.$type === "app.bsky.richtext.facet#link")
      );

      if (!hasLinkFacet) {
        rt.facets.push(linkFacet as any);
      }
    } else {
      // Fallback: just detect facets if text doesn't contain link display text
      await rt.detectFacets(agent);
    }

    // Create the record with RichText
    const record = {
      $type: "app.bsky.feed.post",
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
      embed: embed,
    };

    // Post to the repository
    console.log("📝 Creating post with image and RichText link...");
    const response = await agent.com.atproto.repo.createRecord({
      repo: agent.session?.did!,
      collection: "app.bsky.feed.post",
      record: record,
    });

    console.log("✅ Post created:", response.data?.uri);
    return response;
  } catch (error) {
    console.error("❌ Error posting with image and link:", error);
    throw error;
  }
}

/**
 * Post simple text to Bluesky with hashtag support
 *
 * @param agent - The ATP agent with active session
 * @param text - The post text content (hashtags starting with # will be auto-detected)
 * @returns The created post record
 */
export async function postText(agent: AtpAgent, text: string) {
  try {
    const rt = new RichText({ text });
    
    // Add hashtag facets
    addHashtagFacets(rt, text);

    const record: any = {
      $type: "app.bsky.feed.post",
      text: rt.text,
      createdAt: new Date().toISOString(),
    };

    // Only add facets if there are any
    if (rt.facets && rt.facets.length > 0) {
      record.facets = rt.facets;
    }

    // Post to the repository
    console.log("📝 Creating text post...");
    const response = await agent.com.atproto.repo.createRecord({
      repo: agent.session?.did!,
      collection: "app.bsky.feed.post",
      record: record,
    });

    console.log("✅ Post created:", response.data?.uri);
    return response;
  } catch (error) {
    console.error("❌ Error posting text:", error);
    throw error;
  }
}
