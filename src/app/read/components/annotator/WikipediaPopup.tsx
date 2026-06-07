import React, { useEffect, useRef } from 'react';
import Popup from '@/components/Popup';
import { Position } from '@/utils/sel';
import { detectLanguage } from '@/utils/lang';
import { useTranslation } from '@/hooks/useTranslation';

interface WikipediaPopupProps {
  text: string;
  lang: string;
  position: Position;
  trianglePosition: Position;
  popupWidth: number;
  popupHeight: number;
  onDismiss?: () => void;
}

const WikipediaPopup: React.FC<WikipediaPopupProps> = ({
  text,
  lang,
  position,
  trianglePosition,
  popupWidth,
  popupHeight,
  onDismiss,
}) => {
  const _ = useTranslation();
  const isLoading = useRef(false);

  const bookLang = typeof lang === 'string' ? lang : lang?.[0];
  const langCode = bookLang ? bookLang.split(/[-_]|\s+/)[0]! : 'en';
  // FIXME: detect wrong lang sometimes
  const realLang = detectLanguage(text, false) || langCode;
  // console.log('>> lang', bookLang, lang, langCode, realLang);

  useEffect(() => {
    if (isLoading.current) {
      return;
    }
    isLoading.current = true;

    const main = document.querySelector('main') as HTMLElement;
    const footer = document.querySelector('footer') as HTMLElement;

    const fetchSummary = async (query: string, language: string) => {
      main.innerHTML = '';
      footer.dataset['state'] = 'loading';

      try {
        const response = await fetch(
          `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
        );

        if (!response.ok) {
          throw new Error('Failed to fetch Wikipedia summary');
        }

        const data = await response.json();

        const hgroup = document.createElement('hgroup');
        hgroup.style.color = 'white';
        hgroup.style.backgroundPosition = 'center center';
        hgroup.style.backgroundSize = 'cover';
        hgroup.style.backgroundColor = 'rgba(0, 0, 0, .4)';
        hgroup.style.backgroundBlendMode = 'darken';
        hgroup.style.borderRadius = '6px';
        hgroup.style.padding = '12px';
        hgroup.style.marginBottom = '12px';
        hgroup.style.minHeight = '100px';

        const h1 = document.createElement('h1');
        h1.innerHTML = data.titles.display;
        h1.className = 'text-lg font-bold';
        hgroup.append(h1);

        if (data.description) {
          const description = document.createElement('p');
          description.innerText = data.description;
          hgroup.appendChild(description);
        }

        if (data.thumbnail) {
          hgroup.style.backgroundImage = `url("${data.thumbnail.source}")`;
        }

        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = data.extract_html;
        contentDiv.className = 'p-2 text-sm';
        contentDiv.dir = data.dir;

        main.append(hgroup, contentDiv);
        footer.dataset['state'] = 'loaded';
      } catch (error) {
        console.error(error);

        const errorDiv = document.createElement('div');
        const h1 = document.createElement('h1');
        h1.innerText = _('Error');

        const errorMsg = document.createElement('p');
        errorMsg.innerHTML = _(`Unable to find the article. Try searching directly on <a href="https://${language}.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}" target="_blank" rel="noopener noreferrer" class="not-eink:text-primary underline">Wikipedia</a>.`);

        errorDiv.append(h1, errorMsg);
        main.appendChild(errorDiv);
        footer.dataset['state'] = 'error';
      }
    };

    fetchSummary(text, realLang);
  }, [_, text, realLang]);

  return (
    <div>
      <Popup
        width={popupWidth}
        height={popupHeight}
        position={position}
        trianglePosition={trianglePosition}
        className='select-text'
        onDismiss={onDismiss}
      >
        <div className='text-base-content flex h-full flex-col pt-2'>
          <main className='flex-grow overflow-y-auto px-2 font-sans'></main>
          <footer className='mt-auto hidden data-[state=loaded]:block data-[state=error]:hidden data-[state=loading]:hidden'>
            <a 
              className='not-eink:opacity-60 flex items-center p-2 text-xs link'
              href={`https://${realLang}.wikipedia.org/wiki/${encodeURIComponent(text)}`}
              target="_blank" 
              rel="noopener noreferrer"
            >
              Source: Wikipedia (CC BY-SA)
            </a>
          </footer>
        </div>
      </Popup>
    </div>
  );
};

export default WikipediaPopup;
