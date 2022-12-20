# franklin-plugin-screens

A digital signage plugin for Franklin that adopts the AEM Screens APIs, so you can use Franklin as a content provider for your AEM Screens Cloud Services projects. It is meant to be used with this forked [Franklin Project Boilerplate](https://github.com/ramboz/helix-project-boilerplate) that includes a plugin system.

## Install

### Via the boilerplate

```bash
npm run franklin:plugin:add --name=screens --url=git@github.com:ramboz/franklin-plugin-screens.git
```

You can then later update it from the source again via:
```bash
npm run franklin:plugin:update --name=screens
```

### Manually

```bash
git subtree add --squash --prefix plugins/screens git@github.com:ramboz/franklin-plugin-screens.git main
```

You can then later update it from the source again via:
```bash
git subtree pull --squash --prefix plugins/screens git@github.com:ramboz/franklin-plugin-screens.git main
```

## Usage

The easiest is to load the plugin via the `withPlugin` method provided in this forked [Franklin Project Boilerplate](https://github.com/ramboz/helix-project-boilerplate).

```js
import { withPlugin } from './lib-franklin.js';

...

await withPlugin('/plugins/screens/index.js', {
  condition: () => window.location.hostname === 'localhost' || window.location.origin.endsWith('.hlx.page')
});
```

## Configuration

| Name | Default | Type | Description |
|-|-|-|-|
| `itemDuration` | `8000` | `number` | Default duration in ms to show items in a sequence channel
| `itemFit` | `cover` | `string` | Default algorithm to use to fit images/videos for sequence channels. Use either `cover` or `fit`
| `proofOfPlay` | `false` | `boolean` | Whether to track proof of play events via RUM instrumentation
| `type` | `generic` | `string` | The type of channel. Use one of `sequence`, `multizone` or `generic`

You'd use those as follows:
```js
await withPlugin('/plugins/perflogger/index.js', {
  itemDuration: 8000,
  itemFit: 'cover',
  proofOfPlay: false,
  type: 'generic',
});
```
