import type { Transformer } from './types';
import { TransformContext } from './types';
import { footnoteTransformer } from './footnote';
import { languageTransformer } from './language';
import { punctuationTransformer } from './punctuation';

export const availableTransformers: Transformer[] = [
  punctuationTransformer,
  footnoteTransformer,
  languageTransformer,
  // Add more transformers here
];

export const transformContent = async (ctx: TransformContext): Promise<string> => {
  let transformed = ctx.content;

  const activeTransformers = ctx.transformers
    .map((name) => availableTransformers.find((transformer) => transformer.name === name))
    .filter((transformer) => !!transformer);
  for (const transformer of activeTransformers) {
    try {
      transformed = await transformer.transform({ ...ctx, content: transformed });
    } catch (error) {
      console.warn(`Error in transformer ${transformer.name}:`, error);
    }
  }

  return transformed;
};
