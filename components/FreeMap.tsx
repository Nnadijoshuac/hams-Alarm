import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

/**
 * Free map, no API key: MapLibre GL JS rendering OpenFreeMap vector tiles
 * (https://openfreemap.org — free, no sign-up, no usage limits) inside a
 * WebView. Tapping (or long-pressing) the map drops a pin; the radius circle
 * is drawn in the app's accent colour.
 */

type WebViewHandle = { injectJavaScript: (js: string) => void };
// The package's generic typings omit `ref`, though the Android component forwards it.
const RNWebView = WebView as unknown as React.ComponentType<React.ComponentProps<typeof WebView> & { ref?: React.Ref<WebViewHandle> }>;

const MAPLIBRE = 'https://unpkg.com/maplibre-gl@5.24.1/dist';
const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

export interface LatLngLite {
  latitude: number;
  longitude: number;
}

interface MapState {
  pin: LatLngLite | null;
  radius: number;
  center: LatLngLite | null;
}

function html(initial: MapState, accent: string, paper: string) {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}/maplibre-gl.css">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<style>
  html,body,#m{margin:0;padding:0;height:100%;width:100%;background:${paper};}
  .maplibregl-ctrl-attrib,.leaflet-control-attribution{font:10px sans-serif;background:rgba(255,255,255,.7)!important}
  .pin{width:30px;height:40px}
  #err{position:absolute;left:8px;right:8px;top:8px;z-index:9999;font:12px monospace;color:#B4232F;background:rgba(255,255,255,.92);border-radius:8px;padding:6px 8px;display:none;white-space:pre-wrap}
</style></head><body><div id="m"></div><div id="err"></div><script>
var S=${JSON.stringify(initial)};
function post(m){var s=JSON.stringify(m);if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(s)}else{window.parent.postMessage(s,'*')}}
function log(msg){post({type:'log',msg:String(msg)})}
function showErr(msg){var e=document.getElementById('err');e.textContent=String(msg).slice(0,300);e.style.display='block';log('ERROR '+msg)}
window.onerror=function(m,src,l,c,err){showErr(m+(err&&err.stack?' '+err.stack:''))};
var PIN='<svg viewBox="0 0 30 40" width="30" height="40"><path d="M15 39C15 39 2 23.5 2 14a13 13 0 0 1 26 0c0 9.5-13 25-13 25z" fill="${accent}"/><circle cx="15" cy="14" r="5.5" fill="${paper}"/></svg>';
function ring(lat,lng,r){var pts=[];for(var i=0;i<=72;i++){var a=i/72*2*Math.PI;pts.push([lng+(r/(111320*Math.cos(lat*Math.PI/180)))*Math.sin(a),lat+(r/111320)*Math.cos(a)])}return pts}
function load(src,cb,fail){var s=document.createElement('script');s.src=src;s.onload=cb;s.onerror=function(){fail('could not load '+src)};document.head.appendChild(s)}
var apply=function(){};
window.setState=function(s){S=s;apply(s,true)};
var engine=null;

