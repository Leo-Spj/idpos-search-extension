const DEFAULT_CACHE_TTL = 2 * 60 * 1000; // 2 minutos
const DEFAULT_CACHE_CLEANUP = 10 * 60 * 1000; // 10 minutos

export function createRankingEngine(options = {}) {
  const {
    maxResults = 40,
    frequencyData = createFrequencyData(),
    cache = {},
    nowProvider = () => new Date()
  } = options;

  const cacheStore = cache.map || new Map();
  const cacheTtl = typeof cache.ttl === "number" ? cache.ttl : DEFAULT_CACHE_TTL;
  const cleanupInterval = typeof cache.cleanupInterval === "number" ? cache.cleanupInterval : DEFAULT_CACHE_CLEANUP;
  let cleanupTimer = null;

  const safeFrequency = normalizeFrequencyData(frequencyData);

  function scheduleCleanup() {
    if (cleanupTimer) return;
    cleanupTimer = setTimeout(() => {
      cleanupTimer = null;
      const expiry = Date.now() - cacheTtl;
      for (const [key, entry] of cacheStore.entries()) {
        if (entry.timestamp < expiry) {
          cacheStore.delete(key);
        }
      }
      if (cacheStore.size) {
        scheduleCleanup();
      }
    }, cleanupInterval);
    if (typeof cleanupTimer.unref === "function") {
      cleanupTimer.unref();
    }
  }

  function getCachedResults(key, version) {
    if (!key) return null;
    const entry = cacheStore.get(key);
    if (!entry) return null;
    if (version !== undefined && entry.version !== version) {
      cacheStore.delete(key);
      return null;
    }
    if (Date.now() - entry.timestamp > cacheTtl) {
      cacheStore.delete(key);
      return null;
    }
    return entry.results.slice();
  }

  function setCachedResults(key, version, results) {
    if (!key) return;
    cacheStore.set(key, {
      results: results.slice(),
      timestamp: Date.now(),
      version
    });
    scheduleCleanup();
  }

  function rankResults(query, nodes = [], context = {}) {
    const sanitized = removeAccents(String(query || "").toLowerCase());
    const tokens = sanitized.split(/\s+/).filter(Boolean);
    if (!tokens.length) return getDefaultResults(nodes, context);
    if (!nodes.length) return [];

    const { cacheEligible = false, cacheKey = null, cacheVersion, now = nowProvider() } = context;
    if (cacheEligible) {
      const cached = getCachedResults(cacheKey, cacheVersion);
      if (cached) return cached;
    }

    const scored = [];
    for (const node of nodes) {
      const score = scoreNode(tokens, node, safeFrequency, now);
      if (score <= 0) continue;
      scored.push({ score, node });
    }

    if (!scored.length) {
      if (cacheEligible && cacheKey) setCachedResults(cacheKey, cacheVersion, []);
      return [];
    }

    const combined = splitAndSort(scored, (a, b) => compareByScore(a, b));
    const results = combined.slice(0, maxResults).map(item => mapNodeToResult(item.node));

    if (cacheEligible && cacheKey) {
      setCachedResults(cacheKey, cacheVersion, results);
    }

    return results;
  }

  function getDefaultResults(nodes = [], context = {}) {
    if (!nodes.length) return [];
    const now = context.now || nowProvider();
    const annotated = nodes.map(node => ({
      node,
      contextScore: computeContextScore(node, safeFrequency, now)
    }));

    const combined = splitAndSort(annotated, (a, b) => compareByContextScore(a, b));
    return combined.slice(0, maxResults).map(item => mapNodeToResult(item.node));
  }

  function invalidateCache(predicate) {
    if (!cacheStore.size) return;
    if (typeof predicate !== "function") {
      cacheStore.clear();
      return;
    }
    for (const [key, entry] of cacheStore.entries()) {
      if (predicate(key, entry)) {
        cacheStore.delete(key);
      }
    }
  }

  return {
    rankResults,
    getDefaultResults,
    mapNodeToResult,
    removeAccents,
    buildCacheKey,
    invalidateCache
  };
}

