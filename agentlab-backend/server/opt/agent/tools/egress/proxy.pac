// Generated from /opt/agent/ops/egress/config.json — do not edit by hand.
// All public hosts go to the local gateway, which tries DIRECT first and
// only uses DataImpulse when a fetch was blocked (or the host was forced).
function FindProxyForURL(url, host) {
  host = host.toLowerCase();
  if (isPlainHostName(host) || shExpMatch(host, '127.*') || host == 'localhost'
      || shExpMatch(host, '10.*') || shExpMatch(host, '192.168.*') || shExpMatch(host, '172.1[6-9].*')
      || shExpMatch(host, '172.2[0-9].*') || shExpMatch(host, '172.3[0-1].*')) return 'DIRECT';
  if (dnsDomainIs(host, '.aws.amazon.com') || host == 'aws.amazon.com') return 'DIRECT';
  if (dnsDomainIs(host, '.aws-portal.amazon.com') || host == 'aws-portal.amazon.com') return 'DIRECT';
  if (dnsDomainIs(host, '.pay.amazon.com') || host == 'pay.amazon.com') return 'DIRECT';
  if (dnsDomainIs(host, '.payments.amazon.com') || host == 'payments.amazon.com') return 'DIRECT';
  if (dnsDomainIs(host, '.amazonpay.amazon.com') || host == 'amazonpay.amazon.com') return 'DIRECT';
  if (dnsDomainIs(host, '.sellercentral.amazon.com') || host == 'sellercentral.amazon.com') return 'DIRECT';
  if (dnsDomainIs(host, '.advertising.amazon.com') || host == 'advertising.amazon.com') return 'DIRECT';
  return 'PROXY 127.0.0.1:18080';
}
