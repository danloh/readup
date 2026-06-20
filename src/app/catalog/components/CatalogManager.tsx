'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { 
  IoAdd, IoBook, IoEyeOff, IoEye, IoCloudDownloadOutline, IoEllipsisVertical 
} from 'react-icons/io5';
import { MdChevronRight } from 'react-icons/md';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';

import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { isWebAppPlatform } from '@/services/environment';
import { saveSysSettings } from '@/helpers/settings';
import { OPDSCatalog } from '@/types/opds';
import { isLanAddress } from '@/utils/network';
import ModalPortal from '@/components/ModalPortal';
import { SectionTitle } from '@/components/settings/primitives';
import MenuItem from '@/components/MenuItem';
import Menu from '@/components/Menu';
import Dropdown from '@/components/Dropdown';
import { eventDispatcher } from '@/utils/event';
import { 
  deleteSubscriptionState, loadSubscriptionState, OPDSSubscriptionState 
} from '@/services/opds';
import { validateOPDSURL } from '../utils/opdsUtils';
import {
  formatOPDSCustomHeadersInput,
  hasOPDSCustomHeaders,
  parseOPDSCustomHeadersInput,
} from '../utils/customHeaders';
import { FailedDownloadsDialog } from './FailedDownloadsDialog';

const POPULAR_CATALOGS: OPDSCatalog[] = [
  {
    id: 'gutenberg',
    name: 'Project Gutenberg',
    url: 'https://m.gutenberg.org/ebooks.opds/',
    description: "World's largest collection of free ebooks",
    icon: '🏛️',
  },
  {
    id: 'manybooks',
    name: 'ManyBooks',
    url: 'https://manybooks.net/opds/index.php',
    description: 'Over 50,000 free ebooks',
    icon: '📖',
  },
  {
    id: 'unglue.it',
    name: 'Unglue.it',
    url: 'https://unglue.it/api/opds/',
    description: 'Free ebooks from authors who have "unglued" their books',
    icon: '🔓',
  },
];

const EMPTY_NEW_CATALOG = {
  name: '',
  url: '',
  description: '',
  username: '',
  password: '',
  proxy: '',
  customHeadersInput: '',
  proxyConsent: false,
  autoDownload: false,
};

async function validateOPDSCatalog(
  url: string,
  username?: string,
  password?: string,
  customHeaders?: Record<string, string>,
): Promise<{ valid: boolean; error?: string }> {
  const result = await validateOPDSURL(url, username, password, isWebAppPlatform(), customHeaders);
  return { valid: result.isValid, error: result.error };
}

interface CMProps {
  closeDialog: () => void;
}

