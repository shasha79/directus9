import type { EXTENSION_LANGUAGES } from '@wbce-d9/constants';
import type { Plugin, RollupOptions, OutputOptions as RollupOutputOptions } from 'rollup';

export type Language = (typeof EXTENSION_LANGUAGES)[number];
export type LanguageShort = 'js' | 'ts';

export type Config = {
	plugins?: Plugin[];
	onwarn?: RollupOptions['onwarn'];
};

export type RollupConfig = { rollupOptions: RollupOptions; rollupOutputOptions: RollupOutputOptions };
export type RollupMode = 'browser' | 'node';
