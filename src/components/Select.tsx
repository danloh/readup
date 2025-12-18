import clsx from 'clsx';
import React from 'react';
import { TRANSLATED_LANGS } from '@/services/constants';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';

type Option = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: Option[];
  disabled?: boolean;
  className?: string;
};

export default function Select({
  value,
  onChange,
  options,
  className,
  disabled = false,
}: SelectProps) {
  return (
    <select
      value={value}
      onChange={onChange}
      onKeyDown={(e) => e.stopPropagation()}
      className={clsx('select bg-base-200 h-8 min-h-8 rounded-md border-none text-sm', className)}
      disabled={disabled}
      style={{
        textAlignLast: 'end',
      }}
    >
      {options.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}


export const getLangOptions = (langs: Record<string, string>, label: string) => {
  const options = Object.entries(langs).map(([value, label]) => ({ value, label }));
  options.sort((a, b) => a.label.localeCompare(b.label));
  options.unshift({ value: '', label });
  return options;
};

export function LangSelect() {
  const _ = useTranslation();
  const { setUILang } = useThemeStore();
  
  const getCurrentUILangOption = () => {
    const uiLang = localStorage?.getItem('i18nextLng') || '';
    return {
      value: uiLang,
      label:
        uiLang === ''
          ? _('Auto')
          : TRANSLATED_LANGS[uiLang as keyof typeof TRANSLATED_LANGS],
    };
  };

  const handleSelectUILang = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const option = event.target.value;
    setUILang(option);
  };

  return (
    <Select
      value={getCurrentUILangOption().value}
      onChange={handleSelectUILang}
      options={getLangOptions(TRANSLATED_LANGS, _('System Language'))}
    />
  );
}
