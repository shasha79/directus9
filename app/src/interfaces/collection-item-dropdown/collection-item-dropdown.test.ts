import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, expect, test, vi } from 'vitest';
import api from '@/api';
import { usePermissionsStore } from '@/stores/permissions';
import { unexpectedError } from '@/utils/unexpected-error';
import Interface from './collection-item-dropdown.vue';

vi.mock('@/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

vi.mock('@/stores/collections', () => ({
	useCollectionsStore: () => ({ getCollection: () => ({ meta: { display_template: '{{ title }}' } }) }),
}));

vi.mock('@/stores/fields', () => ({
	useFieldsStore: () => ({ getPrimaryKeyFieldForCollection: () => ({ field: 'id' }) }),
}));

vi.mock('@/stores/permissions', () => ({
	usePermissionsStore: () => ({ hasPermission: updateAllowed }),
}));

vi.mock('@/utils/adjust-fields-for-displays', () => ({ adjustFieldsForDisplays: (fields: string[]) => fields }));
vi.mock('@/utils/is-allowed', () => ({ isAllowed: () => true }));
vi.mock('@/utils/unexpected-error', () => ({ unexpectedError: vi.fn() }));

vi.mock('@/views/private/components/drawer-collection.vue', () => ({
	default: { name: 'DrawerCollection', template: '<div />', props: ['active'] },
}));

vi.mock('@/views/private/components/drawer-item.vue', () => ({
	default: { name: 'DrawerItem', template: '<div />', props: ['active', 'primaryKey', 'disabled', 'collection'] },
}));

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const updateAllowed = vi.fn();

beforeEach(() => {
	vi.clearAllMocks();
	updateAllowed.mockReturnValue(true);
	vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'item/1', title: 'Original' }] } });
	vi.mocked(api.patch).mockResolvedValue({ data: { data: {} } });
});

async function mountInterface(props = {}) {
	const wrapper = mount(Interface, {
		props: { selectedCollection: 'books', value: { key: 'item/1', collection: 'books' }, ...props },
		global: {
			directives: { tooltip: () => {} },
			stubs: {
				VInput: { template: '<div><slot name="input" /><slot name="append" /></div>' },
				VIcon: { template: '<button />', props: ['name'] },
				VSkeletonLoader: true,
				RenderTemplate: { template: '<span>{{ item.title }}</span>', props: ['item'] },
			},
		},
	});

	await flushPromises();
	return wrapper;
}

test('opens only the related item drawer when clicking edit, even when creation is disabled', async () => {
	const wrapper = await mountInterface({ enableCreate: false });

	await wrapper.get('.edit').trigger('click');

	expect(wrapper.getComponent({ name: 'DrawerItem' }).props()).toMatchObject({
		active: true,
		primaryKey: 'item/1',
		collection: 'books',
		disabled: false,
	});

	expect(wrapper.getComponent({ name: 'DrawerCollection' }).props('active')).toBe(false);
	expect(usePermissionsStore().hasPermission).toHaveBeenCalledWith('books', 'update');
});

test('saves edits to the existing related item and refreshes its label without changing the reference', async () => {
	const wrapper = await mountInterface({ enableCreate: false });
	vi.mocked(api.get).mockResolvedValue({ data: { data: [{ id: 'item/1', title: 'Updated' }] } });

	wrapper.getComponent({ name: 'DrawerItem' }).vm.$emit('input', { title: 'Updated' });
	await flushPromises();

	expect(api.patch).toHaveBeenCalledWith('/items/books/item%2F1', { title: 'Updated' });
	expect(wrapper.text()).toContain('Updated');
	expect(wrapper.emitted('input')).toBeUndefined();
});

test.each([{ disabled: true }, { permitted: false }])(
	'prevents saving a read-only related item: %j',
	async (options) => {
		updateAllowed.mockReturnValue(options.permitted !== false);
		const wrapper = await mountInterface({ disabled: options.disabled ?? false, enableCreate: false });

		expect(wrapper.getComponent({ name: 'DrawerItem' }).props('disabled')).toBe(true);
		wrapper.getComponent({ name: 'DrawerItem' }).vm.$emit('input', { title: 'Updated' });
		await flushPromises();

		expect(api.patch).not.toHaveBeenCalled();
	}
);

test('reports save failures and keeps the existing reference', async () => {
	const wrapper = await mountInterface({ enableCreate: false });
	const error = new Error('Save failed');
	vi.mocked(api.patch).mockRejectedValue(error);

	wrapper.getComponent({ name: 'DrawerItem' }).vm.$emit('input', { title: 'Updated' });
	await flushPromises();

	expect(unexpectedError).toHaveBeenCalledWith(error);
	expect(wrapper.text()).toContain('Original');
	expect(wrapper.emitted('input')).toBeUndefined();
});
