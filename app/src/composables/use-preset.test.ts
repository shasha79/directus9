import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick, ref } from 'vue';
import { usePreset } from './use-preset';
import { usePresetsStore } from '@/stores/presets';

vi.mock('@/api', () => ({ default: {} }));

vi.mock('@/stores/user', () => ({
	useUserStore: () => ({ currentUser: { id: 'user', role: { id: 'role' } } }),
}));

vi.mock('@/utils/translate-literal', () => ({ translate: (value: string) => value }));

function openDrawer(collection = ref('related_items')) {
	const scope = effectScope();
	const preset = scope.run(() => usePreset(collection, ref(null), true))!;
	return { preset, close: () => scope.stop() };
}

describe('temporary collection presets', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('retains the filter and search when a drawer is recreated for another item', () => {
		const first = openDrawer();
		const filter = { title: { _contains: 'archive' } };
		first.preset.filter.value = filter;
		first.preset.search.value = 'letter';
		first.close();

		const next = openDrawer();
		expect(next.preset.filter.value).toEqual(filter);
		expect(next.preset.search.value).toBe('letter');
		next.close();
	});

	it('keeps collection searches separate when switching collections', async () => {
		const collection = ref('related_items');
		const drawer = openDrawer(collection);
		const filter = { title: { _eq: 'archive' } };
		drawer.preset.filter.value = filter;
		collection.value = 'other_items';
		await nextTick();
		expect(drawer.preset.filter.value).toBeNull();
		collection.value = 'related_items';
		await nextTick();
		expect(drawer.preset.filter.value).toEqual(filter);
		drawer.close();
	});

	it('retains an explicitly cleared filter instead of restoring the collection default', () => {
		const store = usePresetsStore();

		store.collectionPresets = [
			{ collection: 'related_items', user: 'user', role: null, filter: { status: { _eq: 'draft' } } } as any,
		];

		const drawer = openDrawer();
		expect(drawer.preset.filter.value).toEqual({ status: { _eq: 'draft' } });
		drawer.preset.filter.value = null;
		drawer.close();
		const next = openDrawer();
		expect(next.preset.filter.value).toBeNull();
		expect(store.getPresetForCollection('related_items').filter).toEqual({ status: { _eq: 'draft' } });
		next.close();
	});

	it('does not change the main collection preset or retain searches after logout', async () => {
		const store = usePresetsStore();
		const drawer = openDrawer();
		drawer.preset.filter.value = { title: { _eq: 'archive' } };
		drawer.preset.search.value = 'letter';
		drawer.close();
		expect(store.getPresetForCollection('related_items').filter).toBeNull();
		expect(store.getPresetForCollection('related_items').search).toBeNull();
		await store.dehydrate();
		const next = openDrawer();
		expect(next.preset.filter.value).toBeNull();
		expect(next.preset.search.value).toBeNull();
		next.close();
	});
});
