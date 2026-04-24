# Remote Sync

This fork adds a first-pass 1v1 remote sync mode for BongoCat.

## What it syncs

- keyboard press/release actions that match the current model resources
- mouse left/right press/release actions
- pointer direction by normalized screen ratio

It does **not** sync actual typed text content.

## Start relay server

```bash
pnpm install
pnpm relay:sync
```

Default relay address:

```text
ws://127.0.0.1:4399
```

You can also override host and port:

```bash
HOST=0.0.0.0 PORT=4399 pnpm relay:sync
```

## Connect two clients

1. Open **猫咪设置 > 双端同步**.
2. Enable sync on both sides.
3. Fill the same server URL.
4. Fill the same room ID.
5. Wait until status becomes `已连接`.

For LAN testing, use the relay machine IP, for example:

```text
ws://192.168.1.20:4399
```

## Current limits

- one room supports at most 2 peers
- room state is relay-based, no persistence
- when a peer disconnects, remote key overlays are cleared
- mouse button state is synchronized as a simple mirrored action layer
