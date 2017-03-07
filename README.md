# WebVR Agent

UI helper for presenting and navigating WebVR experiences.


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

This code is licensed under the [MIT License](LICENSE.md).
