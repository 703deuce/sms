"""Offline check: next-open skips closed US holidays, blackouts and closures (same days booking refuses)."""
import copy, sys
from datetime import datetime
from zoneinfo import ZoneInfo
sys.path.insert(0, sys.argv[1] if len(sys.argv) > 1 else '.')
import store
tz = ZoneInfo('America/New_York')
base = store.load_config(); base['timezone'] = 'America/New_York'
base['business_hours'] = {d: (['09:00', '17:00'] if d in ('mon', 'tue', 'wed', 'thu', 'fri') else None) for d in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')}
base['closures'] = []; base['booking']['blackout_dates'] = []; base['booking'].setdefault('holidays', {})['closed'] = ['thanksgiving', 'christmas']
now = datetime(2026, 11, 26, 0, 30, tzinfo=tz)        # 12:30 AM ET Thanksgiving Thursday
ok = True
def chk(name, got, want):
    global ok; ok &= got == want; print(('PASS' if got == want else 'FAIL'), name, '->', got, '| want', want)
chk('resolve_when next-open (Thanksgiving closed)', store.resolve_when('next-open', base, 'until', now), '2026-11-27T09:00:00-05:00')
chk('next_open_day (greeting)', store.next_open_day(base, now), 'Friday November 27 at 9:00 AM')
c = copy.deepcopy(base); c['booking']['holidays']['closed'] = ['christmas']
chk('thanksgiving open -> Thu 9 AM', store.resolve_when('next-open', c, 'until', now), '2026-11-26T09:00:00-05:00')
chk('greeting, thanksgiving open -> today 9 AM', store.next_open_day(c, now), 'today at 9:00 AM')
c = copy.deepcopy(base); c['booking']['blackout_dates'] = ['2026-11-27']
chk('Fri blackout too -> Mon', store.resolve_when('next-open', c, 'until', now), '2026-11-30T09:00:00-05:00')
c = copy.deepcopy(base); c['closures'] = [{'date': '2026-11-30', 'name': 'Off'}]
chk('Wed night, Thu holiday -> Fri', store.resolve_when('next-open', c, 'until', datetime(2026, 11, 25, 22, 0, tzinfo=tz)), '2026-11-27T09:00:00-05:00')
chk('Christmas Eve night -> Sat/Sun skipped -> Mon Dec 28', store.resolve_when('next-open', base, 'until', datetime(2026, 12, 24, 20, 0, tzinfo=tz)), '2026-12-28T09:00:00-05:00')
tz_ = tz
chk('biz hours: Thanksgiving Thu 11 AM is closed (after-hours)', store.is_business_hours(base, datetime(2026, 11, 26, 11, 0, tzinfo=tz_)), False)
chk('closure_today on Thanksgiving names it', (store.closure_today(base, datetime(2026, 11, 26, 11, 0, tzinfo=tz_)) or {}).get('name'), store.US_HOLIDAYS['thanksgiving'])
chk('biz hours: normal Fri Nov 27 11 AM is open', store.is_business_hours(base, datetime(2026, 11, 27, 11, 0, tzinfo=tz_)), True)
c = copy.deepcopy(base); c['booking']['holidays']['closed'] = ['christmas']
chk('biz hours: Thanksgiving set to open, 11 AM is open', store.is_business_hours(c, datetime(2026, 11, 26, 11, 0, tzinfo=tz_)), True)
c = copy.deepcopy(base); c['booking']['blackout_dates'] = ['2026-11-27']
chk('biz hours: Fri day off (blackout) 11 AM is closed', store.is_business_hours(c, datetime(2026, 11, 27, 11, 0, tzinfo=tz_)), False)
c = copy.deepcopy(base); c['closures'] = [{'date': '2026-11-26', 'name': 'Half day', 'hours': ['10:00', '14:00']}]
chk('biz hours: owner special hours on the holiday win (11 AM open)', store.is_business_hours(c, datetime(2026, 11, 26, 11, 0, tzinfo=tz_)), True)
print('ALL PASS' if ok else 'SOME FAILED'); sys.exit(0 if ok else 1)
