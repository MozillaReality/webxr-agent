<img src="https://raw.githubusercontent.com/webvrrocks/webvr-agent/master/public/img/promo.png" alt="WebVR Agent" title="WebVR Agent" width="220">

# WebVR Agent

UI helper for presenting and navigating [WebVR](https://webvr.rocks/) experiences.

We built the [WebVR Agent](https://github.com/webvrrocks/webvr-agent) as a drop-in JavaScript helper library to handle presentation and navigation of WebVR sites.

**[Check it out!](https://github.com/webvrrocks/webvr-agent)**

To include it in your site, simply include this snippet of code in your HTML (ideally, immediately before the `</head>` or before `</body>`):

```html
<script src="https://agent.webvr.rocks/client.js" async defer></script>
```

If your site has a [W3C Web-App Manifest](https://w3c.github.io/webvr/) included (referenced by `<link rel="manifest" href="manifest.webmanifest">` in the HTML of your site), the WebVR Agent displays a navigation bar at the bottom of your page, rendering the metadata for your app (including its logo, name, description), detecting the user's connected VR headsets, as well as managing entering/exiting VR mode, including mechanisms for streamlined page-to-page (i.e., scene-to-scene) navigation. (Easter egg: check out the keyboard shortcuts. _Hint: you can talk your computer, and it'll talk back._)

The library's [open source code is on GitHub](https://github.com/webvrrocks/webvr-agent), released under the [Creative Commons CC0-1.0 Public Domain license](https://github.com/webvrrocks/webvr-agent#license). Contributions are welcome!

Below you can enjoy some example scenes adapted from [Erica Layton](https://twitter.com/EricaLayton)'s magical [SkyIslands VR](https://www.skyislandsvr.com/) worlds (each site with its own web-app manifest and embedded `<script>` tags for the WebVR Agent).<br><br>

## Demo usage

## [Carnival Globe Trees](https://skyislands.webvr.rocks/carnivalglobetrees.html)

<a href="https://skyislands.webvr.rocks/carnivalglobetrees.html"><img src="https://cloud.headwayapp.co/changelogs_images/images/big/000/003/462-18f144dddc0c060cecc0de7d7ac4de696d363293.png" alt="Screenshot of SkyIslands VR: Carnival Globe Trees (embedded WebVR Agent, with a web-app manifest)" title="SkyIslands VR: Carnival Globe Trees" width="400"></a>

<details>
  <ul>
    <li>
      <strong><a href="https://skyislands.webvr.rocks/carnivalglobetrees.html">View the WebVR site</a></strong>
      <ul>
        <li>
          <a href="https://github.com/WebVRRocks/skyislands/blob/master/carnivalglobetrees.webmanifest">View the source code</a>
        </li>
      </ul>
    </li>
    <li>
      <strong><a href="https://fetchmanifest.org/manifest?ws=2&url=https://skyislands.webvr.rocks/carnivalglobetrees.html">View the processed manifest</a></strong>
      <ul>
        <li>
          <a href="https://github.com/WebVRRocks/skyislands/blob/master/carnivalglobetrees.webmanifest">View the source code]</a>
        </li>
      </ul>
    </li>
  </ul>
</details>

<hr>

## [Dark Lotus](https://skyislands.webvr.rocks/darklotus.html)

<a href="https://skyislands.webvr.rocks/darklotus.html"><img src="https://cloud.headwayapp.co/changelogs_images/images/big/000/003/463-40cf0fe3146f7722f9fc57b0e5a5e9d3e61845fe.png" alt="Screenshot of SkyIslands VR: Dark Lotus (embedded WebVR Agent, with a web-app manifest)" title="SkyIslands VR: Dark Lotus" width="400"></a>

<details>
  <ul>
    <li>
      <strong><a href="https://skyislands.webvr.rocks/darklotus.html">View the WebVR site</a></strong>
      <ul>
        <li>
          <a href="https://github.com/WebVRRocks/skyislands/blob/master/darklotus.webmanifest">View the source code</a>
        </li>
      </ul>
    </li>
    <li>
    <strong><a href="https://fetchmanifest.org/manifest?ws=2&amp;url=https://skyislands.webvr.rocks/darklotus.html">View the processed manifest</a></strong>
    <ul>
      <li>
        <a href="https://github.com/WebVRRocks/skyislands/blob/master/darklotus.webmanifest">View the source code</a>
      </li>
    </ul>
    </li>
  </ul>
</details>

<hr>

### [Meditation Orbs](https://skyislands.webvr.rocks/meditationorbs.html)

<a href="https://skyislands.webvr.rocks/meditationorbs.html"><img src="https://cloud.headwayapp.co/changelogs_images/images/big/000/003/465-de99f33a494a725593c5df92fdf10c1a2bf85b03.png" alt="Screenshot of SkyIslands VR: Meditation Orbs (embedded WebVR Agent, with a web-app manifest)" title="SkyIslands VR: Meditation Orbs" width="400"></a>

<details>
  <ul>
    <li>
      <strong><a href="https://skyislands.webvr.rocks/meditationorbs.html">View the WebVR site</a></strong>
      <ul>
        <li>
          <a href="https://github.com/WebVRRocks/skyislands/blob/master/meditationorbs.webmanifest">View the source code</a>
        </li>
      </ul>
    </li>
    <li>
      <strong><a href="https://fetchmanifest.org/manifest?ws=2&amp;url=https://skyislands.webvr.rocks/darklotus.html">View the processed manifest</a></strong>
      <ul>
        <li>
          <a href="https://github.com/WebVRRocks/skyislands/blob/master/meditationorbs.webmanifest">View the source code</a>
        </li>
      </ul>
    </li>
  </ul>
</details>

<hr>

If you have any issues or feature requests, feel free to [file an issue](https://github.com/webvrrocks/webvr-agent/issues) on the [GitHub project](https://github.com/webvrrocks/webvr-agent). Also, don't hesitate to [contact](https://twitter.com/cvanw) [us](https://twitter.com/whoyee) if there are any fun WebVR scenes in the wild that you'd like use the WebVR Agent.

<hr>

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

This project is automatically deployed to [this Heroku instance](https://agent.webvr.rocks/) when commits land on the `master` branch of this repository.


## License

All code and content within this source-code repository is licensed under the [**Creative Commons Zero v1.0 Universal** license (CC0 1.0 Universal; Public Domain Dedication)](LICENSE.md).

You can copy, modify, distribute and perform this work, even for commercial purposes, all without asking permission.

For more information, refer to these following links:

* a copy of the [license](LICENSE.md) in [this source-code repository](https://github.com/webvrrocks/webvr-agent)
* the [human-readable summary](https://creativecommons.org/publicdomain/zero/1.0/) of the [full text of the legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode)
* the [full text of the legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode)
