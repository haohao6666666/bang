import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { createService } from './service.mjs';
import { ServiceError } from './validation.mjs';

function isPrivateLanHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  if (/^(fc|fd|fe80:)/i.test(hostname)) return true;
  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map(Number);
  return octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 169 && octets[1] === 254);
}

export function startApi({
  port = 4175,
  host = '127.0.0.1',
  allowLan = false,
  allowLanConfig = process.env.JIXIANG_ALLOW_LAN_CONFIG === '1',
  service = createService(),
} = {}) {
  const server = http.createServer(async (req, res) => {
    const send = (status, data) => {
      if (res.destroyed) return;
      res.writeHead(status, {
        'Content-Type': 'application/json;charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify(data));
    };

    try {
      const requestHost = String(req.headers.host || '').replace(/^\[/, '').replace(/\](:\d+)?$/, '$1');
      const hostname = requestHost.replace(/:\d+$/, '');
      if (!/^\d+$/.test(requestHost.split(':').pop() || '')) throw new ServiceError('不允许这个访问地址。', 403);
      if (!(allowLan ? isPrivateLanHost(hostname) : /^(127\.0\.0\.1|localhost)$/.test(hostname))) {
        throw new ServiceError(allowLan ? '只允许本机或同一局域网访问。' : '只允许本机访问。', 403);
      }

      const origin = req.headers.origin;
      if (origin) {
        let originUrl;
        try { originUrl = new URL(origin); } catch { throw new ServiceError('不允许这个来源访问本机模型服务。', 403); }
        const allowedOrigin = allowLan
          ? originUrl.protocol === 'http:' && isPrivateLanHost(originUrl.hostname)
          : originUrl.protocol === 'http:' && /^(127\.0\.0\.1|localhost)$/.test(originUrl.hostname);
        if (!allowedOrigin) throw new ServiceError('不允许这个来源访问本机模型服务。', 403);
      }
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new ServiceError('不允许跨站请求。', 403);

      const url = new URL(req.url, 'http://127.0.0.1');
      if (req.method === 'GET' && url.pathname === '/api/ai/status') return send(200, await service.status());
      if (req.method === 'GET' && url.pathname === '/api/ai/stamps') return send(200, await service.stamps());
      if (req.method === 'GET' && url.pathname.startsWith('/api/ai/stamp-assets/')) {
        const asset = await service.asset(url.pathname.split('/').pop());
        res.writeHead(200, {
          'Content-Type': asset.mime,
          'Cache-Control': 'private,max-age=31536000,immutable',
          'X-Content-Type-Options': 'nosniff',
        });
        return res.end(asset.bytes);
      }
      if (req.method !== 'POST') return send(404, { error: '接口不存在。' });
      if (!req.headers['content-type']?.startsWith('application/json') || req.headers['x-jixiang-request'] !== '1') {
        throw new ServiceError('请从迹向界面发起请求。', 403);
      }

      const name = url.pathname.slice('/api/ai/'.length);
      const endpoints = ['config', 'echo', 'weekly', 'stamp', 'companion', 'analyze'];
      if (!url.pathname.startsWith('/api/ai/') || !endpoints.includes(name)) return send(404, { error: '接口不存在。' });
      if (name === 'config' && allowLan && !/^(127\.0\.0\.1|localhost|::1)$/.test(hostname) && !allowLanConfig) {
        throw new ServiceError('模型配置只允许在运行服务的电脑上修改。', 403);
      }
      const maxBytes = name === 'companion' || name === 'analyze' ? 9 * 1024 * 1024 : 900000;
      const parts = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > maxBytes) throw new ServiceError('发送内容过大，请减少收藏片段。', 413);
        parts.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new ServiceError('请求不是有效的 JSON。'); }
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      const method = name === 'config' ? 'configure' : name;
      if (typeof service[method] !== 'function') throw new ServiceError('本机服务尚未启用这个能力。', 501);
      const result = await service[method](body, controller.signal);
      send(200, result);
    } catch (error) {
      send(error instanceof ServiceError ? error.status : 500, {
        error: error instanceof ServiceError ? error.message : '本机服务遇到问题，请检查配置后重试。',
      });
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.loadEnvFile('.env'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const server = await startApi();
  console.log(`迹向 API: http://127.0.0.1:${server.address().port}`);
}