/* Primary: MapLibre GL + OpenFreeMap vector tiles (needs WebGL2). */
function startMapLibre(){
  engine='maplibre';
  var start=S.pin||S.center||{latitude:20,longitude:0};
  var map=new maplibregl.Map({container:'m',style:'${STYLE}',center:[start.longitude,start.latitude],zoom:(S.pin||S.center)?14:1.5,attributionControl:{compact:true},dragRotate:false,pitchWithRotate:false});
  map.touchZoomRotate.disableRotation();
  var el=document.createElement('div');el.className='pin';el.innerHTML=PIN;
  var marker=new maplibregl.Marker({element:el,anchor:'bottom'});
  var ready=false;
  var timer=setTimeout(function(){if(!ready){log('maplibre did not load in 8s, using fallback');try{map.remove()}catch(e){}startLeaflet()}},8000);
  map.on('error',function(e){log('maplibre error: '+(e&&e.error&&e.error.message))});
  apply=function(s,fit){if(!ready)return;var src=map.getSource('c');
    if(s.pin){var pts=ring(s.pin.latitude,s.pin.longitude,s.radius);
      src.setData({type:'Feature',geometry:{type:'Polygon',coordinates:[pts]}});
      marker.setLngLat([s.pin.longitude,s.pin.latitude]).addTo(map);
      if(fit){var b=new maplibregl.LngLatBounds();pts.forEach(function(p){b.extend(p)});map.fitBounds(b,{padding:36,duration:500,maxZoom:17})}
    }else{src.setData({type:'FeatureCollection',features:[]});marker.remove();
      if(fit&&s.center){map.easeTo({center:[s.center.longitude,s.center.latitude],zoom:14,duration:500})}}};
  map.on('load',function(){
    clearTimeout(timer);
    map.addSource('c',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    map.addLayer({id:'cf',type:'fill',source:'c',paint:{'fill-color':'${accent}','fill-opacity':0.14}});
    map.addLayer({id:'cl',type:'line',source:'c',paint:{'line-color':'${accent}','line-width':2.5}});
    ready=true;map.resize();setTimeout(function(){map.resize()},400);apply(S,true);post({type:'ready',engine:engine});log('maplibre ready');
  });
  var t=null,p0=null;function cancel(){if(t){clearTimeout(t);t=null}}
  map.on('touchstart',function(e){cancel();if(e.originalEvent.touches.length>1)return;p0=e.point;var ll=e.lngLat;t=setTimeout(function(){t=null;post({type:'pin',latitude:ll.lat,longitude:ll.lng})},520)});
  map.on('touchmove',function(e){if(p0&&(Math.abs(e.point.x-p0.x)>8||Math.abs(e.point.y-p0.y)>8))cancel()});
  map.on('touchend',cancel);map.on('movestart',function(e){if(e.originalEvent)cancel()});
  map.on('contextmenu',function(e){post({type:'pin',latitude:e.lngLat.lat,longitude:e.lngLat.lng})});
  // A tap (no drag) drops the pin: reliable inside Android WebViews, unlike long-press.
  map.on('click',function(e){post({type:'pin',latitude:e.lngLat.lat,longitude:e.lngLat.lng})});
  window.addEventListener('resize',function(){map.resize()});
}

/* Fallback: Leaflet + OpenStreetMap raster tiles (no WebGL needed). */
function startLeaflet(){
  if(engine==='leaflet')return;engine='leaflet';
  var go=function(){
    var start=S.pin||S.center||{latitude:20,longitude:0};
    var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([start.latitude,start.longitude],(S.pin||S.center)?15:2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    var icon=L.divIcon({className:'',html:PIN,iconSize:[30,40],iconAnchor:[15,40]});
    var marker=null,circle=null;
    apply=function(s,fit){
      if(marker){map.removeLayer(marker);marker=null}if(circle){map.removeLayer(circle);circle=null}
      if(s.pin){var ll=[s.pin.latitude,s.pin.longitude];
        circle=L.circle(ll,{radius:s.radius,color:'${accent}',weight:2.5,fillColor:'${accent}',fillOpacity:0.14}).addTo(map);
        marker=L.marker(ll,{icon:icon}).addTo(map);
        if(fit)map.fitBounds(circle.getBounds(),{padding:[36,36],maxZoom:17});
      }else if(fit&&s.center){map.setView([s.center.latitude,s.center.longitude],15)}};
    map.on('contextmenu',function(e){post({type:'pin',latitude:e.latlng.lat,longitude:e.latlng.lng})});
    map.on('click',function(e){post({type:'pin',latitude:e.latlng.lat,longitude:e.latlng.lng})});
    setTimeout(function(){map.invalidateSize()},300);
    apply(S,true);post({type:'ready',engine:engine});log('leaflet ready');
  };
  if(window.L)go();else load('${LEAFLET}/leaflet.js',go,showErr);
}

var cv=document.createElement('canvas');
var webgl2=!!(cv.getContext&&cv.getContext('webgl2'));
log('webgl2='+webgl2);
if(webgl2){load('${MAPLIBRE}/maplibre-gl.js',function(){try{startMapLibre()}catch(e){log('maplibre failed: '+e);startLeaflet()}},function(m){log(m);startLeaflet()})}
else{startLeaflet()}
</script></body></html>`;
}

interface Props {
  pin: LatLngLite | null;
  radius: number;
  /** Where to look when there is no pin yet (e.g. the user's last position). */
  center: LatLngLite | null;
  accent: string;
  paper: string;
  onLongPress: (p: LatLngLite) => void;
  style?: StyleProp<ViewStyle>;
}

export function FreeMap({ pin, radius, center, accent, paper, onLongPress, style }: Props) {
  // The page is built once; later changes are pushed in with setState().
  const [initial] = useState<MapState>(() => ({ pin, radius, center }));
  const page = useMemo(() => html(initial, accent, paper), [initial, accent, paper]);
  const web = useRef<WebViewHandle>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const ready = useRef(false);

  const push = (s: MapState) => {
    if (!ready.current) return;
    const json = JSON.stringify(s);
    if (Platform.OS === 'web') {
      (frame.current?.contentWindow as unknown as { setState?: (x: MapState) => void } | null)?.setState?.(s);
    } else {
      web.current?.injectJavaScript(`window.setState(${json});true;`);
    }
  };

  useEffect(() => {
    push({ pin, radius, center });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin?.latitude, pin?.longitude, radius, center?.latitude, center?.longitude]);

  const handle = (raw: string) => {
    try {
      const m = JSON.parse(raw);
      if (m.type === 'ready') {
        ready.current = true;
        push({ pin, radius, center });
      } else if (m.type === 'log') {
        console.log('[map]', m.msg);
      } else if (m.type === 'pin') {
        onLongPress({ latitude: m.latitude, longitude: m.longitude });
      }
    } catch {
      // not ours
    }
  };

  // Browser preview: an iframe talks to us with window.postMessage.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onMsg = (e: MessageEvent) => typeof e.data === 'string' && handle(e.data);
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  });

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.box, style]}>
        {createElement('iframe', { ref: frame, srcDoc: page, style: { border: 0, width: '100%', height: '100%' } })}
      </View>
    );
  }

  return (
    <View style={[styles.box, style]}>
      <RNWebView
        ref={web}
        originWhitelist={['*']}
        source={{ html: page }}
        onMessage={(e: WebViewMessageEvent) => handle(e.nativeEvent.data)}
        style={{ backgroundColor: paper }}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        overScrollMode="never"
        nestedScrollEnabled
        webviewDebuggingEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
});
