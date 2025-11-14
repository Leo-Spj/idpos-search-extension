import test from 'node:test';
import assert from 'node:assert/strict';

import { createRankingEngine, buildCacheKey } from './ranking.js';

function createFrequencyData() {
  return {
    lastAccess: new Map(),
    accessCount: new Map(),
    timeOfDay: new Map(),
    weekday: new Map()
  };
}

function makeNode({
  id,
  title,
  module = '',
  description = '',
  path = [],
  usage = 0,
  source = 'static',
  depth
}) {
  const computedDepth = typeof depth === 'number' ? depth : (path.length ? path.length - 1 : 0);
  return {
    id,
    title,
    module,
    description,
    path,
    pathLabel: path.join(' > '),
    usage,
    source,
    depth: computedDepth,
    url: `https://pos.idbi.pe/${id}`,
    action: 'navigate'
  };
}

const fixedNow = new Date('2025-01-01T10:00:00Z');

function createEngine(overrides = {}) {
  return createRankingEngine({
    maxResults: 10,
    frequencyData: createFrequencyData(),
    nowProvider: () => fixedNow,
    ...overrides
  });
}

test('rankResults prioriza coincidencias exactas sobre parciales', () => {
  const engine = createEngine();
  const nodes = [
    makeNode({ id: 'orders', title: 'Órdenes', module: 'Ventas', path: ['Ventas', 'Órdenes'], usage: 4 }),
    makeNode({ id: 'report', title: 'Reporte de órdenes', module: 'Reportes', path: ['Reportes', 'Órdenes'], usage: 6 }),
    makeNode({ id: 'stock', title: 'Stock inicial', module: 'Inventarios', path: ['Inventarios', 'Stock'], usage: 2 })
  ];

  const results = engine.rankResults('ordenes', nodes);
  assert.equal(results[0].id, 'orders');
  assert.ok(results.find(item => item.id === 'report'));
});

test('rankResults usa caché cuando solo hay nodos estáticos', () => {
  const engine = createEngine();
  const nodes = [
    makeNode({ id: 'alpha', title: 'Módulo Alpha', module: 'Ventas', path: ['Ventas', 'Alpha'] }),
    makeNode({ id: 'beta', title: 'Panel Beta', module: 'Ventas', path: ['Ventas', 'Beta'] })
  ];

  const context = {
    cacheEligible: true,
    cacheKey: buildCacheKey('alpha', 'ventas'),
    cacheVersion: 1
  };

  const first = engine.rankResults('alpha', nodes, context);
  assert.ok(first.length > 0, 'Debe haber coincidencias en la primera búsqueda');
  nodes[0].title = 'Sin coincidencia';
  nodes[0].path = ['Ventas', 'Sin coincidencia'];
  nodes[0].pathLabel = nodes[0].path.join(' > ');

  const second = engine.rankResults('alpha', nodes, context);
  assert.deepEqual(second, first, 'Debe entregar los resultados en caché');

  engine.invalidateCache();
  const third = engine.rankResults('alpha', nodes, context);
  assert.equal(third.length, 0, 'Tras limpiar caché debe recalcular sin coincidencias');
});

test('getDefaultResults mantiene deprecados al final aunque tengan más uso', () => {
  const engine = createEngine();
  const nodes = [
    makeNode({ id: 'active', title: 'Clientes', module: 'Ventas', path: ['Ventas', 'Clientes'], usage: 2 }),
    makeNode({ id: 'deprecated', title: 'Antiguo módulo', module: 'deprecado', path: ['Legado', 'Módulo'], usage: 50 })
  ];

  const results = engine.getDefaultResults(nodes, { now: fixedNow });
  assert.equal(results[0].id, 'active');
  assert.equal(results[results.length - 1].id, 'deprecated');
});
