import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  Check,
  DatabaseZap,
  Globe,
  Orbit,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Badge } from '@/components/ui/base-ui/badge';
import { Button } from '@/components/ui/base-ui/button';
import { Input } from '@/components/ui/base-ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/base-ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/base-ui/select';
import { Separator } from '@/components/ui/base-ui/separator';
import { Slider } from '@/components/ui/base-ui/slider';
import { Switch } from '@/components/ui/base-ui/switch';
import { Textarea } from '@/components/ui/base-ui/textarea';
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame';
import { Scrollspy } from '@/components/reui/scrollspy';
import { cn } from '@/lib/utils';
import { clearPickupCaches } from '@/lib/pickup/cache/clear';
import {
  PICKUP_RENDER_MODE_SYNTAX_REBUILD,
  PICKUP_RENDER_MODE_VOCAB_INFUSION,
  type PickupRenderMode,
} from '@/lib/pickup/content/render-mode';
import { PICKUP_TYPES } from '@/lib/pickup/pickup-types';
import {
  DEFAULT_PICKUP_SETTINGS,
  getPickupSettings,
  setPickupSettings,
  type PickupStylePreset,
} from '@/lib/pickup/settings';
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_MODEL_LIST,
  ensureTranslateProviderStored,
  getStoredLlmModel,
  getStoredLlmModelList,
  hasStoredLlmApiKey,
  setStoredLlmApiKey,
  setStoredLlmModel,
  setStoredLlmModelList,
  setStoredTranslateProvider,
} from '@/lib/pickup/background/translate/storage';
import {
  DEFAULT_TRANSLATE_PROVIDER,
  TRANSLATE_PROVIDERS,
  TRANSLATE_PROVIDER_LABELS,
} from '@/lib/pickup/translate/options';

const STYLE_PRESETS: Array<{
  id: PickupStylePreset;
  title: string;
  description: string;
}> = [
  { id: 'underline', title: '线条', description: '只保留下划线，保持轻量提示。' },
  { id: 'soft-bg', title: '柔和底色', description: '背景轻提示，阅读更柔和。' },
  { id: 'underline-soft', title: '线条 + 底色', description: '双重提示，结构最清晰。' },
];

const MODE_OPTIONS: Array<{ id: PickupRenderMode; label: string; hint: string }> = [
  { id: PICKUP_RENDER_MODE_SYNTAX_REBUILD, label: '翻译语法', hint: '默认显示结构化译文。' },
  { id: PICKUP_RENDER_MODE_VOCAB_INFUSION, label: '原生语法', hint: '强调原文结构与词汇。' },
];

const NAV_ITEMS = [
  {
    id: 'general',
    title: '基本设置',
    description: '启用、模式与服务',
    icon: Sparkles,
  },
  {
    id: 'style',
    title: '译文样式',
    description: '高亮风格与透明度',
    icon: SlidersHorizontal,
  },
  {
    id: 'ignore',
    title: '忽略名单',
    description: '不翻译的网站',
    icon: Globe,
  },
  {
    id: 'floating',
    title: '悬浮球',
    description: '开关与提示',
    icon: Orbit,
  },
  {
    id: 'model',
    title: '模型设置',
    description: 'LLM 插件配置',
    icon: Wand2,
    badge: '插件',
  },
] as const;

