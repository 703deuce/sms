# MCTB SIP Adapter

Dumb telephony adapter: Telnyx FQDN → Asterisk → existing Transovo HTTP backend.

See [docs/MCTB-SIP-ADAPTER.md](../docs/MCTB-SIP-ADAPTER.md) for deployment and certification.

```bash
# Build locally
docker build -t mctb-sip-adapter ./mctb-sip-adapter

# Run (host networking recommended)
docker run --rm --network host \
  -e EXTERNAL_SIP_IP=203.0.113.10 \
  -e TRANSOVO_BACKEND_URL=https://app.transovo.ai \
  -e TRANSOVO_INTERNAL_API_KEY=... \
  mctb-sip-adapter
```
