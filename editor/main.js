    import {
      computeViewSize as cameraComputeViewSize,
      scrollToCenter as cameraScrollToCenter,
      centerToScroll as cameraCenterToScroll,
      clampCenterToScrollBounds as cameraClampCenterToScrollBounds,
      clampScrollToIsoDiamond as cameraClampScrollToIsoDiamond,
      computeRoadViewOffset as cameraComputeRoadViewOffset
    } from './CameraMath.ts';

    const LAYERS=['ground','paths','cam','zones','decor','citadel','spawn'];
    const canvas=document.getElementById('canvas');
    const ctx=canvas.getContext('2d');
    const statusEl=document.getElementById('status');
    const statsEl=document.getElementById('stats');
    const tileListEl=document.getElementById('tile-list');
    const tileSearchEl=document.getElementById('tile-search');
    const ovLeftEl=document.getElementById('ov-left');
    const ovRightEl=document.getElementById('ov-right');
    const assetsInfoEl=document.getElementById('assets-info');
    const selectedInfoEl=document.getElementById('selected-info');

    let currentLang='en';
    let MW=70,MH=30,TW=64,TH=32;
    const GAME_W=1280,GAME_H=720;
    const TOP_BAR_HEIGHT=42;  // must match #top-bar CSS height in HUDScene
    const HUD_HEIGHT=172;     // must match #bottom-bar CSS height in HUDScene
    const GAME_VIEW_H=GAME_H-TOP_BAR_HEIGHT-HUD_HEIGHT; // actual visible game area = 506px
    const ISO_LAYER_X=1152,ISO_LAYER_Y=0;
    const ROAD_EDGE_INSET_PX=10;
    const ROAD_VIEW_EXTRA_OFFSET_Y=0;
    let cx=0,cy=0,cz=2.2;
    let showGrid=true,currentLayer='ground',brushSize=4,paintMode='paint';
    let gameZoom=1.948,camLockCenter=false,camCenterX=0,camCenterY=0,camStartX=0,camStartY=0,camMoveMode='road-both',camRoadDir='east',camBoundsSource='layers',camBoundsPad=120,camIsoClamp=false;
    let camRoadOffsetY=ROAD_VIEW_EXTRA_OFFSET_Y;
    let camBoundsEnabled=false,camBoundsMinA=0,camBoundsMaxA=0,camBoundsMinB=0,camBoundsMaxB=0;
    let boundsEditMode=false,boundsDrag=null;
    let mapRev=0;
    let isPanning=false,isPainting=false,isPickingStart=false,panMouseX=0,panMouseY=0,panCamX=0,panCamY=0,hoverCol=-1,hoverRow=-1;
    let gameCamMode=false; // editor simulates game camera (bounds clamp)
    let gameCamClampDirty=false;
    let gamePanelOpen=false; // unified game panel toggle
    let gamePanelSavedCz=1; // saved editor zoom to restore when toggling off
    let gameViewMode=false;      // G-key: interactive Game View Mode вЂ“ draggable viewport rect
    let gameViewDrag=false;      // true while LMB is dragging the viewport rect
    let gvDragStartMx=0,gvDragStartMy=0;     // screen mouse position at drag start
    let gvDragStartCamX=0,gvDragStartCamY=0; // camStartX/Y at drag start
    const ATTACK_TOWER_ASSET='assets/build/tower/tower_attack.png';
    const ATTACK_TOWER_SPRITE_TRIM={sx:126,sy:78,sw:772,sh:852};
    const ATTACK_TOWER_RENDER_TUNING={
      anchorX:386,
      anchorY:628,
      drawWidthScale:1,
      tileOffsetX:0,
      tileOffsetY:0,
      drawHeight:72,
      shadowOffsetY:-1.5,
      shadowRadiusX:13,
      shadowRadiusY:4.5,
      shadowAlpha:0.24,
    };

    let layers={};
    const layerVisible={ground:true,paths:true,cam:true,zones:true,decor:true,citadel:true,spawn:true};
    const MASK_LAYERS=new Set(['paths','cam','zones','citadel','spawn']);
    const MASK_COLORS={
      paths:'rgba(61,143,255,0.34)',
      cam:'rgba(120,200,255,0.28)',
      zones:'rgba(255,179,68,0.30)',
      citadel:'rgba(0,214,255,0.28)',
      spawn:'rgba(255,93,93,0.34)'
    };
      let lastLoadedMapFile = '';    // filename of the map currently open in editor
      let lastLoadedMapPath = '';    // full path like /assets/maps/valkyrix-map.json
      const LAST_MAP_KEY = 'valkyrix-last-map-path';
    let lastActivatedMapFile = ''; // filename last sent to /__set_active_map

    // Track which layers have had a tile explicitly selected by the user this session
    const tileExplicitlySelected = {};

    let tileRefs=[];
    const tileImages=new Map();
    const selectedTileByLayer={ground:1,paths:1,cam:1,zones:1,decor:1,citadel:1,spawn:1};
    let autoTiles=[];
    let currentCatalog='tiles';
    const assetCatalog={tiles:[],buildings:[],objects:[],graphics:[]};
    const selectedAsset={tiles:'',buildings:'',objects:'',graphics:''};
    let placedBuildings=[];
    let placedObjects=[];
    let placedGraphics=[];
    let placeTilesW=1,placeTilesH=1;
    let selectedEntity=null;
    let entityDragMode=null; // 'move' | 'resize-br' | 'resize-bl' | 'resize-tr' | 'resize-tl'
    let entityDragStartMx=0,entityDragStartMy=0;
    let entityDragStartTW=1,entityDragStartTH=1;
    let entityDragStartX=0,entityDragStartY=0;
    const HANDLE_R=9;

    const I18N={
      ru:{
        new:'Новая',save:'Сохранить',loadActive:'Загрузить active',reloadAssets:'Обновить ассеты',mapFile:'файл карты...',
        layer:['Земля','Дорога','камера','Зоны','Декор','Цитадель','Спавн'],paint:['Рисовать','Стереть'],grid:'Сетка',ready:'Готово',
        tiles:'Плитки',search:'Поиск плитки',assets:'плиток',selected:'выбрано gid',selectedMask:'выбрано: маска(1)',
        map:'Карта',size:'Размер',width:'Ширина',height:'Высота',tileW:'Тайл W',tileH:'Тайл H',applySize:'Применить размер',
        vis:'Видимость слоев',ground:'Земля',paths:'Дорога',cam:'камера',zones:'Зоны',decor:'Декор',citadel:'Цитадель',spawn:'Спавн',
        camera:'камера',gameZoom:'зум игры',useZoom:'Взять текущий зум',gamePanel:'Режим игры',lock:'Фиксировать центр',centerX:'Центр X',centerY:'Центр Y',
        setMapCenter:'Поставить центр карты',startX:'Старт игры X',startY:'Старт игры Y',takeView:'Установить старт игры',goStart:'Перейти к старту',
        boundsSource:'Источник bounds',boundsPad:'Отступ bounds',customBounds:'Свои bounds',editBounds:'Редактировать bounds',autoBounds:'Авто bounds',boundsOpts:['map','layers','none'],
        isoClamp:'ISO clamp (ромб)',
        moveMode:'Режим движения',roadDir:'Направление дороги',roadOffset:'Смещение дороги Y (px)',diag:'Диагностика',
        mm:['свободно','по дороге (обе)','по дороге (вперед)','по дороге (назад)'],dir:['восток','запад','север','юг'],
        tabs:['ТАЙЛЫ','ЗДАНИЯ','ОБЪЕКТЫ','ГРАФИКА'],
        catTitle:{tiles:'Плитки',buildings:'Здания',objects:'Объекты',graphics:'Графика'},
        modeMask:'Слой {layer}: режим цветовой маски',
        placeHint:'Режим размещения: {kind}'
      },
      en:{
        new:'New',save:'Save',loadActive:'Load active',reloadAssets:'Reload assets',mapFile:'map file...',
        layer:['Ground','Paths','Camera','Zones','Decor','Citadel','Spawn'],paint:['Paint','Erase'],grid:'Grid',ready:'Ready',
        tiles:'Tiles',search:'Search tile',assets:'tiles',selected:'selected gid',selectedMask:'selected: mask(1)',
        map:'Map',size:'Size',width:'Width',height:'Height',tileW:'Tile W',tileH:'Tile H',applySize:'Apply size',
        vis:'Layer Visibility',ground:'Ground',paths:'Paths',cam:'Camera',zones:'Zones',decor:'Decor',citadel:'Citadel',spawn:'Spawn',
        camera:'Camera',gameZoom:'Game zoom',useZoom:'Use current zoom',gamePanel:'Game mode',lock:'Lock center',centerX:'Center X',centerY:'Center Y',
        setMapCenter:'Set map center',startX:'Game start X',startY:'Game start Y',takeView:'Set game start',goStart:'Go to start',
        boundsSource:'Bounds source',boundsPad:'Bounds pad',customBounds:'Custom bounds',editBounds:'Edit bounds',autoBounds:'Auto bounds',boundsOpts:['map','layers','none'],
        isoClamp:'ISO clamp (diamond)',
        moveMode:'Move mode',roadDir:'Road direction',roadOffset:'Road offset Y (px)',diag:'Diagnostics',
        mm:['free','road-both','road-forward','road-backward'],dir:['east','west','north','south'],
        tabs:['TILES','BUILDINGS','OBJECTS','GRAPHICS'],
        catTitle:{tiles:'Tiles',buildings:'Buildings',objects:'Objects',graphics:'Graphics'},
        modeMask:'Layer {layer}: color mask mode',
        placeHint:'Placement mode: {kind}'
      }
    };

    function tr(ru,en){return currentLang==='ru'?ru:en;}
    function setStatus(text){statusEl.textContent=text;}
    function setSelectLabels(selectId,labels){const s=document.getElementById(selectId);if(!s)return;for(let i=0;i<labels.length&&i<s.options.length;i++)s.options[i].textContent=labels[i];}
    function applyLanguage(lang){
      currentLang=lang==='en'?'en':'ru';
      const t=I18N[currentLang];
      document.documentElement.lang=currentLang;
      document.getElementById('btn-lang').textContent=currentLang==='ru'?'EN':'RU';
      document.getElementById('btn-new').textContent=t.new;
      document.getElementById('btn-save').textContent=t.save;
      document.getElementById('btn-load-active').textContent=t.loadActive;
      document.getElementById('btn-load-assets').textContent=t.reloadAssets;
      document.getElementById('lbl-grid').textContent=t.grid;
      document.getElementById('title-left').textContent=getCatalogTitle(currentCatalog);
      document.getElementById('title-right').textContent=t.map;
      tileSearchEl.placeholder=t.search;
      document.getElementById('sec-size').textContent=t.size;
      document.getElementById('lbl-width').textContent=t.width;
      document.getElementById('lbl-height').textContent=t.height;
      document.getElementById('lbl-tilew').textContent=t.tileW;
      document.getElementById('lbl-tileh').textContent=t.tileH;
      document.getElementById('btn-sz').textContent=t.applySize;
      document.getElementById('sec-vis').textContent=t.vis;
      document.getElementById('vis-ground').textContent=t.ground;
      document.getElementById('vis-paths').textContent=t.paths;
      const vc=document.getElementById('vis-cam');if(vc) vc.textContent=t.cam;
      document.getElementById('vis-zones').textContent=t.zones;
      document.getElementById('vis-decor').textContent=t.decor;
      document.getElementById('vis-citadel').textContent=t.citadel;
      document.getElementById('vis-spawn').textContent=t.spawn;
      document.getElementById('sec-cam').textContent=t.camera;
      document.getElementById('lbl-game-zoom').textContent=t.gameZoom;
      document.getElementById('btn-use-editor-zoom').textContent=t.useZoom;
      document.getElementById('btn-game-panel').textContent=t.gamePanel;
      document.getElementById('lbl-start-x').textContent=t.startX;
      document.getElementById('lbl-start-y').textContent=t.startY;
      document.getElementById('btn-cam-from-view').textContent=t.takeView;
      document.getElementById('btn-cam-apply-start').textContent=t.goStart;
      const bs=document.getElementById('lbl-bounds-source');if(bs) bs.textContent=t.boundsSource;
      document.getElementById('lbl-bounds-pad').textContent=t.boundsPad;
      document.getElementById('lbl-bounds-custom').textContent=t.customBounds;
      document.getElementById('lbl-iso-clamp').textContent=t.isoClamp;
      document.getElementById('btn-bounds-edit').textContent=t.editBounds;
      document.getElementById('btn-bounds-clear').textContent=t.autoBounds;
      document.querySelectorAll('#bounds-source .seg-btn').forEach((b,i)=>{b.textContent=(t.boundsOpts&&t.boundsOpts[i])||b.getAttribute('data-bounds')||b.textContent;});
      document.getElementById('lbl-move-mode').textContent=t.moveMode;
      document.getElementById('lbl-road-dir').textContent=t.roadDir;
      document.getElementById('lbl-road-offset').textContent=t.roadOffset;
      document.getElementById('sec-dbg').textContent=t.diag;
      setSelectLabels('layer-sel',t.layer);
      setSelectLabels('paint-mode',t.paint);
      setSelectLabels('cam-move-mode',t.mm);
      setSelectLabels('cam-road-dir',t.dir);
      document.getElementById('tab-tiles').textContent=t.tabs[0];
      document.getElementById('tab-buildings').textContent=t.tabs[1];
      document.getElementById('tab-objects').textContent=t.tabs[2];
      document.getElementById('tab-graphics').textContent=t.tabs[3];
      const preset=document.getElementById('map-preset');
      if(preset.options.length>0&&preset.options[0].value==='') preset.options[0].textContent=t.mapFile;
      setStatus(t.ready);
      syncTop();
    }

    function getCatalogTitle(cat){
      return (I18N[currentLang].catTitle && I18N[currentLang].catTitle[cat]) || (cat||'');
    }

    function getActiveAssets(){
      if(currentCatalog==='tiles') return tileRefs;
      return assetCatalog[currentCatalog] || [];
    }

    function getActiveEntityList(){
      if(currentCatalog==='buildings') return placedBuildings;
      if(currentCatalog==='objects') return placedObjects;
      if(currentCatalog==='graphics') return placedGraphics;
      return [];
    }

    function normalizeRef(ref){const s=String(ref||'').trim();if(!s)return'';if(/^https?:\/\//i.test(s))return s;if(s.startsWith('/'))return s.slice(1);if(s.startsWith('assets/'))return s;if(s.includes('/'))return s.replace(/^\/+/,'');return `assets/tilesets/${s}`;}
    function refUrl(ref){const s=normalizeRef(ref);if(!s)return'';if(/^https?:\/\//i.test(s))return s;return encodeURI('/'+s);}
    function refName(ref){const s=String(ref||'').replace(/\\/g,'/');const i=s.lastIndexOf('/');return i>=0?s.slice(i+1):s;}

    function initLayers(){const out={};for(const l of LAYERS){out[l]=[];for(let r=0;r<MH;r++)out[l].push(new Array(MW).fill(0));}for(let r=0;r<MH;r++)for(let c=0;c<MW;c++)out.ground[r][c]=1;layers=out;}
    function resizeCanvas(){const rect=canvas.parentElement.getBoundingClientRect();canvas.width=Math.max(480,Math.floor(rect.width));canvas.height=Math.max(320,Math.floor(rect.height));draw();}
    function tileToWorld(col,row){return{x:(col-row)*(TW/2)+TW/2+ISO_LAYER_X,y:(col+row)*(TH/2)+TH/2+ISO_LAYER_Y};}
    function isWorldPointInsideTile(wx,wy,col,row){
      const halfW=TW/2,halfH=TH/2;
      const tile=tileToWorld(col,row);
      const dx=wx-tile.x,dy=wy-tile.y;
      return Math.abs(dx)/Math.max(halfW,0.001)+Math.abs(dy)/Math.max(halfH,0.001)<=1.0001;
    }
    function worldToTile(wx,wy){
      const halfW=TW/2,halfH=TH/2;
      const localX=wx-ISO_LAYER_X-halfW;
      const localY=wy-ISO_LAYER_Y-halfH;
      const approxCol=(localX/halfW+localY/halfH)/2;
      const approxRow=(localY/halfH-localX/halfW)/2;
      const centerCol=Math.round(approxCol);
      const centerRow=Math.round(approxRow);
      let best={col:centerCol,row:centerRow};
      let bestDist=Number.POSITIVE_INFINITY;
      for(let row=centerRow-1;row<=centerRow+1;row++){
        for(let col=centerCol-1;col<=centerCol+1;col++){
          if(!isWorldPointInsideTile(wx,wy,col,row)) continue;
          const tile=tileToWorld(col,row);
          const dx=tile.x-wx,dy=tile.y-wy;
          const dist=dx*dx+dy*dy;
          if(dist<bestDist){best={col,row};bestDist=dist;}
        }
      }
      if(bestDist<Number.POSITIVE_INFINITY) return best;
      for(let row=centerRow-1;row<=centerRow+1;row++){
        for(let col=centerCol-1;col<=centerCol+1;col++){
          const tile=tileToWorld(col,row);
          const dx=tile.x-wx,dy=tile.y-wy;
          const dist=dx*dx+dy*dy;
          if(dist<bestDist){best={col,row};bestDist=dist;}
        }
      }
      return best;
    }
    function eventToCanvasPos(e){
      const rect=canvas.getBoundingClientRect();
      if(rect.width<=0||rect.height<=0) return {x:0,y:0};
      return{
        x:(e.clientX-rect.left)*(canvas.width/rect.width),
        y:(e.clientY-rect.top)*(canvas.height/rect.height)
      };
    }
    function getViewScreenOffset(){
      if(!gamePanelOpen) return {x:0,y:0};
      const fit=getGameFitScale();
      const gameW=GAME_W*fit, gameH=GAME_H*fit;
      const left=(canvas.width-gameW)/2;
      const top=(canvas.height-gameH)/2;
      const viewTop=top+TOP_BAR_HEIGHT*fit;
      const viewLeft=left;
      const viewCx=viewLeft+gameW/2;
      const viewCy=viewTop+(GAME_VIEW_H*fit)/2;
      return {x:viewCx-canvas.width/2, y:viewCy-canvas.height/2};
    }
    function worldToScreen(wx,wy){
      const off=getViewScreenOffset();
      const c=getEditorCamCenter();
      return{x:canvas.width/2+off.x+(wx-c.x)*cz,y:canvas.height/2+off.y+(wy-c.y)*cz};
    }
    function screenToWorld(sx,sy){
      const off=getViewScreenOffset();
      const c=getEditorCamCenter();
      return{x:(sx-canvas.width/2-off.x)/cz+c.x,y:(sy-canvas.height/2-off.y)/cz+c.y};
    }
    function getEditorCamCenter(){
      return {x:-cx,y:-cy};
    }
    function setEditorCamCenter(x,y){
      cx=-(Number(x)||0);
      cy=-(Number(y)||0);
    }
    function scrollToEditorCamCenter(scrollX,scrollY,zoom,centerOffsetY=0){
      const v=getViewSize(zoom);
      return cameraScrollToCenter(scrollX,scrollY,v.viewW,v.viewH,centerOffsetY);
    }
    function centerToEditorCamScroll(centerX,centerY,zoom,centerOffsetY=0){
      const v=getViewSize(zoom);
      return cameraCenterToScroll(centerX,centerY,v.viewW,v.viewH,centerOffsetY);
    }
    function mapCenter(){return{x:((MW-MH)*TW)/4,y:((MW+MH-2)*TH)/4};}
    function toGameX(x){return x;}
    function toGameY(y){return y;}
    function fromGameX(x){return x;}
    function fromGameY(y){return y;}
    function normalizeMinMax(a,b){return a<=b?[a,b]:[b,a];}
    function getCustomScrollRect(zoom){
      const v=getViewSize(zoom);
      const viewW=v.viewW;
      const viewH=v.viewH;
      const ref=computeIsoDiamondBoundsFromMap();
      if(!ref) return{minX:0,maxX:-viewW,minY:0,maxY:-viewH,left:0,right:-viewW,top:0,bottom:-viewH,viewW,viewH};
      const p1=isoABToWorld(camBoundsMinA,camBoundsMinB,ref);
      const p2=isoABToWorld(camBoundsMinA,camBoundsMaxB,ref);
      const p3=isoABToWorld(camBoundsMaxA,camBoundsMaxB,ref);
      const p4=isoABToWorld(camBoundsMaxA,camBoundsMinB,ref);
      const left=Math.min(p1.x,p2.x,p3.x,p4.x);
      const right=Math.max(p1.x,p2.x,p3.x,p4.x)-viewW;
      const top=Math.min(p1.y,p2.y,p3.y,p4.y);
      const bottom=Math.max(p1.y,p2.y,p3.y,p4.y)-viewH;
      return{
        minX:left,maxX:right,minY:top,maxY:bottom,
        left,right,top,bottom,viewW,viewH
      };
    }
    function setCustomBoundsFromScrollRect(rect){
      if(!rect) return;
      const ref=computeIsoDiamondBoundsFromMap();
      if(!ref) return;
      const l=rect.left,r=rect.right+(rect.viewW||0);
      const t=rect.top,b=rect.bottom+(rect.viewH||0);
      let minA=Infinity,maxA=-Infinity,minB=Infinity,maxB=-Infinity;
      for(const p of [{x:l,y:t},{x:r,y:t},{x:r,y:b},{x:l,y:b}]){
        const iso=worldToIsoAB(p.x,p.y,ref);
        if(iso.a<minA)minA=iso.a;if(iso.a>maxA)maxA=iso.a;
        if(iso.b<minB)minB=iso.b;if(iso.b>maxB)maxB=iso.b;
      }
      camBoundsMinA=minA;camBoundsMaxA=maxA;camBoundsMinB=minB;camBoundsMaxB=maxB;
    }
    function estimateGameFitScale(){
      const w=Math.max(1,window.innerWidth||1280);
      const h=Math.max(1,window.innerHeight||720);
      return Math.min(w/1280,h/720);
    }
    function getGameFitScale(){
      return Math.min(canvas.width/GAME_W,canvas.height/GAME_H);
    }

    function isoOrigin(){return{x:TW/2+ISO_LAYER_X,y:TH/2+ISO_LAYER_Y};}
    function mapDiamondPoints(){
      if(MW<=0||MH<=0) return null;
      const halfW=TW/2,halfH=TH/2;
      const lastX=MW-1,lastY=MH-1;
      const c00=tileToWorld(0,0);
      const cR0=tileToWorld(lastX,0);
      const cRR=tileToWorld(lastX,lastY);
      const c0B=tileToWorld(0,lastY);
      return {
        top:{x:c00.x,y:c00.y-halfH},
        right:{x:cR0.x+halfW,y:cR0.y},
        bottom:{x:cRR.x,y:cRR.y+halfH},
        left:{x:c0B.x-halfW,y:c0B.y}
      };
    }
    function computeMapWorldBounds(){
      const d=mapDiamondPoints();
      if(!d) return null;
      return {left:d.left.x,right:d.right.x,top:d.top.y,bottom:d.bottom.y};
    }
    function computeLayerWorldBounds(layer){
      const halfW=TW/2,halfH=TH/2;
      let minX=Number.POSITIVE_INFINITY,minY=Number.POSITIVE_INFINITY,maxX=Number.NEGATIVE_INFINITY,maxY=Number.NEGATIVE_INFINITY;
      let found=false;
      for(let r=0;r<MH;r++) for(let c=0;c<MW;c++){
        if((layer[r][c]|0)<=0) continue;
        found=true;
        const w=tileToWorld(c,r);
        const left=w.x-halfW,right=w.x+halfW,top=w.y-halfH,bottom=w.y+halfH;
        if(left<minX) minX=left;
        if(top<minY) minY=top;
        if(right>maxX) maxX=right;
        if(bottom>maxY) maxY=bottom;
      }
      if(!found) return null;
      return {left:minX,right:maxX,top:minY,bottom:maxY};
    }
    function updateVisHint(){
      const el=document.getElementById('vis-hint');
      if(el) el.textContent=Math.round(GAME_W/gameZoom)+'Г—'+Math.round(GAME_VIEW_H/gameZoom);
    }

    function buildPresaveItems(){
      const items=[];
      const gz=gameZoom;
      // Zoom check
      if(gz>=1.5&&gz<=2.5) items.push({ok:true,icon:'?',title:`зум игры: ${gz.toFixed(3)}`,desc:'В норме (рекомендуется 1.5–2.5)'});
      else items.push({ok:false,icon:'?',title:`зум игры: ${gz.toFixed(3)}`,desc:'Необычный зум. Рекомендуется ~1.948'});
      // StartX/Y check (should be >1000 = game-space)
      if(camStartX>900) items.push({ok:true,icon:'?',title:`Старт X/Y: ${Math.round(camStartX)}, ${Math.round(camStartY)}`,desc:'Game-space'});
      else items.push({ok:false,icon:'?',title:`Старт X/Y: ${Math.round(camStartX)}, ${Math.round(camStartY)}`,desc:'Слишком мало — проверь координаты старта.'});
      // MoveMode
      const mm=camMoveMode;
      if(mm==='road-both') items.push({ok:true,icon:'?',title:`Режим: ${mm}`,desc:'камера следует по дороге — рекомендуется'});
      else items.push({ok:'info',icon:'?',title:`Режим: ${mm}`,desc:'Убедись что выбран правильный режим для карты'});
      // Road direction
      items.push({ok:'info',icon:'?',title:`Направление дороги: ${camRoadDir}`,desc:'Враги идут С этого портала К цитадели'});
      // Bounds
      if(camBoundsEnabled) items.push({ok:true,icon:'?',title:`Bounds: custom`,desc:`A:[${Math.round(camBoundsMinA)}..${Math.round(camBoundsMaxA)}] B:[${Math.round(camBoundsMinB)}..${Math.round(camBoundsMaxB)}]`});
      else items.push({ok:'info',icon:'?',title:'Bounds: авто',desc:`Источник: ${camBoundsSource}. Игра рассчитает сама.`});
      // isoClamp warning
      if(camIsoClamp&&mm!=='free') items.push({ok:false,icon:'?',title:'ISO clamp ВКЛЮЧЁН при road-режиме',desc:'камера может упереться до конца дороги! Рекомендуется выключить.'});
      else if(!camIsoClamp) items.push({ok:true,icon:'?',title:'ISO clamp выключен',desc:'Правильно для road-режима'});
      return items;
    }

    function showPresaveModal(){
      const items=buildPresaveItems();
      const container=document.getElementById('presave-items');
      if(!container) return false;
      container.innerHTML=items.map(it=>{
        const cls=it.ok===true?'ok':it.ok===false?'warn':'info';
        return `<div class="presave-item ${cls}"><div class="pi-icon">${it.icon}</div><div class="pi-text"><strong>${it.title}</strong><span>${it.desc}</span></div></div>`;
      }).join('');
      document.getElementById('presave-overlay').classList.add('open');
    }

    function confirmSaveMap(){
      document.getElementById('presave-overlay').classList.remove('open');
      doSaveMap();
    }

    function fitMapToView(margin){
      const b=computeMapWorldBounds();
      if(!b) return;
      const pad=typeof margin==='number'?margin:0.88;
      const mapW=b.right-b.left;
      const mapH=b.bottom-b.top;
      if(mapW<=0||mapH<=0) return;
      const cw=Math.max(480,canvas.width);
      const ch=Math.max(320,canvas.height);
      cz=Math.max(0.05,Math.min(8,Math.min(cw/mapW,ch/mapH)*pad));
      setEditorCamCenter((b.left+b.right)/2,(b.top+b.bottom)/2);
      if(!Number.isFinite(cz)||!Number.isFinite(cx)||!Number.isFinite(cy)){
        cz=1;
        setEditorCamCenter(0,0);
      }
      draw();
    }
    function computeIsoDiamondBoundsFromMap(){
      const halfW=TW/2,halfH=TH/2;
      if(MW<=0||MH<=0) return null;
      const origin=isoOrigin();
      const lastX=MW-1,lastY=MH-1;
      const c00={x:origin.x,y:origin.y};
      const cR0={x:origin.x+lastX*halfW,y:origin.y+lastX*halfH};
      const cRR={x:origin.x+(lastX-lastY)*halfW,y:origin.y+(lastX+lastY)*halfH};
      const c0B={x:origin.x-lastY*halfW,y:origin.y+lastY*halfH};
      const corners=[
        {x:c00.x,y:c00.y-halfH},
        {x:cR0.x+halfW,y:cR0.y},
        {x:cRR.x,y:cRR.y+halfH},
        {x:c0B.x-halfW,y:c0B.y},
      ];
      let minA=Number.POSITIVE_INFINITY,maxA=Number.NEGATIVE_INFINITY,minB=Number.POSITIVE_INFINITY,maxB=Number.NEGATIVE_INFINITY;
      for(const p of corners){
        const u=(p.x-origin.x)/halfW;
        const v=(p.y-origin.y)/halfH;
        const a=u+v;
        const b=v-u;
        if(a<minA) minA=a;
        if(a>maxA) maxA=a;
        if(b<minB) minB=b;
        if(b>maxB) maxB=b;
      }
      return {minA,maxA,minB,maxB,halfW,halfH,originX:origin.x,originY:origin.y};
    }
    function computeIsoDiamondBoundsFromLayer(layer){
      const halfW=TW/2,halfH=TH/2;
      const origin=isoOrigin();
      let minA=Number.POSITIVE_INFINITY,maxA=Number.NEGATIVE_INFINITY,minB=Number.POSITIVE_INFINITY,maxB=Number.NEGATIVE_INFINITY;
      let found=false;
      for(let r=0;r<MH;r++) for(let c=0;c<MW;c++){
        if((layer[r][c]|0)<=0) continue;
        found=true;
        const w=tileToWorld(c,r);
        const points=[
          {x:w.x,y:w.y-halfH},
          {x:w.x+halfW,y:w.y},
          {x:w.x,y:w.y+halfH},
          {x:w.x-halfW,y:w.y},
        ];
        for(const p of points){
          const u=(p.x-origin.x)/halfW;
          const v=(p.y-origin.y)/halfH;
          const a=u+v;
          const b=v-u;
          if(a<minA) minA=a;
          if(a>maxA) maxA=a;
          if(b<minB) minB=b;
          if(b>maxB) maxB=b;
        }
      }
      if(!found) return null;
      return {minA,maxA,minB,maxB,halfW,halfH,originX:origin.x,originY:origin.y};
    }
    function isoABToWorld(a,b,bounds){
      const u=(a-b)/2;
      const v=(a+b)/2;
      return {x:bounds.originX+u*bounds.halfW,y:bounds.originY+v*bounds.halfH};
    }
    function worldToIsoAB(wx,wy,ref){const u=(wx-ref.originX)/ref.halfW;const v=(wy-ref.originY)/ref.halfH;return{a:u+v,b:v-u};}
    function getBoundsWorld(){
      if(camBoundsSource==='none') return null;
      if(camBoundsSource==='map') return computeMapWorldBounds();
      return computeLayerWorldBounds(layers.ground)||computeMapWorldBounds();
    }
    function getBoundsIso(){
      if(camBoundsSource==='none') return null;
      if(camBoundsSource==='map') return computeIsoDiamondBoundsFromMap();
      return computeIsoDiamondBoundsFromLayer(layers.ground)||computeIsoDiamondBoundsFromMap();
    }
    function getViewSize(zoom){
      return cameraComputeViewSize(gameCamMode?GAME_W:canvas.width,gameCamMode?GAME_VIEW_H:canvas.height,zoom);
    }
    function getGameViewSize(zoom){
      return cameraComputeViewSize(GAME_W,GAME_VIEW_H,zoom);
    }
    function computeAutoScrollBounds(zoom){
      const bounds=getBoundsWorld();
      if(!bounds) return null;
      const v=getViewSize(zoom);
      const viewW=v.viewW;
      const viewH=v.viewH;
      const tightBounds=camBoundsSource==='map';
      const insetLeft=tightBounds?0:Math.min(140,Math.max(0,viewW*0.08));
      const insetRight=tightBounds?0:Math.min(140,Math.max(0,viewW*0.08));
      const freeInsetY=tightBounds?0:Math.min(120,Math.max(0,viewH*0.1));
      const roadInsetTop=tightBounds?0:Math.min(16,Math.max(0,viewH*0.02));
      const roadInsetBottom=tightBounds?0:Math.min(56,Math.max(0,viewH*0.04));
      const insetTop=(camMoveMode==='free')?freeInsetY:roadInsetTop;
      const insetBottom=(camMoveMode==='free')?freeInsetY:roadInsetBottom;
      const pad=camBoundsPad;
      
      // These return the literal min/max Scroll values allowed
      const minX=bounds.left+insetLeft-pad;
      const maxX=bounds.right-viewW-insetRight+pad;
      const minY=bounds.top+insetTop-pad;
      const maxY=bounds.bottom-viewH-insetBottom+pad;
      return {minX,maxX,minY,maxY,viewW,viewH};
    }
    function computeCameraScrollBounds(zoom){
      if(camBoundsEnabled){
        return getCustomScrollRect(zoom);
      }
      return computeAutoScrollBounds(zoom);
    }
    function getRoadViewOffsetY(z){
      const zoom=Number.isFinite(z)?z:gameZoom;
      return cameraComputeRoadViewOffset(zoom,TOP_BAR_HEIGHT,camRoadOffsetY,camMoveMode==='free',gameCamMode);
    }
    function getGameRoadViewOffsetY(z){
      const zoom=Number.isFinite(z)?z:gameZoom;
      return cameraComputeRoadViewOffset(zoom,TOP_BAR_HEIGHT,camRoadOffsetY,camMoveMode==='free',true);
    }
    function findCitadelBuildingItem(list=placedBuildings){
      if(!Array.isArray(list)) return null;
      for(const it of list){
        const name=String(it?.name||'').toLowerCase();
        const asset=String(it?.asset||'').toLowerCase();
        if(name.includes('citadel')||name.includes('цитад')||asset.includes('citadel')) return it;
      }
      return null;
    }
    function findPortalBuildingItems(list=placedBuildings){
      if(!Array.isArray(list)) return [];
      return list.filter((it)=>{
        const name=String(it?.name||'').toLowerCase();
        const asset=String(it?.asset||'').toLowerCase();
        return name.includes('portal')||name.includes('port')||asset.includes('portal')||asset.includes('port.');
      });
    }
    function getSceneCitadelWorld(){
      const building=findCitadelBuildingItem();
      if(building&&Number.isFinite(building.x)&&Number.isFinite(building.y)) return {x:Number(building.x),y:Number(building.y)};
      const layer=layers.citadel;
      if(layer){
        let sumC=0,sumR=0,count=0;
        for(let r=0;r<MH;r++) for(let c=0;c<MW;c++){
          if((layer[r][c]|0)<=0) continue;
          sumC+=c; sumR+=r; count++;
        }
        if(count>0){
          const c=sumC/count, r=sumR/count;
          return tileToWorld(c,r);
        }
      }
      if(Number.isFinite(camCenterX)&&Number.isFinite(camCenterY)) return {x:camCenterX,y:camCenterY};
      return mapCenter();
    }
    function getSceneRailAnchorWorld(){
      if(Number.isFinite(camCenterX)&&Number.isFinite(camCenterY)) return {x:camCenterX,y:camCenterY};
      return mapCenter();
    }
    function getCitadelWorld(){
      const layer=layers.citadel;
      if(layer){
        let sumC=0,sumR=0,count=0;
        for(let r=0;r<MH;r++) for(let c=0;c<MW;c++){
          if((layer[r][c]|0)<=0) continue;
          sumC+=c; sumR+=r; count++;
        }
        if(count>0){
          const c=sumC/count, r=sumR/count;
          return tileToWorld(c,r);
        }
      }
      if(Number.isFinite(camCenterX)&&Number.isFinite(camCenterY)) return {x:camCenterX,y:camCenterY};
      return mapCenter();
    }
    function buildScenePortals(citadel){
      const portalBuildings=findPortalBuildingItems();
      if(portalBuildings.length>0){
        return portalBuildings
          .filter((it)=>Number.isFinite(it.x)&&Number.isFinite(it.y))
          .map((it)=>({
            x:Math.round(toGameX(Number(it.x))),
            y:Math.round(toGameY(Number(it.y))),
            direction:classifyDirection(Number(it.x)-citadel.x,Number(it.y)-citadel.y),
            col:typeof it.col==='number'?it.col:null,
            row:typeof it.row==='number'?it.row:null,
          }));
      }
      const out=[];
      const spawn=layers.spawn;
      if(!spawn) return out;
      for(let r=0;r<MH;r++) for(let c=0;c<MW;c++){
        if((spawn[r][c]|0)<=0) continue;
        const w=tileToWorld(c,r);
        out.push({
          x:Math.round(toGameX(w.x)),
          y:Math.round(toGameY(w.y)),
          direction:classifyDirection(w.x-citadel.x,w.y-citadel.y),
          col:c,
          row:r,
        });
      }
      return out;
    }
    function getCustomBoundsAABB(){
      if(!camBoundsEnabled) return null;
      const ref=computeIsoDiamondBoundsFromMap();
      if(!ref) return null;
      const pts=[
        isoABToWorld(camBoundsMinA,camBoundsMinB,ref),
        isoABToWorld(camBoundsMinA,camBoundsMaxB,ref),
        isoABToWorld(camBoundsMaxA,camBoundsMaxB,ref),
        isoABToWorld(camBoundsMaxA,camBoundsMinB,ref),
      ];
      const minX=Math.min(...pts.map(p=>p.x));
      const maxX=Math.max(...pts.map(p=>p.x));
      const minY=Math.min(...pts.map(p=>p.y));
      const maxY=Math.max(...pts.map(p=>p.y));
      return {minX,maxX,minY,maxY};
    }
    function classifyDirection(dx,dy){
      if(dx>=0) return (dy<=0)?'north':'east';
      return (dy>0)?'south':'west';
    }
    function buildEditorRail(){
      let pathLayer=layers.paths;
      const camLayer=layers.cam;
      let usingCamLayer=false;
      if(camLayer){
        let hasCam=false;
        for(let r=0;r<MH && !hasCam;r++) for(let c=0;c<MW;c++){
          if((camLayer[r][c]|0)>0){hasCam=true;break;}
        }
        if(hasCam){ pathLayer=camLayer; usingCamLayer=true; }
      }
      if(!pathLayer) return null;
      const tiles=[];
      const tileSet=new Set();
      const tileByKey=new Map();
      for(let r=0;r<MH;r++) for(let c=0;c<MW;c++){
        if((pathLayer[r][c]|0)<=0) continue;
        const k=`${c},${r}`;
        const w=tileToWorld(c,r);
        const t={c,r,k,x:w.x,y:w.y};
        tileSet.add(k);
        tileByKey.set(k,t);
        tiles.push(t);
      }
      if(tiles.length===0) return null;
      if(usingCamLayer){
        const neighMap=new Map();
        const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
        for(const t of tiles){
          const adj=[];
          for(const [dc,dr] of dirs){
            const nk=`${t.c+dc},${t.r+dr}`;
            if(tileSet.has(nk)) adj.push(nk);
          }
          neighMap.set(t.k,adj);
        }
        const endpoints=tiles.filter(t => (neighMap.get(t.k)?.length||0) <= 1);
        const bfs=(startKey)=>{
          const dist=new Map(); const parent=new Map();
          const q=[startKey];
          dist.set(startKey,0); parent.set(startKey,null);
          let far=startKey, best=0;
          while(q.length){
            const key=q.shift();
            const d=dist.get(key)||0;
            if(d>=best){best=d; far=key;}
            for(const nk of (neighMap.get(key)||[])){
              if(dist.has(nk)) continue;
              dist.set(nk,d+1);
              parent.set(nk,key);
              q.push(nk);
            }
          }
          return {dist,parent,far};
        };
        const seed=(endpoints.length>0?endpoints[0].k:tiles[0].k);
        const a=bfs(seed).far;
        const res=bfs(a);
        const b=res.far;
        const parent=res.parent;
        const keys=[];
        let cur=b;
        while(cur){
          keys.push(cur);
          if(cur===a) break;
          cur=parent.get(cur)||null;
        }
        if(keys[keys.length-1]!==a) return null;
        keys.reverse();
        const points=[];
        for(const k of keys){
          const t=tileByKey.get(k);
          if(!t) continue;
          points.push({x:t.x,y:t.y});
        }
        const dedup=[];
        for(const p of points){
          const prev=dedup[dedup.length-1];
          if(!prev || Math.hypot(p.x-prev.x,p.y-prev.y)>0.5) dedup.push(p);
        }
        return dedup;
      }
      const cit=getCitadelWorld();
      let start=null,startKey=null,bestD2=Infinity;
      for(const t of tiles){
        const dx=t.x-cit.x, dy=t.y-cit.y;
        const d2=dx*dx+dy*dy;
        if(d2<bestD2){bestD2=d2;start=t;startKey=t.k;}
      }
      if(!startKey) return null;
      const dist=new Map(); const parent=new Map();
      const q=[startKey];
      dist.set(startKey,0); parent.set(startKey,null);
      while(q.length){
        const key=q.shift();
        const t=tileByKey.get(key);
        if(!t) continue;
        const base=dist.get(key)||0;
        const neigh=[[1,0],[-1,0],[0,1],[0,-1]];
        for(const [dc,dr] of neigh){
          const nc=t.c+dc, nr=t.r+dr;
          const nk=`${nc},${nr}`;
          if(!tileSet.has(nk) || dist.has(nk)) continue;
          dist.set(nk,base+1);
          parent.set(nk,key);
          q.push(nk);
        }
      }
      const candidates=[];
      let maxSteps=-1;
      for(const t of tiles){
        const steps=dist.get(t.k);
        if(steps==null||steps<=0) continue;
        const dx=t.x-cit.x, dy=t.y-cit.y;
        if(classifyDirection(dx,dy)!==camRoadDir) continue;
        candidates.push({t,steps});
        if(steps>maxSteps) maxSteps=steps;
      }
      if(candidates.length===0){
        for(const t of tiles){
          const steps=dist.get(t.k);
          if(steps==null||steps<=0) continue;
          candidates.push({t,steps});
          if(steps>maxSteps) maxSteps=steps;
        }
      }
      if(candidates.length===0) return null;
      if(camMoveMode==='road-both'){
        const pickEnd=(dir)=>{
          let best=null, bestSteps=-1;
          for(const t of tiles){
            const steps=dist.get(t.k);
            if(steps==null||steps<=0) continue;
            const dx=t.x-cit.x, dy=t.y-cit.y;
            if(classifyDirection(dx,dy)!==dir) continue;
            if(steps>bestSteps){bestSteps=steps; best=t;}
          }
          return best;
        };
        const makePath=(endKey)=>{
          const keys=[]; let cur=endKey;
          while(cur){
            keys.push(cur);
            if(cur===startKey) break;
            cur=parent.get(cur)||null;
          }
          if(keys[keys.length-1]!==startKey) return null;
          keys.reverse();
          const pts=[];
          for(const k of keys){
            const t=tileByKey.get(k);
            if(!t) continue;
            pts.push({x:t.x,y:t.y});
          }
          return pts;
        };
        const east=pickEnd('east');
        const west=pickEnd('west');
        const north=pickEnd('north');
        const south=pickEnd('south');
        let bestPts=null, bestLen=0;
        const evalPair=(a,b)=>{
          if(!a||!b) return;
          const pa=makePath(a.k); const pb=makePath(b.k);
          if(!pa||!pb||pa.length<2||pb.length<2) return;
          const revA=pa.slice().reverse();
          const merged=revA.concat(pb.slice(1));
          let len=0;
          for(let i=1;i<merged.length;i++) len+=Math.hypot(merged[i].x-merged[i-1].x, merged[i].y-merged[i-1].y);
          if(len>bestLen){bestLen=len; bestPts=merged;}
        };
        evalPair(east,west);
        evalPair(north,south);
        if(bestPts && bestPts.length>=2){
          const dedup=[];
          for(const p of bestPts){
            const prev=dedup[dedup.length-1];
            if(!prev || Math.hypot(p.x-prev.x,p.y-prev.y)>0.5) dedup.push(p);
          }
          return dedup;
        }
      }
      const frontDepth=Math.max(2,Math.round(maxSteps*0.12));
      const front=candidates.filter(c=>c.steps>=maxSteps-frontDepth).map(c=>c.t);
      const group=(front.length>0)?front:candidates.map(c=>c.t);
      let minLat=Infinity,maxLat=-Infinity;
      for(const t of group){
        const lat=(camRoadDir==='east'||camRoadDir==='west')?t.y:t.x;
        if(lat<minLat) minLat=lat;
        if(lat>maxLat) maxLat=lat;
      }
      const midLat=(minLat+maxLat)/2;
      let bestKey=null, bestScore=Infinity, bestSteps=-1;
      for(const t of group){
        const lat=(camRoadDir==='east'||camRoadDir==='west')?t.y:t.x;
        const score=Math.abs(lat-midLat);
        const steps=dist.get(t.k)||0;
        if(score<bestScore || (score===bestScore && steps>bestSteps)){
          bestScore=score; bestSteps=steps; bestKey=t.k;
        }
      }
      if(!bestKey) return null;
      const keys=[];
      let cur=bestKey;
      while(cur){
        keys.push(cur);
        if(cur===startKey) break;
        cur=parent.get(cur)||null;
      }
      if(keys[keys.length-1]!==startKey) return null;
      keys.reverse();
      const points=[{x:cit.x,y:cit.y}];
      for(const k of keys){
        const t=tileByKey.get(k);
        if(!t) continue;
        points.push({x:t.x,y:t.y});
      }
      const dedup=[];
      for(const p of points){
        const prev=dedup[dedup.length-1];
        if(!prev || Math.hypot(p.x-prev.x,p.y-prev.y)>0.5) dedup.push(p);
      }
        if(dedup.length>=2){
          const p0=dedup[0], p1=dedup[1];
          const segDx=p1.x-p0.x, segDy=p1.y-p0.y;
          const segLen=Math.hypot(segDx,segDy);
          if(segLen>0.01){
            const bx=-segDx/segLen, by=-segDy/segLen;
            const cb=(camMoveMode==='free' && !gamePanelOpen)?getCustomBoundsAABB():null;
            let maxBackStep=2500;
            const mb=computeMapWorldBounds();
            if(mb){
              const dim=Math.max(mb.right-mb.left, mb.bottom-mb.top);
              if(Number.isFinite(dim)) maxBackStep=Math.max(maxBackStep, Math.min(8000, dim+200));
            }
            const steps=5, stepSize=maxBackStep/steps;
            const extra=[];
            for(let s=steps;s>=1;s--){
              const distStep=stepSize*s;
              const ex=p0.x+bx*distStep;
              const ey=p0.y+by*distStep;
            if(cb){
              const margin=1500;
              if(ex<cb.minX-margin||ex>cb.maxX+margin) continue;
              if(ey<cb.minY-margin||ey>cb.maxY+margin) continue;
            }
            extra.push({x:ex,y:ey});
          }
          dedup.unshift(...extra);
        }
      }
      return dedup;
    }
    function projectPointToRail(px,py,rail){
      if(!rail||rail.length<2) return {x:px,y:py};
      let bestX=rail[0].x, bestY=rail[0].y, bestD2=Infinity;
      for(let i=0;i<rail.length-1;i++){
        const a=rail[i], b=rail[i+1];
        const abx=b.x-a.x, aby=b.y-a.y;
        const len2=abx*abx+aby*aby;
        if(len2<=0.0001) continue;
        let t=((px-a.x)*abx+(py-a.y)*aby)/len2;
        if(t<0) t=0; else if(t>1) t=1;
        const qx=a.x+abx*t, qy=a.y+aby*t;
        const dx=px-qx, dy=py-qy;
        const d2=dx*dx+dy*dy;
        if(d2<bestD2){bestD2=d2; bestX=qx; bestY=qy;}
      }
      return {x:bestX,y:bestY};
    }
    function computeRailPreviewBounds(zoom){
      if(camMoveMode==='free') return null;
      const rail=buildEditorRail();
      if(!rail || rail.length<2) return null;
      const v=getViewSize(zoom);
      const viewW=v.viewW;
      const viewH=v.viewH;
      const roadOff=getRoadViewOffsetY(zoom);
      const scrollRect=null; // в режиме рельс границы берём строго по тайлам карты
      const isoRef=computeIsoDiamondBoundsFromMap();
      const useIso=!!isoRef;
      const padA=useIso?(ROAD_EDGE_INSET_PX/isoRef.halfW+ROAD_EDGE_INSET_PX/isoRef.halfH):0;
      const isoMinA=useIso?(isoRef.minA+padA):0;
      const isoMaxA=useIso?(isoRef.maxA-padA):0;
      const isoMinB=useIso?(isoRef.minB+padA):0;
      const isoMaxB=useIso?(isoRef.maxB-padA):0;
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      const step=30;
      for(let i=0;i<rail.length-1;i++){
        const a=rail[i], b=rail[i+1];
        const segLen=Math.hypot(b.x-a.x,b.y-a.y);
        const steps=Math.max(1,Math.ceil(segLen/step));
        for(let s=0;s<=steps;s++){
          const t=s/steps;
          const px=a.x+(b.x-a.x)*t;
          const py=a.y+(b.y-a.y)*t;
          const scroll=centerToEditorCamScroll(px,py,zoom,roadOff);
          const sx=scroll.x;
          const sy=scroll.y;
          let inBounds=true;
          if(scrollRect){
            const minSX=scrollRect.left;
            const maxSX=scrollRect.right-viewW;
            const minSY=scrollRect.top;
            const maxSY=scrollRect.bottom-viewH;
            inBounds=sx>=minSX-1&&sx<=maxSX+1&&sy>=minSY-1&&sy<=maxSY+1;
          }
          if(useIso){
            const corners=[
              {x:sx,y:sy},
              {x:sx+viewW,y:sy},
              {x:sx,y:sy+viewH},
              {x:sx+viewW,y:sy+viewH},
            ];
            let aMin=Infinity,aMax=-Infinity,bMin=Infinity,bMax=-Infinity;
            for(const c of corners){
              const iso=worldToIsoAB(c.x,c.y,isoRef);
              if(iso.a<aMin) aMin=iso.a;
              if(iso.a>aMax) aMax=iso.a;
              if(iso.b<bMin) bMin=iso.b;
              if(iso.b>bMax) bMax=iso.b;
            }
            inBounds=inBounds&&(aMin>=isoMinA&&aMax<=isoMaxA&&bMin>=isoMinB&&bMax<=isoMaxB);
          }
          if(!inBounds) continue;
          if(sx<minX) minX=sx;
          if(sx>maxX) maxX=sx;
          if(sy<minY) minY=sy;
          if(sy>maxY) maxY=sy;
        }
      }
      if(!Number.isFinite(minX)||!Number.isFinite(minY)) return null;
      return {minX,maxX,minY,maxY,viewW,viewH};
    }
    // Export-only: always uses game viewport (1280x506) and game roadOff,
    // independent of gameCamMode UI state.
    function computeGameRailPreviewBounds(zoom){
      if(camMoveMode==='free') return null;
      const rail=buildEditorRail();
      if(!rail || rail.length<2) return null;
      const v=getGameViewSize(zoom);
      const viewW=v.viewW;
      const viewH=v.viewH;
      const roadOff=getGameRoadViewOffsetY(zoom);
      const isoRef=computeIsoDiamondBoundsFromMap();
      const useIso=!!isoRef;
      const padA=useIso?(ROAD_EDGE_INSET_PX/isoRef.halfW+ROAD_EDGE_INSET_PX/isoRef.halfH):0;
      const isoMinA=useIso?(isoRef.minA+padA):0;
      const isoMaxA=useIso?(isoRef.maxA-padA):0;
      const isoMinB=useIso?(isoRef.minB+padA):0;
      const isoMaxB=useIso?(isoRef.maxB-padA):0;
      let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
      const step=30;
      for(let i=0;i<rail.length-1;i++){
        const a=rail[i], b=rail[i+1];
        const segLen=Math.hypot(b.x-a.x,b.y-a.y);
        const steps=Math.max(1,Math.ceil(segLen/step));
        for(let s=0;s<=steps;s++){
          const t=s/steps;
          const px=a.x+(b.x-a.x)*t;
          const py=a.y+(b.y-a.y)*t;
          const scroll=cameraCenterToScroll(px,py+roadOff,viewW,viewH);
          const sx=scroll.x;
          const sy=scroll.y;
          if(useIso){
            const corners=[{x:sx,y:sy},{x:sx+viewW,y:sy},{x:sx,y:sy+viewH},{x:sx+viewW,y:sy+viewH}];
            let aMin=Infinity,aMax=-Infinity,bMin=Infinity,bMax=-Infinity;
            for(const c of corners){
              const iso=worldToIsoAB(c.x,c.y,isoRef);
              if(iso.a<aMin) aMin=iso.a;
              if(iso.a>aMax) aMax=iso.a;
              if(iso.b<bMin) bMin=iso.b;
              if(iso.b>bMax) bMax=iso.b;
            }
            if(!(aMin>=isoMinA&&aMax<=isoMaxA&&bMin>=isoMinB&&bMax<=isoMaxB)) continue;
          }
          if(sx<minX) minX=sx;
          if(sx>maxX) maxX=sx;
          if(sy<minY) minY=sy;
          if(sy>maxY) maxY=sy;
        }
      }
      if(!Number.isFinite(minX)||!Number.isFinite(minY)) return null;
      return {minX,maxX,minY,maxY,viewW,viewH};
    }
    function scrollRectFromBounds(b){
      if(!b) return null;
      const left=Number.isFinite(b.left)?b.left:Math.min(b.minX,b.maxX+b.viewW);
      const right=Number.isFinite(b.right)?b.right:Math.max(b.minX,b.maxX+b.viewW);
      const top=Number.isFinite(b.top)?b.top:Math.min(b.minY,b.maxY+b.viewH);
      const bottom=Number.isFinite(b.bottom)?b.bottom:Math.max(b.minY,b.maxY+b.viewH);
      return {left,right,top,bottom,viewW:b.viewW,viewH:b.viewH};
    }
    function ensureCustomBoundsFromAuto(){
      if(camBoundsEnabled) return;
      const iso=computeIsoDiamondBoundsFromMap();
      if(iso){
        camBoundsMinA=iso.minA;camBoundsMaxA=iso.maxA;
        camBoundsMinB=iso.minB;camBoundsMaxB=iso.maxB;
        camBoundsEnabled=true;
      }
    }
    function getGameStartCenter(){
      if(camLockCenter && camMoveMode==='free') return {x:camCenterX,y:camCenterY};
      if(Number.isFinite(camStartX) && Number.isFinite(camStartY)) return {x:camStartX,y:camStartY};
      return {x:camCenterX,y:camCenterY};
    }
    function setStartPickMode(active){
      isPickingStart=!!active;
      const btn=document.getElementById('btn-cam-from-view');
      if(btn) btn.classList.toggle('btn-accent',isPickingStart);
    }
    function getBoundsRectForEdit(){
      const base=camBoundsEnabled?getCustomScrollRect(gameZoom):computeAutoScrollBounds(gameZoom);
      return scrollRectFromBounds(base);
    }
    function beginBoundsDrag(sx,sy){
      if(!camBoundsEnabled&&!boundsEditMode) return false;
      const ref=computeIsoDiamondBoundsFromMap();
      if(!ref) return false;
      if(boundsEditMode) camBoundsEnabled=true;
      const hit=Math.max(10,14*cz*.4);
      const p1=isoABToWorld(camBoundsMinA,camBoundsMinB,ref);
      const p2=isoABToWorld(camBoundsMinA,camBoundsMaxB,ref);
      const p3=isoABToWorld(camBoundsMaxA,camBoundsMaxB,ref);
      const p4=isoABToWorld(camBoundsMaxA,camBoundsMinB,ref);
      const hs1=worldToScreen(p1.x,p1.y);
      const hs2=worldToScreen(p2.x,p2.y);
      const hs3=worldToScreen(p3.x,p3.y);
      const hs4=worldToScreen(p4.x,p4.y);
      const nearTop=Math.hypot(sx-hs1.x,sy-hs1.y)<=hit;
      const nearLeft=Math.hypot(sx-hs2.x,sy-hs2.y)<=hit;
      const nearBot=Math.hypot(sx-hs3.x,sy-hs3.y)<=hit;
      const nearRight=Math.hypot(sx-hs4.x,sy-hs4.y)<=hit;
      const w=screenToWorld(sx,sy);
      const iso=worldToIsoAB(w.x,w.y,ref);
      const inside=iso.a>=camBoundsMinA&&iso.a<=camBoundsMaxA&&iso.b>=camBoundsMinB&&iso.b<=camBoundsMaxB&&!nearTop&&!nearLeft&&!nearBot&&!nearRight;
      if(!(nearTop||nearLeft||nearBot||nearRight||inside)) return false;
      boundsDrag={mode:(nearTop||nearLeft||nearBot||nearRight)?'resize':'move',
        minA:camBoundsMinA,maxA:camBoundsMaxA,minB:camBoundsMinB,maxB:camBoundsMaxB,
        nearTop,nearLeft,nearBot,nearRight,startA:iso.a,startB:iso.b,ref};
      return true;
    }
    function updateBoundsDrag(sx,sy){
      if(!boundsDrag) return;
      const w=screenToWorld(sx,sy);
      const iso=worldToIsoAB(w.x,w.y,boundsDrag.ref);
      let minA=boundsDrag.minA,maxA=boundsDrag.maxA,minB=boundsDrag.minB,maxB=boundsDrag.maxB;
      if(boundsDrag.mode==='move'){
        const da=iso.a-boundsDrag.startA,db=iso.b-boundsDrag.startB;
        minA+=da;maxA+=da;minB+=db;maxB+=db;
      }else{
        if(boundsDrag.nearTop) minA=Math.min(iso.a,maxA-1);
        if(boundsDrag.nearBot) maxA=Math.max(iso.a,minA+1);
        if(boundsDrag.nearLeft) maxB=Math.max(iso.b,minB+1);
        if(boundsDrag.nearRight) minB=Math.min(iso.b,maxB-1);
        const miso=computeIsoDiamondBoundsFromMap();
        const SNAP=2.5;
        if(miso){
          if(boundsDrag.nearTop&&Math.abs(minA-miso.minA)<SNAP) minA=miso.minA;
          if(boundsDrag.nearBot&&Math.abs(maxA-miso.maxA)<SNAP) maxA=miso.maxA;
          if(boundsDrag.nearLeft&&Math.abs(maxB-miso.maxB)<SNAP) maxB=miso.maxB;
          if(boundsDrag.nearRight&&Math.abs(minB-miso.minB)<SNAP) minB=miso.minB;
        }
      }
      camBoundsMinA=minA;camBoundsMaxA=maxA;camBoundsMinB=minB;camBoundsMaxB=maxB;
      draw();
    }
    function endBoundsDrag(){
      if(!boundsDrag) return;
      boundsDrag=null;
      localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));
    }

    function ensureImage(ref){const key=normalizeRef(ref);if(!key)return null;if(tileImages.has(key))return tileImages.get(key);const img=new Image();const e={img,ready:false,fail:false};tileImages.set(key,e);img.onload=()=>{e.ready=true;draw();renderTiles();};img.onerror=()=>{e.fail=true;draw();};img.src=refUrl(key);return e;}
    function diamond(x,y,hw,hh){ctx.beginPath();ctx.moveTo(x,y-hh);ctx.lineTo(x+hw,y);ctx.lineTo(x,y+hh);ctx.lineTo(x-hw,y);ctx.closePath();}
    function drawTile(col,row){
      const w=tileToWorld(col,row),s=worldToScreen(w.x,w.y),hw=(TW/2)*cz,hh=(TH/2)*cz;
      let gid=layerVisible.ground?(layers.ground[row][col]|0):0;
      if(layerVisible.decor&&(layers.decor[row][col]|0)>0) gid=layers.decor[row][col]|0;
      diamond(s.x,s.y,hw,hh);ctx.save();ctx.clip();
      if(gid>0&&gid<=tileRefs.length){const e=ensureImage(tileRefs[gid-1]);if(e&&e.ready)ctx.drawImage(e.img,s.x-hw,s.y-hh,hw*2,hh*2);else{ctx.fillStyle='#223b64';ctx.fillRect(s.x-hw,s.y-hh,hw*2,hh*2);}}
      else{ctx.fillStyle='#1a2f52';ctx.fillRect(s.x-hw,s.y-hh,hw*2,hh*2);}ctx.restore();
      for(const l of ['paths','zones','citadel','spawn']){
        if(!layerVisible[l]) continue;
        if((layers[l][row][col]|0)<=0) continue;
        ctx.fillStyle=MASK_COLORS[l]||'rgba(120,160,220,0.3)';
        diamond(s.x,s.y,hw*.93,hh*.93);
        ctx.fill();
      }
      if(layerVisible.spawn&&layers.spawn[row][col]>0){ctx.strokeStyle='rgba(255,122,74,.95)';ctx.lineWidth=Math.max(1,2*cz*.35);diamond(s.x,s.y,hw*.72,hh*.72);ctx.stroke();}
      if(layerVisible.citadel&&layers.citadel[row][col]>0){ctx.strokeStyle='rgba(70,205,255,.95)';ctx.lineWidth=Math.max(1,2*cz*.35);diamond(s.x,s.y,hw*.65,hh*.65);ctx.stroke();}
      if(showGrid){ctx.strokeStyle='rgba(45,77,125,.62)';ctx.lineWidth=Math.max(1,1.1*cz*.45);diamond(s.x,s.y,hw,hh);ctx.stroke();}
      if(hoverCol===col&&hoverRow===row){ctx.strokeStyle='rgba(98,195,255,.95)';ctx.lineWidth=Math.max(1,1.8*cz*.4);diamond(s.x,s.y,hw*.9,hh*.9);ctx.stroke();}
    }
    function drawPlacedList(items,color){
      for(const e of items){
        const box=getEntityScreenBox(e);
        const imgEntry=ensureImage(e.asset);
        if(imgEntry&&imgEntry.ready){
          const _img=imgEntry.img;
          if(box.kind==='attack-tower'){
            const scale=buildingScale(cz);
            ctx.save();
            ctx.fillStyle=`rgba(6,12,22,${ATTACK_TOWER_RENDER_TUNING.shadowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(
              box.baseX,
              box.baseY+ATTACK_TOWER_RENDER_TUNING.shadowOffsetY*scale,
              ATTACK_TOWER_RENDER_TUNING.shadowRadiusX*scale,
              ATTACK_TOWER_RENDER_TUNING.shadowRadiusY*scale,
              0,0,Math.PI*2
            );
            ctx.fill();
            ctx.restore();
          }
          const frame=box.kind==='attack-tower'?ATTACK_TOWER_SPRITE_TRIM:getAtlasPreviewFrame(_img);
          ctx.drawImage(_img,frame.sx,frame.sy,frame.sw,frame.sh,box.left,box.top,box.width,box.height);
        }else{
          const s=worldToScreen(e.x,e.y);
          ctx.fillStyle=color;
          ctx.beginPath();
          ctx.arc(s.x,s.y-box.width*0.35,box.width*0.28,0,Math.PI*2);
          ctx.fill();
        }
        if(selectedEntity&&selectedEntity.id===e.id){
          ctx.save();
          ctx.strokeStyle='rgba(255,220,50,0.95)';ctx.lineWidth=Math.max(1.5,2*cz*0.3);
          ctx.strokeRect(box.left,box.top,box.width,box.height);
          const corners=[[box.left,box.top],[box.left+box.width,box.top],[box.left,box.top+box.height],[box.left+box.width,box.top+box.height]];
          ctx.fillStyle='rgba(255,220,50,0.92)';
          for(const[hx,hy]of corners){ctx.beginPath();ctx.arc(hx,hy,HANDLE_R,0,Math.PI*2);ctx.fill();ctx.stroke();}
          ctx.restore();
        }
      }
    }

    function getAtlasPreviewFrame(img){
      const atlas=getSquareAtlasLayout(img);
      if(!atlas) return { sx:0, sy:0, sw:img.width, sh:img.height };
      return atlasFrameRect(atlas,0);
    }

    function getSquareAtlasLayout(img){
      const width=Math.max(0,img.width||img.naturalWidth||0);
      const height=Math.max(0,img.height||img.naturalHeight||0);
      if(!width||!height) return null;
      const frameSize=gcd(width,height);
      if(!frameSize) return null;
      const cols=Math.floor(width/frameSize);
      const rows=Math.floor(height/frameSize);
      if(cols<1||rows<1) return null;
      if(cols*frameSize!==width||rows*frameSize!==height) return null;
      const totalFrames=cols*rows;
      if(totalFrames<=1) return null;
      return { frameSize, cols, rows, totalFrames };
    }

    function atlasFrameRect(atlas,frameIndex){
      const safe=((frameIndex%atlas.totalFrames)+atlas.totalFrames)%atlas.totalFrames;
      const col=safe%atlas.cols;
      const row=Math.floor(safe/atlas.cols);
      return { sx:col*atlas.frameSize, sy:row*atlas.frameSize, sw:atlas.frameSize, sh:atlas.frameSize };
    }

    function gcd(a,b){
      let x=Math.abs(Math.round(a)),y=Math.abs(Math.round(b));
      while(y){const next=x%y;x=y;y=next;}
      return x;
    }

    function drawIsoOriginLines(){
      const _o=isoOrigin();
      const sx=worldToScreen(_o.x,0).x;
      const sy=worldToScreen(0,_o.y).y;
      ctx.save();
      ctx.strokeStyle='rgba(120,190,255,0.35)';
      ctx.lineWidth=Math.max(1,1.1*cz*.4);
      ctx.setLineDash([6,6]);
      ctx.beginPath();
      ctx.moveTo(sx,0);
      ctx.lineTo(sx,canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0,sy);
      ctx.lineTo(canvas.width,sy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='rgba(120,190,255,0.65)';
      ctx.beginPath();
      ctx.arc(sx,sy,Math.max(2,2.6*cz),0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    function drawCameraBounds(){
      if(camBoundsSource==='none') return;
      const mapDiamond=mapDiamondPoints();
      const scroll=computeCameraScrollBounds(gameZoom);
      const railPreview=computeRailPreviewBounds(gameZoom);
      const isoBounds=camIsoClamp?getBoundsIso():null;
      if(mapDiamond){
        const a=worldToScreen(mapDiamond.top.x,mapDiamond.top.y);
        const b=worldToScreen(mapDiamond.right.x,mapDiamond.right.y);
        const c=worldToScreen(mapDiamond.bottom.x,mapDiamond.bottom.y);
        const d=worldToScreen(mapDiamond.left.x,mapDiamond.left.y);
        ctx.save();
        ctx.strokeStyle='rgba(255,102,204,0.6)';
        ctx.lineWidth=Math.max(1.2,2*cz*.35);
        ctx.beginPath();
        ctx.moveTo(a.x,a.y);
        ctx.lineTo(b.x,b.y);
        ctx.lineTo(c.x,c.y);
        ctx.lineTo(d.x,d.y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
      if((camBoundsEnabled||boundsEditMode)&&MW>0&&MH>0){
        const ref=computeIsoDiamondBoundsFromMap();
        if(ref){
          const p1=isoABToWorld(camBoundsMinA,camBoundsMinB,ref);
          const p2=isoABToWorld(camBoundsMinA,camBoundsMaxB,ref);
          const p3=isoABToWorld(camBoundsMaxA,camBoundsMaxB,ref);
          const p4=isoABToWorld(camBoundsMaxA,camBoundsMinB,ref);
          const s1=worldToScreen(p1.x,p1.y);
          const s2=worldToScreen(p2.x,p2.y);
          const s3=worldToScreen(p3.x,p3.y);
          const s4=worldToScreen(p4.x,p4.y);
          ctx.save();
          ctx.strokeStyle='rgba(70,255,140,0.85)';
          ctx.lineWidth=Math.max(1.3,2*cz*.35);
          ctx.beginPath();ctx.moveTo(s1.x,s1.y);ctx.lineTo(s4.x,s4.y);ctx.lineTo(s3.x,s3.y);ctx.lineTo(s2.x,s2.y);ctx.closePath();ctx.stroke();
          ctx.restore();
          const hs=Math.max(5,7*cz*.35);
          ctx.fillStyle='rgba(70,255,140,0.95)';
          for(const h of [s1,s2,s3,s4]){ctx.beginPath();ctx.arc(h.x,h.y,hs/2,0,Math.PI*2);ctx.fill();}
        }
      }
    }

    function drawViewportPreview(){}

    function drawStartMarker(){
      if(!Number.isFinite(camStartX)||!Number.isFinite(camStartY)) return;
      const s=worldToScreen(camStartX,camStartY);
      const r=Math.max(6,8*cz*.6);
      ctx.save();
      ctx.strokeStyle='rgba(255,90,90,0.95)';
      ctx.lineWidth=Math.max(1.2,2*cz*.35);
      ctx.beginPath();
      ctx.moveTo(s.x-r,s.y);
      ctx.lineTo(s.x+r,s.y);
      ctx.moveTo(s.x,s.y-r);
      ctx.lineTo(s.x,s.y+r);
      ctx.stroke();
      ctx.fillStyle='rgba(255,90,90,0.6)';
      ctx.beginPath();
      ctx.arc(s.x,s.y,Math.max(2.5,3*cz*.4),0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // Mirror of game's clampScrollToIsoDiamond вЂ” all coords in editor local world space
    function clampScrollToIsoDiamondEditor(scrollX,scrollY,zoom,bounds,viewW,viewH){
      const vw=Number.isFinite(viewW)?viewW:(GAME_W/zoom);
      const vh=Number.isFinite(viewH)?viewH:(GAME_VIEW_H/zoom);
      return cameraClampScrollToIsoDiamond(scrollX,scrollY,vw,vh,bounds.originX,bounds.originY,bounds,camBoundsPad);
    }

    // Clamp editor camera to bounds вЂ” custom bounds OR game-mode AABB+iso
    function clampEditorCamToBounds(){
      const hasBounds = camBoundsEnabled || camBoundsSource!=='none';
      if(!gameCamMode && !hasBounds) return;
      const clampZoom=gameCamMode?gameZoom:cz;
      // Outside game mode, free editor camera must stay completely free.
      if(!gameCamMode && camMoveMode==='free'){
        gameCamClampDirty=false;
        return;
      }
      let clamped=false;
      if(camMoveMode!=='free'){
        const rail=buildEditorRail();
        if(rail && rail.length>=2){
          const roadOff=getRoadViewOffsetY(clampZoom);
          const center=getEditorCamCenter();
          const centerX=center.x;
          const centerY=center.y;
          const proj=projectPointToRail(centerX,centerY-roadOff,rail);
          let scroll=centerToEditorCamScroll(proj.x,proj.y+roadOff,clampZoom);
          let sx=scroll.x;
          let sy=scroll.y;
          const railPreview=computeRailPreviewBounds(clampZoom);
          if(railPreview){
            if(Number.isFinite(railPreview.minX)&&Number.isFinite(railPreview.maxX)) sx=Math.max(railPreview.minX,Math.min(railPreview.maxX,sx));
            if(Number.isFinite(railPreview.minY)&&Number.isFinite(railPreview.maxY)) sy=Math.max(railPreview.minY,Math.min(railPreview.maxY,sy));
          }
          const newCenter=scrollToEditorCamCenter(sx,sy,clampZoom);
          const newCenterX=newCenter.x;
          const newCenterY=newCenter.y;
          setEditorCamCenter(newCenterX,newCenterY);
          clamped=true;
        }
      }
      if(!clamped && camBoundsSource!=='none'){
        const railPreview=computeRailPreviewBounds(clampZoom);
        const scroll=railPreview||computeCameraScrollBounds(clampZoom);
        if(scroll){
          const v=getViewSize(clampZoom);
          const viewW=v.viewW;
          const viewH=v.viewH;
          const roadOff=getRoadViewOffsetY(clampZoom);
          const center=getEditorCamCenter();
          const centerX=center.x;
          const centerY=center.y;
          let baseScroll=centerToEditorCamScroll(centerX,centerY,clampZoom);
          let sx=baseScroll.x;
          let sy=baseScroll.y;
          if(Number.isFinite(scroll.minX)&&Number.isFinite(scroll.maxX)) sx=Math.max(scroll.minX,Math.min(scroll.maxX,sx));
          if(Number.isFinite(scroll.minY)&&Number.isFinite(scroll.maxY)) sy=Math.max(scroll.minY,Math.min(scroll.maxY,sy));
          const baseIso=getBoundsIso();
          const iso=(camBoundsEnabled&&baseIso)
            ? {...baseIso,minA:camBoundsMinA,maxA:camBoundsMaxA,minB:camBoundsMinB,maxB:camBoundsMaxB}
            : (camIsoClamp?baseIso:null);
          if(iso){
            const c=clampScrollToIsoDiamondEditor(sx,sy,clampZoom,iso,viewW,viewH);
            sx=c.x;
            sy=c.y;
          }
          const newCenter=scrollToEditorCamCenter(sx,sy,clampZoom);
          const newCenterX=newCenter.x;
          const newCenterY=newCenter.y;
          setEditorCamCenter(newCenterX,newCenterY);
          clamped=true;
        }
      }
      gameCamClampDirty=false;
      // Clamp is active in Game Mode, and also in camera free mode (requested parity).
    }

    // Unified game panel: zoom + rails + bounds in one place
    function toggleGamePanel(){
      gamePanelOpen=!gamePanelOpen;
      const panel=document.getElementById('game-panel');
      const btn=document.getElementById('btn-game-panel');
      const gvPanel=document.getElementById('game-view-panel');
      gameViewMode=false;
      if(gvPanel) gvPanel.style.display='none';
      if(gamePanelOpen){
        gamePanelSavedCz=cz;
        cz=Math.max(0.1,Math.min(8,getGameFitScale()*gameZoom));
        gameCamMode=true;
        if(panel) panel.style.display='block';
        if(btn){btn.style.background='linear-gradient(180deg,#1a4a1a,#0e2e0e)';btn.style.color='#ffe07a';btn.style.borderColor='#4a8a2a';}
        gameCamClampDirty=true;
        clampEditorCamToBounds();
        setStatus(tr('Режим игры ВКЛ — зум, рельсы, границы','Game mode ON — zoom, rails, bounds'));
      } else {
        gameCamMode=false;
        cz=gamePanelSavedCz;
        if(panel) panel.style.display='none';
        if(btn){btn.style.background='';btn.style.color='';btn.style.borderColor='';}
        setStatus(tr('Режим игры ВЫКЛ','Game mode OFF'));
      }
      draw();
    }

    // Backward compatibility: L key toggles game panel
    function toggleGameCamMode(){
      toggleGamePanel();
    }

    // в”Ђв”Ђ Game View Mode (G key) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
    // Interactive mode: drag yellow 1280Г—506 viewport rect, see outside-bounds overlay.
    function toggleGameViewMode(){
      gameViewMode=!gameViewMode;
      gameViewDrag=false;
      const btn=document.getElementById('btn-game-view');
      const panel=document.getElementById('game-view-panel');
      if(gameViewMode){
        if(btn){btn.style.background='linear-gradient(180deg,#1a4a1a,#0e2e0e)';btn.style.color='#ffe07a';btn.style.borderColor='#4a8a2a';}
        if(panel) panel.style.display='block';
        setStatus(tr('Game View: тяните жёлтый прямоугольник · [G] выход','Game View: drag yellow rect · [G] to exit'));
      }else{
        if(btn){btn.style.background='';btn.style.color='';btn.style.borderColor='';}
        if(panel) panel.style.display='none';
        setStatus(tr('Режим редактора','Editor mode'));
      }
      draw();
    }

    // Clamp game-view rect center so it stays within the map's axis-aligned bounding box
    function clampGameViewRectToMap(cx,cy,viewW,viewH){
      const mb=computeMapWorldBounds();
      if(!mb) return{x:cx,y:cy};
      return cameraClampCenterToScrollBounds(cx,cy,viewW,viewH,{
        minX:mb.left,
        maxX:mb.right-viewW,
        minY:mb.top,
        maxY:mb.bottom-viewH
      });
    }

    // Draw dark overlay outside the map diamond вЂ” only in Game View Mode
    function drawOutsideBoundsOverlay(){
      if(!gameViewMode) return;
      const d=mapDiamondPoints();
      if(!d) return;
      ctx.save();
      // Full-canvas dark overlay
      ctx.fillStyle='rgba(0,4,16,0.46)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      // Punch out the map diamond shape (show map clearly through overlay)
      ctx.globalCompositeOperation='destination-out';
      const pts=[
        worldToScreen(d.top.x,d.top.y),
        worldToScreen(d.right.x,d.right.y),
        worldToScreen(d.bottom.x,d.bottom.y),
        worldToScreen(d.left.x,d.left.y)
      ];
      ctx.beginPath();
      ctx.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Draw map boundary outline
      ctx.save();
      ctx.strokeStyle='rgba(80,160,230,0.75)';
      ctx.lineWidth=Math.max(1.5,2*cz*0.3);
      ctx.setLineDash([5,4]);
      ctx.beginPath();
      ctx.moveTo(pts[0].x,pts[0].y);
      for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Save current viewport rect center as camStartX/Y (game-view mode)
    function setStartFromGameView(){
      syncCamForm();
      setStatus(tr(
        `Старт задан: X=${Math.round(camStartX)}, Y=${Math.round(camStartY)}`,
        `Start set: X=${Math.round(camStartX)}, Y=${Math.round(camStartY)}`
      ));
      localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));
    }

    function drawGameCamFrame(){
      if(!gamePanelOpen) return;
      // Draw thick cyan border around the canvas to indicate L-mode is active
      ctx.save();
      ctx.strokeStyle='rgba(0,255,220,0.85)';
      ctx.lineWidth=4;
      ctx.strokeRect(2,2,canvas.width-4,canvas.height-4);
      ctx.fillStyle='rgba(0,255,220,0.9)';
      ctx.font='bold 14px monospace';
      ctx.fillText(tr('РЕЖ.ИГРЫ — ESC выход','GAME MODE — ESC to exit'),10,22);
      ctx.restore();
    }

    function drawGameUiOverlay(){
      if(!gamePanelOpen) return;
      const fit=getGameFitScale();
      const w=GAME_W*fit;
      const h=GAME_H*fit;
      const left=(canvas.width-w)/2;
      const top=(canvas.height-h)/2;
      // Darken outside the game window
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,0.35)';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.globalCompositeOperation='destination-out';
      ctx.fillRect(left,top,w,h);
      ctx.restore();
      // Game window frame + UI bars
      const topH=TOP_BAR_HEIGHT*fit;
      const bottomH=HUD_HEIGHT*fit;
      ctx.save();
      ctx.strokeStyle='rgba(120,190,255,0.7)';
      ctx.lineWidth=2;
      ctx.strokeRect(left,top,w,h);
      ctx.fillStyle='rgba(6,12,24,0.85)';
      ctx.fillRect(left,top,w,topH);
      ctx.fillRect(left,top+h-bottomH,w,bottomH);
      ctx.restore();
    }

    function drawGameMoveBounds(){
      if(!gamePanelOpen) return;
      const railPreview=computeRailPreviewBounds(gameZoom);
      const scroll=railPreview||computeCameraScrollBounds(gameZoom);
      if(!scroll) return;
      const rect=railPreview
        ? {left:railPreview.minX,right:railPreview.maxX+railPreview.viewW,top:railPreview.minY,bottom:railPreview.maxY+railPreview.viewH}
        : scrollRectFromBounds(scroll);
      if(!rect) return;
      const s0=worldToScreen(rect.left,rect.top);
      const s1=worldToScreen(rect.right,rect.bottom);
      ctx.save();
      ctx.strokeStyle='rgba(90,200,255,0.85)';
      ctx.lineWidth=Math.max(1.2,2*cz*.35);
      ctx.setLineDash([6,4]);
      ctx.strokeRect(s0.x,s0.y,s1.x-s0.x,s1.y-s0.y);
      ctx.setLineDash([]);
      ctx.fillStyle='rgba(90,200,255,0.85)';
      ctx.font='bold 11px monospace';
      ctx.fillText('LIMITS',s0.x+4,s0.y-4);
      ctx.restore();
    }

    function drawCameraOverlays(){
      drawIsoOriginLines();
      drawCameraBounds();
      drawOutsideBoundsOverlay(); // Game View Mode: dark overlay outside map diamond
      drawViewportPreview();
      drawStartMarker();
      drawGameCamFrame();
      drawGameUiOverlay();
      drawGameMoveBounds();
    }

    function draw(){
      if(gamePanelOpen){
        cz=Math.max(0.1,Math.min(8,getGameFitScale()*gameZoom));
      }
      clampEditorCamToBounds();
      ctx.clearRect(0,0,canvas.width,canvas.height);
      for(let r=0;r<MH;r++) for(let c=0;c<MW;c++) drawTile(c,r);
      drawPlacedList(placedGraphics,'rgba(158,220,255,0.95)');
      drawPlacedList(placedObjects,'rgba(255,168,81,0.95)');
      drawPlacedList(placedBuildings,'rgba(106,255,162,0.95)');
      drawCameraOverlays();
      const modeText=MASK_LAYERS.has(currentLayer)?tr('Режим маски','Mask mode'):tr('Плитка ','Tile ')+(selectedTileByLayer[currentLayer]||1);
      const gameModeTag=gamePanelOpen?` | ${tr('РЕЖ.ИГРЫ','GAME MODE')}`:'';
      const scrollBounds=computeCameraScrollBounds(gameZoom);
      const scrollRect=scrollRectFromBounds(scrollBounds);
      const scrollLine=scrollRect
        ? `${tr('scroll','scroll')}: X ${Math.round(scrollRect.left)}..${Math.round(scrollRect.right-scrollRect.viewW)} Y ${Math.round(scrollRect.top)}..${Math.round(scrollRect.bottom-scrollRect.viewH)}`
        : `${tr('scroll','scroll')}: n/a`;
      const viewRectLine=scrollRect
        ? `${tr('view rect','view rect')}: L${Math.round(scrollRect.left)} R${Math.round(scrollRect.right)} T${Math.round(scrollRect.top)} B${Math.round(scrollRect.bottom)}`
        : `${tr('view rect','view rect')}: n/a`;
      const railPreview=computeRailPreviewBounds(gameZoom);
      const railLine=railPreview
        ? `${tr('rail scroll','rail scroll')}: X ${Math.round(railPreview.minX)}..${Math.round(railPreview.maxX)} Y ${Math.round(railPreview.minY)}..${Math.round(railPreview.maxY)}`
        : `${tr('rail scroll','rail scroll')}: n/a`;
      const customAabb=getCustomBoundsAABB();
      const customAabbLine=customAabb
        ? `${tr('custom aabb','custom aabb')}: L${Math.round(customAabb.minX)} R${Math.round(customAabb.maxX)} T${Math.round(customAabb.minY)} B${Math.round(customAabb.maxY)}`
        : `${tr('custom aabb','custom aabb')}: ${tr('нет','off')}`;
      ovLeftEl.textContent=`${tr('Слой','Layer')}: ${currentLayer} | ${tr('Кисть','Brush')}: ${brushSize}x${brushSize} | ${modeText}${gameModeTag}`;
      ovRightEl.textContent=`${tr('Тайл','Tile')}: ${hoverCol}, ${hoverRow}`;
      const editorCamCenter=getEditorCamCenter();
      const mapWB=computeMapWorldBounds();
      const mapWBLine=mapWB
        ? `${tr('мир карты','map world')}: L${Math.round(mapWB.left)} R${Math.round(mapWB.right)} T${Math.round(mapWB.top)} B${Math.round(mapWB.bottom)}`
        : `${tr('мир карты','map world')}: n/a`;
      const layerWB=computeLayerWorldBounds(layers.ground);
      const layerWBLine=layerWB
        ? `${tr('ground слой','ground layer')}: L${Math.round(layerWB.left)} R${Math.round(layerWB.right)} T${Math.round(layerWB.top)} B${Math.round(layerWB.bottom)}`
        : `${tr('ground слой','ground layer')}: n/a`;
      const origin=isoOrigin();
      const citW=getCitadelWorld();
      const railAnchor=getSceneRailAnchorWorld();
      const editorRailDbg=buildEditorRail();
      statsEl.textContent=[
        `${tr('карта','map')}: ${MW}x${MH}`,
        `${tr('тайл','tile')}: ${TW}x${TH}`,
        mapWBLine,
        layerWBLine,
        `${tr('ISO origin','ISO origin')}: ${Math.round(origin.x)}, ${Math.round(origin.y)}`,
        `${tr('цитадель','citadel')}: ${Math.round(citW.x)}, ${Math.round(citW.y)}`,
        `${tr('якорь рельса','rail anchor')}: ${Math.round(railAnchor.x)}, ${Math.round(railAnchor.y)}`,
        `${tr('рельс','rail')}: ${editorRailDbg?editorRailDbg.length:0} ${tr('точек','pts')}`,
        `${tr('камера редактора','editor cam')}: ${Math.round(editorCamCenter.x)}, ${Math.round(editorCamCenter.y)} zoom:${cz.toFixed(2)}`,
        `${tr('зум игры','game zoom')}: ${gameZoom.toFixed(2)} | vis: ${Math.round(GAME_W/gameZoom)}x${Math.round(GAME_VIEW_H/gameZoom)}`,
        `${tr('камера','camera')}: ${tr('режим','mode')} ${camMoveMode} dir ${camRoadDir}`,
        `${tr('точка тарта','start pos')}: ${Math.round(camStartX)}, ${Math.round(camStartY)}`,
        `${tr('границы','bounds')}: ${camBoundsSource} pad ${Math.round(camBoundsPad)}`,
        `${tr('custom bounds','custom bounds')}: ${camBoundsEnabled?`A:[${Math.round(camBoundsMinA)}..${Math.round(camBoundsMaxA)}] B:[${Math.round(camBoundsMinB)}..${Math.round(camBoundsMaxB)}]`:tr('нет','off')}`,
        customAabbLine,
        scrollLine,
        viewRectLine,
        railLine,
        `${tr('ревизия','rev')}: ${mapRev || '-'}`,
        `${tr('плиток в каталоге','tiles in catalog')}: ${tileRefs.length}`,
        `${tr('зданий','buildings')}: ${placedBuildings.length}, ${tr('объектов','objects')}: ${placedObjects.length}, ${tr('графики','graphics')}: ${placedGraphics.length}`
      ].join('\n');
      const gamePanel=document.getElementById('game-panel');
      if(gamePanel){
        if(gamePanelOpen){
          const visW=Math.round(GAME_W/gameZoom);
          const visH=Math.round(GAME_VIEW_H/gameZoom);
          const boundsLine=camBoundsEnabled
            ? `A:[${Math.round(camBoundsMinA)}..${Math.round(camBoundsMaxA)}] B:[${Math.round(camBoundsMinB)}..${Math.round(camBoundsMaxB)}]`
            : `${camBoundsSource} pad ${Math.round(camBoundsPad)}`;
          const limitsRect=railPreview
            ? {left:railPreview.minX,right:railPreview.maxX+railPreview.viewW,top:railPreview.minY,bottom:railPreview.maxY+railPreview.viewH}
            : scrollRect;
          const limitsLine=limitsRect
            ? `${tr('границы','limits')}: L${Math.round(limitsRect.left)} R${Math.round(limitsRect.right)} T${Math.round(limitsRect.top)} B${Math.round(limitsRect.bottom)}`
            : `${tr('границы','limits')}: n/a`;
          gamePanel.textContent=[
            `${tr('зум игры','game zoom')}: ${gameZoom.toFixed(2)} | vis ${visW}x${visH}`,
            `${tr('границы','bounds')}: ${boundsLine}`,
            limitsLine,
            railLine,
            viewRectLine,
          ].join('\n');
        } else {
          gamePanel.textContent='';
        }
      }
    }

    function flatten(layer){const out=[];for(let r=0;r<MH;r++)for(let c=0;c<MW;c++)out.push(layer[r][c]|0);return out;}
    function unflatten(flat){const out=[];let i=0;for(let r=0;r<MH;r++){const row=[];for(let c=0;c<MW;c++){row.push(Array.isArray(flat)&&typeof flat[i]==='number'?(flat[i]|0):0);i++;}out.push(row);}return out;}
    function syncBoundsUI(){
      document.querySelectorAll('#bounds-source .seg-btn').forEach((b)=>b.classList.toggle('active',b.getAttribute('data-bounds')===camBoundsSource));
      const cb=document.getElementById('bounds-custom');if(cb)cb.checked=!!camBoundsEnabled;
      const ic=document.getElementById('iso-clamp');if(ic)ic.checked=!!camIsoClamp;
      const be=document.getElementById('btn-bounds-edit');if(be)be.classList.toggle('active',!!boundsEditMode);
      const bi=document.getElementById('bounds-inputs');if(bi)bi.style.display=camBoundsEnabled?'block':'none';
      if(camBoundsEnabled){
        const ref=computeIsoDiamondBoundsFromMap();
        if(ref){
          const pts=[isoABToWorld(camBoundsMinA,camBoundsMinB,ref),isoABToWorld(camBoundsMinA,camBoundsMaxB,ref),
                     isoABToWorld(camBoundsMaxA,camBoundsMaxB,ref),isoABToWorld(camBoundsMaxA,camBoundsMinB,ref)];
          const el=id=>document.getElementById(id);
          if(el('bounds-minx'))el('bounds-minx').value=String(Math.round(Math.min(...pts.map(p=>p.x))));
          if(el('bounds-maxx'))el('bounds-maxx').value=String(Math.round(Math.max(...pts.map(p=>p.x))));
          if(el('bounds-miny'))el('bounds-miny').value=String(Math.round(Math.min(...pts.map(p=>p.y))));
          if(el('bounds-maxy'))el('bounds-maxy').value=String(Math.round(Math.max(...pts.map(p=>p.y))));
        }
      }
    }
    function syncCamForm(){
      if(camMoveMode!=='free') camIsoClamp=false;
      document.getElementById('game-zoom').value=String(gameZoom);
      updateVisHint();
      document.getElementById('cam-start-x').value=String(Math.round(camStartX));
      document.getElementById('cam-start-y').value=String(Math.round(camStartY));
      document.getElementById('bounds-pad').value=String(Math.round(camBoundsPad));
      document.getElementById('road-offset-y').value=String(Math.round(camRoadOffsetY));
      document.getElementById('cam-move-mode').value=camMoveMode;
      document.getElementById('cam-road-dir').value=camRoadDir;
      var bMinEl=document.getElementById('bounds-info-min');
      var bMaxEl=document.getElementById('bounds-info-max');
      if(camBoundsEnabled){
        const _ref=computeIsoDiamondBoundsFromMap();
        if(_ref){
          const _pts=[isoABToWorld(camBoundsMinA,camBoundsMinB,_ref),isoABToWorld(camBoundsMinA,camBoundsMaxB,_ref),
                      isoABToWorld(camBoundsMaxA,camBoundsMaxB,_ref),isoABToWorld(camBoundsMaxA,camBoundsMinB,_ref)];
          if(bMinEl) bMinEl.textContent='X: '+Math.round(Math.min(..._pts.map(p=>p.x)))+', Y: '+Math.round(Math.min(..._pts.map(p=>p.y)));
          if(bMaxEl) bMaxEl.textContent='X: '+Math.round(Math.max(..._pts.map(p=>p.x)))+', Y: '+Math.round(Math.max(..._pts.map(p=>p.y)));
        }
      }else{
        if(bMinEl) bMinEl.textContent='вЂ”';
        if(bMaxEl) bMaxEl.textContent='вЂ”';
      }
      syncBoundsUI();
      const ic=document.getElementById('iso-clamp');
      if(ic){
        ic.checked=!!camIsoClamp;
        ic.disabled=camMoveMode!=='free';
      }
    }
    function readCamForm(){
      gameZoom=Math.max(.1,Math.min(8,Number(document.getElementById('game-zoom').value)||gameZoom));
      if(gamePanelOpen){
        cz=Math.max(0.1,Math.min(8,getGameFitScale()*gameZoom));
      }
      updateVisHint();
      camStartX=Number(document.getElementById('cam-start-x').value)||0;
      camStartY=Number(document.getElementById('cam-start-y').value)||0;
      const padVal=Number(document.getElementById('bounds-pad').value);
      if(Number.isFinite(padVal)) camBoundsPad=Math.max(0,Math.min(600,padVal));
      const roadOffVal=Number(document.getElementById('road-offset-y').value);
      if(Number.isFinite(roadOffVal)) camRoadOffsetY=Math.max(-2000,Math.min(2000,roadOffVal));
      camMoveMode=document.getElementById('cam-move-mode').value;
      camRoadDir=document.getElementById('cam-road-dir').value;
      const cb=document.getElementById('bounds-custom');if(cb) camBoundsEnabled=!!cb.checked;
      const ic=document.getElementById('iso-clamp');if(ic) camIsoClamp=!!ic.checked;
      if(camMoveMode==='free'){
        boundsEditMode=true;
        camBoundsEnabled=true;
      }else{
        boundsEditMode=false;
        camIsoClamp=false;
        if(ic) ic.checked=false;
      }
      gameCamClampDirty=true;
      syncCamForm();
      draw();
    }

    function adjustRoadOffset(delta,src){
      const d=Number(delta)||0;
      if(!d) return;
      const prev=camRoadOffsetY;
      camRoadOffsetY=Math.max(-2000,Math.min(2000,camRoadOffsetY+d));
      if(Math.abs(camRoadOffsetY-prev)<0.001) return;
      gameCamClampDirty=true;
      syncCamForm();
      draw();
      localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));
      setStatus(tr(
        `Смещение дороги Y: ${Math.round(camRoadOffsetY)} (${src||'hotkey'})`,
        `Road offset Y: ${Math.round(camRoadOffsetY)} (${src||'hotkey'})`
      ));
    }

    function ensureTileCatalogForMap(){let maxId=1;for(const l of LAYERS)for(let r=0;r<MH;r++)for(let c=0;c<MW;c++)maxId=Math.max(maxId,layers[l][r][c]|0);while(tileRefs.length<maxId)tileRefs.push('assets/tilesets/ground_stone1.png');tileRefs=tileRefs.map(normalizeRef);if(tileRefs.length===0)tileRefs=['assets/tilesets/ground_stone1.png'];}
    function baseNameNoExt(ref){return refName(ref).replace(/\.[a-z0-9]+$/i,'');}
    function serializeEntitySet(items){
      const templates=[];
      const templateByKey=new Map();
      const out=[];
      for(const it of items){
        const assetRef=normalizeRef(it.asset||'');
        const fileName=refName(assetRef);
        if(!fileName) continue;
        const key=assetRef.toLowerCase()||fileName.toLowerCase();
        if(!templateByKey.has(key)){
          const tmpl={
            name:it.name||baseNameNoExt(fileName),
            fileName,
            asset:assetRef,
            w:it.w||64,
            h:it.h||64,
          };
          templateByKey.set(key,tmpl);
          templates.push(tmpl);
        }
        out.push({
          template:fileName,
          asset:assetRef,
          name:it.name||baseNameNoExt(fileName),
          x:Math.round(it.x||0),
          y:Math.round(it.y||0),
          w:it.w||64,
          h:it.h||64,
          rot:it.rot||0,
          ax:typeof it.ax==='number'?it.ax:0.5,
          ay:typeof it.ay==='number'?it.ay:1,
          col:typeof it.col==='number'?it.col:null,
          row:typeof it.row==='number'?it.row:null,
          tilesW:it.tilesW||1,
          tilesH:it.tilesH||1,
        });
      }
      return { templates, items: out };
    }
    function convertEntityItemsToGame(items){
      return items.map((it)=>({
        ...it,
        x:Math.round(toGameX(Number(it.x)||0)),
        y:Math.round(toGameY(Number(it.y)||0)),
      }));
    }

    function buildMap(){
      readCamForm();
      ensureTileCatalogForMap();
      const bSet=serializeEntitySet(placedBuildings);
      const oSet=serializeEntitySet(placedObjects);
      const gSet=serializeEntitySet(placedGraphics);
      const sceneCitadel=getSceneCitadelWorld();
      const sceneRailAnchor=getSceneRailAnchorWorld();
      const editorRail=buildEditorRail();
      if(bSet.items.length===0){
        bSet.templates.push({ name:'Citadel', fileName:'citadel.png', asset:'assets/build/citadel/citadel.png', w:128, h:128 });
        bSet.items.push({ template:'citadel.png', asset:'assets/build/citadel/citadel.png', name:'Citadel', x:Math.round(sceneCitadel.x), y:Math.round(sceneCitadel.y), w:128, h:128, rot:0, ax:.5, ay:1, col:null, row:null });
      }
      mapRev=Date.now();
      const camCenterXGame=Math.round(toGameX(sceneRailAnchor.x));
      const camCenterYGame=Math.round(toGameY(sceneRailAnchor.y));
      const camStartXGame=Math.round(toGameX(camStartX));
      const camStartYGame=Math.round(toGameY(camStartY));
      const editorCamCenter=getEditorCamCenter();
      const camObj={x:Math.round(editorCamCenter.x),y:Math.round(editorCamCenter.y),editorSpace:'center-world',editorZoom:Number(cz.toFixed(3)),zoom:Number(gameZoom.toFixed(3)),lockCenter:!!camLockCenter,centerX:camCenterXGame,centerY:camCenterYGame,startX:camStartXGame,startY:camStartYGame,moveMode:camMoveMode,roadDirection:camRoadDir,roadViewOffsetY:Number(camRoadOffsetY.toFixed(2)),boundsSource:camBoundsSource,boundsPad:Math.round(camBoundsPad),space:'game'};
      if(camBoundsEnabled){
        camObj.boundsEnabled=true;
        camObj.boundsMinA=camBoundsMinA;camObj.boundsMaxA=camBoundsMaxA;
        camObj.boundsMinB=camBoundsMinB;camObj.boundsMaxB=camBoundsMaxB;
        const ref=computeIsoDiamondBoundsFromMap();
        if(ref){
          const pts=[isoABToWorld(camBoundsMinA,camBoundsMinB,ref),isoABToWorld(camBoundsMinA,camBoundsMaxB,ref),
                     isoABToWorld(camBoundsMaxA,camBoundsMaxB,ref),isoABToWorld(camBoundsMaxA,camBoundsMinB,ref)];
          camObj.boundsMinX=Math.round(Math.min(...pts.map(p=>p.x)));
          camObj.boundsMaxX=Math.round(Math.max(...pts.map(p=>p.x)));
          camObj.boundsMinY=Math.round(Math.min(...pts.map(p=>p.y)));
          camObj.boundsMaxY=Math.round(Math.max(...pts.map(p=>p.y)));
        }
      }
      camObj.isoClamp=!!camIsoClamp;
      // Save rail scroll bounds for game — always computed with game viewport/roadOff
      const editorRailBounds=computeGameRailPreviewBounds(gameZoom);
      if(editorRailBounds){
        camObj.railScrollMinX=editorRailBounds.minX;
        camObj.railScrollMaxX=editorRailBounds.maxX;
        camObj.railScrollMinY=editorRailBounds.minY;
        camObj.railScrollMaxY=editorRailBounds.maxY;
      }
      const bItems=convertEntityItemsToGame(bSet.items);
      const oItems=convertEntityItemsToGame(oSet.items);
      const gItems=convertEntityItemsToGame(gSet.items);
      return{
        version:7,
        rev:mapRev,
        width:MW,height:MH,tileWidth:TW,tileHeight:TH,
        camera:camObj,
        scene:{
          citadel:{x:Math.round(toGameX(sceneCitadel.x)),y:Math.round(toGameY(sceneCitadel.y))},
          railAnchor:{x:Math.round(toGameX(sceneRailAnchor.x)),y:Math.round(toGameY(sceneRailAnchor.y))},
          primaryDirection:camRoadDir,
          portals:buildScenePortals(sceneCitadel),
          cameraRail:Array.isArray(editorRail)?editorRail.map((p)=>({
            x:Math.round(toGameX(Number(p.x)||0)),
            y:Math.round(toGameY(Number(p.y)||0)),
          })) : [],
        },
        entitiesSpace:'game',
        tiles:tileRefs.slice(),
        layers:{ground:flatten(layers.ground),paths:flatten(layers.paths),cam:flatten(layers.cam),zones:flatten(layers.zones),decor:flatten(layers.decor),citadel:flatten(layers.citadel),spawn:flatten(layers.spawn)},
        rotations:{ground:new Array(MW*MH).fill(0),paths:new Array(MW*MH).fill(0),cam:new Array(MW*MH).fill(0),zones:new Array(MW*MH).fill(0),decor:new Array(MW*MH).fill(0),citadel:new Array(MW*MH).fill(0),spawn:new Array(MW*MH).fill(0)},
        buildingTemplates:bSet.templates,
        buildings:bItems,
        obstacleTemplates:oSet.templates,
        obstacles:oItems,
        graphicTemplates:gSet.templates,
        graphics:gItems
      };
    }

    async function doSaveMap(){let name=(document.getElementById('map-name').value||'').trim()||'valkyrix-map';if(!name.toLowerCase().endsWith('.json'))name+='.json';name=name.replace(/[^a-zA-Z0-9._-]/g,'_');if(name.toLowerCase()==='active-map.json'){const err=new Error(tr('Имя active-map зарезервировано. Сохрани карту под другим именем, например valkyrix-map.','The name active-map is reserved. Save the map under another name, for example valkyrix-map.'));setStatus(tr(`Ошибка сохранения: ${err.message}`,`Save error: ${err.message}`));throw err;}const shouldSyncActive=!!lastActivatedMapFile&&name.toLowerCase()===lastActivatedMapFile.toLowerCase();const payload={name,data:buildMap(),makeActive:shouldSyncActive};try{const res=await fetch('/__save_map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!res.ok){const txt=await res.text();throw new Error(txt||`save failed (${res.status})`);}localStorage.setItem('valkyrix-map-autosave',JSON.stringify(payload.data));lastLoadedMapFile=name;if(shouldSyncActive){setStatus(tr(`Сохранено и обновлен active-map: assets/maps/${name}`,`Saved and synced active-map: assets/maps/${name}`));}else{setStatus(tr(`Сохранено: assets/maps/${name} (active-map не тронут)`,`Saved: assets/maps/${name} (active-map unchanged)`));}await loadAssets();return { ok:true, file:name, data:payload.data, activeSynced:shouldSyncActive };}catch(e){setStatus(tr(`Ошибка сохранения: ${e.message}`,`Save error: ${e.message}`));throw e;}}
    async function setActiveMapByPath(v){
      if(!v){
        setStatus(tr('Выберите карту для active-map','Choose map for active-map'));
        return;
      }
      const name=v.split('/').pop();
      try{
        const res=await fetch('/__set_active_map',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ name })});
        if(!res.ok) throw new Error('set active failed');
        lastActivatedMapFile=name;
        setStatus(tr(`Активная карта: ${name}`,`Active map: ${name}`));
        await loadAssets();
      }catch(e){
        setStatus(tr(`Не удалось сделать активной: ${e.message}`,`Set active failed: ${e.message}`));
      }
    }

    function updateDropdownMarkers() {
      const select = document.getElementById('map-preset');
      if (!select) return;
      Array.from(select.options).forEach(opt => {
        const file = opt.value ? opt.value.split('/').pop() : '';
        let label = opt.dataset.baseLabel || opt.textContent.replace(/^[? ]+/, '').trim();
        opt.dataset.baseLabel = label;
        if (file && file === lastLoadedMapFile) {
          opt.textContent = '? ' + label;
          opt.style.color = '#7ec8e3';
        } else {
          opt.textContent = label;
          opt.style.color = '';
        }
      });
    }

    async function activateCurrentMap() {
      const nameInput = document.getElementById('map-name');
      const name = (nameInput ? nameInput.value : '').trim() || 'valkyrix-map';
      const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const file = safe.toLowerCase().endsWith('.json') ? safe : `${safe}.json`;

      if (file.toLowerCase() === 'active-map.json') {
        setStatus(tr(
          'Имя active-map зарезервировано. Сначала сохрани карту под обычным именем, потом активируй её.',
          'The name active-map is reserved. Save the map under a normal name first, then activate it.',
        ));
        return;
      }

      try {
        setStatus(tr('Сохраняю перед активацией...', 'Saving before activation...'));
        await doSaveMap();
        const res = await fetch('/__set_active_map', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: file })
        });
        if (res.ok) {
          lastActivatedMapFile = file;
          localStorage.setItem(LAST_MAP_KEY, `assets/maps/${file}`);
          setStatus(tr(`Активировано: ${file} > active-map.json`, `Activated: ${file} > active-map.json`));
        } else {
          const txt = await res.text();
          setStatus(tr(`Ошибка активации: ${txt}`, `Activation error: ${txt}`));
        }
      } catch (e) {
        setStatus(tr(`Ошибка активации: ${e.message}`, `Activation error: ${e.message}`));
      }
    }

    function buildCatalog(mapRefs,existingRefs){
      const normalizedExisting=existingRefs.map(normalizeRef).filter(Boolean);
      const existingSet=new Set(normalizedExisting);
      const kept=[]; const seen=new Set(); const remap=new Map();
      let dropped=0;
      for(let i=0;i<mapRefs.length;i++){
        const oldId=i+1;
        const n=normalizeRef(mapRefs[i]);
        if(!n || (existingSet.size>0 && !existingSet.has(n))){
          remap.set(oldId,0);
          dropped++;
          continue;
        }
        if(seen.has(n)){
          remap.set(oldId,kept.indexOf(n)+1);
          continue;
        }
        kept.push(n);
        seen.add(n);
        remap.set(oldId,kept.length);
      }
      for(const n of normalizedExisting){
        if(seen.has(n)) continue;
        kept.push(n);
        seen.add(n);
      }
      if(kept.length===0) kept.push('assets/tilesets/ground_stone1.png');
      return { tiles: kept, remap, dropped };
    }

    function remapLayerIds(flat, remap, maxId){
      if(!Array.isArray(flat)) return [];
      const out=new Array(flat.length);
      for(let i=0;i<flat.length;i++){
        const oldId=typeof flat[i]==='number' ? (flat[i]|0) : 0;
        if(oldId<=0){ out[i]=0; continue; }
        if(remap.has(oldId)){ out[i]=remap.get(oldId)||0; continue; }
        out[i]=oldId<=maxId ? oldId : 0;
      }
      return out;
    }

    function mergeCatalog(mapRefs,extraRefs){
      const base=mapRefs.map(normalizeRef).filter(Boolean);
      const out=[]; const seen=new Set();
      for(const ref of base){ if(!seen.has(ref)){ seen.add(ref); out.push(ref); } }
      for(const ref of extraRefs){
        const n=normalizeRef(ref);
        if(!n||seen.has(n)) continue;
        seen.add(n);
        out.push(n);
      }
      tileRefs=out.length?out:['assets/tilesets/ground_stone1.png'];
      assetCatalog.tiles=tileRefs.slice();
      if(!selectedAsset.tiles&&tileRefs.length>0) selectedAsset.tiles=tileRefs[0];
      assetsInfoEl.textContent=`${tr('плиток','tiles')}: ${tileRefs.length}`;
      for(const ref of tileRefs)ensureImage(ref);
      renderTiles();
    }
    function hitTestEntity(list,sx,sy){
      for(let i=list.length-1;i>=0;i--){
        const e=list[i];
        const box=getEntityScreenBox(e);
        if(sx>=box.left&&sx<=box.left+box.width&&sy>=box.top&&sy<=box.top+box.height) return e;
      }
      return null;
    }
    function hitTestCorner(e,sx,sy){
      const box=getEntityScreenBox(e);
      const corners=[['tl',box.left,box.top],['tr',box.left+box.width,box.top],['bl',box.left,box.top+box.height],['br',box.left+box.width,box.top+box.height]];
      for(const[name,hx,hy]of corners){
        const dx=sx-hx,dy=sy-hy;
        if(dx*dx+dy*dy<=HANDLE_R*HANDLE_R*2.5) return name;
      }
      return null;
    }
    function syncEntitySizeBar(){
      const isEntity=currentCatalog!=='tiles';
      document.getElementById('entity-size-bar').style.display=isEntity?'':'none';
      const tw=selectedEntity?selectedEntity.tilesW:placeTilesW;
      const th=selectedEntity?selectedEntity.tilesH:placeTilesH;
      document.getElementById('tw-val').textContent=tw;
      document.getElementById('th-val').textContent=th;
      const lbl=selectedEntity?'Размер выбранного объекта':'Размер (тайлы) — новые объекты';
      document.getElementById('size-bar-label').textContent=lbl;
      document.getElementById('deselect-entity').style.display=selectedEntity?'':'none';
    }
    function adjustTileSize(axis,delta){
      if(selectedEntity){
        if(axis==='w') selectedEntity.tilesW=Math.max(1,selectedEntity.tilesW+delta);
        else selectedEntity.tilesH=Math.max(1,selectedEntity.tilesH+delta);
      } else {
        if(axis==='w') placeTilesW=Math.max(1,placeTilesW+delta);
        else placeTilesH=Math.max(1,placeTilesH+delta);
      }
      syncEntitySizeBar();draw();
    }
    function renderThumb(cnv,ref){const c=cnv.getContext('2d');c.clearRect(0,0,cnv.width,cnv.height);const cx=cnv.width/2,cy=cnv.height/2,hw=22,hh=12;c.beginPath();c.moveTo(cx,cy-hh);c.lineTo(cx+hw,cy);c.lineTo(cx,cy+hh);c.lineTo(cx-hw,cy);c.closePath();c.save();c.clip();const e=ensureImage(ref);if(e&&e.ready){const _i=e.img;const frame=getAtlasPreviewFrame(_i);c.drawImage(_i,frame.sx,frame.sy,frame.sw,frame.sh,cx-hw,cy-hh,hw*2,hh*2);}else{c.fillStyle='#2a476f';c.fillRect(cx-hw,cy-hh,hw*2,hh*2);}c.restore();c.strokeStyle='rgba(86,143,220,.9)';c.lineWidth=1;c.stroke();}
    function renderTiles(){
      const q=(tileSearchEl.value||'').trim().toLowerCase();
      tileListEl.innerHTML='';
      const assets=getActiveAssets();
      const selected=currentCatalog==='tiles' ? (selectedTileByLayer[currentLayer]||1) : (selectedAsset[currentCatalog]||'');
      for(let i=0;i<assets.length;i++){
        const ref=assets[i];
        const gid=i+1;
        const label=refName(ref);
        const text=`${label} ${ref}`.toLowerCase();
        if(q&&!text.includes(q)) continue;
        const item=document.createElement('button');
        item.type='button';
        const isActive=currentCatalog==='tiles' ? (gid===selected) : (ref===selected);
        const isExplicit=currentCatalog==='tiles' && isActive && !!tileExplicitlySelected[currentLayer];
        item.className='tile-item'+(isActive?' active':'')+(isExplicit?' tile-selected':'');
        const th=document.createElement('div');
        th.className='tile-thumb';
        const cn=document.createElement('canvas');
        cn.width=48; cn.height=28;
        renderThumb(cn,ref);
        th.appendChild(cn);
        const md=document.createElement('div');
        md.className='tile-meta';
        md.innerHTML=`<div class=\"tile-name\">${label}</div><div class=\"tile-id\">${currentCatalog==='tiles'?'gid: '+gid:currentCatalog}</div>`;
        item.appendChild(th);
        item.appendChild(md);
        item.addEventListener('click',()=>{
          if(currentCatalog==='tiles'){
            selectedTileByLayer[currentLayer]=gid;
            tileExplicitlySelected[currentLayer]=true;
            selectedInfoEl.textContent=`${tr('выбрано gid','selected gid')}: ${gid}`;
          }else{
            selectedAsset[currentCatalog]=ref;
            selectedInfoEl.textContent=`${tr('выбрано','selected')}: ${label}`;
          }
          renderTiles();
        });
        tileListEl.appendChild(item);
      }
      if(currentCatalog==='tiles'){
        if(MASK_LAYERS.has(currentLayer)) selectedInfoEl.textContent=I18N[currentLang].selectedMask;
        else selectedInfoEl.textContent=`${tr('выбрано gid','selected gid')}: ${selectedTileByLayer[currentLayer]||1}`;
      }else{
        const selectedLabel=selectedAsset[currentCatalog]?refName(selectedAsset[currentCatalog]):'-';
        selectedInfoEl.textContent=`${tr('выбрано','selected')}: ${selectedLabel}`;
      }
    }

    function worldForTile(col,row){
      const w=tileToWorld(col,row);
      return { x:w.x, y:w.y, col, row };
    }
    function snapEntityToTile(entity){
      if(!entity) return;
      const t=worldToTile(Number(entity.x)||0,Number(entity.y)||0);
      const w=tileToWorld(t.col,t.row);
      entity.x=w.x;
      entity.y=w.y;
      entity.col=t.col;
      entity.row=t.row;
    }

    function getEntityDefaults(kind){
      if(kind==='buildings') return { w:128,h:128,ax:0.5,ay:1 };
      if(kind==='objects') return { w:64,h:64,ax:0.5,ay:1 };
      return { w:64,h:64,ax:0.5,ay:0.5 };
    }
    function buildingScale(zoom){
      return Math.max(0.1,zoom);
    }
    function isAttackTowerAsset(ref){
      return normalizeRef(ref).toLowerCase()===ATTACK_TOWER_ASSET;
    }
    function getEntityScreenBox(e){
      if(isAttackTowerAsset(e.asset)){
        const s=worldToScreen(e.x,e.y);
        const scale=buildingScale(cz);
        const baseX=s.x+ATTACK_TOWER_RENDER_TUNING.tileOffsetX*scale;
        const baseY=s.y+ATTACK_TOWER_RENDER_TUNING.tileOffsetY*scale;
        const drawH=ATTACK_TOWER_RENDER_TUNING.drawHeight*scale;
        const drawW=drawH*(ATTACK_TOWER_SPRITE_TRIM.sw/ATTACK_TOWER_SPRITE_TRIM.sh)*ATTACK_TOWER_RENDER_TUNING.drawWidthScale;
        const anchorX=(ATTACK_TOWER_RENDER_TUNING.anchorX/ATTACK_TOWER_SPRITE_TRIM.sw)*drawW;
        const anchorY=(ATTACK_TOWER_RENDER_TUNING.anchorY/ATTACK_TOWER_SPRITE_TRIM.sh)*drawH;
        return {left:baseX-anchorX,top:baseY-anchorY,width:drawW,height:drawH,baseX,baseY,kind:'attack-tower'};
      }
      const s=worldToScreen(e.x,e.y);
      const tw=e.tilesW||1,th=e.tilesH||1;
      const drawW=tw*TW*cz,drawH=th*TW*cz;
      return {left:s.x-drawW/2,top:s.y-drawH,width:drawW,height:drawH,baseX:s.x,baseY:s.y,kind:'default'};
    }

    function placeEntityAt(wx,wy,col,row){
      const list=getActiveEntityList();
      if(paintMode==='erase'){
        for(let i=list.length-1;i>=0;i--){
          const e=list[i];const s=worldToScreen(e.x,e.y);
          const dw=(e.tilesW||1)*TW*cz,dh=(e.tilesH||1)*TW*cz;
          const sx=worldToScreen(wx,wy).x,sy=worldToScreen(wx,wy).y;
          if(sx>=s.x-dw/2&&sx<=s.x+dw/2&&sy>=s.y-dh&&sy<=s.y){list.splice(i,1);break;}
        }
        draw();return;
      }
      const ref=selectedAsset[currentCatalog];
      if(!ref){setStatus(tr('Выбери ассет во вкладке','Select an asset in current tab'));return;}
      if(currentCatalog==='buildings'&&/citadel|цитад/i.test(ref)){
        for(let i=list.length-1;i>=0;i--) if(/citadel|цитад/i.test(list[i].asset||'')) list.splice(i,1);
      }
      const d=getEntityDefaults(currentCatalog);
      list.push({
        id:Date.now()+Math.random(),
        asset:ref,
        name:refName(ref).replace(/\.[a-z0-9]+$/i,''),
        x:wx,y:wy,col,row,
        w:d.w,h:d.h,ax:d.ax,ay:d.ay,rot:0,
        tilesW:placeTilesW,tilesH:placeTilesH
      });
      draw();
    }
    function placeEntity(col,row){
      const list=getActiveEntityList();
      if(list.length===0 && currentCatalog==='tiles') return;
      if(paintMode==='erase'){
        for(let i=list.length-1;i>=0;i--){
          if(list[i].col===col && list[i].row===row){ list.splice(i,1); break; }
        }
        draw();
        return;
      }
      const ref=selectedAsset[currentCatalog];
      if(!ref){ setStatus(tr('Выбери ассет во вкладке','Select an asset in current tab')); return; }
      if(currentCatalog==='buildings' && /citadel|цитад/i.test(ref)) {
        for(let i=list.length-1;i>=0;i--) if(/citadel|цитад/i.test(list[i].asset||'')) list.splice(i,1);
      }
      const p=worldForTile(col,row);
      const d=getEntityDefaults(currentCatalog);
      list.push({
        id:Date.now()+Math.random(),
        asset:ref,
        name:refName(ref).replace(/\.[a-z0-9]+$/i,''),
        x:p.x,
        y:p.y,
        col:p.col,
        row:p.row,
        w:d.w,
        h:d.h,
        ax:d.ax,
        ay:d.ay,
        rot:0,
        tilesW:placeTilesW,
        tilesH:placeTilesH
      });
      draw();
    }
    function clearLayer(name){for(let r=0;r<MH;r++)for(let c=0;c<MW;c++)layers[name][r][c]=0;}
    function paint(col,row){
      if(col<0||row<0||col>=MW||row>=MH) return;
      if(currentCatalog!=='tiles'){ placeEntity(col,row); return; }
      // SAFETY GUARD: prevent painting when no tile explicitly selected
      // Exception: mask layers (paths, zones, citadel, spawn) don't need tile selection
      // Exception: erase mode always allowed
      if(paintMode==='paint' && !MASK_LAYERS.has(currentLayer) && !tileExplicitlySelected[currentLayer]) return;
      const layer=layers[currentLayer];
      const val=paintMode==='erase'?0:(MASK_LAYERS.has(currentLayer)?1:(selectedTileByLayer[currentLayer]||1));
      if(val>0&&(currentLayer==='spawn'||currentLayer==='citadel')) clearLayer(currentLayer);
      const radius=Math.floor(brushSize/2),start=-radius,end=brushSize-radius-1;
      for(let dr=start;dr<=end;dr++) for(let dc=start;dc<=end;dc++){
        const rr=row+dr,cc=col+dc;
        if(rr<0||cc<0||rr>=MH||cc>=MW) continue;
        layer[rr][cc]=val;
      }
      draw();
    }

    function normalizeAssetList(raw){
      return raw
        .map((e)=>Array.isArray(e)?e[1]:e)
        .filter((v)=>typeof v==='string')
        .map((v)=>normalizeRef(v));
    }

    function findAssetByFileName(fileName,list,fallbackPrefix){
      const low=String(fileName||'').toLowerCase();
      for(const ref of list){
        if(refName(ref).toLowerCase()===low) return ref;
      }
      return normalizeRef(`${fallbackPrefix}/${fileName}`);
    }

    function fallbackAssetPrefixes(kind){
      if(kind==='buildings') return ['assets/build','assets/structures','assets/maps'];
      if(kind==='objects') return ['assets/objects'];
      if(kind==='graphics') return ['assets/graphics','assets/Graphics','assets/ball'];
      return [`assets/${kind}`];
    }

    function resolveEntityAsset(fileName,list,kind){
      const safeName=String(fileName||'').trim();
      if(!safeName) return findAssetByFileName('citadel.png',list,'assets/maps');
      for(const prefix of fallbackAssetPrefixes(kind)){
        const asset=findAssetByFileName(safeName,list,prefix);
        if(asset) return asset;
      }
      return normalizeRef(safeName);
    }

    function parseEntitySet(items,templates,kind,entitiesSpace){
      const useGameSpace=entitiesSpace==='game';
      if(!Array.isArray(items)) return [];
      const list=(assetCatalog[kind]||[]);
      const byTemplate=new Map();
      if(Array.isArray(templates)){
        for(const t of templates){
          if(!t||typeof t!=='object') continue;
          const fileName=String(t.fileName||t.template||t.name||'').trim();
          const assetRef=normalizeRef(t.asset||'');
          const resolved=assetRef||resolveEntityAsset(fileName,list,kind);
          if(fileName) byTemplate.set(fileName,resolved);
          if(t.name) byTemplate.set(String(t.name),resolved);
        }
      }
      return items
        .filter((e)=>e&&typeof e==='object')
        .map((e)=>{
          const fileName=String(e.template||e.fileName||e.name||'').trim();
          const assetRef=normalizeRef(e.asset||'');
          const asset=assetRef||byTemplate.get(fileName)||resolveEntityAsset(fileName||'citadel.png',list,kind);
          const defaults=getEntityDefaults(kind);
          const xRaw=Number(e.x)||0;
          const yRaw=Number(e.y)||0;
          return {
            id:Date.now()+Math.random(),
            asset,
            name:String(e.name||baseNameNoExt(asset)),
            x:useGameSpace?fromGameX(xRaw):xRaw,
            y:useGameSpace?fromGameY(yRaw):yRaw,
            col:typeof e.col==='number'?e.col:null,
            row:typeof e.row==='number'?e.row:null,
            w:Number(e.w)||defaults.w,
            h:Number(e.h)||defaults.h,
            ax:typeof e.ax==='number'?e.ax:defaults.ax,
            ay:typeof e.ay==='number'?e.ay:defaults.ay,
            rot:Number(e.rot)||0,
            tilesW:Number(e.tilesW)||1,
            tilesH:Number(e.tilesH)||1,
          };
        });
    }

    async function applyMap(data){
      MW=Number(data.width)||MW;MH=Number(data.height)||MH;TW=Number(data.tileWidth)||TW;TH=Number(data.tileHeight)||TH;
      document.getElementById('iw').value=String(MW);document.getElementById('ih').value=String(MH);document.getElementById('itw').value=String(TW);document.getElementById('ith').value=String(TH);
      const cam=(data.camera&&typeof data.camera==='object')?data.camera:{};
      const scene=(data.scene&&typeof data.scene==='object')?data.scene:{};
      setStartPickMode(false);
      camBoundsSource='layers';
      camBoundsPad=120;
      const editorSpace=typeof cam.editorSpace==='string'?cam.editorSpace:'legacy-offset';
      if(typeof cam.x==='number'&&typeof cam.y==='number'){
        if(editorSpace==='center-world'){
          setEditorCamCenter(cam.x,cam.y);
        }else{
          const oldEditorSpace=editorSpace!=='game';
          const legacyCx=oldEditorSpace?cam.x-ISO_LAYER_X:cam.x;
          const legacyCy=oldEditorSpace?cam.y-ISO_LAYER_Y:cam.y;
          setEditorCamCenter(-legacyCx,-legacyCy);
        }
      }
      if(typeof cam.editorZoom==='number')cz=Math.max(.1,Math.min(8,cam.editorZoom));if(typeof cam.zoom==='number')gameZoom=Math.max(.1,Math.min(8,cam.zoom));
      const usesGameSpace=cam.space==='game'||cam.space==='world';
      camLockCenter=!!cam.lockCenter;
      const mc=mapCenter();
      const sceneRailAnchor=(scene.railAnchor&&typeof scene.railAnchor==='object')?scene.railAnchor:null;
      const sceneCitadel=(scene.citadel&&typeof scene.citadel==='object')?scene.citadel:null;
      camCenterX=(sceneRailAnchor&&typeof sceneRailAnchor.x==='number')?fromGameX(sceneRailAnchor.x):(typeof cam.centerX==='number'?(usesGameSpace?fromGameX(cam.centerX):cam.centerX):mc.x);
      camCenterY=(sceneRailAnchor&&typeof sceneRailAnchor.y==='number')?fromGameY(sceneRailAnchor.y):(typeof cam.centerY==='number'?(usesGameSpace?fromGameY(cam.centerY):cam.centerY):mc.y);
      camStartX=typeof cam.startX==='number'?(usesGameSpace?fromGameX(cam.startX):cam.startX):camCenterX;
      camStartY=typeof cam.startY==='number'?(usesGameSpace?fromGameY(cam.startY):cam.startY):camCenterY;
      camMoveMode=typeof cam.moveMode==='string'?cam.moveMode:'road-both';
      camRoadDir=typeof cam.roadDirection==='string'?cam.roadDirection:(typeof scene.primaryDirection==='string'?scene.primaryDirection:'east');
      camRoadOffsetY=(typeof cam.roadViewOffsetY==='number'&&Number.isFinite(cam.roadViewOffsetY))?cam.roadViewOffsetY:ROAD_VIEW_EXTRA_OFFSET_Y;
      camIsoClamp=!!cam.isoClamp;
      if(cam.boundsSource==='map'||cam.boundsSource==='layers'||cam.boundsSource==='none') camBoundsSource=cam.boundsSource;
      else if(cam.boundsMode==='map'||cam.boundsMode==='layers') camBoundsSource=cam.boundsMode;
      if(typeof cam.boundsPad==='number'&&Number.isFinite(cam.boundsPad)) camBoundsPad=Math.max(0,Math.min(600,cam.boundsPad));
      else if(typeof cam.boundsPadding==='number'&&Number.isFinite(cam.boundsPadding)) camBoundsPad=Math.max(0,Math.min(600,cam.boundsPadding));
      const hasIsoBounds=Number.isFinite(cam.boundsMinA);
      const hasAabbBounds=Number.isFinite(cam.boundsMinX)&&Number.isFinite(cam.boundsMaxX)&&Number.isFinite(cam.boundsMinY)&&Number.isFinite(cam.boundsMaxY);
      if(hasIsoBounds){
        camBoundsEnabled=true;
        camBoundsMinA=cam.boundsMinA;camBoundsMaxA=cam.boundsMaxA;
        camBoundsMinB=cam.boundsMinB;camBoundsMaxB=cam.boundsMaxB;
      }else if(hasAabbBounds){
        camBoundsEnabled=true;
        const ref=computeIsoDiamondBoundsFromMap();
        if(ref){
          const l=usesGameSpace?fromGameX(cam.boundsMinX):cam.boundsMinX;
          const r=usesGameSpace?fromGameX(cam.boundsMaxX):cam.boundsMaxX;
          const t=usesGameSpace?fromGameY(cam.boundsMinY):cam.boundsMinY;
          const b=usesGameSpace?fromGameY(cam.boundsMaxY):cam.boundsMaxY;
          let minA=Infinity,maxA=-Infinity,minB=Infinity,maxB=-Infinity;
          for(const p of [{x:l,y:t},{x:r,y:t},{x:r,y:b},{x:l,y:b}]){
            const iso=worldToIsoAB(p.x,p.y,ref);
            if(iso.a<minA)minA=iso.a;if(iso.a>maxA)maxA=iso.a;
            if(iso.b<minB)minB=iso.b;if(iso.b>maxB)maxB=iso.b;
          }
          camBoundsMinA=minA;camBoundsMaxA=maxA;camBoundsMinB=minB;camBoundsMaxB=maxB;
        }
      }else{
        camBoundsEnabled=false;
      }
      const mapTiles=Array.isArray(data.tiles)?data.tiles.filter((v)=>typeof v==='string'):[];
      const catalog=buildCatalog(mapTiles,autoTiles);
      mergeCatalog(catalog.tiles,[]);
      initLayers();
      const src=(data.layers&&typeof data.layers==='object')?data.layers:{};
      for(const l of LAYERS){
        if(!src[l]) continue;
        layers[l]=unflatten(remapLayerIds(src[l],catalog.remap,tileRefs.length));
      }
      // Safety: ensure map layers are visible after load.
      Object.keys(layerVisible).forEach((k)=>{ layerVisible[k]=true; });
      document.querySelectorAll('[data-vis]').forEach((el)=>{ el.checked=true; });
      const entitiesSpace=typeof data.entitiesSpace==='string'?data.entitiesSpace:'editor';
      placedBuildings=parseEntitySet(Array.isArray(data.buildings)?data.buildings:[],Array.isArray(data.buildingTemplates)?data.buildingTemplates:[],'buildings',entitiesSpace);
      placedObjects=parseEntitySet(Array.isArray(data.obstacles)?data.obstacles:[],Array.isArray(data.obstacleTemplates)?data.obstacleTemplates:[],'objects',entitiesSpace);
      placedGraphics=parseEntitySet(Array.isArray(data.graphics)?data.graphics:[],Array.isArray(data.graphicTemplates)?data.graphicTemplates:[],'graphics',entitiesSpace);
      if(sceneCitadel&&typeof sceneCitadel.x==='number'&&typeof sceneCitadel.y==='number'){
        const cx=fromGameX(sceneCitadel.x);
        const cy=fromGameY(sceneCitadel.y);
        const citadelItem=findCitadelBuildingItem(placedBuildings);
        if(citadelItem){
          citadelItem.x=cx;
          citadelItem.y=cy;
        }else{
          placedBuildings.push({
            id:Date.now()+Math.random(),
            asset:'assets/maps/citadel.png',
            name:'Citadel',
            x:cx,
            y:cy,
            col:null,
            row:null,
            w:128,
            h:128,
            ax:0.5,
            ay:1,
            rot:0
          });
        }
      }
      ensureTileCatalogForMap();
      gamePanelOpen=false;
      gameCamMode=false;
      syncCamForm();
      // Reset tile explicit selection state on new map load
      Object.keys(tileExplicitlySelected).forEach(k => delete tileExplicitlySelected[k]);
      fitMapToView();
      if(catalog.dropped>0){
        setStatus(tr(`Карта загружена, пропущено отсутствующих плиток: ${catalog.dropped}`,`Map loaded, missing tiles skipped: ${catalog.dropped}`));
      }
    }

      async function fetchJsonNoCache(path){
        const res=await fetch(path+'?v='+Date.now());
        if(!res.ok) throw new Error(`fetch failed: ${path}`);
        return res.json();
      }

      async function applyLoadedMap(data,path,label){
        await applyMap(data);
        const base=(label||path.split('/').pop()||'').replace(/^\//,'');
        lastLoadedMapFile=base||'active-map.json';
        lastLoadedMapPath=path;
        document.getElementById('map-name').value=lastLoadedMapFile.replace(/\.json$/i,'');
        updateDropdownMarkers();
        const _lss=document.getElementById('map-preset');
        if(Array.from(_lss.options).some(o=>o.value===path))_lss.value=path;
        localStorage.setItem(LAST_MAP_KEY,path);
      }

      async function resolveActiveMapSource(){
        const activePath='/assets/maps/active-map.json';
        const activeData=await fetchJsonNoCache(activePath);
        const sourceFile=String(activeData&&activeData._editorSourceMap||'').trim().replace(/^\/+/,'');
        if(sourceFile && sourceFile.toLowerCase()!=='active-map.json'){
          return {
            data:activeData,
            path:`/assets/maps/${sourceFile}`,
            label:sourceFile,
            source:'active-snapshot'
          };
        }
        return {data:activeData,path:activePath,label:'active-map.json',source:'active-snapshot'};
      }

      async function loadActive(){
        try{
          const resolved=await resolveActiveMapSource();
          await applyLoadedMap(resolved.data,resolved.path,resolved.label);
          lastActivatedMapFile=(resolved.label&&resolved.label.toLowerCase()!=='active-map.json')?resolved.label:'';
          setStatus(tr(`Загружен ${lastLoadedMapFile}`,`Loaded ${lastLoadedMapFile}`));
        }
        catch{
          const last=localStorage.getItem(LAST_MAP_KEY);
          if(last){
            try{
              const d=await fetchJsonNoCache(last);
              await applyLoadedMap(d,last,last.split('/').pop());
              setStatus(tr(`Загружена ${lastLoadedMapFile}`,`Loaded ${lastLoadedMapFile}`));
              return;
            }catch{
              localStorage.removeItem(LAST_MAP_KEY);
            }
          }
          const saved=localStorage.getItem('valkyrix-map-autosave');
          if(saved){
            try{
              const autosave=JSON.parse(saved);
              if(autosave&&autosave.camera&&autosave.camera.editorSpace==='center-world'){
                await applyMap(autosave);
                setStatus(tr('Загружен автосейв','Loaded autosave'));
                return;
              }
              localStorage.removeItem('valkyrix-map-autosave');
            }catch{
              localStorage.removeItem('valkyrix-map-autosave');
            }
          }
          setStatus(tr('active-map.json не найден, загружены значения по умолчанию','No active-map.json, defaults loaded'));
        }
      }

      async function loadLastSelectedOrActive(){
        await loadActive();
      }

    async function loadAssets(){
      try{
        const payload=await fetch('/__editor_assets?v='+Date.now()).then((r)=>r.json());
        const tiles=Array.isArray(payload.tiles)?payload.tiles:[];
        const structures=Array.isArray(payload.structures)?payload.structures:[];
        const objects=Array.isArray(payload.objects)?payload.objects:[];
        const graphics=Array.isArray(payload.graphics)?payload.graphics:[];
        autoTiles=normalizeAssetList(tiles);
        assetCatalog.tiles=autoTiles.slice();
        assetCatalog.buildings=normalizeAssetList(structures);
        assetCatalog.objects=normalizeAssetList(objects);
        assetCatalog.graphics=normalizeAssetList(graphics);
        if(assetCatalog.buildings.every((r)=>!/citadel\.png$/i.test(r))){
          assetCatalog.buildings.unshift('assets/maps/citadel.png');
        }
        if(!selectedAsset.buildings && assetCatalog.buildings.length>0) selectedAsset.buildings=assetCatalog.buildings[0];
        if(!selectedAsset.objects && assetCatalog.objects.length>0) selectedAsset.objects=assetCatalog.objects[0];
        if(!selectedAsset.graphics && assetCatalog.graphics.length>0) selectedAsset.graphics=assetCatalog.graphics[0];
        const maps=Array.isArray(payload.maps)?payload.maps:[];
        const mapPathsAll=maps.map((e)=>Array.isArray(e)?e[1]:e).filter((v)=>typeof v==='string').map((v)=>v.startsWith('/')?v:('/'+v.replace(/^\/+/,'')));
        const mapPaths=mapPathsAll.filter((v)=>!v.includes('active-map'));
        const sel=document.getElementById('map-preset'),old=sel.value;sel.innerHTML=`<option value="">${I18N[currentLang].mapFile}</option>`;
        for(const path of mapPaths){const o=document.createElement('option');o.value=path;o.textContent=path.split('/').pop();sel.appendChild(o);}
        const saved=localStorage.getItem(LAST_MAP_KEY)||'';
        const _rv=old||saved||lastLoadedMapPath;
        if(mapPaths.includes(_rv)) sel.value=_rv;
        else if(saved && !mapPaths.includes(saved)) localStorage.removeItem(LAST_MAP_KEY);
        updateDropdownMarkers();
      mergeCatalog(tileRefs.length?tileRefs:['assets/tilesets/ground_stone1.png'],autoTiles);
        setStatus(tr(`Ассеты загружены: плиток ${autoTiles.length}, зданий ${assetCatalog.buildings.length}, объектов ${assetCatalog.objects.length}, графики ${assetCatalog.graphics.length}`,`Assets loaded: tiles ${autoTiles.length}, buildings ${assetCatalog.buildings.length}, objects ${assetCatalog.objects.length}, graphics ${assetCatalog.graphics.length}`));
      }catch{setStatus(tr('Не удалось получить /__editor_assets','Cannot fetch /__editor_assets'));}
    }

    function syncTop(){
      currentLayer=document.getElementById('layer-sel').value;
      brushSize=Math.max(1,Number(document.getElementById('brush-size').value)||1);
      paintMode=document.getElementById('paint-mode').value;
      showGrid=!!document.getElementById('show-grid').checked;
      const isMask=currentCatalog==='tiles' && MASK_LAYERS.has(currentLayer);
      tileListEl.style.opacity=isMask?'0.45':'1';
      tileListEl.style.pointerEvents=isMask?'none':'auto';
      const t=I18N[currentLang];
      const title=getCatalogTitle(currentCatalog);
      document.getElementById('title-left').textContent=title;
      document.querySelectorAll('#asset-tabs .tab-btn').forEach((b)=>b.classList.toggle('active',b.getAttribute('data-tab')===currentCatalog));
      if(currentCatalog==='tiles'){
        selectedInfoEl.textContent=isMask?t.selectedMask:`${tr('выбрано gid','selected gid')}: ${selectedTileByLayer[currentLayer]||1}`;
        if(isMask)setStatus(t.modeMask.replace('{layer}',currentLayer));
      }else{
        const kind=t.catTitle[currentCatalog]||currentCatalog;
        selectedInfoEl.textContent=`${tr('выбрано','selected')}: ${selectedAsset[currentCatalog]?refName(selectedAsset[currentCatalog]):'-'}`;
        setStatus(t.placeHint.replace('{kind}',kind));
      }
      renderTiles();
      draw();
    }

    function bind(){
      document.getElementById('btn-new').addEventListener('click',()=>{
        MW=Math.max(10,Number(document.getElementById('iw').value)||MW);
        MH=Math.max(10,Number(document.getElementById('ih').value)||MH);
        TW=Math.max(16,Number(document.getElementById('itw').value)||TW);
        TH=Math.max(8,Number(document.getElementById('ith').value)||TH);
        initLayers();
        // Camera defaults вЂ” match documented optimal settings
        gameZoom=1.948;
        camMoveMode='road-both';
        camRoadDir='east';
        camIsoClamp=false;
        camBoundsSource='map';
        camBoundsPad=0;
        boundsEditMode=false;
        // Start at map center
        const mc=mapCenter();
        camCenterX=mc.x; camCenterY=mc.y;
        camStartX=mc.x; camStartY=mc.y;
        // Auto-calculate scroll bounds from map AABB using same formula as game
        camBoundsEnabled=false;
        ensureCustomBoundsFromAuto();
        syncCamForm();
        syncBoundsUI();
        fitMapToView();
        setStatus(tr(`Новая карта ${MW}x${MH} — камера настроена автоматически`,`New map ${MW}x${MH} — camera auto-configured`));
      });
      document.getElementById('btn-save').addEventListener('click',showPresaveModal);
      document.getElementById('btn-load-active').addEventListener('click',loadActive);
      document.getElementById('btn-load-assets').addEventListener('click',loadAssets);
      document.getElementById('map-preset').addEventListener('change',async(e)=>{const v=e.target.value;if(!v)return;try{const d=await fetch(v+'?v='+Date.now()).then((r)=>r.json());await applyMap(d);const base=v.split('/').pop();lastLoadedMapFile=base;lastLoadedMapPath=v;document.getElementById('map-name').value=base.replace(/\.json$/i,'');localStorage.setItem(LAST_MAP_KEY,v);updateDropdownMarkers();setStatus(tr(`Загружена ${base}`, `Loaded ${base}`));}catch{setStatus(tr('Не удалось загрузить карту','Map load failed'));}});
      document.querySelectorAll('#asset-tabs .tab-btn').forEach((btn)=>btn.addEventListener('click',(ev)=>{
        const tab=ev.currentTarget.getAttribute('data-tab');
        if(!tab||!assetCatalog.hasOwnProperty(tab)) return;
        currentCatalog=tab;
        selectedEntity=null;
        document.querySelectorAll('#asset-tabs .tab-btn').forEach((b)=>b.classList.toggle('active',b===ev.currentTarget));
        syncTop();syncEntitySizeBar();
      }));
      document.getElementById('tw-minus').addEventListener('click',()=>adjustTileSize('w',-1));
      document.getElementById('tw-plus').addEventListener('click',()=>adjustTileSize('w',1));
      document.getElementById('th-minus').addEventListener('click',()=>adjustTileSize('h',-1));
      document.getElementById('th-plus').addEventListener('click',()=>adjustTileSize('h',1));
      document.getElementById('deselect-entity').addEventListener('click',()=>{selectedEntity=null;syncEntitySizeBar();draw();});
      document.getElementById('layer-sel').addEventListener('change',syncTop);
      document.getElementById('brush-size').addEventListener('change',syncTop);
      document.getElementById('paint-mode').addEventListener('change',syncTop);
      document.getElementById('show-grid').addEventListener('change',syncTop);
      tileSearchEl.addEventListener('input',renderTiles);
      document.getElementById('btn-sz').addEventListener('click',()=>{MW=Math.max(10,Number(document.getElementById('iw').value)||MW);MH=Math.max(10,Number(document.getElementById('ih').value)||MH);TW=Math.max(16,Number(document.getElementById('itw').value)||TW);TH=Math.max(8,Number(document.getElementById('ith').value)||TH);initLayers();const mc=mapCenter();camCenterX=mc.x;camCenterY=mc.y;camBoundsEnabled=false;ensureCustomBoundsFromAuto();syncCamForm();syncBoundsUI();fitMapToView();setStatus(tr(`Размер карты ${MW}x${MH} — bounds пересчитаны`,`Map resized ${MW}x${MH} — bounds recalculated`));});
      document.querySelectorAll('[data-vis]').forEach((el)=>el.addEventListener('change',(e)=>{layerVisible[e.target.getAttribute('data-vis')]=!!e.target.checked;draw();}));
      ['game-zoom','cam-start-x','cam-start-y','cam-move-mode','cam-road-dir','road-offset-y','bounds-pad','iso-clamp'].forEach((id)=>document.getElementById(id).addEventListener('change',readCamForm));
      document.getElementById('road-offset-y').addEventListener('input',readCamForm);
      document.getElementById('btn-road-offset-up').addEventListener('click',()=>adjustRoadOffset(4,'btn'));
      document.getElementById('btn-road-offset-down').addEventListener('click',()=>adjustRoadOffset(-4,'btn'));
      // Direct bounds input fields
      function applyBoundsInputs(){
        if(!camBoundsEnabled) return;
        const v=id=>Number(document.getElementById(id).value);
        const _l=v('bounds-minx'),_r=v('bounds-maxx'),_t=v('bounds-miny'),_b=v('bounds-maxy');
        if(Number.isFinite(_l)&&Number.isFinite(_r)&&Number.isFinite(_t)&&Number.isFinite(_b)){
          const _ref=computeIsoDiamondBoundsFromMap();
          if(_ref){
            let _minA=Infinity,_maxA=-Infinity,_minB=Infinity,_maxB=-Infinity;
            for(const p of [{x:_l,y:_t},{x:_r,y:_t},{x:_r,y:_b},{x:_l,y:_b}]){
              const _iso=worldToIsoAB(p.x,p.y,_ref);
              if(_iso.a<_minA)_minA=_iso.a;if(_iso.a>_maxA)_maxA=_iso.a;
              if(_iso.b<_minB)_minB=_iso.b;if(_iso.b>_maxB)_maxB=_iso.b;
            }
            camBoundsMinA=_minA;camBoundsMaxA=_maxA;camBoundsMinB=_minB;camBoundsMaxB=_maxB;
          }
        }
        draw(); localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));
      }
      ['bounds-minx','bounds-maxx','bounds-miny','bounds-maxy'].forEach(id=>document.getElementById(id).addEventListener('change',applyBoundsInputs));
      document.querySelectorAll('#bounds-source .seg-btn').forEach((btn)=>btn.addEventListener('click',()=>{
        const v=btn.getAttribute('data-bounds');
        if(!v) return;
        camBoundsSource=v;
        syncBoundsUI();
        draw();
        localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));
        setStatus(tr(`Источник bounds: ${v}`,`Bounds source: ${v}`));
      }));
      document.getElementById('bounds-custom').addEventListener('change',()=>{
        camBoundsEnabled=!!document.getElementById('bounds-custom').checked;
        if(camBoundsEnabled) ensureCustomBoundsFromAuto();
        else boundsEditMode=false;
        syncBoundsUI();
        draw();
        setStatus(camBoundsEnabled?tr('Custom bounds включены','Custom bounds enabled'):tr('Custom bounds отключены','Custom bounds disabled'));
      });
      document.getElementById('btn-bounds-edit').addEventListener('click',()=>{
        boundsEditMode=!boundsEditMode;
        if(boundsEditMode){
          ensureCustomBoundsFromAuto();
          camBoundsEnabled=true;
          setStatus(tr('Редактирование bounds: тяните края рамки','Edit bounds: drag rectangle edges'));
        }else{
          setStatus(tr('Редактирование bounds выключено','Edit bounds disabled'));
        }
        syncBoundsUI();
        draw();
      });
      document.getElementById('btn-bounds-clear').addEventListener('click',()=>{
        const iso=computeIsoDiamondBoundsFromMap();
        if(iso){
          camBoundsMinA=iso.minA;camBoundsMaxA=iso.maxA;
          camBoundsMinB=iso.minB;camBoundsMaxB=iso.maxB;
          camBoundsEnabled=true;
        } else {
          camBoundsEnabled=false;
        }
        syncBoundsUI();
        draw();
        localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));
        setStatus(tr('Bounds > края карты','Bounds > map edges'));
      });
      document.getElementById('btn-use-editor-zoom').addEventListener('click',()=>{
        const fit=estimateGameFitScale();
        gameZoom=Number((cz/Math.max(0.1,fit)).toFixed(3));
        syncCamForm();
        setStatus(tr(`зум игры=${gameZoom.toFixed(2)} (fit ${fit.toFixed(2)})`,`Game zoom=${gameZoom.toFixed(2)} (fit ${fit.toFixed(2)})`));
      });
      document.getElementById('btn-cam-from-view').addEventListener('click',()=>{setStartPickMode(!isPickingStart);setStatus(isPickingStart?tr('Кликни по карте, чтобы задать старт игры','Click on map to set game start'):tr('Выбор старта отменён','Start pick cancelled'));});
      document.getElementById('btn-cam-apply-start').addEventListener('click',()=>{readCamForm();setEditorCamCenter(camStartX,camStartY);draw();setStatus(tr('Переход к старту камеры','Moved to start camera'));});
      document.getElementById('btn-lang').addEventListener('click',()=>{applyLanguage(currentLang==='ru'?'en':'ru');});
      canvas.addEventListener('contextmenu',(e)=>e.preventDefault());
      canvas.addEventListener('mousedown',(e)=>{
        const p=eventToCanvasPos(e);
        if(gameViewMode && e.button===0){
          gameViewDrag=true;
          gvDragStartMx=p.x;
          gvDragStartMy=p.y;
          gvDragStartCamX=camStartX;
          gvDragStartCamY=camStartY;
          e.stopPropagation();
          return;
        }
        if(gameViewMode) return;
        const panIntent=e.button===1||e.button===2||(e.button===0&&e.altKey);
        if(isPickingStart && e.button===0){
          const p=eventToCanvasPos(e);
          const w=screenToWorld(p.x,p.y);
          const t=worldToTile(w.x,w.y);
          const snap=tileToWorld(t.col,t.row);
          camStartX=snap.x;camStartY=snap.y;
          syncCamForm();
          draw();
          setStartPickMode(false);
          setStatus(tr('Старт игры установлен','Game start set'));
          localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));
          return;
        }
        if(boundsEditMode && e.button===0){
          const p=eventToCanvasPos(e);
          const hit=beginBoundsDrag(p.x,p.y);
          if(hit){
            setStatus(tr('Редактирование bounds: тяните рамку','Edit bounds: drag rectangle'));
          }
          return;
        }
        if(panIntent){
          isPanning=true;panMouseX=p.x;panMouseY=p.y;panCamX=cx;panCamY=cy;canvas.style.cursor='grabbing';
          return;
        }
        if(e.button===0){
          const w=screenToWorld(p.x,p.y);
          const t=worldToTile(w.x,w.y);
          hoverCol=t.col;hoverRow=t.row;
          if(currentCatalog!=='tiles'){
            // 1. Corner resize handle (only if entity selected)
            if(selectedEntity){
              const corner=hitTestCorner(selectedEntity,p.x,p.y);
              if(corner){
                entityDragMode='resize-'+corner;
                entityDragStartMx=p.x;entityDragStartMy=p.y;
                entityDragStartTW=selectedEntity.tilesW||1;entityDragStartTH=selectedEntity.tilesH||1;
                return;
              }
            }
            // 2. Move entity body
            const list=getActiveEntityList();
            const hit=hitTestEntity(list,p.x,p.y);
            if(hit){
              selectedEntity=hit;entityDragMode='move';
              entityDragStartMx=p.x;entityDragStartMy=p.y;
              entityDragStartX=hit.x;entityDragStartY=hit.y;
              syncEntitySizeBar();draw();return;
            }
            // 3. Erase: delete clicked entity
            if(paintMode==='erase'){
              const del=hitTestEntity(list,p.x,p.y);
              if(del){
                const idx=list.indexOf(del);
                if(idx>=0) list.splice(idx,1);
                if(selectedEntity&&selectedEntity.id===del.id){selectedEntity=null;syncEntitySizeBar();}
                draw();
              }
              return;
            }
            // 4. Place new entity snapped to the selected tile center
            if(paintMode==='paint'){
              selectedEntity=null;syncEntitySizeBar();
              placeEntity(t.col,t.row);return;
            }
            return;
          }
          isPainting=true;
          paint(t.col,t.row);
        }
      });
      window.addEventListener('mousemove',(e)=>{
        const p=eventToCanvasPos(e);
        if(gameViewDrag){
          const dxWorld=(p.x-gvDragStartMx)/cz;
          const dyWorld=(p.y-gvDragStartMy)/cz;
          const viewW=GAME_W/Math.max(0.1,gameZoom);
          const viewH=GAME_VIEW_H/Math.max(0.1,gameZoom);
          const clamped=clampGameViewRectToMap(gvDragStartCamX+dxWorld,gvDragStartCamY+dyWorld,viewW,viewH);
          camStartX=clamped.x;
          camStartY=clamped.y;
          syncCamForm();
          draw();
          return;
        }
        const w=screenToWorld(p.x,p.y);
        const t=worldToTile(w.x,w.y);
        hoverCol=t.col;hoverRow=t.row;
        if(boundsDrag){
          updateBoundsDrag(p.x,p.y);
          return;
        }
        if(entityDragMode==='move'&&selectedEntity){
          selectedEntity.x=entityDragStartX+(p.x-entityDragStartMx)/cz;
          selectedEntity.y=entityDragStartY+(p.y-entityDragStartMy)/cz;
          draw();return;
        }
        if(entityDragMode&&entityDragMode.startsWith('resize-')&&selectedEntity){
          const corner=entityDragMode.slice(7);
          const dx=p.x-entityDragStartMx,dy=p.y-entityDragStartMy;
          const tpx=TW*cz;
          const signW=(corner==='br'||corner==='tr')?1:-1;
          const signH=(corner==='bl'||corner==='br')?1:-1;
          selectedEntity.tilesW=Math.max(1,Math.round(entityDragStartTW+signW*dx/tpx));
          selectedEntity.tilesH=Math.max(1,Math.round(entityDragStartTH+signH*dy/tpx));
          syncEntitySizeBar();draw();return;
        }
        if(isPanning){
          cx=panCamX+(p.x-panMouseX)/cz;
          cy=panCamY+(p.y-panMouseY)/cz;
          draw();return;
        }
        if(isPainting){paint(t.col,t.row);return;}
        draw();
      });
      window.addEventListener('mouseup',()=>{
        if(gameViewDrag){gameViewDrag=false;localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));return;}
        if(entityDragMode){
          if(entityDragMode==='move'&&selectedEntity) snapEntityToTile(selectedEntity);
          entityDragMode=null;
          localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));
          draw();
          return;
        }
        const changed=isPainting||isPanning;
        isPanning=false;isPainting=false;canvas.style.cursor='crosshair';
        if(boundsDrag){endBoundsDrag();return;}
        if(changed)localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));
      });
      window.addEventListener('keydown',(e)=>{
        if((e.key==='Delete'||e.key==='Backspace')&&selectedEntity&&currentCatalog!=='tiles'){
          const list=getActiveEntityList();
          const idx=list.indexOf(selectedEntity);
          if(idx>=0) list.splice(idx,1);
          selectedEntity=null;syncEntitySizeBar();draw();
          localStorage.setItem('valkyrix-map-autosave',JSON.stringify(buildMap()));
          return;
        }
        if(e.key==='Escape'){
          if(gamePanelOpen){toggleGamePanel();return;}
          if(gameViewMode){toggleGameViewMode();return;}
          if(isPickingStart){setStartPickMode(false);setStatus(tr('Выбор старта отменён','Start pick cancelled'));}
          if(boundsEditMode){boundsEditMode=false;syncBoundsUI();draw();setStatus(tr('Редактирование bounds выключено','Edit bounds disabled'));}
          return;
        }
        if((e.key==='f'||e.key==='F')&&!e.ctrlKey&&!e.altKey){fitMapToView();setStatus(tr('Карта вписана в экран','Map fit to view'));return;}
        if(e.key.toLowerCase()==='l'){toggleGamePanel();return;}
        if(gamePanelOpen){
          const step=e.shiftKey?8:2;
          if(e.key==='ArrowUp'||e.key===']'){
            e.preventDefault();
            adjustRoadOffset(step,'key');
            return;
          }
          if(e.key==='ArrowDown'||e.key==='['){
            e.preventDefault();
            adjustRoadOffset(-step,'key');
            return;
          }
        }
      });
      canvas.addEventListener('wheel',(e)=>{
        e.preventDefault();
        if(gamePanelOpen){
          if(e.shiftKey){
            const step=e.deltaY>0?-2:2;
            adjustRoadOffset(step,'wheel');
          }
          return;
        }
        const old=cz;
        cz=Math.max(.1,Math.min(8,cz*(e.deltaY>0?.9:1.1)));
        if(Math.abs(old-cz)>.0001)draw();
      },{passive:false});
      window.addEventListener('resize',resizeCanvas);
    }

    async function boot(){initLayers();tileRefs=['assets/tilesets/ground_stone1.png','assets/tilesets/road_texture.jpg','assets/tilesets/snow.png'];mergeCatalog(tileRefs,[]);const mc=mapCenter();camCenterX=mc.x;camCenterY=mc.y;camStartX=mc.x;camStartY=mc.y;syncCamForm();bind();applyLanguage('en');resizeCanvas();await loadAssets();await loadLastSelectedOrActive();syncTop();syncEntitySizeBar();draw();}
    Object.assign(window,{
      activateCurrentMap,
      fitMapToView,
      toggleGamePanel,
      setStartFromGameView,
      confirmSaveMap
    });
    boot();
  


