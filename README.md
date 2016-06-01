# A-Frame Wonderland

Greetings! This is an A-Frame playground — A-Wonderland, if you will.


## Local development

First, clone this repo:

```bash
git clone git@github.com:aframevr/wonderland.git aframevr-wonderland && cd aframevr-wonderland
```

You'll need a local development server to work on this project.

Included in this repo is a Browsersync server that out of the box handles live-reloading and tunnelling (useful for loading sites on other networks and mobile devices).

To install the [Node](https://nodejs.org/en/download/) dependencies:

```bash
npm install
```

To start the server:

```bash
npm start
```

If you'd rather not depend on Node, there are [several other options of running the content locally](https://github.com/mrdoob/three.js/wiki/How-to-run-things-locally).


## Maintainers

To install new JS dependencies to `js/vendor/`:

```bash
npm run jspm -- install github:donmccurdy/aframe-extras github:aframevr/aframe@master github:gasolin/aframe-href-component
```

And to run any other [jspm commands](https://github.com/jspm/jspm-cli#documentation), simply prefix your command with `npm run jspm -- `.
