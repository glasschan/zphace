/**
 * ZHpace - Chinese-English Text Spacing Utility
 * @version 1.1.3
 * @license MIT
 */

class Zhpace {
  static #patterns = {
    cjk: /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u,
    replacements: [
      {
        pattern: /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])([A-Za-z0-9@&=\u0370-\u03FF])/gu,
        replacement: "$1 $2",
      },
      {
        pattern: /([\x21-\x7E])([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
        replacement: "$1 $2",
      },
      {
        pattern: /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])(["'])/gu,
        replacement: "$1 $2",
      },
      {
        pattern: /(["'])([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
        replacement: "$1 $2",
      },
      {
        pattern: /([`"\u05f4]+)(\s*)(.+?)(\s*)([`"\u05f4]+)/g,
        replacement: "$1$3$5",
      },
      {
        pattern: /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])([$$$\{<])/gu,
        replacement: "$1 $2",
      },
      {
        pattern: /([$$$}>])([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
        replacement: "$1 $2",
      },
    ],
  };

  #observer = null;
  #throttle = 50;
  #debug = false;
  #processedNodes = new WeakSet();

  constructor(config = {}) {
    this.#throttle = config.throttle || 50;
    this.#debug = config.debug || false;
    if (this.#debug) {
      console.log("ZHpace initialized with config:", {
        throttle: this.#throttle,
        debug: this.#debug,
      });
    }
  }

  #hasNonCJKText(element) {
    const text = element.textContent;
    return text && !Zhpace.#patterns.cjk.test(text);
  }

  #spacingText(text) {
    try {
      if (typeof text !== "string") return text;
      if (text.length <= 1 || !Zhpace.#patterns.cjk.test(text)) return text;

      let result = text;
      for (const {pattern, replacement} of Zhpace.#patterns.replacements) {
        result = result.replace(pattern, replacement);
      }
      return result;
    } catch (error) {
      if (this.#debug) console.error("ZHpace spacing error:", error);
      return text;
    }
  }

  autoSpacing() {
    try {
      if (this.#debug) console.log("ZHpace autoSpacing initializing...");

      const spacingNodes = (nodes) => {
        const changes = [];
        const nodesToProcess = Array.from(nodes).filter((node) => !this.#processedNodes.has(node));

        for (const node of nodesToProcess) {
          if (node.nodeType === Node.TEXT_NODE) {
            let original = node.textContent;
            let newText = this.#spacingText(original);

            // 处理相邻元素节点
            const prevSibling = node.previousSibling;
            if (prevSibling?.nodeType === Node.ELEMENT_NODE && this.#hasNonCJKText(prevSibling)) {
              if (!/^\s/.test(newText)) newText = " " + newText;
            }

            const nextSibling = node.nextSibling;
            if (nextSibling?.nodeType === Node.ELEMENT_NODE && this.#hasNonCJKText(nextSibling)) {
              if (!/\s$/.test(newText)) newText = newText + " ";
            }

            if (newText !== original) {
              changes.push({node, newText});
            }
            this.#processedNodes.add(node);
          } else if (node.childNodes?.length) {
            const childNodesToProcess = Array.from(node.childNodes).filter((child) => !this.#processedNodes.has(child));
            if (childNodesToProcess.length) spacingNodes(childNodesToProcess);
            this.#processedNodes.add(node);
          }
        }

        if (changes.length) {
          requestAnimationFrame(() => {
            changes.forEach(({node, newText}) => (node.textContent = newText));
            if (this.#debug) console.log(`ZHpace processed ${changes.length} text nodes`);
          });
        }
      };

      requestIdleCallback(() => spacingNodes(document.body.childNodes), {timeout: this.#throttle * 2});

      this.#observer = new MutationObserver((mutations) => {
        const nodesToProcess = new Set();
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!this.#processedNodes.has(node)) nodesToProcess.add(node);
          });
        });
        if (nodesToProcess.size) {
          requestIdleCallback(() => spacingNodes(Array.from(nodesToProcess)), {timeout: this.#throttle});
        }
      });

      this.#observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      if (this.#debug) console.log("ZHpace autoSpacing initialized successfully");
    } catch (error) {
      if (this.#debug) console.error("ZHpace autoSpacing error:", error);
    }
  }

  destroy() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
    this.#processedNodes = new WeakSet();
    if (this.#debug) console.log("ZHpace destroyed");
  }
}

(() => {
  const config = window.zhpaceConfig || {};
  const zhpace = new Zhpace(config);

  window.zhpaceAPI = {
    autoSpacing: () => zhpace.autoSpacing(),
    destroy: () => zhpace.destroy(),
    version: "1.1.3",
  };

  if (config.autoInit !== false) {
    document.addEventListener("DOMContentLoaded", () => zhpace.autoSpacing());
  }
})();
