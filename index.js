/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export const DEFAULT_OPTIONS = {
  itemDuration: 8000,
  itemFit: 'cover',
  proofOfPlay: false,
  type: 'generic',
};

// Post a message to other frames listening for Screens events
function postMessage(type, data, target = window) {
  target.postMessage(JSON.stringify({
    namespace: 'screens-player',
    type,
    data,
  }), '*');
}

// Handle messaging across iframes
window.addEventListener('message', (ev) => {
  if (!ev.data || ev.source === window) {
    return;
  }
  try {
    const data = JSON.parse(ev.data);
    if (data.namespace !== 'screens-player') {
      return;
    }
    switch (data.type) {
      case 'player-wio-ready': // we are informed that the player firmware is ready (before channels are shown)
        break;
      case 'display-initialized': // we are informed that the display data is available
        break;
      case 'channel-status-ready': { // we are informed that another channel (likely an embed) is now ready
        // Start the embedded channel if we have any
        const embed = [...document.querySelectorAll('.embed iframe')]
          .find((iframe) => iframe.contentWindow === ev.source);
        if (embed) {
          const options = document.querySelector('.cq-Screens-channel--multizone') ? { context: 'multizone' } : {};
          postMessage('channel-show', options, embed.contentWindow);
        }
        break;
      }
      case 'channel-show': // we are informed that the current channel is now visible in the player
        break;
      default:
        // ignore
    }
  } catch (err) {
    // Ignore invalid messages
  }
});

// Load and inline a script
function loadScript(url, callback, type) {
  const head = document.querySelector('head');
  const script = document.createElement('script');
  script.setAttribute('src', url);
  if (type) {
    script.setAttribute('type', type);
  }
  head.append(script);
  script.onload = callback;
  return script;
}

// Decorate the sequence content with the required markup
function decorateSequence(main) {
  main.querySelectorAll('.section').forEach((section) => {
    section.classList.add('parbase');
    section.classList.add('cq-Sequence-item');
  });
  main.innerHTML = `<div class="cq-Sequence aem-LayoutCell--1-1" data-strategy="normal">${main.innerHTML}</div>`;
}

// Instrument the proof-of-play feature on channel items
const timers = {};
function instrumentProofOfPlay(main) {
  const proofOfPlayObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const src = entry.target.currentSrc || entry.target.src || entry.target.href;
      const url = new URL(src);
      const path = url.origin === window.location.origin ? url.pathname : url.href;
      const data = { source: path };
      if (!entry.isIntersecting && timers[path]) {
        data.target = Date.now() - timers[path];
        this.plugins.rum.sampleRUM('screens-image', data);
      } else if (entry.isIntersecting) {
        timers[path] = Date.now();
      }
    });
  }, { threshold: 0.8 });

  main.querySelectorAll('.cq-Sequence-item :is(img, video, iframe)').forEach((element) => {
    proofOfPlayObserver.observe(element);
  });
  window.addEventListener('beforeunload', () => proofOfPlayObserver.disconnect());
}

/**
 * The plugin API
 */
export const api = {
  // Decorate the sequence item block
  decorateSequenceItem(block, sourceEl = {}, options = {}) {
    // If the block is a single cell, there is no decoration to be done
    if (!block.childElementCount || block.firstElementChild.childElementCount !== 2) {
      return;
    }

    // Extract config from the block map
    const config = [...block.children].reduce((result, div) => {
      const key = this.toClassName(div.children[0].textContent);
      const value = div.children[1];
      return {
        ...result,
        [key]: value,
      };
    }, {});

    let content;
    Object.entries(config).forEach(([key, value]) => {
      switch (key) {
        case 'src':
        case 'url':
          sourceEl.src = options.src
            ? options.src(value.textContent)
            : value.textContent;
          break;
        case 'content':
          content = value;
          break;
        case 'class':
        case 'style':
          value.textContent.split(',')
            .forEach((style) => block.classList.add(this.toClassName(style)));
          break;
        case 'enddate':
        case 'startdate':
          block.setAttribute(`data-${key}`, new Date(value.textContent).getTime());
          break;
        case 'strategy':
          block.setAttribute(`data-${key}`, value.textContent.toLowerCase());
          break;
        default:
          block.setAttribute(`data-${key}`, value.textContent);
      }
    });
    block.innerHTML = content ? content.innerHTML : (sourceEl.outerHTML || '');
  },
};

/**
 * Override path for plugin blocks
 */
export function patchBlockConfig(config, options) {
  const { blockName } = config;
  if (['image', 'video', 'embed', 'text-overlay'].includes(config.blockName)) {
    return {
      blockName,
      cssPath: `${window.hlx.codeBasePath}${options.basePath}/blocks/${blockName}/${blockName}.css`,
      jsPath: `${window.hlx.codeBasePath}${options.basePath}/blocks/${blockName}/${blockName}.js`,
    };
  }
  return config;
}

/**
 * Logic to execute in the pre eager phase
 */
export function preEager({
  basePath,
  type = DEFAULT_OPTIONS.type,
  proofOfPlay = DEFAULT_OPTIONS.proofOfPlay,
}) {
  this.loadCSS(`${basePath}/screens.css`);

  // Force RUM collection if proof of play is enabled
  if (proofOfPlay) {
    window.hlx.rum.isSelected = window.hlx.rum.isSelected || proofOfPlay;
  }

  const main = document.querySelector('main');
  main.className = `cq-Screens-channel cq-Screens-channel--${type}`;
}

/**
 * Logic to execute in the post eager phase
 */
export function postEager({
  type = DEFAULT_OPTIONS.type,
  itemDuration = DEFAULT_OPTIONS.itemDuration,
  itemFit = DEFAULT_OPTIONS.itemFit,
}) {
  if (type === 'sequence') { // Custom logic for sequence channels
    document.querySelectorAll('.section').forEach((item) => {
      if (itemDuration) {
        item.setAttribute('data-duration', itemDuration);
      }
      if (itemFit) {
        item.setAttribute('data-item-fit', itemFit);
      }
    });

    const main = document.querySelector('main');
    decorateSequence(main);
  }
}

/**
 * Logic to execute in the pre lazy phase
 */
export function preLazy({
  basePath = '',
  type = DEFAULT_OPTIONS.type,
  proofOfPlay = DEFAULT_OPTIONS.proofOfPlay,
}) {
  if (proofOfPlay && this.plugins?.rum) {
    const main = document.querySelector('main');
    instrumentProofOfPlay.call(this, main);
  }

  // Needs to be loaded in the lazy phase as it requires the sequence to be decorated properly
  if (type === 'sequence') { // Custom logic for sequence channels
    return new Promise((resolve) => {
      loadScript(`${basePath}/sequencechannel-embed.min.js`, () => {
        resolve();
      });
    });
  }
  // Regular channels
  return new Promise((resolve) => {
    loadScript(`${basePath}/channel-embed.min.js`, () => {
      resolve();
    });
  });
}

export function postLazy() {
  postMessage('channel-status-ready');
}
