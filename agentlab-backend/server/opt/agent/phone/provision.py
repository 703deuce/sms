"""AgentLab phone provisioning (host-only; keys from /opt/agent/secrets/phone.env, never printed).

  python provision.py inventory                         # Telnyx numbers + LiveKit trunks/rules
  python provision.py search --area 571 [--limit 5]     # available numbers to buy (no spend)
  python provision.py order +1NXXNXXXXXX --i-have-approval   # BUYS a number (needs John's OK)
  python provision.py attach +1NXXNXXXXXX [--agent agentlab-phone]   # route an owned number to the agent
  python provision.py detach +1NXXNXXXXXX --back-to ST_vewjyLgDxVda  # undo attach
  python provision.py outbound-trunk +1NXXNXXXXXX       # LiveKit outbound trunk via Telnyx creds (transfers)
"""
import argparse, asyncio, json, os, sys
import httpx
from livekit import api

TELNYX = 'https://api.telnyx.com/v2'
LK_FQDN_CONNECTION = os.environ.get('TELNYX_LIVEKIT_FQDN_CONNECTION_ID', '3037959952799893412')  # "Transovo LiveKit Inbound"
PROTECTED = {'+15717491060', '+15714073615', '+18666020680'}   # A2P-registered 571s + toll-free platform sender


def th():
    return {'Authorization': 'Bearer ' + os.environ['TELNYX_API_KEY']}


def lk():
    return api.LiveKitAPI(os.environ['LIVEKIT_URL'].replace('wss://', 'https://').rstrip('/'),
                          os.environ['LIVEKIT_API_KEY'], os.environ['LIVEKIT_API_SECRET'])


async def inventory():
    nums = httpx.get(f'{TELNYX}/phone_numbers?page[size]=100', headers=th(), timeout=30).json().get('data', [])
    camp = httpx.get(f'{TELNYX}/10dlc/phone_number_campaigns?recordsPerPage=100', headers=th(), timeout=30).json().get('records', [])
    a2p = {c.get('phoneNumber') for c in camp}
    for n in nums:
        print('TELNYX', n['phone_number'], n.get('phone_number_type'), 'conn=', n.get('connection_name'), 'A2P' if n['phone_number'] in a2p else '',
              'PROTECTED' if n['phone_number'] in PROTECTED else '')
    a = lk()
    for t in (await a.sip.list_inbound_trunk(api.ListSIPInboundTrunkRequest())).items:
        print('LK-IN ', t.sip_trunk_id, t.name, list(t.numbers))
    for t in (await a.sip.list_outbound_trunk(api.ListSIPOutboundTrunkRequest())).items:
        print('LK-OUT', t.sip_trunk_id, t.name, t.address, list(t.numbers))
    for r in (await a.sip.list_dispatch_rule(api.ListSIPDispatchRuleRequest())).items:
        print('LK-RULE', r.sip_dispatch_rule_id, r.name, list(r.trunk_ids), [x.agent_name for x in r.room_config.agents])
    await a.aclose()


def search(area, limit):
    r = httpx.get(f'{TELNYX}/available_phone_numbers', headers=th(), timeout=30,
                  params={'filter[country_code]': 'US', 'filter[national_destination_code]': area, 'filter[limit]': limit,
                          'filter[features][]': ['voice', 'sms']}).json()
    for n in r.get('data', []):
        print(n['phone_number'], n.get('cost_information'), n.get('region_information'))


def order(number, approved):
    if not approved:
        sys.exit('Refusing: buying a number is new spending. Re-run with --i-have-approval after John says OK.')
    r = httpx.post(f'{TELNYX}/number_orders', headers=th(), timeout=60,
                   json={'phone_numbers': [{'phone_number': number}], 'connection_id': LK_FQDN_CONNECTION})
    print(r.status_code, json.dumps(r.json().get('data', r.json()), indent=1)[:1500])


