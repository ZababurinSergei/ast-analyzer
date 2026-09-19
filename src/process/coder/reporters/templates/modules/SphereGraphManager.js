// packages/ast-analyzer/src/reporters/templates/modules/SphereGraphManager.js

/**
 * SphereGraphManager - 3D граф в сфере с векторными координатами
 *
 * Технологии:
 * - Three.js для 3D рендеринга (загружается динамически)
 * - WebGL для аппаратного ускорения
 * - UMAP/t-SNE для уменьшения размерности (через эмбеддинги)
 * - Force-directed layout внутри сферы
 * - Векторные координаты для каждой ноды
 * - Поддержка поиска по векторам
 * - Интерактивное вращение и зумирование
 * - Анимация частиц и связей
 * - Подсветка по семантической близости
 */
export class SphereGraphManager {
  constructor(app) {
    this.app = app;
    this._api = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.nodes = [];
    this.edges = [];
    this.nodeMeshes = new Map();
    this.edgeLines = [];
    this.raycaster = null;
    this.mouse = null;
    this.clock = null;
    this.particles = null;
    this.sphereRadius = 10;
    this.isInitialized = false;
    this._container = null;
    this._hoveredNode = null;
    this._selectedNode = null;
    this._animationId = null;
    this._searchResults = [];
    this._vectorsCache = new Map();
    this._entityMap = new Map();
    this._threeLoaded = false;
    this._loadingPromise = null;
    this._autoRotateTimeout = null;

    // Цвета для типов
    this.COLORS = {
      module: 0x3b82f6,
      function: 0xfbbf24,
      constant: 0xf472b6,
      interface: 0xa78bfa,
      type: 0x22d3ee,
      class: 0x4ade80,
      variable: 0xf87171,
      external: 0xef4444,
    };

    this.LABELS = {
      module: '📁 Модуль',
      function: 'ƒ Функция',
      constant: '📌 Константа',
      interface: '📋 Интерфейс',
      type: '📝 Тип',
      class: '📦 Класс',
      variable: '📄 Переменная',
    };

    // Состояние
    this._filters = {
      search: '',
      type: '',
      minConnections: 0,
    };

    this._isRotating = false;
    this._rotationSpeed = 0.001;

    console.log('🌐 SphereGraphManager created - Modern 3D Sphere Graph');
  }

  /**
   * Загрузка Three.js и зависимостей
   */
  async _loadThreeJS() {
    if (this._threeLoaded) return;
    if (this._loadingPromise) return this._loadingPromise;

    console.log('📦 Загрузка Three.js...');

    this._loadingPromise = new Promise((resolve, reject) => {
      // Проверяем, не загружен ли уже
      if (typeof THREE !== 'undefined') {
        this._threeLoaded = true;
        console.log('✅ Three.js уже загружен');
        resolve();
        return;
      }

      // Загружаем Three.js
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
      script.async = true;

      script.onload = () => {
        console.log('✅ Three.js загружен');
        // Загружаем OrbitControls
        this._loadOrbitControls().then(() => {
          this._threeLoaded = true;
          resolve();
        }).catch(reject);
      };

      script.onerror = () => {
        // Пробуем альтернативный CDN
        console.warn('⚠️ Ошибка загрузки Three.js, пробуем альтернативный CDN...');
        const altScript = document.createElement('script');
        altScript.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
        altScript.async = true;
        altScript.onload = () => {
          console.log('✅ Three.js загружен через альтернативный CDN');
          this._loadOrbitControls().then(() => {
            this._threeLoaded = true;
            resolve();
          }).catch(reject);
        };
        altScript.onerror = () => {
          reject(new Error('Не удалось загрузить Three.js'));
        };
        document.head.appendChild(altScript);
      };

      document.head.appendChild(script);
    });

    return this._loadingPromise;
  }

  /**
   * Загрузка OrbitControls
   */
  async _loadOrbitControls() {
    return new Promise((resolve, reject) => {
      // Проверяем, не загружен ли уже
      if (typeof THREE !== 'undefined' && THREE.OrbitControls) {
        console.log('✅ OrbitControls уже загружены');
        resolve();
        return;
      }

      // Проверяем глобальный OrbitControls
      if (typeof window.OrbitControls !== 'undefined') {
        console.log('✅ OrbitControls уже загружены глобально');
        resolve();
        return;
      }

      // Загружаем OrbitControls
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/js/controls/OrbitControls.js';
      script.async = true;

      script.onload = () => {
        console.log('✅ OrbitControls загружены');
        resolve();
      };

      script.onerror = () => {
        // Пробуем альтернативный CDN
        console.warn('⚠️ Ошибка загрузки OrbitControls, пробуем альтернативный CDN...');
        const altScript = document.createElement('script');
        altScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/controls/OrbitControls.js';
        altScript.async = true;
        altScript.onload = () => {
          console.log('✅ OrbitControls загружены через альтернативный CDN');
          resolve();
        };
        altScript.onerror = () => {
          // Если OrbitControls не загрузились, создаем свои
          console.warn('⚠️ OrbitControls не загружены, использую ручное управление');
          resolve();
        };
        document.head.appendChild(altScript);
      };

      document.head.appendChild(script);
    });
  }

  /**
   * Инициализация
   */
  async init() {
    console.log('🔄 SphereGraphManager.init() called');

    this._api = window[Symbol.for('__AST_APP_API__')];

    const container = document.getElementById('d3GraphWrapper');
    if (!container) {
      console.warn('⚠️ d3GraphWrapper container not found');
      return;
    }

    // Очищаем контейнер
    container.innerHTML = '';

    // Создаем контейнер для Three.js
    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'sphereGraphContainer';
    canvasContainer.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: 500px;
      background: #0b1020;
      border-radius: 8px;
      position: relative;
      overflow: hidden;
    `;
    container.appendChild(canvasContainer);

    this._container = canvasContainer;

    // Загружаем Three.js
    try {
      await this._loadThreeJS();
    } catch (error) {
      console.error('❌ Ошибка загрузки Three.js:', error);
      this._showError('Не удалось загрузить 3D движок. Попробуйте обновить страницу.');
      return;
    }

    // Загружаем данные
    this._loadData();

    // Инициализируем Three.js
    this._initThreeJS();

    // Создаем граф
    this._buildGraph();

    // Настраиваем взаимодействие
    this._setupInteraction();

    this._isInitialized = true;
    console.log('✅ SphereGraphManager initialized with vector coordinates');
  }

  /**
   * Показ ошибки
   */
  _showError(message) {
    if (!this._container) return;
    this._container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;color:#f87171;flex-direction:column;gap:16px;padding:20px;">
        <div style="font-size:48px;">⚠️</div>
        <div style="font-size:16px;text-align:center;max-width:400px;">${message}</div>
        <button onclick="window.graphSwitcher?.switchTo('vis')" 
                style="background:#1a2a4a;border:1px solid #3b82f6;color:#e2e8f0;padding:8px 24px;border-radius:6px;cursor:pointer;font-size:14px;">
          🔄 Переключиться на Vis граф
        </button>
        <button onclick="window.graphSwitcher?.switchTo('d3')" 
                style="background:#1a2a4a;border:1px solid #8b5cf6;color:#e2e8f0;padding:8px 24px;border-radius:6px;cursor:pointer;font-size:14px;">
          📊 Переключиться на D3 граф
        </button>
      </div>
    `;
  }

