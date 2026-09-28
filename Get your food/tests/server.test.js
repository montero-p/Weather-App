const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app } = require('../server');

function requestJson(server, method, path, payload) {
  const data = payload ? JSON.stringify(payload) : null;

  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const req = http.request({
      host: '127.0.0.1',
      port,
      path,
      method,
      headers: data
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          }
        : undefined,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

test('GET /api/restaurants returns a list of restaurants', async () => {
  const server = app.listen(0);

  try {
    const response = await requestJson(server, 'GET', '/api/restaurants');

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(response.data));
    assert.ok(response.data.length > 0);
    assert.equal(typeof response.data[0].name, 'string');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('POST /api/orders accepts a valid order payload', async () => {
  const server = app.listen(0);

  try {
    const response = await requestJson(server, 'POST', '/api/orders', {
      customerName: 'Alicia',
      address: '12 High Street',
      restaurantId: 'harbor-bite',
      items: [{ id: 'cajun-rice-bowl', quantity: 2 }],
      total: 38,
    });

    assert.equal(response.status, 201);
    assert.equal(response.data.success, true);
    assert.equal(typeof response.data.orderId, 'string');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
