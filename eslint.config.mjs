// @ts-check
import antfu from '@antfu/eslint-config'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
    antfu({
        rules: {
            'node/prefer-global/process': ['off'],
            'node/prefer-global/buffer': ['off'],
            'no-console': ['off'],
        },
        stylistic: {
            indent: 4,
            quotes: 'single',
        },
        ignores: [
            '**/*.json',
            '**/*.yaml',
            '**/*.yml',
            'dist/**',
            '.output/**',
            'android/**',
            'ios/**',
        ],
    }),
)
