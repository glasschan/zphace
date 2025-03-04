<?php
/**
 * Plugin Name: ZHpace - 中英文排版自動優化工具
 * Plugin URI: https://github.com/glasschan/zphace
 * Description: 智能偵測並自動為中英文間添加空格，優化網站排版視覺體驗。支援動態內容處理、高效能輕量級設計、可自定義配置，適用於文章內容、標題、評論及各類動態生成的文本。
 * Version: 1.1.3
 * Requires at least: 6.7
 * Requires PHP: 8.1
 * Author: SEAFOODHOLDHAND 史佛浩恒
 * Author URI: https://seafoodholdhand.com
 * License: GPLv3
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: zhpace
 * Domain Path: /languages
 */

declare(strict_types=1);

// 防止直接訪問
if (!defined('ABSPATH')) {
    exit;
}

// 定義常量避免重複計算
define('ZHPACE_VERSION', '1.1.2');
define('ZHPACE_PATH', plugin_dir_path(__FILE__));
define('ZHPACE_URL', plugin_dir_url(__FILE__));
define('ZHPACE_JS_PATH', ZHPACE_PATH . 'js/zhpace.min.js');
define('ZHPACE_DEBUG', defined('WP_DEBUG') && WP_DEBUG);

/**
 * 加載 ZHpace JavaScript
 * 
 * 使用匿名函數來避免全局命名空間污染
 */
add_action('wp_enqueue_scripts', function (): void {
    try {
        // 檢查檔案是否存在，避免在檔案不存在時產生錯誤
        if (!file_exists(ZHPACE_JS_PATH)) {
            if (ZHPACE_DEBUG) {
                error_log('ZHpace Error: JavaScript file not found at ' . ZHPACE_JS_PATH);
            }
            return;
        }

        // 獲取檔案修改時間作為版本號，如果獲取失敗則使用定義的版本號
        $version = @filemtime(ZHPACE_JS_PATH) ?: ZHPACE_VERSION;

        // 註冊並加載 JavaScript
        wp_enqueue_script(
            'zhpace',
            ZHPACE_URL . 'js/zhpace.min.js',
            [],  // 無依賴
            $version,
            [
                'in_footer' => true,
                'strategy' => 'defer'
            ]
        );

        // 配置 JavaScript
        wp_localize_script('zhpace', 'zhpaceConfig', [
            'throttle' => apply_filters('zhpace_throttle', 50),  // 允許通過過濾器修改節流值
            'debug' => ZHPACE_DEBUG,
            'autoInit' => apply_filters('zhpace_auto_init', true)  // 可通過過濾器禁用自動初始化
        ]);
    } catch (Throwable $e) {  // 使用 Throwable 捕獲所有可能的錯誤和異常
        if (ZHPACE_DEBUG) {
            error_log('ZHpace Error: ' . $e->getMessage());
        }
    }
});

// 添加禁用 ZHpace 的選項
add_filter('script_loader_tag', function ($tag, $handle, $src) {
    // 只處理 zhpace 的標籤
    if ('zhpace' !== $handle) {
        return $tag;
    }

    // 檢查是否需要在特定頁面禁用 ZHpace
    if (apply_filters('zhpace_disable', false)) {
        return '';  // 返回空字符串以禁用腳本
    }

    return $tag;
}, 10, 3);

// 在管理頁面註冊設置鏈接
if (is_admin()) {
    add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
        // 添加一個設置鏈接到插件列表中
        $settings_link = '<a href="https://github.com/glasschan/zphace" target="_blank">' . __('文檔', 'zhpace') . '</a>';
        array_unshift($links, $settings_link);
        return $links;
    });
}
