/**
 * ZHpace - Chinese-English Text Spacing Utility
 * @version 1.1.2
 * @license MIT
 */

class Zhpace {
  // 使用靜態變量存儲正則表達式模式，編譯一次後可重複使用
  static #patterns = {
    // 檢測是否包含 CJK 字符的正則表達式
    cjk: /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u,

    // 優化：將所有替換模式合併為一個對象，便於維護
    replacements: [
      // CJK 字符後跟字母數字時添加空格
      {
        pattern: /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])([A-Za-z0-9@&=\u0370-\u03FF])/gu,
        replacement: "$1 $2",
      },
      // 字母數字後跟 CJK 字符時添加空格
      {
        pattern: /([\x21-\x7E])([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
        replacement: "$1 $2",
      },
      // CJK 字符後跟引號時添加空格
      {
        pattern: /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])(["'])/gu,
        replacement: "$1 $2",
      },
      // 引號後跟 CJK 字符時添加空格
      {
        pattern: /(["'])([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
        replacement: "$1 $2",
      },
      // 修復引號內的多餘空格
      {
        pattern: /([`"\u05f4]+)(\s*)(.+?)(\s*)([`"\u05f4]+)/g,
        replacement: "$1$3$5",
      },
      // CJK 字符後跟括號時添加空格
      {
        pattern: /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])([\(\[\{<])/gu,
        replacement: "$1 $2",
      },
      // 括號後跟 CJK 字符時添加空格
      {
        pattern: /([\)\]}>])([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu,
        replacement: "$1 $2",
      },
    ],
  };

  #observer = null;
  #throttle = 50;
  #debug = false;

  // 使用 WeakSet 跟踪已處理的節點，避免重複處理
  #processedNodes = new WeakSet();

  constructor(config = {}) {
    this.#throttle = config.throttle || 50;
    this.#debug = config.debug || false;

    // 如果設置了 debug 模式，輸出初始化信息
    if (this.#debug) {
      console.log("ZHpace initialized with config:", {
        throttle: this.#throttle,
        debug: this.#debug,
      });
    }
  }

  /**
   * 內部使用的文本間距處理函數
   * @param {string} text - 輸入文本
   * @returns {string} 處理後的文本
   * @private
   */
  #spacingText(text) {
    try {
      // 快速類型檢查
      if (typeof text !== "string") {
        return text;
      }

      // 優化：快速檢查是否需要處理
      if (text.length <= 1 || !Zhpace.#patterns.cjk.test(text)) {
        return text;
      }

      // 使用單次遍歷對所有模式進行替換，而不是多次調用 replace
      let result = text;
      for (const {pattern, replacement} of Zhpace.#patterns.replacements) {
        result = result.replace(pattern, replacement);
      }

      return result;
    } catch (error) {
      if (this.#debug) {
        console.error("ZHpace spacing error:", error);
      }
      return text;
    }
  }

  /**
   * 優化的自動間距處理初始化
   */
  autoSpacing() {
    try {
      if (this.#debug) {
        console.log("ZHpace autoSpacing initializing...");
      }

      const spacingNodes = (nodes) => {
        const changes = [];
        const nodesToProcess = Array.from(nodes).filter((node) => !this.#processedNodes.has(node));

        for (const node of nodesToProcess) {
          if (node.nodeType === Node.TEXT_NODE) {
            const original = node.textContent;
            // 直接調用內部方法處理文本
            const newText = this.#spacingText(original);

            if (newText !== original) {
              changes.push({node, newText});
            }

            // 標記節點為已處理
            this.#processedNodes.add(node);
          } else if (node.childNodes?.length) {
            // 優化：只處理未處理過的子節點
            const childNodesToProcess = Array.from(node.childNodes).filter((child) => !this.#processedNodes.has(child));

            if (childNodesToProcess.length > 0) {
              spacingNodes(childNodesToProcess);
            }

            // 標記節點為已處理
            this.#processedNodes.add(node);
          }
        }

        // 批量應用更改以減少重繪
        if (changes.length) {
          requestAnimationFrame(() => {
            changes.forEach(({node, newText}) => {
              node.textContent = newText;
            });

            if (this.#debug) {
              console.log(`ZHpace processed ${changes.length} text nodes`);
            }
          });
        }
      };

      // 初始處理 - 使用 requestIdleCallback 在瀏覽器空閒時進行處理
      requestIdleCallback(() => spacingNodes(document.body.childNodes), {timeout: this.#throttle * 2});

      // 設置 MutationObserver 以處理動態添加的內容
      this.#observer = new MutationObserver((mutations) => {
        // 優化：收集所有新增節點，避免重複處理
        const nodesToProcess = new Set();

        mutations.forEach((mutation) => {
          if (mutation.addedNodes.length) {
            mutation.addedNodes.forEach((node) => {
              // 檢查節點是否已被處理
              if (!this.#processedNodes.has(node)) {
                nodesToProcess.add(node);
              }
            });
          }
        });

        if (nodesToProcess.size) {
          // 使用 requestIdleCallback 在瀏覽器空閒時進行處理
          requestIdleCallback(() => spacingNodes(Array.from(nodesToProcess)), {timeout: this.#throttle});
        }
      });

      // 觀察 DOM 變化
      this.#observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      if (this.#debug) {
        console.log("ZHpace autoSpacing initialized successfully");
      }
    } catch (error) {
      if (this.#debug) {
        console.error("ZHpace autoSpacing error:", error);
      }
    }
  }

  /**
   * 清理資源並釋放內存
   */
  destroy() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }

    // 清空已處理節點集合
    this.#processedNodes = new WeakSet();

    if (this.#debug) {
      console.log("ZHpace destroyed");
    }
  }
}

// 使用立即執行函數表達式 (IIFE) 來避免全局命名空間污染
(() => {
  // 初始化配置
  const config = window.zhpaceConfig || {};
  const zhpace = new Zhpace(config);

  // 將 API 暴露給全局作用域，但只暴露必要的方法
  window.zhpaceAPI = {
    autoSpacing: () => zhpace.autoSpacing(),
    destroy: () => zhpace.destroy(),
    version: "1.1.2", // 更新版本號以反映優化
  };

  // 根據配置自動初始化
  if (config.autoInit !== false) {
    // 使用 DOMContentLoaded 事件觸發自動間距處理
    document.addEventListener("DOMContentLoaded", () => zhpace.autoSpacing());
  }
})();
