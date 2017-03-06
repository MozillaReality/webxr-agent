/* jshint node:true */
/* eslint-env es6 */

const crypto = require('crypto');
const path = require('path');

const bodyParser = require('body-parser');
const browserify = require('browserify-middleware');
const cors = require('cors');
// const errorHandler = require('feathers-errors/handler');
const feathers = require('feathers');
const fetchManifest = require('fetch-manifest');
const hooks = require('feathers-hooks');
const ip = require('ip');
const memory = require('feathers-memory');
const primus = require('feathers-primus');
const rest = require('feathers-rest');
const urlParse = require('url-parse');

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
const getReqHash = req => {
  if (app.get('dnt')) {
    return '';
  }
  return getHash(serverHost + req.headers['accept-language'] + req.headers['accept-encoding'] + req.headers['user-agent'] + req.headers['x-forwarded-for'] + req.connection.remoteAddress);
};

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

app.use((req, res, next) => {
  app.set('dnt', req.headers.dnt === '1' || req.headers.dnt === 1);
  next();
});

Object.keys(realtimeApis).forEach(key => {
  app.use('/' + key, realtimeApis[key]);
});

app.get('/*.js', (req, res, next) => {
  let url = req.url;
  if (!('_' in req.query)) {
    let hash = getReqHash(req);
    if (hash) {
      if (url.indexOf('?') > -1) {
         url += '&_=' + hash;
      } else {
         url += '?_=' + hash;
      }
    }
  }

  if (!IS_PROD) {
    let reqHost = req.headers.host;
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

// let messages = app.service('messages');

app.use('/messages', memory({
  paginate: {
    'default': 2,
    'max': 4
  }
}));

app.use('*', (req, res, next) => {
  res.header('VR-Default-Display', 'HTC Vive');
  res.header('VR-Available-Displays', 'HTC Vive, Oculus Rift, Google Daydream, Samsung Gear VR, Google Cardboard');
  next();
});

let manifests = {};
let sessions = {};

function cacheManifest (data, urlKeys) {
  (urlKeys || []).forEach(url => {
    manifests[url] = data;
  });
  if (data.processed_manifest_url) {
    manifests[data.processed_manifest_url] = data;
  }
  if (data.processed_document_url) {
    manifests[data.processed_document_url] = data;
  }
  return true;
}

function getCachedManifest (url) {
  if (url in manifests) {
    // Asynchronously update the cached manifest.
    getManifest(url).catch(console.error.bind(console));
    // Immediately return the cached manifest.
    return Promise.resolve(manifests[url]);
  }
  // Upon cache miss, fetch the manifest
  // (which will also be cached upon completion).
  return getManifest(url);
}

function getManifest (url) {
  return new Promise(resolve => {
    return fetchManifest.fetchManifest(url).then(data => {
      // console.log(JSON.stringify(data, null, 2));
      resolve(data);
      cacheManifest(data, [url]);
    }).catch(err => {
      let errMsg = err && err.message ? err.message : null;
      let data = {
        success: false,
        error: true,
        message: errMsg
      };
      if (errMsg) {
        console.warn(errMsg);
      }
      // console.error(JSON.stringify(data, null, 2));
      resolve(data);
      cacheManifest(data, [url]);
    });
  });
}

function getUrlFromRequest (req, strToSplitOn) {
  let parsedUrl = urlParse(req.url);

  let url = '';

  if ('url' in req.query) {
    url = req.query.url;
  }
  if (!url) {
    url = req.query.body;
  }
  if (!url) {
    url = req.url.split(strToSplitOn || '/manifest/')[1];
  }

  url = (url || '').trim();

  if (!url) {
    return null;
  }

  parsedUrl = urlParse(url);

  let parsedProtocol = parsedUrl.protocol;
  if (!parsedProtocol || parsedProtocol.indexOf('http') !== 0) {
    url = 'https://' + url.replace(/^:?\/\//, '');
  }

  parsedUrl = urlParse(url);

  return parsedUrl.href;
}

app.get('/manifests', (req, res) => {
  // TODO: Add pagination.
  res.send(manifests);
});

app.get('/manifest*', (req, res, next) => {
  let parsedUrl = urlParse(req.url);

  if (parsedUrl.pathname.indexOf('/manifest.') === 0) {
    // Bail if the user tries to request this server's manifest.
    next();
    return;
  }

  let url = getUrlFromRequest(req);

  if (!url) {
    res.send(400, {
      error: true,
      message: '`url` parameter is required to fetch from a manifest URL or document URL'
    });
    return;
  }

  getCachedManifest(url).then(data => {
    // let dataText = JSON.stringify(data, null, 2);
    // if (data.error) {
    //   console.error(dataText);
    // } else {
    //   console.log(dataText);
    // }
    res.send(data);
  }).catch(err => {
    console.error('Unexpected error fetching manifest for "%s":', url, err);
  });
});

app.get('/sessions', (req, res) => {
  // TODO: Add pagination.
  let hash = getReqHash(req);
  console.log('hash', hash);
  res.send(sessions[hash] || '');
});

app.post('/sessions', (req, res, next) => {
  let hash = getReqHash(req);
  if (!hash) {
    res.send({
      success: false,
      error: 'Did not store because of DNT'
    });
    return;
  }
  let displayId = String(req.body.displayId);
  let displayIsPresenting = req.body.isPresenting === true || req.body.isPresenting === 'true';
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
