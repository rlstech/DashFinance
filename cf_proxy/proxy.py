#!/usr/bin/env python3
"""
TCP proxy that tunnels connections through Cloudflare Access using service tokens.
Implements the same WebSocket protocol as `cloudflared access tcp` but authenticates
headlessly via CF-Access-Client-Id / CF-Access-Client-Secret headers.
"""
import asyncio
import os
import sys
import websockets

CF_HOSTNAME       = os.environ.get('CF_HOSTNAME', 'sql.railton.eu.org')
CF_CLIENT_ID      = os.environ.get('CF_ACCESS_CLIENT_ID', '')
CF_CLIENT_SECRET  = os.environ.get('CF_ACCESS_CLIENT_SECRET', '')
LISTEN_PORT       = int(os.environ.get('LISTEN_PORT', 62311))

WS_URL = f'wss://{CF_HOSTNAME}/cdn-cgi/access/websocket'


async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    peer = writer.get_extra_info('peername')
    print(f'[+] connection from {peer}', flush=True)

    headers = {
        'CF-Access-Client-Id':     CF_CLIENT_ID,
        'CF-Access-Client-Secret': CF_CLIENT_SECRET,
    }

    try:
        async with websockets.connect(WS_URL, additional_headers=headers) as ws:
            print(f'[+] websocket established → {WS_URL}', flush=True)

            async def tcp_to_ws():
                try:
                    while True:
                        data = await reader.read(4096)
                        if not data:
                            break
                        await ws.send(data)
                except Exception as e:
                    print(f'tcp→ws error: {e}', flush=True)
                finally:
                    await ws.close()

            async def ws_to_tcp():
                try:
                    async for msg in ws:
                        chunk = msg if isinstance(msg, bytes) else msg.encode()
                        writer.write(chunk)
                        await writer.drain()
                except Exception as e:
                    print(f'ws→tcp error: {e}', flush=True)
                finally:
                    writer.close()

            t1 = asyncio.create_task(tcp_to_ws())
            t2 = asyncio.create_task(ws_to_tcp())
            _done, pending = await asyncio.wait([t1, t2], return_when=asyncio.FIRST_COMPLETED)
            for t in pending:
                t.cancel()

    except Exception as e:
        print(f'[-] connection failed: {e}', flush=True)
        writer.close()

    print(f'[-] connection closed {peer}', flush=True)


async def main():
    server = await asyncio.start_server(handle, '0.0.0.0', LISTEN_PORT)
    print(f'cf-tcp-proxy listening on 0.0.0.0:{LISTEN_PORT} → {WS_URL}', flush=True)
    async with server:
        await server.serve_forever()


if __name__ == '__main__':
    asyncio.run(main())
