'use strict';
const express = require('express');
const { prisma } = require('../db');
const { HttpError } = require('../errors');
const { authenticate, requireRole } = require('../middleware/authenticate');

const router = express.Router();
const guard = [authenticate(), requireRole('ADMIN')];
const STATUSES = ['PENDING', 'VERIFIED', 'REJECTED', 'NOT_REQUIRED'];

router.get('/drivers', ...guard, async (req, res, next) => {
  try {
    const status = STATUSES.includes(req.query?.status) ? req.query.status : 'PENDING';
    const drivers = await prisma.user.findMany({
      where: { role: 'DRIVER', verificationStatus: status },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, email: true, phone: true, faydaNumber: true,
        vehicleModel: true, vehiclePlate: true, verificationStatus: true,
        verifiedAt: true, createdAt: true,
      },
    });
    res.json({ drivers });
  } catch (err) { next(err); }
});

router.get('/drivers/:id/photo/:which', ...guard, async (req, res, next) => {
  try {
    if (!['selfie', 'id'].includes(req.params.which)) throw new HttpError(404, 'Not found.');
    const driver = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!driver || driver.role !== 'DRIVER') throw new HttpError(404, 'Driver not found.');
    const dataUri = req.params.which === 'selfie' ? driver.selfiePhoto : driver.idPhoto;
    if (!dataUri) throw new HttpError(404, 'No photo on file.');
    const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUri);
    if (!match) throw new HttpError(500, 'Stored photo is corrupt.');
    res.set('Content-Type', match[1]).set('Cache-Control', 'private, max-age=0, no-store').send(Buffer.from(match[2], 'base64'));
  } catch (err) { next(err); }
});

router.post('/drivers/:id/status', ...guard, async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!['VERIFIED', 'REJECTED'].includes(status)) throw new HttpError(400, 'Status must be VERIFIED or REJECTED.');
    const driver = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!driver || driver.role !== 'DRIVER') throw new HttpError(404, 'Driver not found.');
    const updated = await prisma.user.update({
      where: { id: driver.id },
      data: { verificationStatus: status, verifiedAt: status === 'VERIFIED' ? new Date() : null },
    });
    res.json({ driver: { id: updated.id, verificationStatus: updated.verificationStatus } });
  } catch (err) { next(err); }
});

router.get('/', (req, res) => {
  res.type('html').send(ADMIN_PAGE);
});

// A single self-contained HTML page (no build step) so verifying a driver's
// Fayda ID + photos needs nothing more than this URL and an admin login —
// the whole point being no one has to come into an office to do it.
const ADMIN_PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Beklo driver verification</title>
<style>
  body{font-family:-apple-system,system-ui,sans-serif;background:#F7F8F4;margin:0;padding:24px;color:#14150F;}
  h1{font-size:20px;margin:0 0 16px;}
  #login{max-width:320px;margin:60px auto;background:#fff;padding:24px;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.08);}
  input{width:100%;box-sizing:border-box;padding:10px 12px;margin:6px 0 14px;border:1px solid #ddd;border-radius:8px;font-size:15px;}
  button{cursor:pointer;border:none;border-radius:10px;padding:10px 16px;font-weight:700;font-size:14px;}
  .primary{background:#14150F;color:#fff;width:100%;}
  .card{background:#fff;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 1px 6px rgba(0,0,0,.06);}
  .row{display:flex;gap:12px;flex-wrap:wrap;}
  .photos{display:flex;gap:10px;margin:10px 0;}
  .photos img{width:140px;height:140px;object-fit:cover;border-radius:10px;background:#eee;}
  .meta{color:#666;font-size:13px;line-height:1.6;}
  .actions{margin-top:10px;display:flex;gap:8px;}
  .verify{background:#DCEFC7;}
  .reject{background:#F5D5D0;}
  #err{color:#9A3412;margin-top:8px;font-size:13px;}
  #empty{color:#666;}
</style></head>
<body>
  <div id="login">
    <h1>Beklo admin</h1>
    <input id="email" placeholder="Admin email" autocapitalize="none">
    <input id="password" placeholder="Password" type="password">
    <button class="primary" onclick="login()">Sign in</button>
    <div id="err"></div>
  </div>
  <div id="app" style="display:none;max-width:640px;margin:0 auto;">
    <h1>Pending driver verifications</h1>
    <div id="list"></div>
  </div>
<script>
  var API = location.origin;
  var token = '';
  function login() {
    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    fetch(API + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
      .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error||'Login failed'); return d; }); })
      .then(function(data){
        if (data.user.role !== 'ADMIN') throw new Error('This account is not an admin.');
        token = data.token;
        document.getElementById('login').style.display='none';
        document.getElementById('app').style.display='block';
        load();
      })
      .catch(function(e){ document.getElementById('err').textContent = e.message; });
  }
  function load() {
    fetch(API + '/admin/drivers?status=PENDING', { headers: { Authorization: 'Bearer ' + token } })
      .then(function(r){ return r.json(); })
      .then(function(data){ render(data.drivers || []); });
  }
  function render(drivers) {
    var list = document.getElementById('list');
    if (!drivers.length) { list.innerHTML = '<p id="empty">No pending drivers right now.</p>'; return; }
    list.innerHTML = drivers.map(function(d){
      return '<div class="card">' +
        '<strong>' + escapeHtml(d.name) + '</strong>' +
        '<div class="meta">' + escapeHtml(d.email||'') + ' &middot; ' + escapeHtml(d.phone||'') + '<br>' +
        'Fayda ID: ' + escapeHtml(d.faydaNumber||'—') + '<br>' +
        'Vehicle: ' + escapeHtml(d.vehicleModel||'—') + ' &middot; Plate: ' + escapeHtml(d.vehiclePlate||'—') + '</div>' +
        '<div class="photos">' +
          '<img src="' + API + '/admin/drivers/' + d.id + '/photo/selfie?token=' + encodeURIComponent(token) + '">' +
          '<img src="' + API + '/admin/drivers/' + d.id + '/photo/id?token=' + encodeURIComponent(token) + '">' +
        '</div>' +
        '<div class="actions">' +
          '<button class="verify" onclick="setStatus(&quot;' + d.id + '&quot;,&quot;VERIFIED&quot;)">Verify</button>' +
          '<button class="reject" onclick="setStatus(&quot;' + d.id + '&quot;,&quot;REJECTED&quot;)">Reject</button>' +
        '</div></div>';
    }).join('');
  }
  function setStatus(id, status) {
    fetch(API + '/admin/drivers/' + id + '/status', {
      method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer ' + token},
      body: JSON.stringify({ status: status }),
    }).then(load);
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
</script>
</body></html>`;

module.exports = router;
