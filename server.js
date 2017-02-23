/* jshint node:true */
/* eslint-env es6 */

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

const IS_PROD = process.env.NODE_ENV === 'production';
const STATIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 4040;

let serverHost;
const noop = () => {};
const realtimeApis = {
  'users': memory(),
  'messages': memory()
};
const staticApi = feathers.static(STATIC_DIR);

const app = feathers()
  .configure(
    primus({
      transformer: 'websockets'
    })
  )
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
  if (IS_PROD) {
    next();
    return;
  }
  var reqHost = req.headers.host;
  var serverUrl = req.protocol.replace(':', '') + '://' + serverHost + req.url;
  if (reqHost !== serverHost) {
    res.redirect(302, serverUrl);
    return;
  }
  next();
});

app.get('/*.js', browserify(STATIC_DIR));

app.use('/', staticApi)
  .use(errorHandler());

var messageService = app.service('/messages');
messageService.create({text: 'Message one'}, {}, noop);
messageService.create({text: 'Message two'}, {}, noop);
messageService.create({text: 'Message three'}, {}, noop);

messageService.before({
  all: [
    authentication.hooks.verifyToken(),
    authentication.hooks.populateUser(),
    authentication.hooks.restrictToAuthenticated()
  ]
});

var userService = app.service('users');

// Add a hook to the user service to automatically replace
// the password with a hash of the password before saving it.
userService.before({
  create: authentication.hooks.hashPassword()
});

// Create a user to log in as.
var User = {
  email: 'user@example.com',
  password: 'password'
};

userService.create(User, {}).then(user => {
  console.log('Created default user', user);
});

const server = app.listen(PORT, () => {
  serverHost = `${ip.address()}:${server.address().port}`;
  console.log('Listening on %s', serverHost);
});
