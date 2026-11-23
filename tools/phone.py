"""
Drive the connected Android phone over adb, to walk through the app.

  python tools/phone.py shot [name]          screenshot -> tools/shots/<name>.png (+ half-size preview)
  python tools/phone.py ui                    list on-screen elements: text / label, centre x,y, clickable
  python tools/phone.py tap X Y               tap at full-resolution pixel coords
  python tools/phone.py tapl "label"          tap the first element whose text/label contains "label"
  python tools/phone.py long X Y [ms]         long-press
  python tools/phone.py swipe X1 Y1 X2 Y2 [ms]
  python tools/phone.py scroll down|up [px]   scroll the middle of the screen
  python tools/phone.py type "text"           type into the focused field
  python tools/phone.py key back|home|enter|tab
  python tools/phone.py launch                (re)start Hams_Alarm
  python tools/phone.py logs                  recent errors from the app

Coordinates are full-resolution phone pixels (the half-size preview is x0.5).
"""
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')

ADB = os.environ.get('ADB', 'C:/Users/chimd/Android/ptools/platform-tools/adb.exe')
PKG = 'com.hamsalarm.app'
SHOTS = os.path.join(os.path.dirname(__file__), 'shots')


def adb(*args, binary=False):
    r = subprocess.run([ADB, *args], capture_output=True)
    return r.stdout if binary else r.stdout.decode('utf8', 'replace')


def shot(name='screen'):
    from PIL import Image
    os.makedirs(SHOTS, exist_ok=True)
    png = adb('exec-out', 'screencap', '-p', binary=True)
    full = os.path.join(SHOTS, f'{name}.png')
    open(full, 'wb').write(png)
    im = Image.open(full)
    small = im.resize((im.width // 2, im.height // 2))
    prev = os.path.join(SHOTS, f'{name}_half.png')
    small.save(prev)
    print(f'{full}  ({im.width}x{im.height})  preview: {prev}')


def dump():
    # Remove any old dump first: when the screen is animating (e.g. a clock hand)
    # uiautomator can't get an idle state and would otherwise leave a stale file.
    adb('shell', 'rm', '-f', '/sdcard/ui.xml')
    res = adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
    xml = adb('exec-out', 'cat', '/sdcard/ui.xml')
    if '<?xml' not in xml:
        print(f'(no fresh UI dump: {res.strip()[:80]})', file=sys.stderr)
        return []
    xml = xml[xml.find('<?xml'):]
    root = ET.fromstring(xml)
    out = []
    for n in root.iter('node'):
        label = n.get('text') or n.get('content-desc') or ''
        b = re.findall(r'\d+', n.get('bounds', ''))
        if len(b) != 4:
            continue
        x1, y1, x2, y2 = map(int, b)
        if x2 - x1 <= 0 or y2 - y1 <= 0:
            continue
        clickable = n.get('clickable') == 'true'
        if label or clickable:
            out.append({'label': label.replace('\n', ' '), 'x': (x1 + x2) // 2, 'y': (y1 + y2) // 2,
                        'w': x2 - x1, 'h': y2 - y1, 'click': clickable, 'cls': n.get('class', '').split('.')[-1]})
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    cmd, a = sys.argv[1], sys.argv[2:]
    if cmd == 'shot':
        time.sleep(0.6)
        shot(a[0] if a else 'screen')
    elif cmd == 'ui':
        for e in dump():
            flag = 'TAP ' if e['click'] else '    '
            print(f"{flag}({e['x']:4},{e['y']:4}) {e['w']:4}x{e['h']:<4} {e['cls'][:12]:12} {e['label'][:70]}")
    elif cmd == 'tap':
        adb('shell', 'input', 'tap', a[0], a[1])
    elif cmd == 'tapl':
        want = a[0].lower()
        els = dump()
        if not els:
            print('UI dump empty (screen animating?) - use tap X Y instead')
            sys.exit(1)
        # exact label first, then substring
        ranked = [e for e in els if e['label'].lower() == want] + [e for e in els if want in e['label'].lower()]
        for e in ranked:
                adb('shell', 'input', 'tap', str(e['x']), str(e['y']))
                print(f"tapped '{e['label']}' at {e['x']},{e['y']}")
                return
        print(f'NOT FOUND: {a[0]}')
        sys.exit(1)
    elif cmd == 'long':
        ms = a[2] if len(a) > 2 else '800'
        adb('shell', 'input', 'swipe', a[0], a[1], a[0], a[1], ms)
    elif cmd == 'swipe':
        adb('shell', 'input', 'swipe', *a[:4], a[4] if len(a) > 4 else '350')
    elif cmd == 'scroll':
        px = int(a[1]) if len(a) > 1 else 900
        y0, y1 = (1700, 1700 - px) if a[0] == 'down' else (700, 700 + px)
        adb('shell', 'input', 'swipe', '540', str(y0), '540', str(y1), '400')
    elif cmd == 'type':
        adb('shell', 'input', 'text', a[0].replace(' ', '%s'))
    elif cmd == 'key':
        codes = {'back': '4', 'home': '3', 'enter': '66', 'tab': '61', 'del': '67'}
        adb('shell', 'input', 'keyevent', codes.get(a[0], a[0]))
    elif cmd == 'launch':
        adb('shell', 'am', 'force-stop', PKG)
        adb('shell', 'monkey', '-p', PKG, '-c', 'android.intent.category.LAUNCHER', '1')
        time.sleep(4)
        print('launched, pid', adb('shell', 'pidof', PKG).strip())
    elif cmd == 'logs':
        pid = adb('shell', 'pidof', PKG).strip()
        out = adb('logcat', '-d', '-v', 'brief', *(['--pid', pid] if pid else []))
        for line in out.splitlines():
            if re.search(r'^(E|F)/|ReactNativeJS|FATAL|Exception', line):
                print(line[:240])
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
