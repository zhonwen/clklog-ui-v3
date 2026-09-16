import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**', '**/v2/**', 'public/config.js']),

  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  skipFormatting,

  {
    name: 'clklog/rules',
    rules: {
      // 迁移期间容易溜进来的三类问题，一律按 error 拦住
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-nocheck': true,
          'ts-ignore': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // 规则构建器（analysis-model/*、custom-analysis、userReview/typeRules）沿用 v2 的数据流：
      // 父组件传入 modelObject，子组件就地修改它，不走 emit。
      // Vue 2 允许这样改 props 对象的内部属性，v2 全靠它联动；改成单向数据流等于重构数据结构，
      // 与「逻辑严格以 v2 为基准」冲突。这里降为 warn 保持可见，后续若要整改可逐个文件收敛。
      'vue/no-mutating-props': 'warn',

      // FilterBar 的开关属性沿用 v2 的 PascalCase 命名（ByArea / ByData ...）。
      // Vue 3 会把模板里的 by-area 归一成 byArea，与声明的 ByArea 对不上，
      // 这条规则一旦 --fix 会把所有筛选条开关改成短横线写法并静默失效，因此关掉。
      'vue/attribute-hyphenation': 'off',

      // v2 迁过来的代码里大量 == / !=，暂时只警告，逐个模块收敛
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // 组件名允许单词（首页那批组件沿用 v2 命名），其余按官方推荐
      'vue/multi-word-component-names': 'off',
      'vue/attributes-order': 'warn',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
    },
  },
)
