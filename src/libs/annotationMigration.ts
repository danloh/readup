/**
 * Handle annotation migration when EPUB structure changes
 * Detects and validates annotations across EPUB versions
 */

import { BookNote } from '@/types/book';
import { EpubManifest, detectArticleChanges } from './articleToEpub';
import { ArticleType } from '@/app/feed/components/dataAgent';

export type ArticleAnnotationMetadata = {
  articleLink: string;
  epubVersion: string;
  cfi: string;
  articleIndex: number;
  text: string;
};

export interface AnnotationValidationResult {
  valid: boolean;
  warning?: string;
  action?: 'keep' | 'migrate' | 'remove';
  migratedCfi?: string;
}

/**
 * Validate annotation after EPUB structure changes
 * Returns whether annotation is still valid
 */
export function validateAnnotationAfterChange(
  _annotation: BookNote,
  _oldManifest: EpubManifest,
  _newManifest: EpubManifest,
  changeInfo: ReturnType<typeof detectArticleChanges>
): AnnotationValidationResult {
  // If only appended articles at the end, CFI is still valid
  if (changeInfo.appendOnly) {
    return {
      valid: true,
      action: 'keep',
    };
  }

  // If articles were removed or reordered, CFI might be invalid
  if (changeInfo.removed.length > 0 || changeInfo.reordered) {
    return {
      valid: false,
      warning: `Articles were ${changeInfo.reordered ? 'reordered' : 'removed'}. Annotation CFI may be invalid.`,
      action: 'remove',
    };
  }

  // If only added, should be safe
  if (changeInfo.added.length > 0 && !changeInfo.reordered) {
    return {
      valid: true,
      action: 'keep',
    };
  }

  return {
    valid: true,
    action: 'keep',
  };
}

/**
 * Migrate annotations when articles are reordered
 * Attempts to find annotation in new location based on article ID
 */
export function migrateAnnotationToNewEpub(
  _annotation: BookNote,
  oldManifest: EpubManifest,
  newManifest: EpubManifest,
  metadata: ArticleAnnotationMetadata
): AnnotationValidationResult {
  // Try to find the article in the new manifest
  const articleLink = metadata.articleLink;
  const newArticleIndex = newManifest.articleIds.indexOf(articleLink);

  if (newArticleIndex === -1) {
    // Article was removed
    return {
      valid: false,
      warning: `Article for annotation was removed from collection`,
      action: 'remove',
    };
  }

  const oldArticleIndex = oldManifest.articleIds.indexOf(articleLink);
  if (oldArticleIndex === newArticleIndex) {
    // Article is in the same position, CFI should still work
    return {
      valid: true,
      action: 'keep',
    };
  }

  // Article moved to different position
  // CFI becomes invalid, but we can keep the annotation with metadata for recovery
  return {
    valid: false,
    warning: `Article moved from position ${oldArticleIndex} to ${newArticleIndex}. Annotation may need manual relocation.`,
    action: 'keep', // Keep but mark as potentially invalid
  };
}

/**
 * Compare two manifests and generate migration strategy
 */
export function generateMigrationStrategy(
  oldManifest: EpubManifest,
  newManifest: EpubManifest,
  annotations: BookNote[],
  annotationMetadata: Map<string, ArticleAnnotationMetadata>
): {
  strategy: 'keep-all' | 'warn' | 'migrate' | 'manual-review';
  removedAnnotations: BookNote[];
  migratedAnnotations: BookNote[];
  validAnnotations: BookNote[];
  warnings: string[];
} {
  const newArticles = newManifest.articleIds.map(link => ({ link } as ArticleType));
  const changeInfo = detectArticleChanges(oldManifest, newArticles);
  
  if (!changeInfo.changed) {
    return {
      strategy: 'keep-all',
      removedAnnotations: [],
      migratedAnnotations: [],
      validAnnotations: annotations,
      warnings: [],
    };
  }

  if (changeInfo.appendOnly) {
    return {
      strategy: 'keep-all',
      removedAnnotations: [],
      migratedAnnotations: [],
      validAnnotations: annotations,
      warnings: [`${changeInfo.added.length} new articles added. All existing annotations remain valid.`],
    };
  }

  // Complex changes - need review
  const removed: BookNote[] = [];
  const migrated: BookNote[] = [];
  const valid: BookNote[] = [];
  const warnings: string[] = [];

  annotations.forEach(annotation => {
    const metadata = annotationMetadata.get(annotation.id);
    if (!metadata) {
      // No metadata, can't validate
      valid.push(annotation);
      return;
    }

    const result = migrateAnnotationToNewEpub(annotation, oldManifest, newManifest, metadata);
    
    if (result.action === 'remove') {
      removed.push(annotation);
    } else if (result.action === 'migrate') {
      migrated.push(annotation);
    } else {
      valid.push(annotation);
    }

    if (result.warning) {
      warnings.push(result.warning);
    }
  });

  return {
    strategy: removed.length > 0 ? 'manual-review' : 'migrate',
    removedAnnotations: removed,
    migratedAnnotations: migrated,
    validAnnotations: valid,
    warnings,
  };
}

/**
 * Create metadata for an annotation to enable migration tracking
 */
export function createAnnotationMetadata(
  annotation: BookNote,
  epubVersion: string,
  articleLink: string,
  articleIndex: number,
  text: string
): ArticleAnnotationMetadata {
  return {
    articleLink,
    epubVersion,
    cfi: annotation.cfi,
    articleIndex,
    text,
  };
}