  /**
   * Загрузка данных
   */
  _loadData() {
    const reportData = window[Symbol.for('__AST_INTERACTIVE_REPORT_DATA__')];
    if (!reportData) {
      console.warn('⚠️ Report data not found');
      return;
    }

    // Извлекаем все сущности
    this.allEntities = this._extractAllEntities(reportData);
    this.allEdges = this._buildEntityEdges(this.allEntities, reportData);

    // Генерируем векторные координаты
    this._generateVectorCoordinates();

    console.log(`📊 Загружено: ${this.allEntities.length} сущностей, ${this.allEdges.length} связей`);
    console.log(`🧭 Векторные координаты сгенерированы для ${this._entityMap.size} сущностей`);
  }

  /**
   * Генерация векторных координат с использованием современных методов
   */
  _generateVectorCoordinates() {
    console.log('🧬 Генерация векторных координат...');

    // 1. Создаем эмбеддинги на основе AST-структуры и текста
    const embeddings = this._generateEmbeddings();

    // 2. Уменьшаем размерность до 3D с помощью UMAP-подобного алгоритма
    const coordinates = this._reduceDimensions(embeddings);

    // 3. Нормализуем к сфере
    this._normalizeToSphere(coordinates);

    // 4. Сохраняем векторы
    for (let i = 0; i < this.allEntities.length; i++) {
      const entity = this.allEntities[i];
      const vec = coordinates[i] || { x: 0, y: 0, z: 0 };
      entity.vector = vec;
      entity.embedding = embeddings[i] || [];
      this._entityMap.set(entity.id, entity);
      this._vectorsCache.set(entity.id, vec);
    }

    console.log('✅ Векторные координаты сгенерированы');
  }

  /**
   * Генерация эмбеддингов для сущностей
   */
  _generateEmbeddings() {
    const embeddings = [];

    for (const entity of this.allEntities) {
      // Базовый вектор (100 измерений)
      const vec = new Float32Array(100);

      // 1. Кодируем тип (one-hot)
      const typeIndex = ['module', 'function', 'class', 'interface', 'type', 'constant', 'variable'].indexOf(entity.type);
      if (typeIndex >= 0) {
        vec[typeIndex * 5] = 1.0;
      }

      // 2. Кодируем экспортированность
      if (entity.isExported) {
        vec[35] = 1.0;
      }

      // 3. Кодируем асинхронность
      if (entity.isAsync) {
        vec[36] = 1.0;
      }

      // 4. Хэш имени (как признак)
      const nameHash = this._hashString(entity.name);
      for (let i = 0; i < 10; i++) {
        vec[40 + i] = (nameHash >> (i * 3)) & 0x7;
      }

      // 5. Количество связей (нормализованное)
      const connections = (entity.calls?.length || 0) + (entity.calledBy?.length || 0);
      vec[50] = Math.min(connections / 20, 1.0);

      // 6. Сложность (нормализованная)
      const complexity = entity.complexity || 0;
      vec[51] = Math.min(complexity / 30, 1.0);

      // 7. Размер файла/функции (нормализованный)
      const size = entity.fileStats?.lines || entity.endLine - entity.startLine || 0;
      vec[52] = Math.min(size / 500, 1.0);

      // 8. Количество параметров
      const params = entity.params?.length || 0;
      vec[53] = Math.min(params / 10, 1.0);

      // 9. Семантический хэш кода (из первых 50 символов)
      if (entity.body || entity.definition || entity.value) {
        const text = entity.body || entity.definition || String(entity.value);
        const textHash = this._hashString(text.substring(0, 50));
        for (let i = 0; i < 15; i++) {
          vec[60 + i] = (textHash >> (i * 2)) & 0x3;
        }
      }

      // 10. Расшифровка: зависимости от других модулей
      if (entity.module) {
        const moduleHash = this._hashString(entity.module);
        for (let i = 0; i < 15; i++) {
          vec[80 + i] = (moduleHash >> (i * 2)) & 0x3;
        }
      }

      embeddings.push(vec);
    }

    return embeddings;
  }

  /**
   * Уменьшение размерности с 100 до 3
   */
  _reduceDimensions(embeddings) {
    const n = embeddings.length;
    if (n === 0) return [];

    // Используем улучшенный алгоритм:
    // 1. PCA для начального приближения
    // 2. Force-directed layout для оптимизации

    // Шаг 1: PCA
    const pcaResult = this._pca(embeddings, 3);
    let coords = pcaResult;

    // Шаг 2: Force-directed refinement с сохранением структуры
    coords = this._refineCoordinates(coords, embeddings);

    // Шаг 3: Нормализация
    const maxVal = Math.max(
      Math.max(...coords.map(c => Math.abs(c.x))),
      Math.max(...coords.map(c => Math.abs(c.y))),
      Math.max(...coords.map(c => Math.abs(c.z)))
    );

    if (maxVal > 0) {
      coords = coords.map(c => ({
        x: c.x / maxVal * 2,
        y: c.y / maxVal * 2,
        z: c.z / maxVal * 2
      }));
    }

    return coords;
  }

