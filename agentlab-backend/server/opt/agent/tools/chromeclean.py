"""Shared by desktop-open (container) and the desktop service (host): make the Chromium profile start clean.
Keeps cookies and logins; removes the session-restore state that causes the "Restore pages?" bubble."""
import json, os, shutil

SESSION_FILES = ['Current Session', 'Current Tabs', 'Last Session', 'Last Tabs']
SESSION_DIRS = ['Sessions', 'Sessions_Encrypted']


def clean_profile(profile, downloads=None):
    d = os.path.join(profile, 'Default')
    os.makedirs(d, exist_ok=True)
    for n in SESSION_FILES:
        try: os.remove(os.path.join(d, n))
        except OSError: pass
    for n in SESSION_DIRS:
        shutil.rmtree(os.path.join(d, n), ignore_errors=True)
    for n in ('SingletonLock', 'SingletonSocket', 'SingletonCookie'):
        try: os.remove(os.path.join(profile, n))
        except OSError: pass
    p = os.path.join(d, 'Preferences')
    try:
        prefs = json.load(open(p))
    except Exception:
        prefs = {}
    prof = prefs.setdefault('profile', {})
    prof['exit_type'] = 'Normal'
    prof['exited_cleanly'] = True
    # 1 = "continue where you left off": Chrome then keeps SESSION cookies (most logins) across restarts.
    # The tab/session files are deleted above, so no old tabs come back.
    prefs.setdefault('session', {})['restore_on_startup'] = 1
    if downloads:
        os.makedirs(downloads, exist_ok=True)
        dl = prefs.setdefault('download', {})
        dl['default_directory'] = downloads
        dl['prompt_for_download'] = False
        prefs.setdefault('savefile', {})['default_directory'] = downloads
    tmp = p + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(prefs, f)
    os.replace(tmp, p)
    ls = os.path.join(profile, 'Local State')
    try:
        st = json.load(open(ls))
        st.setdefault('profile', {})['exited_cleanly'] = True  # older builds read it here
        with open(ls + '.tmp', 'w') as f:
            json.dump(st, f)
        os.replace(ls + '.tmp', ls)
    except Exception:
        pass
