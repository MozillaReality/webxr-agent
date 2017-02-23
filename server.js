/* jshint node:true */
/* eslint-env es6 */

const crypto = require('crypto');
const path = require('path');

const authentication = require('feathers-authentication');
const bodyParser = require('body-parser');
const browserify = require('browserify-middleware');
const errorHandler = require('feathers-errors/handler');
const feathers = require('feathers');
const hooks = require('feathers-hooks');
const ip = require('ip');
const memory = require('feathers-memory');
const primus = require('feathers-primus');
const rest = require('feathers-rest');

const IS_PROD = process.env.NODE_ENV === 'production';
const STATIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 4040;

let serverHost;
const realtimeApis = {
  'users': memory(),
  'messages': memory()
};
const staticApi = feathers.static(STATIC_DIR);

const getHash = str => crypto.createHash('sha256').update(str).digest('base64');
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
  .configure(
    authentication({
      idField: 'id',
      successRedirect: false,
      failureRedirect: false
    })
  );

Object.keys(realtimeApis).forEach(key => {
  app.use('/' + key, realtimeApis[key]);
});

app.get('/*.js', (req, res, next) => {
  var url = req.url;
  if (!('_' in req.query)) {
    var hash = '_=' + getHash(serverHost + req.get('origin') + req.query['url'] + req.headers['accept-language'] + req.headers['accept-encoding'] + req.headers['user-agent'] + req.headers['host']);
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

app.use('/', staticApi)
  .use(errorHandler());

// Create a dummy Message
app.service('messages').create({
  text: 'Server message',
  complete: false
}).then(msg => {
  console.log('Created message:', msg);
});

// var messageService = app.service('messages');
// messageService.create({text: 'Message one'}, {}, noop);
// messageService.create({text: 'Message two'}, {}, noop);
// messageService.create({text: 'Message three'}, {}, noop);

// messageService.before({
//   all: [
//     authentication.hooks.verifyToken(),
//     authentication.hooks.populateUser(),
//     authentication.hooks.restrictToAuthenticated()
//   ]
// });

// var userService = app.service('users');

// // Add a hook to the user service to automatically replace
// // the password with a hash of the password before saving it.
// userService.before({
//   create: authentication.hooks.hashPassword()
// });

// // Create a user to log in as.
// var User = {
//   email: 'user@example.com',
//   password: 'password'
// };

// userService.create(User, {}).then(user => {
//   console.log('Created default user', user);
// });

const server = app.listen(PORT, () => {
  serverHost = `${ip.address()}:${server.address().port}`;
  console.log('Listening on %s', serverHost);
});
