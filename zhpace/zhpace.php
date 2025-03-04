<?php
/**
 * Plugin Name: ZHpace - 請為中英排版加空格
 * Description: 自動實現中文文案排版規範，支援文章內容、標題和自定義字段處理
 * Version: 1.0.0
 * Author: SEAFOODHOLDHAND 史佛浩恒
 * Requires PHP: 8.1
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    define('ABSPATH', dirname(__FILE__) . '/'); // 定義 WordPress 根目錄常數
}

// 明確載入 WordPress 核心函數庫
require_once ABSPATH . 'wp-includes/pluggable.php'; // 載入 pluggable.php，包含常用的插件函數
require_once ABSPATH . 'wp-includes/meta.php'; // 載入 meta.php，包含處理文章元數據的函數

if (!defined('ABSPATH')) {
    exit; // 如果 ABSPATH 仍然未定義，則直接結束執行
}

final class ChineseTextFormatter
{
    private static bool $processing_meta = false; // 避免迴圈處理 meta 數據

    public static function init(): void
    {
        // 註冊 WordPress 內容過濾器
        add_filter('the_content', [self::class, 'format_content']); // 格式化文章內容
        add_filter('the_title', [self::class, 'format_content']); // 格式化文章標題
        add_filter('get_post_metadata', [self::class, 'format_meta'], 10, 4); // 格式化文章元數據
    }

    public static function format_content(string $content): string
    {
        // 格式化文章內容
        return self::process_text($content); // 使用 process_text 函數處理文本
    }

    public static function format_meta($value, $object_id, $meta_key, $single)
    {
        // 格式化文章元數據
        if (self::$processing_meta) {
            return $value; // 如果正在處理 meta，則直接返回，避免無限迴圈
        }

        self::$processing_meta = true; // 設置處理 meta 標誌
        $value = maybe_unserialize($value); // 反序列化 meta 值，以處理陣列或對象

        if (is_string($value)) {
            $value = self::process_text($value); // 如果是字符串，則進行格式化
        } elseif (is_array($value)) {
            array_walk_recursive($value, function (&$item) { // 遞迴處理陣列中的每個元素
                if (is_string($item)) {
                    $item = self::process_text($item); // 如果是字符串，則進行格式化
                }
            });
        }

        self::$processing_meta = false; // 移除處理 meta 標誌
        return $value; // 返回處理後的 meta 值
    }

    private static function process_text(string $content): string
    {
        $patterns = [
            // 中英文間加空格
            '~(\p{Han})([a-zA-Z0-9])(?![^<]*>)~u' => '\1 \2',
            '~([a-zA-Z0-9])(\p{Han})(?![^<]*>)~u' => '\1 \2',

            // 中文與數字之間需要增加空格
            '~([\x{4e00}-\x{9fa5}])([0-9])/u' => '$1 $2',
            '~([0-9])([\x{4e00}-\x{9fa5}])/u' => '$1 $2',

            // 數字與單位之間需要增加空格
            '~(\d)([a-zA-Z]{2,})/u' => '$1 $2',

            // 角度/百分比與數字之間不需要增加空格
            '/(?<=\d)°(?!\s)/u' => '°',
            '/(?<=\d)%(?!\s)/u' => '%',

            // 全形標點與其他字符之間不加空格
            '/\s*([，。！？；：》】」』])\s*/u' => '$1',
            '/\s*([（《【「『])/u' => '$1',

            // 全形和半形
            '/([,])/' => '，',
            '/\.(?!\d)/' => '。',
            '/([!])/' => '！',
            '/([\?])/' => '？',

            // 移除重複標點
            '/([！？]){2,}/u' => '$1',

            // 專有名詞大寫校正
            '/\b(github|javascript|typescript|html5|css3)\b/i' => function ($matches) {
                return strtolower($matches[1]) === 'html5' ? 'HTML5' : ucfirst(strtolower($matches[1]));
            },

            // 英文整句、特殊名詞，其內容使用半形標點
            '/([\x{4e00}-\x{9fa5}]+)(["][\s\S]*?["\'])/u' => '$1 $2',

            // 全形數字轉半形
            '/[\x{ff10}-\x{ff19}]/u' => function ($m) {
                return chr(ord($m[0]) - 65248);
            },

            // Space for opneing (Ps) and closing (Pe) punctuations (from space-lover.php)
            '~(\p{Han})([a-zA-Z0-9\p{Ps}\p{Pi}])(?![^<]*>)~u' => '\1 \2',
            '~([a-zA-Z0-9\p{Pe}\p{Pf}])(\p{Han})(?![^<]*>)~u' => '\1 \2',

            // Space for general punctuations (from space-lover.php)
            '~([!?‽:;,.%])(\p{Han})~u' => '\1 \2',
            '~(\p{Han})([@$#])~u' => '\1 \2',

            // Space fix for 'ampersand' character (from space-lover.php)
            '~(&?(?:amp)?;) (\p{Han})(?![^<]*>)~u' => '\1\2',

            // Space for HTML tags (from space-lover.php)
            '~(\p{Han})(<(?!ruby)[a-zA-Z]+?[^>]*?>)([a-zA-Z0-9\p{Ps}\p{Pi}@$#])~u' => '\1 \2\3',
            '~(\p{Han})(<\/(?!ruby)[a-zA-Z]+>)([a-zA-Z0-9])~u' => '\1\2 \3',
            '~([a-zA-Z0-9\p{Pe}\p{Pf}!?‽:;,.%])(<(?!ruby)[a-zA-Z]+?[^>]*?>)(\p{Han})~u' => '\1 \2\3',
            '~([a-zA-Z0-9\p{Ps}\p{Pi}!?‽:;,.%])(<\/(?!ruby)[a-zA-Z]+>)(\p{Han})~u' => '\1\2 \3',

            // Special characters fix for Chinese Ps/Pe categories (from space-lover.php)
            '~[ ]*([「」『』（）〈〉《》【】〔〕〖〗〘〙〚〛])[ ]*~u' => '\1',
        ];

        foreach ($patterns as $pattern => $replacement) {
            if (is_callable($replacement)) {
                $content = preg_replace_callback($pattern, $replacement, $content);
            } else {
                $content = preg_replace($pattern, $replacement, $content);
            }
        }

        return $content;
    }
}

add_action('init', [ChineseTextFormatter::class, 'init']); // 在 WordPress 初始化時啟動插件
