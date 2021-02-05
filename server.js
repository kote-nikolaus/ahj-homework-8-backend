const http = require('http');
const Koa = require('koa');
const Router = require('koa-router');
const WS = require('ws');

const app = new Koa();

app.use(async (ctx, next) => {
  const origin = ctx.request.get('Origin');
  if (!origin) {
    return await next();
  }

  const headers = { 'Access-Control-Allow-Origin': '*', };

  if (ctx.request.method !== 'OPTIONS') {
    ctx.response.set({ ...headers });
    try {
      return await next();
    } catch (e) {
      e.headers = { ...e.headers, ...headers };
      throw e;
    }
  }

  if (ctx.request.get('Access-Control-Request-Method')) {
    ctx.response.set({
      ...headers,
      'Access-Control-Allow-Methods': 'GET, POST, PUD, DELETE, PATCH',
    });

    if (ctx.request.get('Access-Control-Request-Headers')) {
      ctx.response.set('Access-Control-Allow-Headers', ctx.request.get('Access-Control-Request-Headers'));
    }

    ctx.response.status = 204;
  }
});

const router = new Router();

router.get('/index', async (ctx) => {
  ctx.response.body = 'hello';
});

app.use(router.routes()).use(router.allowedMethods());

const port = process.env.PORT || 7070;
const server = http.createServer(app.callback())
const wsServer = new WS.Server({ server });

const members = new Set();
const messages = [];

function sendToAll(message) {
  [...wsServer.clients]
  .filter(o => o.readyState === WS.OPEN)
  .forEach(o => o.send(message));
}

wsServer.on('connection', (ws, req) => {
  ws.on('message', data => {
    let obj = JSON.parse(data);
    switch (obj.method) {
      case 'addMember':
      {
        if (members.has(obj.name)) {
          ws.send(JSON.stringify({
            type: "fail",
          }));
        } else {
          members.add(obj.name);
          ws.send(JSON.stringify({
            type: "success",
          }));
        }
        return;
      }
      case 'removeMember':
      {
        members.delete(obj.name);
        sendToAll(JSON.stringify({
          type: "members",
          content: Array.from(members),
        }));
        return;
      }
      case 'getAllMembers':
      {
      sendToAll(JSON.stringify({
        type: "members",
        content: Array.from(members),
      }));
          return;
      }
      case 'sendMessage':
      {
        messages.push(obj.message);
        sendToAll(JSON.stringify({
          type: "messages",
          content: messages,
        }));
        return;
      }
      case 'getAllMessages':
      {
      sendToAll(JSON.stringify({
        type: "messages",
        content: messages,
      }));
        return;
      }
    }
  });
});

server.listen(port);
