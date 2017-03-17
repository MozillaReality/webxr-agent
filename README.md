# WebVR Agent

UI helper for presenting and navigating [WebVR](https://webvr.rocks/) experiences.


## Local development

First, clone this repo:

```bash
mkdir -p webvrrocks && git clone git@github.com:webvrrocks/webvr-agent.git webvrrocks/webvr-agent && cd webvrrocks/webvr-agent
```

To install the [Node](https://nodejs.org/en/download/) dependencies:

```bash
npm install
```

To start the server:

```bash
npm start
```


## Deployment

Run these commands locally to set up on the server the process manager, [`pm2`](https://github.com/Unitech/pm2), which is used to run the Node web services:

```bash
ssh wwwnode@138.197.120.12 "npm install pm2 -g && pm2 install pm2-webhook && mkdir -p /var/www/node"
scp pm2-ecosystem.json wwwnode@138.197.120.12:/var/www/node/pm2-ecosystem.json
ssh wwwnode@138.197.120.12 "pm2 startup && pm2 startOrGracefulReload /var/www/node/pm2-ecosystem.json"
```


## License

All code and content within this source-code repository is licensed under the [**Creative Commons Zero** license (CC0 1.0 Universal; Public Domain Dedication)**](LICENSE.md).

You can copy, modify, distribute and perform this work, even for commercial purposes, all without asking permission.

For more information, refer to these following links:

* a copy of the [license](LICENSE.md) in [this source-code repository](https://github.com/webvrrocks/webvr-agent)
* the [human-readable summary](https://creativecommons.org/publicdomain/zero/1.0/) of the [full text of the legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode)
* the [full text of the legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode)
