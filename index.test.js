/* eslint-disable no-unused-expressions */
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

/* eslint-disable no-console, object-curly-newline */
import { assert, expect } from '@esm-bundle/chai';
import { readFile } from '@web/test-runner-commands';
import sinon from 'sinon';
import {
  DEFAULT_OPTIONS,
  api,
  patchBlockConfig,
  preEager,
  postEager,
  preLazy,
  postLazy
} from './index.js';

function toClassName(val) {
  return val.toLowerCase().replace(/[^0-9a-z]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const context = {
  getMetadata: sinon.stub().callsFake((val) => document.querySelector(`head>meta[name=${val}]`)?.content || ''),
  loadCSS: sinon.stub(),
  toClassName: sinon.stub().callsFake(toClassName),
  toCamelCase: sinon.stub().callsFake((val = '') => toClassName(val).replace(/-([a-z])/g, (g) => g[1].toUpperCase())),
  plugins: {
    rum: {
      sampleRUM: sinon.stub(),
    },
  },
};

describe('Screens Plugin', () => {
  beforeEach(() => {
    window.hlx = { codeBasePath: '' };
  });

  describe('DEFAULT_OPTIONS', () => {
    it('set default options for the plugin', () => {
      expect(DEFAULT_OPTIONS).to.eql({
        itemDuration: 8000,
        itemFit: 'cover',
        proofOfPlay: false,
        type: 'generic',
      });
    });
  });

  describe('message', () => {
    let iframe;

    beforeEach(() => {
      iframe = document.createElement('iframe');
      iframe.src = 'about:blank';
      document.body.append(iframe);
    });

    afterEach(() => {
      iframe.remove();
    });

    it('does nothing when a "channel-status-ready" is received if there are no embedded channels', () => {
      sinon.spy(iframe.contentWindow, 'postMessage');
      const evt = new MessageEvent('message', {
        data: JSON.stringify({ namespace: 'screens-player', type: 'channel-status-ready' }),
        source: iframe.contentWindow,
      });
      window.dispatchEvent(evt);
      assert(!iframe.contentWindow.postMessage.called);
    });

    it('sends a "channel-show" message to the embedded channel that sent us the "channel-status-ready"', () => {
      const embed = document.createElement('div');
      embed.classList.add('embed');
      embed.append(iframe);
      document.body.append(embed);
      sinon.spy(iframe.contentWindow, 'postMessage');
      const evt = new MessageEvent('message', {
        data: JSON.stringify({ namespace: 'screens-player', type: 'channel-status-ready' }),
        source: iframe.contentWindow,
      });
      window.dispatchEvent(evt);
      assert(iframe.contentWindow.postMessage.calledWith(JSON.stringify({
        namespace: 'screens-player',
        type: 'channel-show',
        data: {},
      }), '*'));
    });

    it('sends a "channel-show" message to the embedded channel that sent us the "channel-status-ready" with multizone layout context if required', () => {
      const main = document.createElement('main');
      main.classList.add('cq-Screens-channel--multizone');
      document.body.append(main);
      const embed = document.createElement('div');
      embed.classList.add('embed');
      embed.append(iframe);
      main.append(embed);
      sinon.spy(iframe.contentWindow, 'postMessage');
      const evt = new MessageEvent('message', {
        data: JSON.stringify({ namespace: 'screens-player', type: 'channel-status-ready' }),
        source: iframe.contentWindow,
      });
      window.dispatchEvent(evt);
      assert(iframe.contentWindow.postMessage.calledWith(JSON.stringify({
        namespace: 'screens-player',
        type: 'channel-show',
        data: { context: 'multizone' },
      }), '*'));
    });
  });

  describe('Plugin API', () => {
    let block;

    beforeEach(() => {
      block = document.createElement('div');
    });

    afterEach(() => {
      block.innerHTML = '';
    });

    describe('#decorateSequenceItem', () => {
      it('does nothing if the block is not a map config', () => {
        api.decorateSequenceItem.call(context, block);
        expect(block.outerHTML).to.eql('<div></div>');

        block.innerHTML = '<div></div>';
        api.decorateSequenceItem.call(context, block);
        expect(block.outerHTML).to.eql('<div><div></div></div>');
      });

      it('sets the element src using the given value', () => {
        block.innerHTML = '<div><div>src</div><div>/foo</div></div>';
        const img = document.createElement('img');
        api.decorateSequenceItem.call(context, block, img);
        expect(block.outerHTML).to.eql('<div><img src="/foo"></div>');
      });

      it('sets the element src using the given value and custom parsing logic', () => {
        block.innerHTML = '<div><div>url</div><div>/foo</div></div>';
        const img = document.createElement('img');
        api.decorateSequenceItem.call(context, block, img, { src: (val) => val.toUpperCase() });
        expect(block.outerHTML).to.eql('<div><img src="/FOO"></div>');
      });

      it('sets the element content using the given value', () => {
        block.innerHTML = '<div><div>content</div><div>foo<strong>bar</strong></div></div>';
        api.decorateSequenceItem.call(context, block);
        expect(block.outerHTML).to.eql('<div>foo<strong>bar</strong></div>');
      });

      it('sets the element CSS classes using the given values', () => {
        block.innerHTML = '<div><div>style</div><div>foo,bar</div></div>';
        api.decorateSequenceItem.call(context, block);
        expect(block.outerHTML).to.eql('<div class="foo bar"></div>');
        block.className = '';

        block.innerHTML = '<div><div>class</div><div>baz,qux</div></div>';
        api.decorateSequenceItem.call(context, block);
        expect(block.outerHTML).to.eql('<div class="baz qux"></div>');
      });

      it('sets the element start and end dates using the given values', () => {
        block.innerHTML = `
          <div><div>startdate</div><div>2022-01-01T00:00:00.000</div></div>
          <div><div>enddate</div><div>2022-12-31T23:59:59.999</div></div>`;
        api.decorateSequenceItem.call(context, block);
        expect(block.outerHTML).to.eql('<div data-startdate="1640991600000" data-enddate="1672527599999"></div>');
      });

      it('sets the element strategy using the given values', () => {
        block.innerHTML = '<div><div>strategy</div><div>absolute</div></div>';
        api.decorateSequenceItem.call(context, block);
        expect(block.outerHTML).to.eql('<div data-strategy="absolute"></div>');
      });

      it('sets data attributes for generic properties', () => {
        block.innerHTML = '<div><div>foo</div><div>bar</div></div><div><div>baz</div><div>qux</div></div>';
        api.decorateSequenceItem.call(context, block);
        expect(block.outerHTML).to.eql('<div data-foo="bar" data-baz="qux"></div>');
      });
    });
  });

  describe('#patchBlockConfig', () => {
    it('intercepts the config for the image block', () => {
      const config = { blockName: 'image' };
      const result = patchBlockConfig(config, { basePath: '/plugins/screens' });
      expect(result).to.eql({
        blockName: 'image',
        cssPath: '/plugins/screens/blocks/image/image.css',
        jsPath: '/plugins/screens/blocks/image/image.js',
      });
    });

    it('intercepts the config for the video block', () => {
      const config = { blockName: 'video' };
      const result = patchBlockConfig(config, { basePath: '/plugins/screens' });
      expect(result).to.eql({
        blockName: 'video',
        cssPath: '/plugins/screens/blocks/video/video.css',
        jsPath: '/plugins/screens/blocks/video/video.js',
      });
    });

    it('intercepts the config for the embed block', () => {
      const config = { blockName: 'embed' };
      const result = patchBlockConfig(config, { basePath: '/plugins/screens' });
      expect(result).to.eql({
        blockName: 'embed',
        cssPath: '/plugins/screens/blocks/embed/embed.css',
        jsPath: '/plugins/screens/blocks/embed/embed.js',
      });
    });

    it('intercepts the config for the text-overlay block', () => {
      const config = { blockName: 'text-overlay' };
      const result = patchBlockConfig(config, { basePath: '/plugins/screens' });
      expect(result).to.eql({
        blockName: 'text-overlay',
        cssPath: '/plugins/screens/blocks/text-overlay/text-overlay.css',
        jsPath: '/plugins/screens/blocks/text-overlay/text-overlay.js',
      });
    });

    it('returns the default config for other blocks', () => {
      const config = { blockName: 'foo' };
      const result = patchBlockConfig(config, {});
      expect(result).to.eql({ blockName: 'foo' });
    });
  });

  describe('#preEager', () => {
    beforeEach(() => {
      document.body.innerHTML = '<main></main>';
      window.hlx.rum = { isSelected: false };
    });

    afterEach(() => {
      document.body.innerHTML = '';
    });

    it('does not force RUM collection if proof-of-play is disabled', () => {
      preEager.call(context, {});
      expect(window.hlx.rum.isSelected).to.eql(false);
    });

    it('forces RUM collection if proof-of-play is enabled', () => {
      preEager.call(context, { proofOfPlay: true });
      expect(window.hlx.rum.isSelected).to.eql(true);
    });

    it('decorates the page with Screens channel classes', () => {
      preEager.call(context, {});
      expect(document.body.innerHTML).to.eql('<main class="cq-Screens-channel cq-Screens-channel--generic"></main>');
      preEager.call(context, { type: 'sequence' });
      expect(document.body.innerHTML).to.eql('<main class="cq-Screens-channel cq-Screens-channel--sequence"></main>');
    });
  });

  describe('#postEager', () => {
    it('decorates the sequence in the channel', () => {
      document.body.innerHTML = '<main><div class="section"></div><div class="section"></div></main>';
      postEager.call(context, { type: 'sequence' });
      expect(document.querySelector('main>.cq-Sequence[data-strategy]')).to.be.ok;
      expect(document.querySelectorAll('main>.cq-Sequence>.section.parbase.cq-Sequence-item').length).to.eql(2);
      document.body.innerHTML = '';
    });

    it('sets the default duration on all sequence elements', () => {
      document.body.innerHTML = '<main><div class="section"></div><div class="section"></div></main>';
      postEager.call(context, { type: 'sequence', itemDuration: 1337 });
      expect(document.querySelectorAll('.cq-Sequence-item[data-duration="1337"]').length).to.eql(2);
      document.body.innerHTML = '';
    });

    it('sets the default object fitting config on all sequence elements', () => {
      document.body.innerHTML = '<main><div class="section"></div><div class="section"></div></main>';
      postEager.call(context, { type: 'sequence', itemFit: 'cover' });
      expect(document.querySelectorAll('.cq-Sequence-item[data-item-fit="cover"]').length).to.eql(2);
      document.body.innerHTML = '';
    });
  });

  describe('#preLazy', () => {
    const observeMock = sinon.stub();

    beforeEach(() => {
      window.PerformanceObserver = sinon.stub(window, 'IntersectionObserver').callsFake(() => ({
        observe: observeMock,
      }));
    });

    afterEach(() => {
      window.PerformanceObserver.restore();
      observeMock.reset();
    });

    it('instruments observers for proof-of-play if enabled', () => {
      document.body.innerHTML = '<main><div class="cq-Sequence-item"><img src="/foo.webp"/></div></main>';
      preLazy.call(context, { proofOfPlay: true });
      assert(observeMock.calledOnce);
      document.body.innerHTML = '';
    });

    it('loads the required dependencies for sequence channels', () => {
      preLazy.call(context, { type: 'sequence' });
      const script = document.querySelector('head>script[src*="/sequencechannel-embed.min.js"]');
      expect(script).to.exist;
      script.remove();
    });

    it('loads the required dependencies for generic channels', () => {
      preLazy.call(context, {});
      const script = document.querySelector('head>script[src*="/channel-embed.min.js"]');
      expect(script).to.exist;
      script.remove();
    });
  });

  describe('#postLazy', () => {
    it('sends the "channel-status-ready" message', () => {
      sinon.spy(window, 'postMessage');
      postLazy();
      assert(window.postMessage.calledWith(JSON.stringify({
        namespace: 'screens-player',
        type: 'channel-status-ready',
      }), '*'));
    });
  });
});
