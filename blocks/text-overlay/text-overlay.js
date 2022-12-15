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
import { toClassName } from '/scripts/lib-franklin.js';

export default async function decorate(block) {
  // Direct link embed
  if (block.childElementCount == 1 && block.firstElementChild.childElementCount === 1) {
    block.innerHTML = block.firstElementChild.firstElementChild.innerHTML;
  } else { // Map config
    const config = [...block.children].reduce((config, div) => {
      const key = toClassName(div.children[0].textContent);
      const value = div.children[1];
      return {
        ...config,
        [key]: value
      }
    }, {});
    let content;
    Object.entries(config).forEach(([key, value]) => {
      if (key === 'content' && value) {
        content = value;
      } else if (key === 'style' || key === 'class') {
        value.textContent.split(',').forEach((style) => block.classList.add(toClassName(style)));
      } else {
        block.setAttribute(`data-${key}`, value.textContent.toLowerCase());
      }
    });
    block.innerHTML = content.innerHTML;
  }
}
