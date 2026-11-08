import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { usePreset } from '@/composables/use-preset';
import DrawerCollection from './drawer-collection.vue';

vi.mock('@/composables/use-preset', () => ({ usePreset: vi.fn() }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

vi.mock('@wbce-d9/composables', () => ({
	useCollection: () => ({ info: {} }),
	useLayout: () => ({ layoutWrapper: null }),
}));

vi.mock('@/composables/use-extension', () => ({ useExtension: () => null }));
vi.mock('@/views/private/components/search-input.vue', () => ({ default: {} }));

// Exercise the drawer's state and lifecycle without mounting the layout or fetching items.
const DrawerState = defineComponent({ ...DrawerCollection, render: () => null });

describe('collection drawer pagination', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		vi.mocked(usePreset).mockReturnValue({
			layout: ref('tabular'),
			layoutOptions: ref({}),
			layoutQuery: ref({ page: 2, limit: 25, sort: ['title'] }),
			search: ref(null),
			filter: ref({ title: { _contains: 'Hungary Aid' } }),
		} as unknown as ReturnType<typeof usePreset>);
	});

	it('starts a new drawer on page one without changing the collection preset', () => {
		const drawer = mount(DrawerState, { props: { active: true, collection: 'directus_files' } });
		expect(drawer.vm.localQuery).toEqual({ page: 1, limit: 25, sort: ['title'] });
		expect(vi.mocked(usePreset).mock.results[0].value.layoutQuery.value.page).toBe(2);
		drawer.unmount();
	});

	it('resets pagination on reopening while retaining the filter and sort', async () => {
		const drawer = mount(DrawerState, { props: { active: true, collection: 'directus_files' } });
		drawer.vm.localQuery = { ...drawer.vm.localQuery, page: 2 };
		await drawer.setProps({ active: false });
		await drawer.setProps({ active: true });
		expect(drawer.vm.localQuery).toEqual({ page: 1, limit: 25, sort: ['title'] });
		expect(drawer.vm.presetFilter).toEqual({ title: { _contains: 'Hungary Aid' } });
		drawer.unmount();
	});

	it('allows navigating to later pages while the drawer stays open', async () => {
		const drawer = mount(DrawerState, { props: { active: false, collection: 'directus_files' } });
		await drawer.setProps({ active: true });
		drawer.vm.localQuery = { ...drawer.vm.localQuery, page: 2 };
		await drawer.setProps({ selection: ['file-id'] });
		expect(drawer.vm.localQuery.page).toBe(2);
		drawer.unmount();
	});
});
