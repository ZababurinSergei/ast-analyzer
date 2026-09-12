// decoders/graphDecoder.js
import { decodeCallType } from './types.js';

export function decodeGraphExports(exports, entityMap, fileMap) {
  if (!exports || !Array.isArray(exports)) {return exports;}

  return exports.map(exp => {
    if (!Array.isArray(exp)) {return exp;}

    // exp = [from, line, type, exportName?, localName?, fileId?]
    const from = exp[0];
    const line = exp[1];
    const type = exp[2] || 'ne';
    const exportName = exp[3] || '';
    const localName = exp[4] || '';
    const fileId = exp[5] || '';

    let fromName = from;
    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }

    let fileName = fileId;
    if (fileMap && fileMap[fileId]) {
      fileName = fileMap[fileId];
    }

    return {
      from,
      fromName,
      line,
      type: decodeCallType(type),
      typeCode: type,
      exportName,
      localName,
      file: fileName,
      fileId,
    };
  });
}

export function decodeGraphImports(imports, entityMap, fileMap) {
  if (!imports || !Array.isArray(imports)) {return imports;}

  return imports.map(imp => {
    if (!Array.isArray(imp)) {return imp;}

    // imp = [from, to, name, type, fileId?]
    const from = imp[0];
    const to = imp[1];
    const name = imp[2] || '';
    const type = imp[3] || 'n';
    const fileId = imp[4] || '';

    let fromName = from;
    let toName = to;

    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }
    if (entityMap && entityMap[to]) {
      toName = entityMap[to] || to;
    }

    let fileName = fileId;
    if (fileMap && fileMap[fileId]) {
      fileName = fileMap[fileId];
    }

    return {
      from,
      fromName,
      to,
      toName,
      name,
      type: decodeCallType(type),
      typeCode: type,
      file: fileName,
      fileId,
    };
  });
}

export function decodeGraphCalls(calls, entityMap) {
  if (!calls || !Array.isArray(calls)) {return calls;}

  return calls.map(call => {
    if (!Array.isArray(call)) {return call;}

    // call = [from, to, line, type]
    const from = call[0];
    const to = call[1];
    const line = call[2];
    const type = call[3] || 'd';

    let fromName = from;
    let toName = to;

    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }
    if (entityMap && entityMap[to]) {
      toName = entityMap[to] || to;
    }

    return {
      from,
      fromName,
      to,
      toName,
      line,
      type: decodeCallType(type),
      typeCode: type,
    };
  });
}

export function decodeGraphCycles(cycles, entityMap) {
  if (!cycles || !Array.isArray(cycles)) {return cycles;}

  return cycles.map(cycle => {
    if (!Array.isArray(cycle)) {return cycle;}

    // cycle = [from, to, line, type?]
    const from = cycle[0];
    const to = cycle[1];
    const line = cycle[2];
    const type = cycle[3] || 'd';

    let fromName = from;
    let toName = to;

    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }
    if (entityMap && entityMap[to]) {
      toName = entityMap[to] || to;
    }

    return {
      from,
      fromName,
      to,
      toName,
      line,
      type: decodeCallType(type),
      typeCode: type,
    };
  });
}

export function decodeGraphReExports(reExports, entityMap) {
  if (!reExports || !Array.isArray(reExports)) {return reExports;}

  return reExports.map(re => {
    if (!Array.isArray(re)) {return re;}

    // re = [from, to, type]
    const from = re[0];
    const to = re[1];
    const type = re[2] || 'named';

    let fromName = from;
    let toName = to;

    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }
    if (entityMap && entityMap[to]) {
      toName = entityMap[to] || to;
    }

    return {
      from,
      fromName,
      to,
      toName,
      type: decodeCallType(type),
      typeCode: type,
    };
  });
}

export function decodeGraphUnused(unused, entityMap, fileMap) {
  if (!unused || !Array.isArray(unused)) {return unused;}

  return unused.map(item => {
    if (!Array.isArray(item) || item.length < 3) {return item;}

    // uc = [entity, fileId, line]
    const entity = item[0];
    const fileId = item[1];
    const line = item[2];

    let entityName = entity;
    if (entityMap && entityMap[entity]) {
      entityName = entityMap[entity] || entity;
    }

    let fileName = fileId;
    if (fileMap && fileMap[fileId]) {
      fileName = fileMap[fileId];
    }

    return {
      entity,
      entityName,
      file: fileName,
      fileId,
      line,
    };
  });
}