export function CatalogManager({ closeDialog }: CMProps) {
  const _ = useTranslation();
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const { settings } = useSettingsStore();
  const [catalogs, setCatalogs] = useState<OPDSCatalog[]>(() => settings.opdsCatalogs || []);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCatalog, setNewCatalog] = useState(EMPTY_NEW_CATALOG);
  const [showPassword, setShowPassword] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [headerError, setHeaderError] = useState('');
  const [proxyConsentError, setProxyConsentError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const popularCatalogs = appService?.distChannel !== 'appstore' ? POPULAR_CATALOGS : [];

  const [subscriptionStates, setSubscriptionStates] = useState<
    Record<string, OPDSSubscriptionState>
  >({});
  const [failedDialogCatalogId, setFailedDialogCatalogId] = useState<string | null>(null);

  const reloadSubscriptionStates = useCallback(async () => {
    if (!appService) return;
    const eligible = catalogs.filter((c) => c.autoDownload);
    const entries = await Promise.all(
      eligible.map(async (c) => [c.id, await loadSubscriptionState(appService, c.id)] as const),
    );
    setSubscriptionStates(Object.fromEntries(entries));
  }, [appService, catalogs]);

  useEffect(() => {
    reloadSubscriptionStates();
  }, [reloadSubscriptionStates]);

  useEffect(() => {
    const handler = () => {
      reloadSubscriptionStates();
    };
    eventDispatcher.on('opds-sync-complete', handler);
    return () => eventDispatcher.off('opds-sync-complete', handler);
  }, [reloadSubscriptionStates]);
  
  const hasSensitiveWebOPDSInput =
    newCatalog.username.trim().length > 0 ||
    newCatalog.password.trim().length > 0 ||
    newCatalog.customHeadersInput.trim().length > 0;
  const isWebCatalogProxyWarningRequired = isWebAppPlatform() && hasSensitiveWebOPDSInput;

  const saveCatalogs = (updatedCatalogs: OPDSCatalog[]) => {
    setCatalogs(updatedCatalogs);
    saveSysSettings(envConfig, 'opdsCatalogs', updatedCatalogs);
  };

  const saveOpdsProxy = (url_: string, proxy_: string) => {
    const url = url_.trim();
    const proxy = proxy_.trim();
    if (!url || !proxy) return;
    const proxies = settings.opdsProxy || {};
    proxies[url] = proxy;
    saveSysSettings(envConfig, 'opdsProxy', proxies);
    localStorage.setItem('opdsProxy', JSON.stringify(proxies));
  };

  const handleAddCatalog = async () => {
    if (!newCatalog.name || !newCatalog.url) return;

    const parsedHeaders = parseOPDSCustomHeadersInput(newCatalog.customHeadersInput);
    if (parsedHeaders.error) {
      setHeaderError(parsedHeaders.error);
      return;
    }

    const urlLower = newCatalog.url.trim().toLowerCase();
    if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) {
      setUrlError(_('URL must start with http:// or https://'));
      return;
    }

    if (
      process.env['NODE_ENV'] === 'production' &&
      isWebAppPlatform() &&
      isLanAddress(newCatalog.url)
    ) {
      setUrlError(_('Adding LAN addresses is not supported in the web app version.'));
      return;
    }

    if (isWebCatalogProxyWarningRequired && !newCatalog.proxyConsent) {
      setProxyConsentError(
        _(
          'Please confirm that this OPDS connection will be proxied before continuing.',
        ),
      );
      return;
    }

    setIsValidating(true);
    setUrlError('');
    setHeaderError('');
    setProxyConsentError('');

    // Add the proxy to the Proxy Map
    saveOpdsProxy(newCatalog.url, newCatalog.proxy);

    const validation = await validateOPDSCatalog(
      newCatalog.url,
      newCatalog.username || undefined,
      newCatalog.password || undefined,
      parsedHeaders.headers,
    );

    if (!validation.valid) {
      setUrlError(validation.error || _('Invalid OPDS catalog. Please check the URL.'));
      setIsValidating(false);
      return;
    }

    const catalog: OPDSCatalog = {
      id: editingCatalogId || Date.now().toString(),
      name: newCatalog.name,
      url: newCatalog.url,
      description: newCatalog.description,
      username: newCatalog.username || undefined,
      password: newCatalog.password || undefined,
      proxy: newCatalog.proxy || undefined,
      customHeaders: hasOPDSCustomHeaders(parsedHeaders.headers)
        ? parsedHeaders.headers
        : undefined,
      autoDownload: newCatalog.autoDownload || undefined,
    };

    if (editingCatalogId) {
      saveCatalogs(catalogs.map((c) => (c.id === editingCatalogId ? catalog : c)));
    } else {
      saveCatalogs([catalog, ...catalogs]);
    }

    setNewCatalog(EMPTY_NEW_CATALOG);
    setUrlError('');
    setHeaderError('');
    setProxyConsentError('');
    setIsValidating(false);
    setEditingCatalogId(null);
    setShowAddDialog(false);
  };

  const handleEditCatalog = (catalog: OPDSCatalog) => {
    setNewCatalog({
      name: catalog.name,
      url: catalog.url,
      description: catalog.description || '',
      username: catalog.username || '',
      password: catalog.password || '',
      customHeadersInput: formatOPDSCustomHeadersInput(catalog.customHeaders),
      proxy: catalog.proxy || '',
      proxyConsent: false,
      autoDownload: catalog.autoDownload || false,
    });
    setEditingCatalogId(catalog.id);
    setShowAddDialog(true);
  };

  const handleAddPopularCatalog = (popularCatalog: OPDSCatalog) => {
    if (catalogs.some((c) => c.url === popularCatalog.url)) {
      return;
    }

    saveCatalogs([...catalogs, { ...popularCatalog }]);
  };

  const handleRemoveCatalog = (id: string) => {
    saveCatalogs(catalogs.filter((c) => c.id !== id));
    if (appService) {
      // Don't await — leftover state files are harmless and we don't want to
      // block UI removal if the filesystem call fails.
      void deleteSubscriptionState(appService, id);
    }
  };

  const handleToggleAutoDownload = (id: string) => {
    const wasEnabled = catalogs.find((c) => c.id === id)?.autoDownload;
    saveCatalogs(catalogs.map((c) => (c.id === id ? { ...c, autoDownload: !c.autoDownload } : c)));
    // When the user just enabled auto-download, sync now instead of waiting
    // for the next app launch / pull-to-refresh.
    if (!wasEnabled) {
      eventDispatcher.dispatch('check-opds-subscriptions');
    }
  };

  const handleOpenCatalog = (catalog: OPDSCatalog) => {
    const params = new URLSearchParams({ url: catalog.url });
    params.set('id', catalog.id);
    router.push(`/catalog?${params.toString()}`);
    closeDialog();
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setNewCatalog(EMPTY_NEW_CATALOG);
    setUrlError('');
    setHeaderError('');
    setProxyConsentError('');
    setShowPassword(false);
    setEditingCatalogId(null);
  };

  return (
    <div className='container max-w-2xl'>
      <div className='mb-8'>
        <h1 className='mb-2 text-base font-bold'>{_('OPDS Catalogs')}</h1>
        <p className='text-base-content/70 text-xs'>
          {_('Browse and download books from online catalogs')}
        </p>
      </div>

      {/* My Catalogs */}
      <section className='mb-8 text-base'>
        <div className='mb-4 flex items-center justify-between'>
          <SectionTitle>{_('My Catalogs')}</SectionTitle>
          <button
            onClick={() => setShowAddDialog(true)}
            className='eink-bordered border-base-200 hover:border-base-300 hover:bg-base-200/60 focus-visible:ring-base-content/15 inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2'
          >
            <IoAdd className='h-4 w-4' />
            {_('Add Catalog')}
          </button>
        </div>

        {catalogs.length === 0 ? (
          <div className='eink-bordered border-base-300 rounded-lg border-2 border-dashed p-8 text-center'>
            <IoBook className='text-base-content/40 mx-auto mb-4 h-12 w-12' />
            <h3 className='mb-2 font-semibold'>{_('No catalogs yet')}</h3>
            <p className='text-base-content/70 mb-4 text-sm'>
              {_('Add your first OPDS catalog to start browsing books')}
            </p>
            <button onClick={() => setShowAddDialog(true)} className='btn btn-primary btn-sm'>
              {_('Add Your First Catalog')}
            </button>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            {catalogs.map((catalog) => {
              const subState = subscriptionStates[catalog.id];
              const lastCheckedAt = subState?.lastCheckedAt ?? 0;
              const failedCount = subState?.failedEntries.length ?? 0;
              const showSubscriptionStatus =
                catalog.autoDownload && subState && (lastCheckedAt > 0 || failedCount > 0);

              return (
                // Whole card is the browse trigger. Uses role='button' (not
                // a real <button>) because it nests other interactive
                // elements: the 3-dot menu, auto-download toggle, and
                // failed-downloads link. Inner controls call
                // e.stopPropagation() so their clicks don't bubble.
                <div
                  key={catalog.id}
                  role='button'
                  tabIndex={catalog.disabled ? -1 : 0}
                  onClick={() => !catalog.disabled && handleOpenCatalog(catalog)}
                  onKeyDown={(e) => {
                    if (catalog.disabled) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenCatalog(catalog);
                    }
                  }}
                  className={clsx(
                    'card eink-bordered bg-base-100 border-base-200 group/card flex flex-col border transition-colors duration-150',
                    'focus-visible:ring-base-content/15 focus-visible:outline-none focus-visible:ring-2',
                    catalog.disabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-base-300 cursor-pointer',
                  )}
                >
                  <div className='flex flex-1 flex-col gap-2.5 px-4 pb-2 pt-4'>
                    {/* Header: icon + name + chevron hint (whole card is
                        the click target) | overflow menu (Edit / Remove). */}
                    <div className='flex items-start justify-between gap-2'>
                      <h4 className='flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold'>
                        {catalog.icon && <span className='flex-shrink-0'>{catalog.icon}</span>}
                        <span className='truncate'>{catalog.name}</span>
                      </h4>
                      {/* stopPropagation on the trigger wrapper so opening
                          the menu doesn't also browse the catalog.
                          The Dropdown component itself handles floating the
                          menu via daisyui's `.dropdown .dropdown-content`
                          position:absolute rule — don't add !relative here
                          or the menu inlines into the card layout. */}
                      <div
                        className='-mr-1.5 -mt-1 flex-shrink-0'
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Dropdown
                          label={_('Catalog actions')}
                          className='dropdown-bottom dropdown-end'
                          buttonClassName='text-base-content/55 hover:bg-base-200 hover:text-base-content focus-visible:ring-base-content/15 flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2'
                          toggleButton={<IoEllipsisVertical className='h-4 w-4' />}
                        >
                          <Menu className='dropdown-content no-triangle border-base-300 z-20 mt-1 min-w-[8rem] rounded-lg border shadow-lg'>
                            <MenuItem
                              noIcon
                              
                              label={_('Edit')}
                              onClick={() => handleEditCatalog(catalog)}
                            />
                            <MenuItem
                              noIcon
                              label={_('Remove')}
                              onClick={() => handleRemoveCatalog(catalog.id)}
                            />
                          </Menu>
                        </Dropdown>
                      </div>
                    </div>

                    {/* Description (optional) — single line in My Catalogs
                        to keep cards compact and consistent in height
                        regardless of description length. */}
                    {catalog.description && (
                      <p className='text-base-content/70 line-clamp-1 text-xs leading-relaxed'>
                        {catalog.description}
                      </p>
                    )}

                    {/* URL — quieter, mono-ish */}
                    <p className='text-base-content/55 truncate text-[11px]' title={catalog.url}>
                      {catalog.url}
                    </p>

                    {/* Auto-download row — label and toggle live in a SAME
                        flex line (items-center → vertically centered with
                        each other). Subline sits beneath as a sibling.
                        The subline always renders (with &nbsp; placeholder
                        when no status data) so the row's total height stays
                        constant — toggling AD on/off or sync-status data
                        arriving via opds-sync-complete never shifts the
                        card. Browse is the whole-card click; stopPropagation
                        on the label so toggling doesn't also browse. */}
                    <div className='mt-auto flex flex-col gap-0.5 hidden'>
                      <label
                        onClick={(e) => e.stopPropagation()}
                        className={clsx(
                          'flex items-center justify-between gap-2',
                          catalog.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                        )}
                      >
                        <span className='text-base-content/80 inline-flex items-center gap-1.5 text-xs'>
                          <IoCloudDownloadOutline className='h-3.5 w-3.5' />
                          {_('Auto-download')}
                        </span>
                        <input
                          type='checkbox'
                          className='toggle toggle-sm toggle-primary flex-shrink-0'
                          checked={!!catalog.autoDownload}
                          disabled={!!catalog.disabled}
                          onChange={() => handleToggleAutoDownload(catalog.id)}
                        />
                      </label>
                      <span className='text-base-content/55 truncate text-[11px] leading-tight'>
                        {showSubscriptionStatus ? (
                          <>
                            {lastCheckedAt > 0 && (
                              <span>
                                {_('Last synced {{when}}', {
                                  when: dayjs(lastCheckedAt).fromNow(),
                                })}
                              </span>
                            )}
                            {failedCount > 0 && (
                              <>
                                {lastCheckedAt > 0 && <span aria-hidden> · </span>}
                                <button
                                  type='button'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFailedDialogCatalogId(catalog.id);
                                  }}
                                  className='text-error hover:underline'
                                >
                                  {_('{{count}} failed', { count: failedCount })}
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          // &nbsp; reserves line-height so the row above
                          // stays anchored at a consistent vertical position.
                          <>&nbsp;</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Popular Catalogs */}
      <section className={clsx('text-base', popularCatalogs.length === 0 && 'hidden')}>
        <SectionTitle className='mb-3'>{_('Popular Catalogs')}</SectionTitle>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {popularCatalogs
            .filter((catalog) => !catalog.disabled)
            .map((catalog) => {
              const isAdded = catalogs.some((c) => c.url === catalog.url);
              return (
                <div
                  key={catalog.id}
                  className='card eink-bordered bg-base-100 border-base-200 flex flex-col border'
                >
                  <div className='flex flex-1 flex-col gap-2.5 p-4'>
                    <h4>
                      <button
                        type='button'
                        onClick={() => handleOpenCatalog(catalog)}
                        className='flex w-full min-w-0 items-center gap-1.5 rounded-sm text-start text-sm font-semibold transition-colors duration-150 hover:underline focus-visible:underline focus-visible:outline-none'
                      >
                        {catalog.icon && <span className='flex-shrink-0'>{catalog.icon}</span>}
                        <span className='truncate'>{catalog.name}</span>
                      </button>
                    </h4>
                    {catalog.description && (
                      <p className='text-base-content/70 line-clamp-2 text-xs leading-relaxed'>
                        {catalog.description}
                      </p>
                    )}
                    <div className='border-base-200 mt-auto flex items-center justify-end gap-1 border-t pt-3'>
                      {!isAdded && (
                        <button
                          onClick={() => handleAddPopularCatalog(catalog)}
                          className='hover:bg-base-200 focus-visible:ring-base-content/15 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2'
                        >
                          <IoAdd className='h-4 w-4' />
                          {_('Add')}
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenCatalog(catalog)}
                        className='hover:bg-base-200 focus-visible:ring-base-content/15 inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2'
                      >
                        {_('Browse')}
                        <MdChevronRight className='h-4 w-4' />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Add/Edit Catalog Dialog */}
      {showAddDialog && (
        <ModalPortal>
          <dialog className='modal modal-open'>
            <div className='modal-box'>
              <h3 className='mb-4 text-lg font-semibold tracking-tight'>
                {editingCatalogId ? _('Edit OPDS Catalog') : _('Add OPDS Catalog')}
              </h3>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAddCatalog();
                }}
                className='space-y-4'
              >
                <div className='form-control'>
                  <div className='label'>
                    <span className='label-text'>{_('Catalog Name')} *</span>
                  </div>
                  <input
                    type='text'
                    value={newCatalog.name}
                    onChange={(e) => setNewCatalog({ ...newCatalog, name: e.target.value.trim() })}
                    placeholder={_('My Online Library')}
                    className='input input-bordered eink-bordered placeholder:text-sm'
                    disabled={isValidating}
                    required
                  />
                </div>

                <div className='form-control'>
                  <div className='label'>
                    <span className='label-text'>{_('OPDS URL')} *</span>
                  </div>
                  <input
                    type='url'
                    value={newCatalog.url}
                    onChange={(e) => {
                      setNewCatalog({ ...newCatalog, url: e.target.value.trim() });
                      setUrlError('');
                    }}
                    placeholder='https://example.com/opds'
                    className='input input-bordered eink-bordered placeholder:text-sm'
                    disabled={isValidating}
                    required
                  />
                  {urlError && (
                    <div className='label'>
                      <span className='label-text-alt text-error'>{urlError}</span>
                    </div>
                  )}
                </div>

                <div className='form-control'>
                  <div className='label'>
                    <span className='label-text'>{_('Description (optional)')}</span>
                  </div>
                  <textarea
                    value={newCatalog.description}
                    onChange={(e) => setNewCatalog({ ...newCatalog, description: e.target.value })}
                    placeholder={_('A brief description of this catalog')}
                    className='textarea textarea-bordered eink-bordered text-sm placeholder:text-sm'
                    rows={2}
                    disabled={isValidating}
                  />
                </div>

                <div className='form-control'>
                  <div className='label'>
                    <span className='label-text'>{_('Proxy URL (optional)')}</span>
                  </div>
                  <input
                    type='text'
                    value={newCatalog.proxy}
                    onChange={(e) => setNewCatalog({ ...newCatalog, proxy: e.target.value.trim() })}
                    placeholder={_('URL for proxy')}
                    className='input input-bordered eink-bordered placeholder:text-sm'
                    disabled={isValidating}
                  />
                </div>

                <div className='form-control'>
                  <div className='label'>
                    <span className='label-text'>{_('Username (optional)')}</span>
                  </div>
                  <input
                    type='text'
                    value={newCatalog.username}
                    onChange={(e) => {
                      setNewCatalog({ ...newCatalog, username: e.target.value });
                      setProxyConsentError('');
                    }}
                    placeholder={_('Username')}
                    className='input input-bordered eink-bordered placeholder:text-sm'
                    disabled={isValidating}
                    autoComplete='username'
                  />
                </div>

                <div className='form-control'>
                  <div className='label'>
                    <span className='label-text'>{_('Password (optional)')}</span>
                  </div>
                  <div className='relative'>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newCatalog.password}
                      onChange={(e) => {
                        setNewCatalog({ ...newCatalog, password: e.target.value });
                        setProxyConsentError('');
                      }}
                      placeholder={_('Password')}
                      className='input input-bordered eink-bordered w-full pr-10 placeholder:text-sm'
                      disabled={isValidating}
                      autoComplete='current-password'
                    />
                    <button
                      type='button'
                      onClick={() => setShowPassword(!showPassword)}
                      className='btn btn-ghost btn-sm btn-square absolute right-1 top-1/2 -translate-y-1/2'
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <IoEyeOff className='h-4 w-4' />
                      ) : (
                        <IoEye className='h-4 w-4' />
                      )}
                    </button>
                  </div>
                </div>

                <div className='form-control'>
                  <div className='label'>
                    <span className='label-text'>{_('Custom Headers (optional)')}</span>
                  </div>
                  <textarea
                    value={newCatalog.customHeadersInput}
                    onChange={(e) => {
                      setNewCatalog({ ...newCatalog, customHeadersInput: e.target.value });
                      setHeaderError('');
                      setProxyConsentError('');
                    }}
                    placeholder={formatOPDSCustomHeadersInput({
                      'CF-Access-Client-Id': 'your-client-id',
                      'CF-Access-Client-Secret': 'your-client-secret',
                    })}
                    className='textarea textarea-bordered eink-bordered font-mono text-sm placeholder:text-xs'
                    rows={4}
                    disabled={isValidating}
                    spellCheck={false}
                  />
                  <div className='label'>
                    <span className='label-text-alt text-base-content/60'>
                      {_('Add one header per line using "Header-Name: value".')}
                    </span>
                  </div>
                  {headerError && (
                    <div className='label pt-0'>
                      <span className='label-text-alt text-error'>{headerError}</span>
                    </div>
                  )}
                </div>

                {isWebCatalogProxyWarningRequired && (
                  <div className='form-control border-warning/30 bg-warning/10 rounded-lg border p-4'>
                    <label className='label cursor-pointer items-start justify-start gap-3 p-0'>
                      <input
                        type='checkbox'
                        className='checkbox checkbox-sm mt-0.5'
                        checked={newCatalog.proxyConsent}
                        onChange={(e) => {
                          setNewCatalog({ ...newCatalog, proxyConsent: e.target.checked });
                          setProxyConsentError('');
                        }}
                        disabled={isValidating}
                      />
                      <span className='label-text text-sm leading-6'>
                        {_(
                          'I understand this OPDS connection will be proxied on the web app. If I do not trust Proxy with these credentials or headers, I should use the native app instead.',
                        )}
                      </span>
                    </label>
                    {proxyConsentError && (
                      <div className='label px-0 pb-0 pt-2'>
                        <span className='label-text-alt text-error'>{proxyConsentError}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className='form-control hidden'>
                  <label className='label cursor-pointer justify-start gap-3 p-0'>
                    <input
                      type='checkbox'
                      className='toggle toggle-sm toggle-primary'
                      checked={newCatalog.autoDownload}
                      onChange={(e) =>
                        setNewCatalog({ ...newCatalog, autoDownload: e.target.checked })
                      }
                      disabled={isValidating}
                    />
                    <div>
                      <span className='label-text'>{_('Auto-download new items')}</span>
                      <p className='text-base-content/60 text-xs'>
                        {_('Automatically download new publications when the app syncs')}
                      </p>
                    </div>
                  </label>
                </div>

                <div className='modal-action gap-2'>
                  <button
                    type='button'
                    onClick={handleCloseDialog}
                    disabled={isValidating}
                    className={clsx(
                      'eink-bordered',
                      'h-10 rounded-lg px-4 text-sm font-medium',
                      'text-base-content hover:bg-base-200',
                      'transition-colors duration-150',
                      'focus-visible:ring-base-content/15 focus-visible:outline-none focus-visible:ring-2',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                      'disabled:hover:bg-transparent',
                    )}
                  >
                    {_('Cancel')}
                  </button>
                  <button
                    type='submit'
                    disabled={isValidating}
                    className={clsx(
                      'btn btn-primary',
                      'h-10 min-h-10 rounded-lg border-0 px-5 text-sm font-medium',
                      'focus-visible:ring-primary/40 focus-visible:outline-none focus-visible:ring-2',
                      isValidating && 'opacity-60',
                    )}
                  >
                    {isValidating ? (
                      <>
                        <span className='loading loading-dots text-success loading-sm'></span>
                        {_('Validating...')}
                      </>
                    ) : editingCatalogId ? (
                      _('Save Changes')
                    ) : (
                      _('Add Catalog')
                    )}
                  </button>
                </div>
              </form>
            </div>
          </dialog>
        </ModalPortal>
      )}

      {failedDialogCatalogId && (
        <FailedDownloadsDialog
          catalogId={failedDialogCatalogId}
          catalogName={catalogs.find((c) => c.id === failedDialogCatalogId)?.name ?? ''}
          onClose={() => {
            setFailedDialogCatalogId(null);
            // The dialog mutates failedEntries / knownEntryIds — refresh the
            // status row so changes are visible without waiting for a sync.
            reloadSubscriptionStates();
          }}
        />
      )}
    </div>
  );
}