export function buildCacheKey(query, category = "all") {
  const normalizedQuery = removeAccents(String(query || "").toLowerCase()).trim();
  const normalizedCategory = removeAccents(String(category || "all").toLowerCase()).trim() || "all";
  return `${normalizedCategory}::${normalizedQuery}`;
}

function splitAndSort(collection, comparator) {
  const deprecated = collection.filter(item => isDeprecated(item.node));
  const active = collection.filter(item => !isDeprecated(item.node));
  active.sort(comparator);
  deprecated.sort(comparator);
  return [...active, ...deprecated];
}

function compareByScore(a, b) {
  if (Math.abs(b.score - a.score) < 0.1) {
    return compareByCategoryAndPath(a.node, b.node);
  }
  return b.score - a.score;
}

function compareByContextScore(a, b) {
  if (Math.abs(b.contextScore - a.contextScore) < 0.1) {
    return compareByCategoryAndPath(a.node, b.node);
  }
  return b.contextScore - a.contextScore;
}

function computeContextScore(node, frequencyData, now) {
  let contextScore = 0;
  const usageCount = node.usage || 0;
  contextScore += usageCount * 100;

  const lastAccess = frequencyData.lastAccess.get(node.id);
  if (lastAccess) {
    const hoursSince = (now.getTime() - lastAccess) / (1000 * 60 * 60);
    contextScore += 500 * Math.exp(-hoursSince / 16);
  }

  const hour = now.getHours();
  const day = now.getDay();
  const timeKey = `${node.id}:${hour}`;
  const dayKey = `${node.id}:${day}`;

  if (frequencyData.timeOfDay.has(timeKey)) {
    contextScore += frequencyData.timeOfDay.get(timeKey) * 50;
  }

  if (frequencyData.weekday.has(dayKey)) {
    contextScore += frequencyData.weekday.get(dayKey) * 30;
  }

  if (node.source === "static") {
    contextScore += 20;
  }

  contextScore -= (node.depth || 0) * 5;
  return contextScore;
}

function scoreNode(tokens, node, frequencyData, now) {
  const title = node.titleLower || removeAccents(String(node.title || "").toLowerCase());
  const tag = node.tagLower || removeAccents((node.tag || []).join(" ").toLowerCase());
  const description = removeAccents(String(node.description || "").toLowerCase());

  let textScore = 0;
  let matchQuality = 0;

  for (const token of tokens) {
    if (!token) continue;

    let tokenScore = 0;
    let tokenQuality = 0;

    if (title === token) {
      tokenScore = 1000;
      tokenQuality = 1;
    } else if (title.startsWith(token)) {
      tokenScore = 800;
      tokenQuality = 0.9;
    } else if (new RegExp(`\\b${escapeRegex(token)}\\b`).test(title)) {
      tokenScore = 600;
      tokenQuality = 0.8;
    } else if (title.includes(token)) {
      tokenScore = 400;
      tokenQuality = 0.7;
    } else if (new RegExp(`\\b${escapeRegex(token)}\\b`).test(tag)) {
      tokenScore = 300;
      tokenQuality = 0.6;
    } else if (tag.includes(token)) {
      tokenScore = 200;
      tokenQuality = 0.5;
    } else if (description.includes(token)) {
      tokenScore = 150;
      tokenQuality = 0.4;
    } else if (fuzzyIncludes(title, token)) {
      tokenScore = 100;
      tokenQuality = 0.3;
    } else if (fuzzyIncludes(tag, token)) {
      tokenScore = 50;
      tokenQuality = 0.2;
    } else {
      return 0;
    }

    textScore += tokenScore;
    matchQuality += tokenQuality;
  }

  matchQuality = matchQuality / tokens.length;

  const usageCount = node.usage || 0;
  const frequencyScore = Math.min(500, usageCount * 50);

  let recencyScore = 0;
  const lastAccess = frequencyData.lastAccess.get(node.id);
  if (lastAccess) {
    const hoursSince = (now.getTime() - lastAccess) / (1000 * 60 * 60);
    recencyScore = 300 * Math.exp(-hoursSince / 16);
  }

  let temporalScore = 0;
  const hour = now.getHours();
  const day = now.getDay();
  const timeKey = `${node.id}:${hour}`;
  const dayKey = `${node.id}:${day}`;

  if (frequencyData.timeOfDay.has(timeKey)) {
    const hourCount = frequencyData.timeOfDay.get(timeKey);
    temporalScore += Math.min(100, hourCount * 20);
  }

  if (frequencyData.weekday.has(dayKey)) {
    const dayCount = frequencyData.weekday.get(dayKey);
    temporalScore += Math.min(100, dayCount * 15);
  }

  const staticBonus = node.source === "static" ? 50 : 0;
  const depthPenalty = (node.depth || 0) * 10;

  let finalScore = textScore +
    frequencyScore * matchQuality * 0.8 +
    recencyScore * matchQuality * 0.7 +
    temporalScore * matchQuality * 0.5 +
    staticBonus -
    depthPenalty;

  if (matchQuality >= 0.9 && tokens.length > 1) {
    finalScore *= 1.2;
  }

  return Math.max(0, finalScore);
}

