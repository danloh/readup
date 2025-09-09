// import { loadCSS, loadJS } from 'markmap-common';
// import * as markmap from 'markmap-view';
import { useEffect, createRef } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';

const transformer = new Transformer();
// const { scripts, styles } = transformer.getAssets();
// loadCSS(styles!);
// loadJS(scripts!, { getMarkmap: () => markmap });

type MmProps = {
  mdValue: string;
  title?: string;
  initDir?: string;
  mmClass?: string;
};

export function Mindmap(props: MmProps) {
  const { mdValue, title = 'mm', mmClass = '' } = props;
  // Ref for SVG element
  const refSvg = createRef<SVGSVGElement>();
  // Ref for markmap object
  const refMm = createRef<Markmap>();

  useEffect(() => {
    // Create markmap and save to refMm
    if (refMm.current) return;
    const mm = Markmap.create(refSvg.current);
    console.log('create', refSvg.current);
    refMm.current = mm;
  }, [refSvg.current]);

  useEffect(() => {
    // Update data for markmap once value is changed
    const mm = refMm.current;
    if (!mm) return;
    const { root } = transformer.transform(mdValue);
    mm.setData(root).then(() => {
      mm.fit();
    });
  }, [refMm.current, mdValue]);

  return (
    <div id={title} className={`flex flex-col h-screen p-2 ${mmClass}`}>
      <svg className="flex-1" ref={refSvg} />
    </div>
  );
}
