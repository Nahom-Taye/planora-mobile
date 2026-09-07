import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import React from 'react';

export const requireModule = createRequire(import.meta.url);

export function sourceModule<T>(filename: string, mocks: Record<string, unknown> = {}, suffix = ''): T {
  const cache = new Map<string, { exports: unknown }>();
  function load(file: string): unknown {
    const absolute = resolve(file);
    if (cache.has(absolute)) return cache.get(absolute)!.exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const source = readFileSync(absolute, 'utf8') + (absolute === resolve(filename) ? suffix : '');
    const code = ts.transpileModule(source, {
      fileName: absolute + '.tsx',
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name: string) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve('src', name.slice(2)) : resolve(dirname(absolute), name);
        const path = [base, base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')].find((candidate) => existsSync(candidate) && /\.[tj]sx?$/.test(candidate));
        if (path) return load(path);
      }
      return requireModule(name);
    };
    new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
    return module.exports;
  }
  return load(filename) as T;
}

export type RouteNode = { route: string; contextKey: string; type: string; initialRouteName?: string; children: RouteNode[] };

export function routeFiles(directory = 'app'): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? routeFiles(path) : /\.[tj]sx?$/.test(path) ? [path.replaceAll('\\', '/')] : [];
  });
}

export function generatedTree(platform: string): RouteNode {
  const files = routeFiles();
  const context = Object.assign((key: string) => {
    const source = readFileSync(join('app', key), 'utf8');
    const settings = /export const unstable_settings\s*=\s*({[\s\S]*?});/.exec(source);
    return { default: () => null, ...(settings ? { unstable_settings: new Function(`return (${settings[1]})`)() } : {}) };
  }, { keys: () => files.map((file) => './' + file.slice(4)) });
  return requireModule('expo-router/build/getRoutes').getRoutes(context, { platform, skipGenerated: true, importMode: 'sync' });
}

export function findJsx(source: string, tag: string) {
  const file = ts.createSourceFile('layout.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found: ts.JsxElement | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(file) === tag) found = node;
    else ts.forEachChild(node, visit);
  }
  visit(file);
  if (!found) throw new Error('Navigator declaration missing.');
  return found.getText(file);
}

export function evaluateJsx(source: string, scope: Record<string, unknown>) {
  const code = ts.transpileModule(`const result = (${source});`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
    fileName: 'layout.tsx',
  }).outputText;
  return new Function('React', ...Object.keys(scope), code + '\nreturn result;')(React, ...Object.values(scope)) as React.ReactElement;
}

export function dependencyFunction(file: string, name: string, scope: Record<string, unknown>) {
  const source = readFileSync(requireModule.resolve(file), 'utf8');
  const parsed = ts.createSourceFile('module.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = parsed.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === name);
  if (!node) throw new Error('Runtime function missing.');
  return new Function(...Object.keys(scope), `${node.getText(parsed)}; return ${name};`)(...Object.values(scope));
}

export type RenderNode = { props: Record<string, unknown>; type: unknown; findAllByType(type: unknown): RenderNode[]; findByProps(props: Record<string, unknown>): RenderNode };
export type Renderer = { root: RenderNode; toJSON(): unknown; update(element: React.ReactElement): void; unmount(): void };
export const renderer = requireModule('react-test-renderer') as { create(element: React.ReactElement): Renderer; act(operation: () => unknown): Promise<void> };

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

export const host = (name: string) => {
  const component = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => React.createElement(name, props, children);
  component.displayName = name;
  return component;
};

export const native = {
  View: host('View'), Text: host('Text'), TextInput: host('TextInput'), Pressable: host('Pressable'), ActivityIndicator: host('ActivityIndicator'),
  StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
  Alert: { alert: () => undefined },
  AccessibilityInfo: { setAccessibilityFocus: () => undefined },
  findNodeHandle: () => null,
};