function mapNodeToResult(node) {
  const hierarchy = node.tag && node.tag.length ? node.tag.join(" · ") : node.title;
  return {
    id: node.id,
    title: node.title,
    description: node.description || "",
    url: node.url,
    action: node.action,
    nodeRef: node.ref,
    pathLabel: node.pathLabel || hierarchy,
    tag: node.tag || [],
    module: node.module || "",
    usage: node.usage || 0
  };
}

function fuzzyIncludes(haystack, needle) {
  if (needle.length <= 2) return haystack.includes(needle);
  let index = 0;
  let lastMatchIndex = -1;
  let gapCount = 0;

  for (let i = 0; i < haystack.length; i++) {
    if (haystack[i] === needle[index]) {
      if (lastMatchIndex >= 0 && (i - lastMatchIndex) > 2) {
        gapCount++;
      }
      lastMatchIndex = i;
      index++;
      if (index === needle.length) {
        return gapCount <= Math.floor(needle.length / 2);
      }
    }
  }

  return false;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compareByCategoryAndPath(a, b) {
  const categoryA = normalizeCategory(a.module);
  const categoryB = normalizeCategory(b.module);

  const deprecatedA = categoryA === "deprecado" || a.status === "legacy";
  const deprecatedB = categoryB === "deprecado" || b.status === "legacy";
  if (deprecatedA !== deprecatedB) return deprecatedA ? 1 : -1;

  const categoryCompare = categoryA.localeCompare(categoryB, "es", { sensitivity: "base" });
  if (categoryCompare !== 0) return categoryCompare;

  const pathA = String((a.pathLabel || "").trim());
  const pathB = String((b.pathLabel || "").trim());
  const pathCompare = pathA.localeCompare(pathB, "es", { sensitivity: "base" });
  if (pathCompare !== 0) return pathCompare;

  const titleA = String((a.title || "").trim());
  const titleB = String((b.title || "").trim());
  return titleA.localeCompare(titleB, "es", { sensitivity: "base" });
}

function normalizeCategory(value) {
  return removeAccents(String(value || "").trim().toLowerCase());
}

function isDeprecated(node) {
  if (!node) return false;
  const module = normalizeCategory(node.module);
  return module === "deprecado" || node.status === "legacy";
}

function removeAccents(text) {
  if (typeof text !== "string") return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function createFrequencyData() {
  return {
    lastAccess: new Map(),
    accessCount: new Map(),
    timeOfDay: new Map(),
    weekday: new Map()
  };
}

function normalizeFrequencyData(data = {}) {
  return {
    lastAccess: data.lastAccess || new Map(),
    accessCount: data.accessCount || new Map(),
    timeOfDay: data.timeOfDay || new Map(),
    weekday: data.weekday || new Map()
  };
}

export { mapNodeToResult, removeAccents };
