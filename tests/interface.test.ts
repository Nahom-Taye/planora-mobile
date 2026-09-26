import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';

import type { AppTheme } from '../src/theme/themes.ts';
import { contrastRatio } from '../src/theme/contrast.ts';
import { createTranslator } from '../src/features/localization/localization.ts';
import { host, native, renderer, sourceModule, type Renderer } from './runtime-harness.ts';

const nativeRuntime = { ...native, Platform: { select: (options: Record<string, unknown>) => options.default } };
const themes = sourceModule<{ lightTheme: AppTheme; darkTheme: AppTheme }>('src/theme/themes.ts', { 'react-native': nativeRuntime });
const theme = themes.lightTheme;
const flatten = (value: unknown): Record<string, unknown> => Array.isArray(value)
  ? Object.assign({}, ...value.map(flatten))
  : value && typeof value === 'object' ? value as Record<string, unknown> : {};

test('current light and dark text, actions and selected controls retain readable contrast', () => {
  for (const selectedTheme of [themes.lightTheme, themes.darkTheme]) {
    const colors = selectedTheme.colors;
    for (const background of ['background', 'surface', 'surfaceSubtle'] as const) {
      for (const foreground of ['text', 'textMuted', 'primary', 'accent', 'danger', 'warning'] as const) {
        assert.ok(contrastRatio(colors[foreground], colors[background]) >= 4.5, `${selectedTheme.mode}: ${foreground} on ${background}`);
      }
    }
    assert.ok(contrastRatio(colors.onPrimary, colors.primary) >= 4.5);
    assert.ok(contrastRatio(colors.onDanger, colors.danger) >= 4.5);
    assert.ok(contrastRatio(colors.accent, colors.accentSoft) >= 4.5);
  }
});

test('shared text follows Arabic direction while preserving explicit alignment and font scaling', async () => {
  const { Text } = sourceModule<{ Text: React.ComponentType<Record<string, unknown>> }>('src/components/ui/text.tsx', {
    'react-native': nativeRuntime,
    '@/hooks/use-app-theme': { useAppTheme: () => theme },
    '@/providers/localization-provider': { useLocalization: () => ({ isRTL: true, direction: 'rtl' }) },
  });
  let mounted!: Renderer;
  try {
    await renderer.act(() => { mounted = renderer.create(React.createElement(Text, { variant: 'display' }, 'العربية')); });
    const props = mounted.root.findAllByType('Text')[0].props;
    assert.equal(flatten(props.style).textAlign, 'right');
    assert.equal(flatten(props.style).letterSpacing, 0);
    assert.notEqual(props.allowFontScaling, false);
    await renderer.act(() => mounted.update(React.createElement(Text, { align: 'center' }, 'العربية')));
    assert.equal(flatten(mounted.root.findAllByType('Text')[0].props.style).textAlign, 'center');
  } finally { if (mounted) await renderer.act(() => mounted.unmount()); }
});

test('input focus styling preserves caller events, editing, errors and password visibility', async () => {
  for (const [file, name] of [['src/components/ui/form-field.tsx', 'FormField'], ['src/features/auth/components/auth-text-field.tsx', 'AuthTextField']]) {
    const translate = createTranslator('en');
    const module = sourceModule<Record<string, React.ComponentType<Record<string, unknown>>>>(file, {
      'react-native': nativeRuntime,
      '@expo/vector-icons/Ionicons': host('Icon'),
      '@/components/ui': { Text: host('Text') },
      '@/hooks/use-app-theme': { useAppTheme: () => theme },
      '@/providers/localization-provider': { useLocalization: () => ({ t: translate, direction: 'ltr', isRTL: false }) },
    });
    let focusEvents = 0;
    let blurEvents = 0;
    let edited = '';
    const props = { label: 'Field', value: '', password: name === 'AuthTextField', onFocus: () => { focusEvents++; }, onBlur: () => { blurEvents++; }, onChangeText: (value: string) => { edited = value; } };
    let mounted!: Renderer;
    try {
      await renderer.act(() => { mounted = renderer.create(React.createElement(module[name], props)); });
      const input = () => mounted.root.findAllByType('TextInput')[0];
      await renderer.act(() => (input().props.onFocus as (event: object) => void)({}));
      assert.equal(focusEvents, 1);
      const styledNodes = [...mounted.root.findAllByType('View'), input()];
      assert.ok(styledNodes.some((node) => flatten(node.props.style).borderColor === theme.colors.primary));
      await renderer.act(() => (input().props.onChangeText as (value: string) => void)('Updated'));
      assert.equal(edited, 'Updated');
      if (name === 'AuthTextField') {
        assert.equal(input().props.secureTextEntry, true);
        await renderer.act(() => (mounted.root.findByProps({ accessibilityLabel: translate('auth.showPassword') }).props.onPress as () => void)());
        assert.equal(input().props.secureTextEntry, false);
      }
      await renderer.act(() => mounted.update(React.createElement(module[name], { ...props, error: 'Required' })));
      assert.ok([...mounted.root.findAllByType('View'), input()].some((node) => flatten(node.props.style).borderColor === theme.colors.danger));
      await renderer.act(() => (input().props.onBlur as (event: object) => void)({}));
      assert.equal(blurEvents, 1);
    } finally { if (mounted) await renderer.act(() => mounted.unmount()); }
  }
});

test('short timeline blocks keep their time accessible and open details at enlarged text sizes', async () => {
  for (const fontScale of [1, 2]) {
    let opened = '';
    const { DayTimeline } = sourceModule<{ DayTimeline: React.ComponentType<Record<string, unknown>> }>('src/features/planner/components/day-timeline.tsx', {
      'react-native': { ...nativeRuntime, useWindowDimensions: () => ({ width: 360, height: 800, fontScale }) },
      '@expo/vector-icons/Ionicons': host('Icon'),
      'expo-router': { useRouter: () => ({ push: (route: { params: { id: string } }) => { opened = route.params.id; } }) },
      '@/components/ui': { Text: host('Text') },
      '@/hooks/use-app-theme': { useAppTheme: () => theme },
      '@/providers/localization-provider': { useLocalization: () => ({ isRTL: false, t: createTranslator('en'), formatTime: (time: string) => time }) },
    });
    const block = { id: 'block', title: 'Calendar item', date: '2026-09-07', startTime: '09:00', endTime: '09:15', status: 'planned', deletedAt: null };
    let mounted!: Renderer;
    try {
      await renderer.act(() => { mounted = renderer.create(React.createElement(DayTimeline, { blocks: [block], date: block.date, today: null, timeZone: 'UTC', dayStartsAt: '06:00' })); });
      const button = mounted.root.findAllByType('Pressable')[0];
      assert.match(String(button.props.accessibilityLabel), /09:00.*09:15/);
      const style = flatten((button.props.style as (state: object) => unknown)({ pressed: false }));
      assert.ok(Number(style.height) >= 44);
      assert.ok(Number(style.height) >= theme.typography.label.lineHeight * fontScale + 16);
      await renderer.act(() => (button.props.onPress as () => void)());
      assert.equal(opened, block.id);
    } finally { if (mounted) await renderer.act(() => mounted.unmount()); }
  }
});
