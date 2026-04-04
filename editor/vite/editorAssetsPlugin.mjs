import fs from 'fs';
import { join, resolve } from 'path';

function listFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => exts.some((ext) => file.toLowerCase().endsWith(ext)));
}

function listFilesRecursive(dir, exts, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full, exts, rel));
      continue;
    }
    if (exts.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
      out.push(rel);
    }
  }
  return out;
}

function listFromDir(dir, exts, webPrefix, recursive = false) {
  const files = recursive ? listFilesRecursive(dir, exts) : listFiles(dir, exts);
  return files.map((file) => [`${webPrefix}/${file}`, `${webPrefix}/${file}`]);
}

export function editorAssetsPlugin(options = {}) {
  const rootDir = options.rootDir ?? resolve(__dirname, '..', '..');
  const virtualId = 'virtual:editor-assets';
  const resolvedVirtualId = `\0${virtualId}`;
  const exts = ['.png', '.jpg', '.jpeg', '.webp', '.json'];

  const buildLists = () => {
    const publicDir = resolve(rootDir, 'public');
    const tilesetsDir = join(publicDir, 'assets', 'tilesets');
    const tilesDir = join(publicDir, 'assets', 'tiles');
    const editorTilesDir = join(publicDir, 'assets', 'editor-tiles');
    const structuresDir = join(publicDir, 'assets', 'structures');
    const buildDir = join(publicDir, 'assets', 'build');
    const objectsDir = join(publicDir, 'assets', 'objects');
    const ballDir = join(publicDir, 'assets', 'ball');
    const graphicsDir = join(publicDir, 'assets', 'graphics');
    const graphicsDirAlt = join(publicDir, 'assets', 'Graphics');
    const mapsDir = join(publicDir, 'assets', 'maps');

    const tiles = [
      ...listFromDir(tilesDir, exts, '/assets/tiles'),
      ...listFromDir(tilesetsDir, exts, '/assets/tilesets'),
      ...listFromDir(editorTilesDir, exts, '/assets/editor-tiles'),
    ];

    const structures = [
      ...listFromDir(structuresDir, exts, '/assets/structures', true),
      ...listFromDir(buildDir, exts, '/assets/build', true),
    ];

    const objects = [
      ...listFromDir(objectsDir, exts, '/assets/objects', true),
    ];

    const graphics = [
      ...listFromDir(graphicsDir, exts, '/assets/graphics', true),
      ...listFromDir(graphicsDirAlt, exts, '/assets/Graphics', true),
      ...listFromDir(ballDir, exts, '/assets/ball', true),
    ];

    const maps = listFromDir(mapsDir, ['.json'], '/assets/maps');

    return { tiles, structures, objects, graphics, maps };
  };

  const publicDir = resolve(rootDir, 'public');
  const mapsDir = join(publicDir, 'assets', 'maps');

  const registerMiddlewares = (middlewares) => {
    middlewares.use('/__active_map', (_req, res) => {
      try {
        const activePath = join(mapsDir, 'active-map.json');
        if (!fs.existsSync(activePath)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: 'active-map.json not found' }));
          return;
        }
        const data = fs.readFileSync(activePath, 'utf8');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.end(data);
      } catch (err) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });

    middlewares.use('/__editor_assets', (_req, res) => {
      const { tiles, structures, objects, graphics, maps } = buildLists();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ tiles, structures, objects, graphics, maps }));
    });

    middlewares.use('/__save_map', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const { name, data, makeActive } = payload;
          if (!name || !data) throw new Error('Invalid payload');

          const safe = name.toString().replace(/[^a-zA-Z0-9._-]/g, '_');
          const file = safe.toLowerCase().endsWith('.json') ? safe : `${safe}.json`;
          if (file === 'active-map.json') throw new Error('The filename active-map.json is reserved. Save under another name, then activate it.');
          if (!fs.existsSync(mapsDir)) fs.mkdirSync(mapsDir, { recursive: true });

          delete data._editorSourceMap;

          fs.writeFileSync(join(mapsDir, file), JSON.stringify(data, null, 2), 'utf8');
          const shouldActivate = Object.prototype.hasOwnProperty.call(payload, 'makeActive') ? !!makeActive : true;

          if (shouldActivate) {
            const activeData = { ...data, _editorSourceMap: file };
            fs.writeFileSync(join(mapsDir, 'active-map.json'), JSON.stringify(activeData, null, 2), 'utf8');
          }

          const distDir = resolve(rootDir, 'dist');
          const distMapsDir = resolve(distDir, 'assets', 'maps');
          if (fs.existsSync(distDir)) {
            if (!fs.existsSync(distMapsDir)) fs.mkdirSync(distMapsDir, { recursive: true });
            fs.writeFileSync(join(distMapsDir, file), JSON.stringify(data, null, 2), 'utf8');
            if (shouldActivate) {
              const activeData = { ...data, _editorSourceMap: file };
              fs.writeFileSync(join(distMapsDir, 'active-map.json'), JSON.stringify(activeData, null, 2), 'utf8');
            }
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, file, active: shouldActivate ? 'active-map.json' : null }));
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
    });

    middlewares.use('/__set_active_map', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method Not Allowed');
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const raw = payload.name || payload.path || payload.map;
          if (!raw) throw new Error('Missing map name');

          const base = raw.toString().split('/').pop();
          const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_');
          const file = safe.toLowerCase().endsWith('.json') ? safe : `${safe}.json`;
          if (file === 'active-map.json') throw new Error('The filename active-map.json is reserved. Activate a named map file instead.');
          const srcPath = join(mapsDir, file);
          if (!fs.existsSync(srcPath)) throw new Error('Map not found');

          const parsedData = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
          parsedData._editorSourceMap = file;
          const data = JSON.stringify(parsedData, null, 2);

          fs.writeFileSync(join(mapsDir, 'active-map.json'), data, 'utf8');

          const distDir = resolve(rootDir, 'dist');
          const distMapsDir = resolve(distDir, 'assets', 'maps');
          if (fs.existsSync(distDir)) {
            if (!fs.existsSync(distMapsDir)) fs.mkdirSync(distMapsDir, { recursive: true });
            fs.writeFileSync(join(distMapsDir, 'active-map.json'), data, 'utf8');
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: true, active: 'active-map.json', source: file }));
        } catch (err) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
    });
  };

  return {
    name: 'editor-assets',
    resolveId(id) {
      if (id === virtualId) return resolvedVirtualId;
      return undefined;
    },
    load(id) {
      if (id !== resolvedVirtualId) return undefined;
      const { tiles, structures, objects, maps } = buildLists();
      return [
        `export const AUTO_TILES = ${JSON.stringify(tiles)};`,
        `export const AUTO_STRUCTURES = ${JSON.stringify(structures)};`,
        `export const AUTO_OBJECTS = ${JSON.stringify(objects)};`,
        `export const AUTO_MAPS = ${JSON.stringify(maps)};`,
      ].join('\n');
    },
    configureServer(server) {
      const watchDirs = [
        join(publicDir, 'assets', 'tilesets'),
        join(publicDir, 'assets', 'tiles'),
        join(publicDir, 'assets', 'editor-tiles'),
        join(publicDir, 'assets', 'structures'),
        join(publicDir, 'assets', 'build'),
        join(publicDir, 'assets', 'objects'),
        join(publicDir, 'assets', 'graphics'),
        join(publicDir, 'assets', 'Graphics'),
        join(publicDir, 'assets', 'ball'),
        join(publicDir, 'assets', 'maps'),
      ];

      watchDirs.forEach((dir) => server.watcher.add(dir));

      const reload = () => {
        const mod = server.moduleGraph.getModuleById(resolvedVirtualId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };

      server.watcher.on('add', reload);
      server.watcher.on('change', reload);
      server.watcher.on('unlink', reload);

      registerMiddlewares(server.middlewares);
    },
    configurePreviewServer(server) {
      registerMiddlewares(server.middlewares);
    },
  };
}