function normalizeIgnoreList(raw: string) {
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function SectionCard({
  id,
  title,
  subtitle,
  icon,
  children,
  headerRight,
}: {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Frame spacing="sm">
        <FramePanel className="bg-background-quaternary">
          <FrameHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border options-accent-border bg-background-secondary options-accent-text">
                  {icon}
                </div>
                <div>
                  <FrameTitle className="text-base text-foreground">{title}</FrameTitle>
                  <FrameDescription className="text-xs text-text-tertiary">{subtitle}</FrameDescription>
                </div>
              </div>
              {headerRight}
            </div>
          </FrameHeader>
          <Separator className="my-4" />
          <div className="grid gap-4">{children}</div>
        </FramePanel>
      </Frame>
    </section>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description ? (
          <div className="text-xs text-text-tertiary">{description}</div>
        ) : null}
      </div>
      <div className="w-full md:w-auto">{children}</div>
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_PICKUP_SETTINGS);
  const [ignoreText, setIgnoreText] = useState('');
  const [translateProvider, setTranslateProvider] = useState(DEFAULT_TRANSLATE_PROVIDER);
  const [llmModel, setLlmModel] = useState(DEFAULT_LLM_MODEL);
  const [llmModels, setLlmModels] = useState<string[]>(DEFAULT_LLM_MODEL_LIST);
  const [newModelInput, setNewModelInput] = useState('');
  const [llmKeyInput, setLlmKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'clearing' | 'done' | 'error'>('idle');
  const scrollTargetRef = useRef<HTMLDivElement | null>(null);

  const grammarColor = useMemo(() => PICKUP_TYPES[0], []);
  const vocabColor = useMemo(() => PICKUP_TYPES[1], []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const loadedSettings = await getPickupSettings();
        const provider = await ensureTranslateProviderStored();
        const model = await getStoredLlmModel();
        const models = await getStoredLlmModelList();
        const apiKeyReady = await hasStoredLlmApiKey();
        if (!active) {
          return;
        }
        setSettings(loadedSettings);
        setIgnoreText(loadedSettings.ignoreList.join('\n'));
        setTranslateProvider(provider);
        setLlmModel(model);
        setLlmModels(models);
        setHasApiKey(apiKeyReady);
      } catch {
        // Ignore load failures and keep defaults.
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#general');
    }
  }, []);

  const handleNavClick = (id: string) => (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (typeof document === 'undefined') {
      return;
    }
    const section = document.getElementById(id);
    const container = scrollTargetRef.current;
    if (section && container) {
      const containerRect = container.getBoundingClientRect();
      const sectionRect = section.getBoundingClientRect();
      const top = sectionRect.top - containerRect.top + container.scrollTop - 16;
      container.scrollTo({ top, behavior: 'smooth' });
    } else if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    window.history.replaceState(null, '', `#${id}`);
  };

  const updateSettings = async (patch: Partial<typeof settings>) => {
    setSaveStatus('saving');
    try {
      const next = await setPickupSettings(patch);
      setSettings(next);
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1200);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleModeChange = (mode: PickupRenderMode) => {
    void updateSettings({ defaultRenderMode: mode });
  };

  const handleStyleChange = (preset: PickupStylePreset) => {
    void updateSettings({ stylePreset: preset });
  };

  const handleOpacityChange = (value: number | readonly number[]) => {
    const nextValue = Array.isArray(value) ? value[0] : value;
    if (typeof nextValue !== 'number') {
      return;
    }
    void updateSettings({ highlightOpacity: nextValue });
  };

  const handleIgnoreSave = () => {
    const parsed = normalizeIgnoreList(ignoreText);
    void updateSettings({ ignoreList: parsed });
    setIgnoreText(parsed.join('\n'));
  };

  const handleProviderChange = async (
    nextProvider: (typeof TRANSLATE_PROVIDERS)[number] | null,
  ) => {
    if (!nextProvider) {
      return;
    }
    setSaveStatus('saving');
    try {
      await setStoredTranslateProvider(nextProvider);
      setTranslateProvider(nextProvider);
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1200);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleApiKeySave = async () => {
    if (!llmKeyInput.trim()) {
      return;
    }
    setSaveStatus('saving');
    try {
      await setStoredLlmApiKey(llmKeyInput.trim());
      const ready = await hasStoredLlmApiKey();
      setHasApiKey(ready);
      setLlmKeyInput('');
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1200);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleModelSelect = async (value: string) => {
    setLlmModel(value);
    setSaveStatus('saving');
    try {
      const next = await setStoredLlmModel(value);
      setLlmModel(next);
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1200);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleModelAdd = async () => {
    const normalized = newModelInput.trim();
    if (!normalized) {
      return;
    }
    if (llmModels.includes(normalized)) {
      setNewModelInput('');
      return;
    }
    const nextList = [...llmModels, normalized];
    setSaveStatus('saving');
    try {
      const saved = await setStoredLlmModelList(nextList);
      setLlmModels(saved);
      await handleModelSelect(normalized);
      setNewModelInput('');
    } catch {
      setSaveStatus('error');
    }
  };

  const handleModelRemove = async (value: string) => {
    const nextList = llmModels.filter(item => item !== value);
    if (nextList.length === 0) {
      return;
    }
    setSaveStatus('saving');
    try {
      const saved = await setStoredLlmModelList(nextList);
      setLlmModels(saved);
      if (llmModel === value) {
        await handleModelSelect(saved[0]);
      }
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1200);
    } catch {
      setSaveStatus('error');
    }
  };

  const handleCacheClear = async () => {
    const confirmed = window.confirm('确认清除缓存吗？这会移除已缓存的解析与译文。');
    if (!confirmed) {
      return;
    }
    setCacheStatus('clearing');
    try {
      await clearPickupCaches();
      setCacheStatus('done');
      window.setTimeout(() => setCacheStatus('idle'), 1200);
    } catch {
      setCacheStatus('error');
    }
  };

  const cacheActionLabel = cacheStatus === 'clearing' ? '清理中…' : '清除缓存';
  const cacheBadge =
    cacheStatus === 'done'
      ? { label: '已清除', variant: 'secondary' as const }
      : cacheStatus === 'error'
        ? { label: '清理失败', variant: 'destructive' as const }
        : cacheStatus === 'clearing'
          ? { label: '清理中…', variant: 'outline' as const }
          : { label: '释放空间', variant: 'outline' as const };

  const saveBadge =
    saveStatus === 'saving'
      ? { label: '保存中…', variant: 'secondary' as const }
      : saveStatus === 'saved'
        ? { label: '已保存', variant: 'outline' as const }
        : saveStatus === 'error'
          ? { label: '保存失败', variant: 'destructive' as const }
          : { label: '自动保存', variant: 'outline' as const };

  const providerHint =
    translateProvider === 'llm'
      ? hasApiKey
        ? `LLM 已配置，当前模型：${llmModel || DEFAULT_LLM_MODEL}`
        : 'LLM 未配置 API Key，暂不可用。'
      : 'Google 免费翻译。';

  return (
    <div className="h-screen overflow-hidden bg-background-tertiary px-6 py-8 text-foreground">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6">
        <Frame spacing="sm" variant="ghost">
          <FramePanel className="bg-background-quaternary">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] options-accent-text">Xen Options</p>
                <h1 className="mt-2 text-2xl font-semibold text-foreground">后台设置面板</h1>
                <p className="mt-1 text-xs text-text-tertiary">
                  修改设置后新页面自动生效，已打开页面可能需要刷新。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={saveBadge.variant} className="gap-1">
                  {saveStatus === 'saved' ? <Check className="h-3 w-3" /> : null}
                  {saveBadge.label}
                </Badge>
              </div>
            </div>
          </FramePanel>
        </Frame>

        <div className="grid flex-1 min-h-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-6">
            <Frame spacing="sm">
              <FramePanel className="bg-background-quaternary">
                <FrameHeader>
                  <div className="text-sm font-medium text-foreground">设置导航</div>
                  <FrameDescription className="text-xs text-text-tertiary">
                    通过锚点定位配置区块。
                  </FrameDescription>
                </FrameHeader>
                <Separator className="my-3" />
                <Scrollspy
                  targetRef={scrollTargetRef}
                  offset={24}
                  className="flex flex-col gap-1"
                >
                  {NAV_ITEMS.map(item => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        data-scrollspy-anchor={item.id}
                        onClick={handleNavClick(item.id)}
                        className={cn(
                          'no-underline group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-foreground/70 transition-colors',
                          'hover:bg-background-secondary hover:text-foreground',
                          'data-[active=true]:options-accent-bg data-[active=true]:options-accent-text'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <div className="flex flex-1 flex-col">
                          <span className="font-medium">{item.title}</span>
                          <span className="text-xs text-text-tertiary group-data-[active=true]:options-accent-muted">
                            {item.description}
                          </span>
                        </div>
                        {'badge' in item && item.badge ? (
                          <Badge variant="outline" className="text-[10px] options-accent-text options-accent-border">
                            {item.badge}
                          </Badge>
                        ) : null}
                      </a>
                    );
                  })}
                </Scrollspy>
              </FramePanel>
            </Frame>
          </div>

          <div
            ref={scrollTargetRef}
            className="flex min-h-0 flex-col gap-6 overflow-y-auto pr-2"
          >
            <SectionCard
              id="general"
              title="基本设置"
              subtitle="全局启用、默认模式、翻译服务与缓存管理"
              icon={<Sparkles className="h-4 w-4" />}
            >
              <SettingRow
                title="启用翻译渲染"
                description="关闭后不再解析页面，但仍保留配置。"
              >
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(value) => updateSettings({ enabled: value })}
                />
              </SettingRow>

              <Separator />

              <div className="grid gap-3">
                <div className="text-sm font-medium text-foreground">默认模式</div>
                <RadioGroup
                  value={settings.defaultRenderMode}
                  onValueChange={(value) => handleModeChange(value as PickupRenderMode)}
                >
                  {MODE_OPTIONS.map(option => (
                    <label
                      key={option.id}
                      className={cn(
                        'flex items-start gap-3 rounded-md border border-border-primary bg-background-quaternary px-3 py-2 transition-colors',
                        settings.defaultRenderMode === option.id
                          ? 'options-accent-border options-accent-bg'
                          : 'hover:bg-background-secondary'
                      )}
                    >
                      <RadioGroupItem value={option.id} />
                      <div>
                        <div className="text-sm font-medium text-foreground">{option.label}</div>
                        <div className="text-xs text-text-tertiary">{option.hint}</div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              <div className="grid gap-2">
                <SettingRow title="翻译服务" description="选择默认翻译来源。">
                  <Select value={translateProvider} onValueChange={handleProviderChange}>
                    <SelectTrigger className="w-full md:w-56">
                      <SelectValue placeholder="选择翻译服务" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSLATE_PROVIDERS.map(provider => (
                        <SelectItem key={provider} value={provider}>
                          {TRANSLATE_PROVIDER_LABELS[provider]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
                <div className="text-xs text-text-tertiary">{providerHint}</div>
              </div>

              <Separator />

              <SettingRow
                title="缓存管理"
                description="清理缓存会移除已解析的语法与译文记录。"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCacheClear}
                    disabled={cacheStatus === 'clearing'}
                  >
                    <DatabaseZap className="h-4 w-4" />
                    {cacheActionLabel}
                  </Button>
                  <Badge variant={cacheBadge.variant}>{cacheBadge.label}</Badge>
                </div>
              </SettingRow>
            </SectionCard>

            <SectionCard
              id="style"
              title="译文显示样式"
              subtitle="控制高亮方式与透明度"
              icon={<SlidersHorizontal className="h-4 w-4" />}
            >
              <div className="grid gap-3">
                <div className="text-sm font-medium text-foreground">高亮方式</div>
                <RadioGroup
                  value={settings.stylePreset}
                  onValueChange={(value) => handleStyleChange(value as PickupStylePreset)}
                >
                  {STYLE_PRESETS.map(preset => (
                    <label
                      key={preset.id}
                      className={cn(
                        'flex items-start justify-between gap-3 rounded-md border border-border-primary bg-background-quaternary px-3 py-2 transition-colors',
                        settings.stylePreset === preset.id
                          ? 'options-accent-border options-accent-bg'
                          : 'hover:bg-background-secondary'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={preset.id} />
                        <div>
                          <div className="text-sm font-medium text-foreground">{preset.title}</div>
                          <div className="text-xs text-text-tertiary">{preset.description}</div>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-text-tertiary">
                        <span
                          className="rounded px-2 py-1"
                          style={{
                            backgroundColor: preset.id !== 'underline' ? grammarColor.background : 'transparent',
                            textDecoration: preset.id !== 'soft-bg' ? 'underline dashed' : 'none',
                            textDecorationColor: grammarColor.border,
                          }}
                        >
                          GR
                        </span>
                        <span
                          className="rounded px-2 py-1"
                          style={{
                            backgroundColor: preset.id !== 'underline' ? vocabColor.background : 'transparent',
                            textDecoration: preset.id !== 'soft-bg' ? 'underline dashed' : 'none',
                            textDecorationColor: vocabColor.border,
                          }}
                        >
                          VOC
                        </span>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Separator />

              <div className="grid gap-3">
                <div className="flex items-center justify-between text-sm font-medium text-foreground">
                  <span>高亮透明度</span>
                  <Badge variant="outline">{settings.highlightOpacity}%</Badge>
                </div>
                <Slider
                  value={[settings.highlightOpacity]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={handleOpacityChange}
                />
              </div>
            </SectionCard>

            <SectionCard
              id="ignore"
              title="站点忽略名单"
              subtitle="在这些网站上不进行翻译"
              icon={<Globe className="h-4 w-4" />}
            >
              <div className="grid gap-3">
                <Textarea
                  className="min-h-[160px]"
                  placeholder="每行一个域名，例如\nnews.ycombinator.com\n*.example.com"
                  value={ignoreText}
                  onChange={(event) => setIgnoreText(event.target.value)}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-text-tertiary">支持域名或完整 URL 前缀。</div>
                  <Button variant="outline" size="sm" onClick={handleIgnoreSave}>
                    保存忽略名单
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              id="floating"
              title="悬浮球设置"
              subtitle="控制浮标是否显示"
              icon={<Orbit className="h-4 w-4" />}
            >
              <SettingRow
                title="启用悬浮球"
                description="关闭后页面不再显示浮标。"
              >
                <Switch
                  checked={settings.floatingSidebarEnabled}
                  onCheckedChange={(value) => updateSettings({ floatingSidebarEnabled: value })}
                />
              </SettingRow>
              <div className="text-xs text-text-tertiary">悬浮球位置仍保留，可随时重新开启。</div>
            </SectionCard>

            <SectionCard
              id="model"
              title="模型设置"
              subtitle="LLM 模型与 API Key"
              icon={<Wand2 className="h-4 w-4" />}
              headerRight={(
                <Badge variant="outline" className="options-accent-border options-accent-text">
                  插件
                </Badge>
              )}
            >
              <div className="grid gap-3">
                <div className="text-sm font-medium text-foreground">LLM 模型列表</div>
                <RadioGroup value={llmModel} onValueChange={handleModelSelect}>
                  {llmModels.map(model => (
                    <div
                      key={model}
                      className={cn(
                        'flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-primary bg-background-quaternary px-3 py-2',
                        llmModel === model ? 'options-accent-border options-accent-bg' : null
                      )}
                    >
                      <label className="flex items-center gap-3">
                        <RadioGroupItem value={model} />
                        <span className="text-sm text-foreground">{model}</span>
                      </label>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => void handleModelRemove(model)}
                        disabled={llmModels.length <= 1}
                      >
                        移除
                      </Button>
                    </div>
                  ))}
                </RadioGroup>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={newModelInput}
                    onChange={(event) => setNewModelInput(event.target.value)}
                    placeholder={DEFAULT_LLM_MODEL}
                  />
                  <Button variant="secondary" size="sm" onClick={handleModelAdd}>
                    添加
                  </Button>
                </div>
                <div className="text-xs text-text-tertiary">
                  当前使用模型会影响译文缓存，切换后会重新生成。
                </div>
              </div>

              <Separator />

              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">LLM API Key</div>
                    <div className="text-xs text-text-tertiary">{hasApiKey ? '已保存' : '未配置'}</div>
                  </div>
                  {hasApiKey ? (
                    <Badge variant="secondary" className="gap-1">
                      <Check className="h-3 w-3" />
                      Ready
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="password"
                    value={llmKeyInput}
                    onChange={(event) => setLlmKeyInput(event.target.value)}
                    placeholder="粘贴新的 API Key"
                  />
                  <Button variant="outline" size="sm" onClick={handleApiKeySave}>
                    更新
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