export function decodeGraphClosures(closures, entityMap) {
  if (!closures || !Array.isArray(closures)) {return closures;}

  return closures.map(closure => {
    if (!Array.isArray(closure) || closure.length < 3) {return closure;}

    // closure = [entity, parent, line]
    const entity = closure[0];
    const parent = closure[1];
    const line = closure[2];

    let entityName = entity;
    let parentName = parent;

    if (entityMap && entityMap[entity]) {
      entityName = entityMap[entity] || entity;
    }
    if (entityMap && entityMap[parent]) {
      parentName = entityMap[parent] || parent;
    }

    return {
      entity,
      entityName,
      parent,
      parentName,
      line,
    };
  });
}

export function decodeGraphAsync(asyncChains, entityMap) {
  if (!asyncChains || !Array.isArray(asyncChains)) {return asyncChains;}

  return asyncChains.map(chain => {
    if (!Array.isArray(chain) || chain.length < 3) {return chain;}

    // async = [from, to, line]
    const from = chain[0];
    const to = chain[1];
    const line = chain[2];

    let fromName = from;
    let toName = to;

    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }
    if (entityMap && entityMap[to]) {
      toName = entityMap[to] || to;
    }

    return {
      from,
      fromName,
      to,
      toName,
      line,
    };
  });
}

export function decodeGraphReflections(reflections, entityMap) {
  if (!reflections || !Array.isArray(reflections)) {return reflections;}

  return reflections.map(ref => {
    if (!Array.isArray(ref) || ref.length < 3) {return ref;}

    // reflection = [entity, type, line]
    const entity = ref[0];
    const type = ref[1];
    const line = ref[2];

    let entityName = entity;
    if (entityMap && entityMap[entity]) {
      entityName = entityMap[entity] || entity;
    }

    return {
      entity,
      entityName,
      type,
      line,
    };
  });
}

export function decodeGraphTypeDeps(typeDeps, entityMap) {
  if (!typeDeps || !Array.isArray(typeDeps)) {return typeDeps;}

  return typeDeps.map(td => {
    if (!Array.isArray(td) || td.length < 3) {return td;}

    // td = [from, to, type]
    const from = td[0];
    const to = td[1];
    const type = td[2] || 'p';

    let fromName = from;
    let toName = to;

    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }
    if (entityMap && entityMap[to]) {
      toName = entityMap[to] || to;
    }

    return {
      from,
      fromName,
      to,
      toName,
      type: decodeCallType(type),
      typeCode: type,
    };
  });
}

export function decodeGraphConstUses(constUses, entityMap) {
  if (!constUses || !Array.isArray(constUses)) {return constUses;}

  return constUses.map(use => {
    if (!Array.isArray(use) || use.length < 3) {return use;}

    // constUses = [from, to, line]
    const from = use[0];
    const to = use[1];
    const line = use[2];

    let fromName = from;
    let toName = to;

    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }
    if (entityMap && entityMap[to]) {
      toName = entityMap[to] || to;
    }

    return {
      from,
      fromName,
      to,
      toName,
      line,
    };
  });
}

export function decodeGraphConstDeps(constDeps, entityMap) {
  if (!constDeps || !Array.isArray(constDeps)) {return constDeps;}

  return constDeps.map(dep => {
    if (!Array.isArray(dep) || dep.length < 3) {return dep;}

    // constDeps = [from, to, type]
    const from = dep[0];
    const to = dep[1];
    const type = dep[2] || 'val';

    let fromName = from;
    let toName = to;

    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }
    if (entityMap && entityMap[to]) {
      toName = entityMap[to] || to;
    }

    return {
      from,
      fromName,
      to,
      toName,
      type: decodeCallType(type),
      typeCode: type,
    };
  });
}

export function decodeGraphConstExports(constExports, entityMap, fileMap) {
  if (!constExports || !Array.isArray(constExports)) {return constExports;}

  return constExports.map(ce => {
    if (!Array.isArray(ce) || ce.length < 4) {return ce;}

    // constExports = [from, line, type, fileId?]
    const from = ce[0];
    const line = ce[1];
    const type = ce[2] || 'ce';
    const fileId = ce[3] || '';

    let fromName = from;
    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }

    let fileName = fileId;
    if (fileMap && fileMap[fileId]) {
      fileName = fileMap[fileId];
    }

    return {
      from,
      fromName,
      line,
      type: decodeCallType(type),
      typeCode: type,
      file: fileName,
      fileId,
    };
  });
}

