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

let i = 0;

export default async function decorate(block, plugins) {
  const key = 'screens-zone-cell' + ++i;

  // Add the `cq-Screens-subsequence` class as this is required by the default Screens instrumentation
  block.closest('.section').classList.add('cq-Screens-subsequence');

  // Direct link embed
  if (block.childElementCount == 1 && block.firstElementChild.childElementCount === 1) {
    const src = block.firstElementChild.firstElementChild.textContent;
    block.innerHTML = `<iframe id="${key}" src="${src}"><iframe>`;
  } else { // Map config
    const iframe = document.createElement('iframe');
    iframe.setAttribute('id', key);
    if (plugins.screens) { // Apply screens sequence item config
      plugins.screens.decorateSequenceItem(block, iframe);
    }
  }
  
}