async def attach(number, agent):
    if number in PROTECTED:
        sys.exit(f'{number} is protected (A2P / platform sender); not touching it.')
    # 1) Telnyx: point the number's voice at the LiveKit Cloud FQDN connection.
    r = httpx.patch(f'{TELNYX}/phone_numbers/{number}', headers=th(), timeout=30, json={'connection_id': LK_FQDN_CONNECTION})
    print('telnyx connection ->', r.status_code, r.json().get('data', {}).get('connection_name'))
    a = lk()
    # 2) LiveKit: a number may sit on only one inbound trunk; move it off any shared trunk.
    for t in (await a.sip.list_inbound_trunk(api.ListSIPInboundTrunkRequest())).items:
        drop = [n for n in t.numbers if n.lstrip('+') == number.lstrip('+')]
        if drop and t.name != f'{agent}-inbound':
            await a.sip.update_inbound_trunk_fields(t.sip_trunk_id, numbers=api.ListUpdate(remove=drop))
            print('removed', drop, 'from', t.sip_trunk_id, t.name)
    mine = [t for t in (await a.sip.list_inbound_trunk(api.ListSIPInboundTrunkRequest())).items if t.name == f'{agent}-inbound']
    if mine:
        t = mine[0]
        if number not in t.numbers:
            await a.sip.update_inbound_trunk_fields(t.sip_trunk_id, numbers=api.ListUpdate(add=[number]))
    else:
        t = await a.sip.create_inbound_trunk(api.CreateSIPInboundTrunkRequest(trunk=api.SIPInboundTrunkInfo(
            name=f'{agent}-inbound', numbers=[number], krisp_enabled=True)))
    print('inbound trunk', t.sip_trunk_id)
    rules = [r for r in (await a.sip.list_dispatch_rule(api.ListSIPDispatchRuleRequest())).items if r.name == f'{agent}-dispatch']
    if not rules:
        r = await a.sip.create_dispatch_rule(api.CreateSIPDispatchRuleRequest(dispatch_rule=api.SIPDispatchRuleInfo(
            name=f'{agent}-dispatch', trunk_ids=[t.sip_trunk_id],
            rule=api.SIPDispatchRule(dispatch_rule_individual=api.SIPDispatchRuleIndividual(room_prefix=f'{agent}-call-')),
            room_config=api.RoomConfiguration(agents=[api.RoomAgentDispatch(agent_name=agent)]))))
        print('dispatch rule', r.sip_dispatch_rule_id)
    else:
        print('dispatch rule exists', rules[0].sip_dispatch_rule_id)
    await a.aclose()


async def detach(number, back_to, agent):
    a = lk()
    for t in (await a.sip.list_inbound_trunk(api.ListSIPInboundTrunkRequest())).items:
        if t.name == f'{agent}-inbound' and number in t.numbers:
            await a.sip.update_inbound_trunk_fields(t.sip_trunk_id, numbers=api.ListUpdate(remove=[number]))
            print('removed from', t.sip_trunk_id)
    if back_to:
        await a.sip.update_inbound_trunk_fields(back_to, numbers=api.ListUpdate(add=[number]))
        print('added back to', back_to)
    await a.aclose()


async def outbound_trunk(number, agent):
    a = lk()
    have = [t for t in (await a.sip.list_outbound_trunk(api.ListSIPOutboundTrunkRequest())).items if t.name == f'{agent}-outbound']
    if have:
        print('outbound trunk exists', have[0].sip_trunk_id)
    else:
        t = await a.sip.create_outbound_trunk(api.CreateSIPOutboundTrunkRequest(trunk=api.SIPOutboundTrunkInfo(
            name=f'{agent}-outbound', address='sip.telnyx.com', numbers=[number],
            auth_username=os.environ['TELNYX_SIP_OUTBOUND_USERNAME'], auth_password=os.environ['TELNYX_SIP_OUTBOUND_PASSWORD'])))
        print('outbound trunk', t.sip_trunk_id)
    await a.aclose()


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('cmd')
    p.add_argument('number', nargs='?')
    p.add_argument('--agent', default='agentlab-phone')
    p.add_argument('--area', default='571')
    p.add_argument('--limit', type=int, default=5)
    p.add_argument('--back-to', default='')
    p.add_argument('--i-have-approval', action='store_true')
    a = p.parse_args()
    if a.cmd == 'inventory': asyncio.run(inventory())
    elif a.cmd == 'search': search(a.area, a.limit)
    elif a.cmd == 'order': order(a.number, a.i_have_approval)
    elif a.cmd == 'attach': asyncio.run(attach(a.number, a.agent))
    elif a.cmd == 'detach': asyncio.run(detach(a.number, a.back_to, a.agent))
    elif a.cmd == 'outbound-trunk': asyncio.run(outbound_trunk(a.number, a.agent))
    else: sys.exit(__doc__)