export function decodeGraphConfigRefs(configRefs, entityMap) {
  if (!configRefs || !Array.isArray(configRefs)) {return configRefs;}

  return configRefs.map(cfg => {
    if (!Array.isArray(cfg) || cfg.length < 3) {return cfg;}

    // cfg = [from, type, file]
    const from = cfg[0];
    const type = cfg[1] || 'env';
    const file = cfg[2] || '';

    let fromName = from;
    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }

    return {
      from,
      fromName,
      type: decodeCallType(type),
      typeCode: type,
      file,
    };
  });
}

export function decodeGraphExternalLibs(externalLibs, entityMap) {
  if (!externalLibs || !Array.isArray(externalLibs)) {return externalLibs;}

  return externalLibs.map(ext => {
    if (!Array.isArray(ext) || ext.length < 3) {return ext;}

    // ext = [from, name, version?]
    const from = ext[0];
    const name = ext[1] || '';
    const version = ext[2] || '';

    let fromName = from;
    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }

    return {
      from,
      fromName,
      name,
      version,
    };
  });
}

export function decodeGraphVueTemplates(vueTemplates, entityMap) {
  if (!vueTemplates || !Array.isArray(vueTemplates)) {return vueTemplates;}

  return vueTemplates.map(vt => {
    if (!Array.isArray(vt) || vt.length < 3) {return vt;}

    // vt = [from, type, file]
    const from = vt[0];
    const type = vt[1] || 'component';
    const file = vt[2] || '';

    let fromName = from;
    if (entityMap && entityMap[from]) {
      fromName = entityMap[from] || from;
    }

    return {
      from,
      fromName,
      type: decodeCallType(type),
      typeCode: type,
      file,
    };
  });
}

export function decodeGraphFull(graph, entityMap, fileMap) {
  if (!graph) {return graph;}

  const result = {};

  // Декодируем все части графа
  if (graph.e) {
    result.exports = decodeGraphExports(graph.e, entityMap, fileMap);
  }

  if (graph.i) {
    result.imports = decodeGraphImports(graph.i, entityMap, fileMap);
  }

  if (graph.c) {
    result.calls = decodeGraphCalls(graph.c, entityMap);
  }

  if (graph.cy) {
    result.cycles = decodeGraphCycles(graph.cy, entityMap);
  }

  if (graph.re) {
    result.reExports = decodeGraphReExports(graph.re, entityMap);
  }

  if (graph.uc) {
    result.unused = decodeGraphUnused(graph.uc, entityMap, fileMap);
  }

  if (graph.closures) {
    result.closures = decodeGraphClosures(graph.closures, entityMap);
  }

  if (graph.async) {
    result.asyncChains = decodeGraphAsync(graph.async, entityMap);
  }

  if (graph.reflection) {
    result.reflections = decodeGraphReflections(graph.reflection, entityMap);
  }

  if (graph.td) {
    result.typeDependencies = decodeGraphTypeDeps(graph.td, entityMap);
  }

  if (graph.constUses) {
    result.constUses = decodeGraphConstUses(graph.constUses, entityMap);
  }

  if (graph.constDeps) {
    result.constDeps = decodeGraphConstDeps(graph.constDeps, entityMap);
  }

  if (graph.constExports) {
    result.constExports = decodeGraphConstExports(graph.constExports, entityMap, fileMap);
  }

  if (graph.cfg) {
    result.configRefs = decodeGraphConfigRefs(graph.cfg, entityMap);
  }

  if (graph.ext) {
    result.externalLibs = decodeGraphExternalLibs(graph.ext, entityMap);
  }

  if (graph.vt) {
    result.vueTemplates = decodeGraphVueTemplates(graph.vt, entityMap);
  }

  // Копируем остальные поля
  for (const [key, value] of Object.entries(graph)) {
    if (
      ![
        'e',
        'i',
        'c',
        'cy',
        're',
        'uc',
        'closures',
        'async',
        'reflection',
        'td',
        'constUses',
        'constDeps',
        'constExports',
        'cfg',
        'ext',
        'vt',
      ].includes(key)
    ) {
      result[key] = value;
    }
  }

  return result;
}

export default {
  decodeGraphExports,
  decodeGraphImports,
  decodeGraphCalls,
  decodeGraphCycles,
  decodeGraphReExports,
  decodeGraphUnused,
  decodeGraphClosures,
  decodeGraphAsync,
  decodeGraphReflections,
  decodeGraphTypeDeps,
  decodeGraphConstUses,
  decodeGraphConstDeps,
  decodeGraphConstExports,
  decodeGraphConfigRefs,
  decodeGraphExternalLibs,
  decodeGraphVueTemplates,
  decodeGraphFull,
};
