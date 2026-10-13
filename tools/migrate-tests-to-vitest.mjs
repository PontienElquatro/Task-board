// Mechanical test-API migration. Dry run by default; validates every file before writing.
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const f = ts.factory;
const member = (node, name) => f.createPropertyAccessExpression(node, name);
const invoke = (node, args = [], types) => f.createCallExpression(node, types, args);
const viCall = (name, args = []) => invoke(member(f.createIdentifier('vi'), name), args);
const named = (node, name) => ts.isIdentifier(node) && node.text === name;
const namespace = (node, name, method) => ts.isPropertyAccessExpression(node)
  && named(node.expression, name) && node.name.text === method;

function counts(source) {
  const result = { tests: 0, assertions: 0 };
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (['it', 'fit', 'xit'].includes(node.expression.text)) result.tests++;
      if (['expect', 'expectAsync'].includes(node.expression.text)) result.assertions++;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}

export function convertJasmine(text, filename = 'migration.spec.ts') {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(source.parseDiagnostics.length, 0, `${filename}: invalid input TypeScript`);
  if (source.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'vitest')) return null;
  const result = ts.transform(source, [context => {
    function visit(node) {
      if (ts.isQualifiedName(node) && named(node.left, 'jasmine')) {
        const mapped = { Spy: 'Mock', SpyObj: 'Mocked' }[node.right.text];
        if (!mapped) throw new Error(`${filename}: unsupported Jasmine type ${node.right.text}`);
        return f.createIdentifier(mapped);
      }
      if (ts.isPropertyAccessExpression(node) && node.name.text === 'args' && ts.isCallExpression(node.expression)) {
        const call = node.expression.expression;
        if (ts.isPropertyAccessExpression(call) && call.name.text === 'mostRecent'
          && ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'calls') {
          return f.createNonNullExpression(member(member(ts.visitNode(call.expression.expression, visit), 'mock'), 'lastCall'));
        }
      }
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const args = node.arguments.map(arg => ts.visitNode(arg, visit));
        if (namespace(expression, 'jasmine', 'createSpy')) {
          const mock = invoke(member(f.createIdentifier('vi'), 'fn'), [], node.typeArguments);
          return args.length ? invoke(member(mock, 'mockName'), [args[0]]) : mock;
        }
        if (namespace(expression, 'jasmine', 'createSpyObj')) {
          const methods = node.arguments[1];
          if (!methods || !ts.isArrayLiteralExpression(methods) || node.arguments.length > 2) throw new Error(`${filename}: unsupported spy object`);
          return f.createObjectLiteralExpression(methods.elements.map(method => {
            if (!ts.isStringLiteral(method)) throw new Error(`${filename}: dynamic spy-object method`);
            return f.createPropertyAssignment(method.text, viCall('fn'));
          }), true);
        }
        for (const method of ['any', 'anything', 'objectContaining', 'arrayContaining', 'stringMatching']) {
          if (namespace(expression, 'jasmine', method)) return invoke(member(f.createIdentifier('expect'), method), args);
        }
        if (named(expression, 'spyOn') || named(expression, 'spyOnProperty')) {
          return viCall('spyOn', args);
        }
        if (ts.isPropertyAccessExpression(expression)) {
          const api = expression.name.text;
          const owner = expression.expression;
          if (ts.isPropertyAccessExpression(owner) && owner.name.text === 'and') {
            const target = ts.visitNode(owner.expression, visit);
            const mapped = { returnValue:'mockReturnValue', resolveTo:'mockResolvedValue', rejectWith:'mockRejectedValue', callFake:'mockImplementation' }[api];
            if (mapped) return invoke(member(target, mapped), args.length ? args : [f.createIdentifier('undefined')]);
            if (api === 'stub') return invoke(member(target, 'mockImplementation'), [f.createArrowFunction(undefined, undefined, [], undefined, f.createToken(ts.SyntaxKind.EqualsGreaterThanToken), f.createBlock([], false))]);
            if (api === 'throwError') {
              const error = args[0];
              const thrown = error && ts.isNewExpression(error) ? error : f.createNewExpression(f.createIdentifier('Error'), undefined, error ? [error] : []);
              return invoke(member(target, 'mockImplementation'), [f.createArrowFunction(undefined, undefined, [], undefined, f.createToken(ts.SyntaxKind.EqualsGreaterThanToken), f.createBlock([f.createThrowStatement(thrown)], true))]);
            }
            throw new Error(`${filename}: unsupported spy strategy ${api}`);
          }
          if (ts.isPropertyAccessExpression(owner) && owner.name.text === 'calls') {
            const mock = member(ts.visitNode(owner.expression, visit), 'mock');
            if (api === 'allArgs') return member(mock, 'calls');
            if (api === 'count') return member(member(mock, 'calls'), 'length');
            if (api === 'reset') return invoke(member(ts.visitNode(owner.expression, visit), 'mockClear'));
            throw new Error(`${filename}: unsupported call history ${api}`);
          }
          if (ts.isCallExpression(owner) && namespace(owner.expression, 'jasmine', 'clock')) {
            const mapped = { install:'useFakeTimers', uninstall:'useRealTimers', tick:'advanceTimersByTime' }[api];
            if (!mapped) throw new Error(`${filename}: unsupported clock API ${api}`);
            return viCall(mapped, args);
          }
          if (ts.isCallExpression(owner) && named(owner.expression, 'expectAsync')) {
            const promise = ts.visitNode(owner.arguments[0], visit);
            if (api === 'toBeResolvedTo') return invoke(member(member(invoke(f.createIdentifier('expect'), [promise]), 'resolves'), 'toEqual'), args);
            if (api === 'toBeRejected' || api === 'toBeResolved') {
              const resolved = api === 'toBeResolved';
              const arrow = value => f.createArrowFunction(undefined, undefined, [], undefined, f.createToken(ts.SyntaxKind.EqualsGreaterThanToken), value ? f.createTrue() : f.createFalse());
              const verdict = invoke(member(promise, 'then'), [arrow(resolved), arrow(!resolved)]);
              return invoke(member(member(invoke(f.createIdentifier('expect'), [verdict]), 'resolves'), 'toBe'), [f.createTrue()]);
            }
            throw new Error(`${filename}: unsupported asynchronous matcher ${api}`);
          }
          if (api === 'toBeTrue' || api === 'toBeFalse') {
            return invoke(member(ts.visitNode(owner, visit), 'toBe'), [api === 'toBeTrue' ? f.createTrue() : f.createFalse()]);
          }
        }
      }
      return ts.visitEachChild(node, visit, context);
    }
    return node => ts.visitNode(node, visit);
  }]);
  const globals = ['beforeAll','beforeEach','afterAll','afterEach','describe','it','expect','vi'];
  const bindings = [...globals.map(name => f.createImportSpecifier(false, undefined, f.createIdentifier(name))),
    ...['Mock','Mocked'].map(name => f.createImportSpecifier(true, undefined, f.createIdentifier(name)))];
  const imported = f.createImportDeclaration(undefined, f.createImportClause(false, undefined, f.createNamedImports(bindings)), f.createStringLiteral('vitest'));
  const output = ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(f.updateSourceFile(result.transformed[0], [imported, ...result.transformed[0].statements]));
  result.dispose();
  assert.ok(!/\bjasmine\s*\.|\bexpectAsync\s*\(/.test(output), `${filename}: unconverted Jasmine API`);
  const reparsed = ts.createSourceFile(filename, output, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(reparsed.parseDiagnostics.length, 0, `${filename}: invalid generated TypeScript`);
  assert.deepEqual(counts(reparsed), counts(source), `${filename}: test/assertion count changed`);
  return {output, counts:counts(source)};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const files = [];
  async function walk(directory) {
    for (const item of await readdir(directory, {withFileTypes:true})) {
      const path = join(directory, item.name);
      if (item.isDirectory()) await walk(path);
      else if (item.isFile() && item.name.endsWith('.spec.ts')) files.push(path);
    }
  }
  await walk(join(root, 'src'));
  const changes = [];
  for (const path of files.sort()) {
    const original = await readFile(path);
    const text = ts.sys.readFile(path);
    assert.ok(text && !text.includes('\0'), `${path}: invalid or corrupt source`);
    const converted = convertJasmine(text, path);
    if (converted) changes.push({path, original, ...converted});
  }
  const totals = changes.reduce((sum, file) => ({tests:sum.tests+file.counts.tests, assertions:sum.assertions+file.counts.assertions}), {tests:0,assertions:0});
  console.log(JSON.stringify({files:changes.length, ...totals, mode:process.argv.includes('--write')?'write':'dry-run'}));
  if (process.argv.includes('--write')) {
    // Atomic per-file replacement avoids truncating an existing test on a failed write.
    for (const file of changes) {
      assert.deepEqual(await readFile(file.path), file.original, `${file.path}: changed during migration`);
      const temporary = file.path+'.vitest-'+randomUUID()+'.tmp';
      await writeFile(temporary, file.output, {encoding:'utf8',flag:'wx'});
      assert.equal(await readFile(temporary,'utf8'), file.output);
      await rename(temporary, file.path);
    }
  }
}
