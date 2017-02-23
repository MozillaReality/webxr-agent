/* jshint node:true */
/* eslint-env es6 */

const crypto = require('crypto');
const path = require('path');

const bodyParser = require('body-parser');
const browserify = require('browserify-middleware');
const cors = require('cors');
const errorHandler = require('feathers-errors/handler');
const feathers = require('feathers');
const hooks = require('feathers-hooks');
const ip = require('ip');
const memory = require('feathers-memory');
const primus = require('feathers-primus');
const rest = require('feathers-rest');

let IS_PROD = process.env.NODE_ENV === 'production';
const STATIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 4040;

let serverHost;
const realtimeApis = {
  // 'users': memory(),
  'messages': memory(),
};
const staticApi = feathers.static(STATIC_DIR);

const getHash = str => crypto.createHash('sha256').update(str).digest('base64');
const getReqHash = req => getHash(serverHost + req.get('origin') + req.query['url'] + req.headers['accept-language'] + req.headers['accept-encoding'] + req.headers['user-agent'] + req.headers['host']);
const noop = () => {};

const app = feathers()
  .configure(
    primus({
      transformer: 'websockets'
    })
  )
  .configure(rest())
  .configure(hooks())
  .use(bodyParser.json())
  .use(
    bodyParser.urlencoded({
      extended: true
    })
  )
  .options('*', cors())
  .use(cors());

Object.keys(realtimeApis).forEach(key => {
  app.use('/' + key, realtimeApis[key]);
});

app.get('/*.js', (req, res, next) => {
  var url = req.url;
  if (!('_' in req.query)) {
    var hash = '_=' + getReqHash(req);
    if (url.indexOf('?') > -1) {
       url += '&' + hash;
    } else {
       url += '?' + hash;
    }
  }

  if (!IS_PROD) {
    var reqHost = req.headers.host;
    if (reqHost !== serverHost) {
      url = req.protocol.replace(':', '') + '://' + serverHost + url;
    }
  }

  if (req.url !== url) {
    res.redirect(302, url);
    return;
  }

  next();
});

app.get('/*.js', browserify(STATIC_DIR));

// Create a dummy Message
var messages = app.service('messages');

app.use('/messages', memory({
  paginate: {
    'default': 2,
    'max': 4
  }
}));

var sessions = {};

app.get('/sessions', (req, res) => {
  var hash = getReqHash(req);
  var displayId = sessions[hash];
  if (!IS_PROD) {
    console.log('GET', req.url, sessions);
  }
  res.send({
    displayIsPresenting: !!displayId,
    displayId: displayId
  });
});

app.post('/sessions', (req, res, next) => {
  var hash = getReqHash(req);
  var displayId = String(req.body.displayId);
  var displayIsPresenting = Boolean(req.body.displayIsPresenting);
  if (displayIsPresenting) {
    sessions[hash] = displayId;
  } else {
    delete sessions[hash];
  }
  if (!IS_PROD) {
    console.log('POST', req.url, req.body, sessions);
  }
  res.send({
    success: true
  });
});

app.use('/', staticApi);
  // .use(errorHandler());

const server = app.listen(PORT, () => {
  IS_PROD = app.settings.env !== 'development';
  serverHost = `${ip.address()}:${server.address().port}`;
  console.log('Listening on %s', serverHost);
});