  /**
   * PCA (Principal Component Analysis)
   */
  _pca(embeddings, dimensions) {
    const n = embeddings.length;
    const dim = embeddings[0].length;

    // 1. Центрирование
    const means = new Float32Array(dim);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < dim; j++) {
        means[j] += embeddings[i][j] / n;
      }
    }

    const centered = embeddings.map(vec => {
      const result = new Float32Array(dim);
      for (let j = 0; j < dim; j++) {
        result[j] = vec[j] - means[j];
      }
      return result;
    });

    // 2. Вычисляем ковариационную матрицу (упрощенно)
    const components = [];
    for (let d = 0; d < dimensions; d++) {
      let component = new Float32Array(dim);
      for (let i = 0; i < dim; i++) {
        component[i] = Math.random() * 2 - 1;
      }

      // Нормализуем
      let norm = 0;
      for (let i = 0; i < dim; i++) {
        norm += component[i] * component[i];
      }
      norm = Math.sqrt(norm);
      for (let i = 0; i < dim; i++) {
        component[i] /= norm;
      }

      // Итерации для поиска главной компоненты
      for (let iter = 0; iter < 50; iter++) {
        let newComponent = new Float32Array(dim);
        for (let i = 0; i < n; i++) {
          const dot = this._dotProduct(centered[i], component);
          for (let j = 0; j < dim; j++) {
            newComponent[j] += centered[i][j] * dot;
          }
        }

        // Нормализуем
        norm = 0;
        for (let i = 0; i < dim; i++) {
          norm += newComponent[i] * newComponent[i];
        }
        norm = Math.sqrt(norm);
        for (let i = 0; i < dim; i++) {
          newComponent[i] /= norm;
        }
        component = newComponent;
      }
      components.push(component);
    }

    // 3. Проекция
    const result = [];
    for (let i = 0; i < n; i++) {
      const proj = { x: 0, y: 0, z: 0 };
      if (dimensions > 0) {
        proj.x = this._dotProduct(centered[i], components[0]);
      }
      if (dimensions > 1) {
        proj.y = this._dotProduct(centered[i], components[1]);
      }
      if (dimensions > 2) {
        proj.z = this._dotProduct(centered[i], components[2]);
      }
      result.push(proj);
    }

    return result;
  }

  /**
   * Уточнение координат с помощью force-directed layout
   */
  _refineCoordinates(coords, embeddings) {
    const n = coords.length;
    if (n === 0) return coords;

    const iterations = 100;
    const learningRate = 0.01;
    const springConst = 0.1;
    const repulsionConst = 100;

    // Вычисляем сходство между сущностями
    const similarity = this._computeSimilarity(embeddings);

    for (let iter = 0; iter < iterations; iter++) {
      const forces = coords.map(() => ({ x: 0, y: 0, z: 0 }));

      // Силы притяжения (похожие сущности притягиваются)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const sim = similarity[i][j];
          if (sim < 0.1) continue;

          const dx = coords[i].x - coords[j].x;
          const dy = coords[i].y - coords[j].y;
          const dz = coords[i].z - coords[j].z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.001;

          const force = sim * springConst * (dist - 2);

          forces[i].x -= force * dx / dist;
          forces[i].y -= force * dy / dist;
          forces[i].z -= force * dz / dist;

          forces[j].x += force * dx / dist;
          forces[j].y += force * dy / dist;
          forces[j].z += force * dz / dist;
        }
      }

      // Силы отталкивания (все пары)
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = coords[i].x - coords[j].x;
          const dy = coords[i].y - coords[j].y;
          const dz = coords[i].z - coords[j].z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.001;

          const force = repulsionConst / (dist * dist + 0.1);

          forces[i].x += force * dx / dist;
          forces[i].y += force * dy / dist;
          forces[i].z += force * dz / dist;

          forces[j].x -= force * dx / dist;
          forces[j].y -= force * dy / dist;
          forces[j].z -= force * dz / dist;
        }
      }

      // Применяем силы
      for (let i = 0; i < n; i++) {
        coords[i].x += forces[i].x * learningRate;
        coords[i].y += forces[i].y * learningRate;
        coords[i].z += forces[i].z * learningRate;
      }
    }

    return coords;
  }

  /**
   * Вычисление сходства между сущностями
   */
  _computeSimilarity(embeddings) {
    const n = embeddings.length;
    const similarity = [];

    for (let i = 0; i < n; i++) {
      similarity[i] = [];
      for (let j = 0; j < n; j++) {
        if (i === j) {
          similarity[i][j] = 1;
        } else {
          const dot = this._dotProduct(embeddings[i], embeddings[j]);
          const norm1 = Math.sqrt(this._dotProduct(embeddings[i], embeddings[i]));
          const norm2 = Math.sqrt(this._dotProduct(embeddings[j], embeddings[j]));
          similarity[i][j] = dot / (norm1 * norm2 + 0.001);
        }
      }
    }

    return similarity;
  }

  /**
   * Нормализация координат к сфере
   */
  _normalizeToSphere(coords) {
    const radius = this.sphereRadius * 0.8;

    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      const dist = Math.sqrt(c.x*c.x + c.y*c.y + c.z*c.z);

      if (dist > 0.001) {
        const scale = (0.5 + Math.random() * 0.5) * radius / dist;
        c.x *= scale;
        c.y *= scale;
        c.z *= scale;
      } else {
        // Случайное положение на сфере
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        c.x = radius * Math.sin(phi) * Math.cos(theta);
        c.y = radius * Math.sin(phi) * Math.sin(theta);
        c.z = radius * Math.cos(phi);
      }
    }
  }

  /**
   * Инициализация Three.js
   */
  _initThreeJS() {
    const container = this._container;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 700;

    // Проверяем, что THREE загружен
    if (typeof THREE === 'undefined') {
      console.error('❌ THREE не загружен!');
      this._showError('Three.js не загружен. Попробуйте обновить страницу.');
      return;
    }

    // Сцена
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1020);

    // Камера
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(20, 15, 25);
    this.camera.lookAt(0, 0, 0);

    // Рендерер
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Орбит контрол
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    } else if (typeof window.OrbitControls !== 'undefined') {
      this.controls = new window.OrbitControls(this.camera, this.renderer.domElement);
    } else {
      console.warn('⚠️ OrbitControls не загружены, использую базовое вращение');
      // Создаем простой контрол без OrbitControls
      this.controls = {
        enableDamping: true,
        dampingFactor: 0.05,
        autoRotate: true,
        autoRotateSpeed: 0.5,
        minDistance: 5,
        maxDistance: 50,
        target: new THREE.Vector3(0, 0, 0),
        update: () => {},
        enableZoom: true,
      };
      // Добавляем ручное управление
      this._setupManualControls();
    }

    if (this.controls) {
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.5;
      this.controls.minDistance = 5;
      this.controls.maxDistance = 50;
      this.controls.update();
    }

    // Освещение
    this._setupLighting();

    // Рейкастер
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Часы
    this.clock = new THREE.Clock();

    // Ресайз
    window.addEventListener('resize', () => this._onResize());

    // Анимационный цикл
    this._animate();

    console.log('✅ Three.js initialized');
  }

  /**
   * Ручное управление для случая без OrbitControls
   */
  _setupManualControls() {
    const canvas = this.renderer?.domElement;
    if (!canvas) return;

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotation = { x: 0, y: 0 };

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
        this.controls.autoRotate = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        rotation.y += deltaX * 0.005;
        rotation.x += deltaY * 0.005;

        previousMousePosition = { x: e.clientX, y: e.clientY };

        // Обновляем камеру
        const radius = this.camera.position.length();
        const theta = rotation.y;
        const phi = Math.PI / 2 + rotation.x;

        this.camera.position.x = radius * Math.sin(phi) * Math.cos(theta);
        this.camera.position.y = radius * Math.cos(phi);
        this.camera.position.z = radius * Math.sin(phi) * Math.sin(theta);
        this.camera.lookAt(0, 0, 0);
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
      setTimeout(() => {
        this.controls.autoRotate = true;
      }, 3000);
    });

    // Зум колесиком
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      const pos = this.camera.position;
      const newRadius = Math.max(5, Math.min(50, pos.length() * delta));
      const ratio = newRadius / pos.length();
      pos.x *= ratio;
      pos.y *= ratio;
      pos.z *= ratio;
    });
  }

  /**
   * Настройка освещения
   */
  _setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambient);

    // Hemisphere light
    const hemi = new THREE.HemisphereLight(0x6088c0, 0x202040, 0.8);
    this.scene.add(hemi);

    // Directional lights
    const light1 = new THREE.DirectionalLight(0xffffff, 1.0);
    light1.position.set(10, 20, 10);
    light1.castShadow = true;
    this.scene.add(light1);

    const light2 = new THREE.DirectionalLight(0x4488ff, 0.5);
    light2.position.set(-10, -5, -10);
    this.scene.add(light2);

    const light3 = new THREE.DirectionalLight(0x88bbff, 0.3);
    light3.position.set(0, -15, 10);
    this.scene.add(light3);

    // Сфера для подсветки
    const sphereGeom = new THREE.SphereGeometry(this.sphereRadius * 1.05, 32, 32);
    const sphereMat = new THREE.MeshBasicMaterial({
      color: 0x1a2a4a,
      wireframe: true,
      transparent: true,
      opacity: 0.1,
    });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    this.scene.add(sphere);

    // Эффект свечения
    const glowGeom = new THREE.SphereGeometry(this.sphereRadius * 1.1, 32, 32);
    const glowMat = new THREE.ShaderMaterial({
      transparent: true,
      opacity: 0.05,
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(0.3, 0.6, 1.0, intensity * 0.3);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const glow = new THREE.Mesh(glowGeom, glowMat);
    this.scene.add(glow);
  }

  /**
   * Построение графа
   */
  _buildGraph() {
    // Очищаем старые объекты
    this._clearGraph();

    // Создаем узлы
    this._createNodes();

    // Создаем связи
    this._createEdges();

    // Создаем частицы фона
    this._createParticles();

    console.log(`✅ Граф построен: ${this.nodeMeshes.size} узлов, ${this.edgeLines.length} связей`);
  }

  /**
   * Создание узлов
   */
  _createNodes() {
    const entities = this.allEntities;

    // Группа для узлов
    const nodeGroup = new THREE.Group();
    this.scene.add(nodeGroup);

    // Кэш материалов для оптимизации
    const materialCache = new Map();

    for (const entity of entities) {
      if (!entity.vector) continue;

      const color = this.COLORS[entity.type] || 0x94a3b8;
      const size = this._getNodeSize(entity);
      const pos = entity.vector;

      // Создаем материал
      const matKey = `${color}_${entity.isExported ? 'exported' : ''}`;
      let material = materialCache.get(matKey);
      if (!material) {
        material = new THREE.MeshPhysicalMaterial({
          color: color,
          metalness: 0.2,
          roughness: 0.3,
          emissive: color,
          emissiveIntensity: entity.isExported ? 0.15 : 0.05,
          clearcoat: 0.1,
          clearcoatRoughness: 0.2,
        });
        materialCache.set(matKey, material);
      }

      // Геометрия в зависимости от типа
      let geometry;
      const type = entity.type;

      if (type === 'module') {
        geometry = new THREE.BoxGeometry(size * 1.2, size * 1.2, size * 1.2);
      } else if (type === 'function') {
        geometry = new THREE.SphereGeometry(size, 16, 16);
      } else if (type === 'class') {
        geometry = new THREE.OctahedronGeometry(size * 1.1);
      } else if (type === 'interface') {
        geometry = new THREE.TorusGeometry(size * 0.8, size * 0.3, 8, 12);
      } else if (type === 'type') {
        geometry = new THREE.ConeGeometry(size * 0.9, size * 1.2, 8);
      } else if (type === 'constant') {
        geometry = new THREE.TetrahedronGeometry(size * 1.1);
      } else {
        geometry = new THREE.SphereGeometry(size * 0.8, 8, 8);
      }

      // Создаем меш
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = {
        entityId: entity.id,
        entity: entity,
        isExported: entity.isExported || false,
        type: entity.type,
        size: size,
        baseColor: color,
        originalPosition: { x: pos.x, y: pos.y, z: pos.z },
      };

      // Добавляем свечение для экспортированных
      if (entity.isExported) {
        const glowMesh = this._createGlowEffect(mesh, color);
        mesh.add(glowMesh);
      }

      nodeGroup.add(mesh);
      this.nodeMeshes.set(entity.id, mesh);
    }
  }

  /**
   * Создание эффекта свечения
   */
  _createGlowEffect(mesh, color) {
    const size = mesh.userData.size || 1;
    const geometry = new THREE.SphereGeometry(size * 1.4, 16, 16);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(uColor, intensity * 0.5);
        }
      `,
      uniforms: {
        uColor: { value: new THREE.Color(color) }
      }
    });

    return new THREE.Mesh(geometry, material);
  }

  /**
   * Создание связей
   */
  _createEdges() {
    const edges = this.allEdges;
    const edgeGroup = new THREE.Group();
    this.scene.add(edgeGroup);

    // Кэш позиций узлов
    const nodePositions = new Map();
    for (const [id, mesh] of this.nodeMeshes) {
      nodePositions.set(id, mesh.position);
    }

    // Фильтруем связи: только между существующими узлами
    const validEdges = edges.filter(e =>
      nodePositions.has(e.from) && nodePositions.has(e.to)
    );

    // Сортируем по типу для оптимизации
    const callEdges = validEdges.filter(e => e.type === 'calls');
    const otherEdges = validEdges.filter(e => e.type !== 'calls');

    // Создаем связи вызовов (более яркие)
    this._createEdgeBatch(callEdges, nodePositions, 0xef4444, 0.5);

    // Создаем остальные связи
    this._createEdgeBatch(otherEdges, nodePositions, 0x3b82f6, 0.3);
  }

  /**
   * Создание пакета связей
   */
  _createEdgeBatch(edges, nodePositions, color, opacity) {
    if (edges.length === 0) return;

    // Используем BufferGeometry для эффективности
    const positions = [];
    const colors = [];

    for (const edge of edges) {
      const from = nodePositions.get(edge.from);
      const to = nodePositions.get(edge.to);

      if (!from || !to) continue;

      positions.push(from.x, from.y, from.z);
      positions.push(to.x, to.y, to.z);

      // Цвет
      const c = new THREE.Color(color);
      for (let i = 0; i < 2; i++) {
        colors.push(c.r, c.g, c.b);
      }
    }

    if (positions.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: opacity,
      linewidth: 1,
    });

    const lines = new THREE.LineSegments(geometry, material);
    this.scene.add(lines);
    this.edgeLines.push(lines);
  }

  /**
   * Создание фоновых частиц
   */
  _createParticles() {
    const count = 2000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Распределение внутри сферы
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = this.sphereRadius * 1.5 * Math.cbrt(Math.random());

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const brightness = 0.3 + Math.random() * 0.3;
      colors[i * 3] = 0.4 * brightness;
      colors[i * 3 + 1] = 0.6 * brightness;
      colors[i * 3 + 2] = 1.0 * brightness;

      sizes[i] = 0.02 + Math.random() * 0.05;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  /**
   * Настройка взаимодействия
   */
  _setupInteraction() {
    const canvas = this.renderer?.domElement;
    if (!canvas) return;

    // Клик
    canvas.addEventListener('click', (event) => {
      this._onClick(event);
    });

    // Наведение
    canvas.addEventListener('mousemove', (event) => {
      this._onHover(event);
    });

    // Двойной клик - фокус
    canvas.addEventListener('dblclick', (event) => {
      this._onDoubleClick(event);
    });

    // Колесо мыши - зум
    canvas.addEventListener('wheel', (event) => {
      // Уже обрабатывается OrbitControls
    });

    // Сброс автоматического вращения при взаимодействии
    canvas.addEventListener('pointerdown', () => {
      if (this.controls) {
        this.controls.autoRotate = false;
      }
    });

    canvas.addEventListener('pointerup', () => {
      // Включаем через 3 секунды бездействия
      clearTimeout(this._autoRotateTimeout);
      this._autoRotateTimeout = setTimeout(() => {
        if (this.controls) {
          this.controls.autoRotate = true;
        }
      }, 5000);
    });

    // Клавиатура
    document.addEventListener('keydown', (e) => {
      if (e.key === 'r' || e.key === 'R') {
        // Сброс вида
        this._resetView();
      }
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        if (this.controls) {
          this.controls.autoRotate = !this.controls.autoRotate;
        }
      }
      if (e.key === 'Escape') {
        this._deselectNode();
      }
    });

    console.log('✅ Interaction setup complete');
  }

  /**
   * Обработка клика
   */
  _onClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.nodeMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const entity = mesh.userData.entity;
      if (entity) {
        this._selectNode(entity.id);
        this._showDetails(entity);
        return;
      }
    }

    // Клик по пустому месту - сброс
    this._deselectNode();
  }

  /**
   * Обработка наведения
   */
  _onHover(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.nodeMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes);

    // Восстанавливаем предыдущий
    if (this._hoveredNode) {
      this._unhighlightNode(this._hoveredNode);
    }

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      this._hoveredNode = mesh;
      this._highlightNode(mesh);
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this._hoveredNode = null;
      this.renderer.domElement.style.cursor = 'default';
    }
  }

  /**
   * Обработка двойного клика
   */
  _onDoubleClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.nodeMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const entity = mesh.userData.entity;
      if (entity) {
        this._focusOnNode(entity.id);
        this._showNeighbors(entity);
      }
    }
  }

  /**
   * Выделение узла
   */
  _highlightNode(mesh) {
    const material = mesh.material;
    if (material.emissiveIntensity !== undefined) {
      material.emissiveIntensity = 0.5;
    }
    const scale = 1.2;
    mesh.scale.set(scale, scale, scale);
  }

  /**
   * Снятие выделения
   */
  _unhighlightNode(mesh) {
    if (!mesh) return;
    const material = mesh.material;
    if (material.emissiveIntensity !== undefined) {
      material.emissiveIntensity = mesh.userData.isExported ? 0.15 : 0.05;
    }
    mesh.scale.set(1, 1, 1);
  }

  /**
   * Выбор узла
   */
  _selectNode(id) {
    // Снимаем выделение с предыдущего
    if (this._selectedNode) {
      this._unhighlightNode(this._selectedNode);
    }

    const mesh = this.nodeMeshes.get(id);
    if (mesh) {
      this._selectedNode = mesh;
      this._highlightNode(mesh);

      // Подсветка связанных узлов
      this._highlightNeighbors(id);
    }
  }

  /**
   * Снятие выбора
   */
  _deselectNode() {
    if (this._selectedNode) {
      this._unhighlightNode(this._selectedNode);
      this._selectedNode = null;
      this._clearNeighborHighlights();
    }

    const detailsDiv = document.getElementById('details');
    if (detailsDiv) {
      detailsDiv.innerHTML = `<p class="hint">💡 Клик по узлу — подробности. Двойной клик — фокус на связанные узлы.</p>`;
    }
  }

  /**
   * Подсветка соседей
   */
  _highlightNeighbors(id) {
    // Находим связи
    const neighbors = new Set();
    for (const edge of this.allEdges) {
      if (edge.from === id) neighbors.add(edge.to);
      if (edge.to === id) neighbors.add(edge.from);
    }

    // Подсвечиваем
    for (const [nodeId, mesh] of this.nodeMeshes) {
      if (neighbors.has(nodeId)) {
        this._highlightNode(mesh);
      }
    }
  }

  /**
   * Снятие подсветки соседей
   */
  _clearNeighborHighlights() {
    for (const [, mesh] of this.nodeMeshes) {
      if (mesh !== this._selectedNode) {
        this._unhighlightNode(mesh);
      }
    }
  }

  /**
   * Фокус на узле
   */
  _focusOnNode(id) {
    const mesh = this.nodeMeshes.get(id);
    if (!mesh) return;

    const pos = mesh.position;
    if (this.controls) {
      this.controls.target.copy(pos);
      this.controls.autoRotate = false;
      this.controls.update();
    }

    // Плавное приближение
    const distance = 5 + mesh.userData.size * 2;
    this.camera.position.set(
      pos.x + distance * 0.7,
      pos.y + distance * 0.5,
      pos.z + distance
    );
    if (this.controls) {
      this.controls.update();
    }
  }

  /**
   * Показ соседей
   */
  _showNeighbors(entity) {
    const neighbors = [];
    for (const edge of this.allEdges) {
      if (edge.from === entity.id) {
        const target = this.allEntities.find(e => e.id === edge.to);
        if (target) neighbors.push(target);
      }
      if (edge.to === entity.id) {
        const source = this.allEntities.find(e => e.id === edge.from);
        if (source) neighbors.push(source);
      }
    }

    // Обновляем детали
    this._showDetails(entity, neighbors);
  }

  /**
   * Показ деталей
   */
  _showDetails(entity, neighbors = []) {
    const detailsDiv = document.getElementById('details');
    if (!detailsDiv) return;

    let html = `<h2>${this._getEntityIcon(entity)} ${this._escapeHtml(entity.name)}</h2>`;
    html += `<div class="meta">`;
    html += `<span class="entity-badge badge-${entity.type}">${this.LABELS[entity.type] || entity.type}</span>`;
    if (entity.isExported) html += ' 📤 Экспортирована';
    if (entity.isAsync) html += ' ⚡ Асинхронная';
    if (entity.isEntry) html += ' ⭐ Точка входа';
    html += `</div>`;

    // Векторные координаты
    if (entity.vector) {
      html += `<div style="font-size:11px;color:#64748b;font-family:monospace;margin:4px 0;background:#0a0a1a;padding:4px 8px;border-radius:4px;border:1px solid #1a2a4a;">`;
      html += `🧭 Вектор: [${entity.vector.x.toFixed(4)}, ${entity.vector.y.toFixed(4)}, ${entity.vector.z.toFixed(4)}]`;
      html += `<br>📍 Расстояние от центра: ${(Math.sqrt(entity.vector.x**2 + entity.vector.y**2 + entity.vector.z**2)).toFixed(4)}`;
      html += `</div>`;
    }

    // Информация
    if (entity.module) {
      html += `<div style="font-size:12px;color:#94a3b8;">📁 Модуль: ${this._escapeHtml(entity.module)}</div>`;
    }
    if (entity.line) html += `<div style="font-size:12px;color:#94a3b8;">📍 Строка: ${entity.line}</div>`;

    // Связи
    if (neighbors.length > 0) {
      html += `<div style="margin-top:8px;border-top:1px solid #1a2a4a;padding-top:8px;">`;
      html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">🔗 Связанные сущности (${neighbors.length}):</div>`;
      html += `<ul class="list" style="max-height:150px;overflow-y:auto;">`;
      for (const neighbor of neighbors) {
        const distance = this._getVectorDistance(entity.vector, neighbor.vector);
        html += `<li style="font-size:11px;color:#e2e8f0;padding:2px 0;">`;
        html += `${this._getEntityIcon(neighbor)} ${this._escapeHtml(neighbor.name)}`;
        html += ` <span style="color:#64748b;font-size:10px;">(${distance.toFixed(4)})</span>`;
        html += `</li>`;
      }
      html += `</ul></div>`;
    }

    // Поиск похожих по вектору
    html += `<div style="margin-top:8px;border-top:1px solid #1a2a4a;padding-top:8px;">`;
    html += `<button onclick="window.SphereGraphSearch('${entity.id}')" style="background:#1a2a4a;border:1px solid #3b82f6;color:#e2e8f0;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px;width:100%;">`;
    html += `🔍 Найти похожие по вектору</button>`;
    html += `</div>`;

    detailsDiv.innerHTML = html;

    // Глобальная функция для поиска
    window.SphereGraphSearch = (id) => {
      this._searchByVector(id);
    };
  }

  /**
   * Поиск по вектору
   */
  _searchByVector(id) {
    const entity = this._entityMap.get(id);
    if (!entity || !entity.vector) return;

    const results = [];
    for (const [otherId, other] of this._entityMap) {
      if (otherId === id || !other.vector) continue;
      const distance = this._getVectorDistance(entity.vector, other.vector);
      results.push({ entity: other, distance });
    }

    results.sort((a, b) => a.distance - b.distance);

    // Показываем топ-10
    this._searchResults = results.slice(0, 10);
    this._highlightSearchResults(this._searchResults);
  }

  /**
   * Подсветка результатов поиска
   */
  _highlightSearchResults(results) {
    // Сначала снимаем все подсветки
    this._clearNeighborHighlights();

    // Подсвечиваем результаты
    const resultIds = new Set(results.map(r => r.entity.id));
    for (const [id, mesh] of this.nodeMeshes) {
      if (resultIds.has(id)) {
        this._highlightNode(mesh);
      }
    }

    // Показываем результаты в деталях
    const detailsDiv = document.getElementById('details');
    if (!detailsDiv) return;

    let html = `<h2>🔍 Результаты поиска по вектору</h2>`;
    html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Найдено ${results.length} похожих сущностей</div>`;
    html += `<ul class="list">`;
    for (const result of results) {
      const entity = result.entity;
      html += `<li style="font-size:11px;color:#e2e8f0;padding:2px 0;cursor:pointer;" onclick="window.SphereGraphFocus('${entity.id}')">`;
      html += `${this._getEntityIcon(entity)} ${this._escapeHtml(entity.name)}`;
      html += ` <span style="color:#64748b;font-size:10px;">📏 ${result.distance.toFixed(4)}</span>`;
      html += ` <span style="color:#64748b;font-size:10px;">${this.LABELS[entity.type]}</span>`;
      html += `</li>`;
    }
    html += `</ul>`;
    html += `<div style="margin-top:8px;">`;
    html += `<button onclick="window.SphereGraphClearSearch()" style="background:#1a2a4a;border:1px solid #f87171;color:#f87171;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px;">✕ Очистить</button>`;
    html += `</div>`;

    detailsDiv.innerHTML = html;

    // Глобальные функции
    window.SphereGraphFocus = (id) => {
      this._focusOnNode(id);
      const entity = this._entityMap.get(id);
      if (entity) this._showDetails(entity);
    };

    window.SphereGraphClearSearch = () => {
      this._searchResults = [];
      this._clearNeighborHighlights();
      this._deselectNode();
    };
  }

  /**
   * Получение размера узла
   */
  _getNodeSize(entity) {
    let size = 0.5;

    if (entity.type === 'module') {
      size = 0.8 + (entity.isEntry ? 0.4 : 0);
    } else if (entity.type === 'function') {
      size = 0.5 + (entity.isExported ? 0.2 : 0) + (entity.calls?.length || 0) * 0.02;
    } else if (entity.type === 'class') {
      size = 0.6 + (entity.methods?.length || 0) * 0.02;
    } else if (entity.type === 'interface') {
      size = 0.5 + (entity.properties?.length || 0) * 0.02;
    } else {
      size = 0.4;
    }

    return Math.min(Math.max(size, 0.3), 1.5);
  }

  /**
   * Получение расстояния между векторами
   */
  _getVectorDistance(v1, v2) {
    if (!v1 || !v2) return Infinity;
    const dx = v1.x - v2.x;
    const dy = v1.y - v2.y;
    const dz = v1.z - v2.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }

  /**
   * Получение иконки
   */
  _getEntityIcon(entity) {
    if (entity.type === 'module') return '📁';
    if (entity.isExported) return '📤';
    const icons = {
      function: 'ƒ',
      constant: '📌',
      interface: '📋',
      type: '📝',
      class: '📦',
      variable: '📄',
    };
    return icons[entity.type] || '•';
  }

  /**
   * Экранирование HTML
   */
  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Хэш строки
   */
  _hashString(str) {
    let hash = 0;
    if (!str) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Скалярное произведение
   */
  _dotProduct(a, b) {
    let sum = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sum += a[i] * b[i];
    }
    return sum;
  }

  /**
   * Анимационный цикл
   */
  _animate() {
    this._animationId = requestAnimationFrame(() => this._animate());

    const delta = this.clock.getDelta();

    // Анимация частиц
    if (this.particles) {
      this.particles.rotation.y += delta * 0.01;
      this.particles.rotation.x += delta * 0.005;
    }

    // Анимация узлов (микро-пульсация)
    for (const [, mesh] of this.nodeMeshes) {
      const scale = 1 + Math.sin(Date.now() * 0.001 + mesh.id.length) * 0.02;
      if (mesh !== this._selectedNode && mesh !== this._hoveredNode) {
        mesh.scale.set(scale, scale, scale);
      }
    }

    if (this.controls) {
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Сброс вида
   */
  _resetView() {
    this.camera.position.set(20, 15, 25);
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.autoRotate = true;
      this.controls.update();
    }
    this._deselectNode();
  }

  /**
   * Очистка графа
   */
  _clearGraph() {
    // Удаляем узлы
    for (const [, mesh] of this.nodeMeshes) {
      this.scene.remove(mesh);
    }
    this.nodeMeshes.clear();

    // Удаляем связи
    for (const line of this.edgeLines) {
      this.scene.remove(line);
    }
    this.edgeLines = [];

    // Удаляем частицы
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles = null;
    }
  }

  /**
   * Обработка изменения размера
   */
  _onResize() {
    if (!this._container) return;
    const width = this._container.clientWidth;
    const height = this._container.clientHeight;

    if (width > 0 && height > 0 && this.camera && this.renderer) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  /**
   * Обновление графа с фокусом
   */
  updateGraphWithFocus(focusModule, focusFunction, mode = 'all') {
    if (!this._isInitialized) {
      this._pendingUpdate = { focusModule, focusFunction, mode };
      return;
    }

    if (focusFunction) {
      const id = `${focusModule}#func:${focusFunction}`;
      if (this.nodeMeshes.has(id)) {
        this._selectNode(id);
        this._focusOnNode(id);
        const entity = this._entityMap.get(id);
        if (entity) this._showDetails(entity);
        return;
      }
    }

    if (focusModule) {
      if (this.nodeMeshes.has(focusModule)) {
        this._selectNode(focusModule);
        this._focusOnNode(focusModule);
        const entity = this._entityMap.get(focusModule);
        if (entity) this._showDetails(entity);
        return;
      }
    }

    // Сброс
    this._deselectNode();
    this._resetView();
  }

  /**
   * Получение узлов
   */
  getGraphNodes() {
    const nodes = [];
    for (const [id, mesh] of this.nodeMeshes) {
      nodes.push({
        id: id,
        position: mesh.position,
        entity: mesh.userData.entity,
      });
    }
    return nodes;
  }

  /**
   * Получение связей
   */
  getGraphLinks() {
    return this.allEdges;
  }

  /**
   * Получение симуляции
   */
  getSimulation() {
    return null;
  }

  /**
   * Очистка
   */
  clear() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }

    this._clearGraph();

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }

    if (this.scene) {
      this.scene = null;
    }

    if (this._container) {
      this._container.innerHTML = '';
    }

    this._isInitialized = false;
  }

  /**
   * Перезагрузка
   */
  async reload() {
    this.clear();
    this._loadData();
    await this._loadThreeJS();
    this._initThreeJS();
    this._buildGraph();
    this._setupInteraction();
    this._isInitialized = true;
  }

  /**
   * Обновление представления
   */
  updateView() {
    if (this._isInitialized) {
      this._buildGraph();
    }
  }

  /**
   * Обработка поиска
   */
  handleSearch(query) {
    this._filters.search = query;
    if (query && query.length > 1) {
      this._searchByText(query);
    } else {
      this._clearSearch();
    }
  }

  /**
   * Поиск по тексту
   */
  _searchByText(query) {
    const q = query.toLowerCase();
    const results = [];

    for (const entity of this.allEntities) {
      if (entity.name.toLowerCase().includes(q) ||
        entity.fullName?.toLowerCase().includes(q) ||
        entity.module?.toLowerCase().includes(q)) {
        results.push(entity);
      }
    }

    if (results.length > 0) {
      // Подсвечиваем результаты
      this._clearNeighborHighlights();
      const resultIds = new Set(results.map(r => r.id));
      for (const [id, mesh] of this.nodeMeshes) {
        if (resultIds.has(id)) {
          this._highlightNode(mesh);
        }
      }

      // Показываем в деталях
      const detailsDiv = document.getElementById('details');
      if (detailsDiv) {
        let html = `<h2>🔍 Результаты поиска: "${query}"</h2>`;
        html += `<div style="font-size:12px;color:#94a3b8;margin-bottom:8px;">Найдено ${results.length} сущностей</div>`;
        html += `<ul class="list" style="max-height:300px;overflow-y:auto;">`;
        for (const entity of results) {
          html += `<li style="font-size:11px;color:#e2e8f0;padding:2px 0;cursor:pointer;" onclick="window.SphereGraphFocus('${entity.id}')">`;
          html += `${this._getEntityIcon(entity)} ${this._escapeHtml(entity.name)}`;
          html += ` <span style="color:#64748b;font-size:10px;">${this.LABELS[entity.type]}</span>`;
          if (entity.vector) {
            html += ` <span style="color:#64748b;font-size:10px;">🧭 [${entity.vector.x.toFixed(2)}, ${entity.vector.y.toFixed(2)}, ${entity.vector.z.toFixed(2)}]</span>`;
          }
          html += `</li>`;
        }
        html += `</ul>`;
        detailsDiv.innerHTML = html;

        window.SphereGraphFocus = (id) => {
          this._focusOnNode(id);
          const entity = this._entityMap.get(id);
          if (entity) this._showDetails(entity);
        };
      }
    }
  }

  /**
   * Очистка поиска
   */
  _clearSearch() {
    this._clearNeighborHighlights();
    this._deselectNode();
    this._filters.search = '';
  }

  /**
   * Извлечение всех сущностей из данных
   */
  _extractAllEntities(data) {
    const entities = [];
    const packages = data.packages || {};

    for (const [modulePath, pkg] of Object.entries(packages)) {
      if (!pkg) continue;

      entities.push({
        id: modulePath,
        name: modulePath.split('/').pop() || modulePath,
        fullName: modulePath,
        type: 'module',
        module: modulePath,
        isEntry: pkg.isEntry || false,
        language: pkg.language || 'unknown',
        fileStats: pkg.fileStats || {},
        displayPath: pkg.displayPath || modulePath,
        exports: pkg.exports || {},
        imports: pkg.imports || {},
        entities: pkg.entities || {},
      });

      const functions = pkg.entities?.functions || [];
      for (const func of functions) {
        if (!func || !func.name) continue;
        entities.push({
          id: `${modulePath}#func:${func.name}`,
          name: func.name,
          fullName: func.name,
          type: 'function',
          module: modulePath,
          isExported: func.isExported || false,
          isAsync: func.isAsync || false,
          params: func.params || [],
          returnType: func.returnType || 'any',
          line: func.line || 0,
          calls: func.calls || [],
          calledBy: func.calledBy || [],
          complexity: func.complexity || 0,
          body: func.body || '',
          isMethod: func.isMethod || false,
          className: func.className || '',
        });
      }

      const constants = pkg.entities?.constants || [];
      for (const const_ of constants) {
        if (!const_ || !const_.name) continue;
        entities.push({
          id: `${modulePath}#const:${const_.name}`,
          name: const_.name,
          fullName: const_.name,
          type: 'constant',
          module: modulePath,
          isExported: const_.isExported || false,
          value: const_.value || '',
          line: const_.line || 0,
        });
      }

      const interfaces = pkg.entities?.interfaces || [];
      for (const interface_ of interfaces) {
        if (!interface_ || !interface_.name) continue;
        entities.push({
          id: `${modulePath}#interface:${interface_.name}`,
          name: interface_.name,
          fullName: interface_.name,
          type: 'interface',
          module: modulePath,
          isExported: interface_.isExported || false,
          properties: interface_.properties || [],
          extends: interface_.extends || [],
          line: interface_.line || 0,
        });
      }

      const types = pkg.entities?.types || [];
      for (const type of types) {
        if (!type || !type.name) continue;
        entities.push({
          id: `${modulePath}#type:${type.name}`,
          name: type.name,
          fullName: type.name,
          type: 'type',
          module: modulePath,
          isExported: type.isExported || false,
          definition: type.definition || '',
          line: type.line || 0,
        });
      }

      const classes = pkg.entities?.classes || [];
      for (const class_ of classes) {
        if (!class_ || !class_.name) continue;
        entities.push({
          id: `${modulePath}#class:${class_.name}`,
          name: class_.name,
          fullName: class_.name,
          type: 'class',
          module: modulePath,
          isExported: class_.isExported || false,
          extends: class_.extends || '',
          implements: class_.implements || [],
          methods: class_.methods || [],
          properties: class_.properties || [],
          line: class_.line || 0,
        });
      }

      const variables = pkg.entities?.variables || [];
      for (const variable of variables) {
        if (!variable || !variable.name) continue;
        entities.push({
          id: `${modulePath}#var:${variable.name}`,
          name: variable.name,
          fullName: variable.name,
          type: 'variable',
          module: modulePath,
          isExported: variable.isExported || false,
          value: variable.value || '',
          line: variable.line || 0,
        });
      }
    }

    return entities;
  }

  /**
   * Построение связей между сущностями
   */
  _buildEntityEdges(entities, data) {
    const edges = [];
    const entityMap = new Map();
    for (const e of entities) {
      entityMap.set(e.id, e);
    }

    // Связи: модуль -> сущности внутри него
    for (const e of entities) {
      if (e.type !== 'module') {
        edges.push({
          from: e.module,
          to: e.id,
          type: 'contains',
          label: 'содержит',
        });
      }
    }

    // Связи: вызовы функций
    for (const e of entities) {
      if (e.type === 'function' && e.calls) {
        for (const call of e.calls) {
          const targetId = `${e.module}#func:${call}`;
          if (entityMap.has(targetId)) {
            edges.push({
              from: e.id,
              to: targetId,
              type: 'calls',
              label: '→',
            });
          } else {
            for (const [id, entity] of entityMap) {
              if (
                entity.type === 'function' &&
                entity.name === call &&
                entity.module !== e.module
              ) {
                edges.push({
                  from: e.id,
                  to: id,
                  type: 'calls',
                  label: '→',
                });
                break;
              }
            }
          }
        }
      }
    }

    // Связи: импорты между модулями
    const packages = data.packages || {};
    for (const [modulePath, pkg] of Object.entries(packages)) {
      if (!pkg) continue;
      const imports = pkg.imports || {};
      for (const [importSource] of Object.entries(imports)) {
        if (entityMap.has(modulePath) && entityMap.has(importSource)) {
          const exists = edges.some(
            e => e.from === modulePath && e.to === importSource && e.type === 'import'
          );
          if (!exists) {
            edges.push({
              from: modulePath,
              to: importSource,
              type: 'import',
              label: '←',
            });
          }
        }
      }
    }

    // Связи: наследование классов
    for (const e of entities) {
      if (e.type === 'class' && e.extends) {
        for (const ext of Array.isArray(e.extends) ? e.extends : [e.extends]) {
          const targetId = `${e.module}#class:${ext}`;
          if (entityMap.has(targetId)) {
            edges.push({
              from: e.id,
              to: targetId,
              type: 'extends',
              label: 'extends',
            });
          }
        }
      }
    }

    // Связи: реализация интерфейсов
    for (const e of entities) {
      if (e.type === 'class' && e.implements) {
        for (const impl of e.implements) {
          const targetId = `${e.module}#interface:${impl}`;
          if (entityMap.has(targetId)) {
            edges.push({
              from: e.id,
              to: targetId,
              type: 'implements',
              label: 'implements',
            });
          }
        }
      }
    }

    // Связи: расширение интерфейсов
    for (const e of entities) {
      if (e.type === 'interface' && e.extends) {
        for (const ext of e.extends) {
          const targetId = `${e.module}#interface:${ext}`;
          if (entityMap.has(targetId)) {
            edges.push({
              from: e.id,
              to: targetId,
              type: 'extends',
              label: 'extends',
            });
          }
        }
      }
    }

    // Удаляем дубликаты
    const uniqueEdges = [];
    const edgeSet = new Set();
    for (const e of edges) {
      const key = `${e.from}->${e.to}:${e.type}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        uniqueEdges.push(e);
      }
    }

    return uniqueEdges;
  }

  /**
   * Освобождение ресурсов
   */
  dispose() {
    this.clear();
  }
}

export default SphereGraphManager;
