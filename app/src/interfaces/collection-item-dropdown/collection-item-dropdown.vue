<template>
	<div class="collection-item-dropdown">
		<v-skeleton-loader v-if="loading" type="input" />
		<v-input v-else clickable :placeholder="t('select_an_item')" :disabled="disabled" @click="selectDrawerOpen = true">
			<template v-if="displayItem" #input>
				<div class="preview">
					<render-template :collection="selectedCollection" :item="displayItem" :template="displayTemplate" />
				</div>
			</template>

			<template #append>
				<template v-if="displayItem">
					<v-icon v-tooltip="t('edit')" name="open_in_new" class="edit" @click.stop="editDrawerOpen = true" />
					<v-icon
						v-if="!disabled"
						v-tooltip="t('deselect')"
						name="close"
						class="deselect"
						@click.stop="$emit('input', undefined)"
					/>
				</template>
				<template v-else>
					<v-icon
						v-if="enableCreate && createAllowed && !disabled"
						v-tooltip="t('create_item')"
						class="add"
						name="add"
						@click.stop="createDrawerOpen = true"
					/>
					<v-icon class="expand" name="expand_more" />
				</template>
			</template>
		</v-input>

		<drawer-collection
			v-model:active="selectDrawerOpen"
			:collection="selectedCollection"
			:selection="value?.key ? [value.key] : []"
			:filter="filter"
			@input="onSelection"
			@update:active="selectDrawerOpen = false"
		/>

		<drawer-item
			v-if="enableCreate && createAllowed && !disabled"
			v-model:active="createDrawerOpen"
			:collection="selectedCollection"
			primary-key="+"
			@input="onCreateDrawerInput"
		/>

		<drawer-item
			v-if="displayItem && value?.key != null"
			v-model:active="editDrawerOpen"
			:collection="selectedCollection"
			:primary-key="value.key"
			:disabled="disabled || !updateAllowed"
			@input="onEditDrawerInput"
		/>
	</div>
</template>

<script setup lang="ts">
import api from '@/api';
import { useCollectionsStore } from '@/stores/collections';
import { useFieldsStore } from '@/stores/fields';
import { usePermissionsStore } from '@/stores/permissions';
import { adjustFieldsForDisplays } from '@/utils/adjust-fields-for-displays';
import { isAllowed } from '@/utils/is-allowed';
import { unexpectedError } from '@/utils/unexpected-error';
import DrawerCollection from '@/views/private/components/drawer-collection.vue';
import DrawerItem from '@/views/private/components/drawer-item.vue';
import { Filter } from '@wbce-d9/types';
import { getEndpoint, getFieldsFromTemplate } from '@wbce-d9/utils';
import { computed, ref, toRefs, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

type Value = {
	key: (string | number) | null;
	collection: string;
};

const props = withDefaults(
	defineProps<{
		value?: Value | null;
		selectedCollection: string;
		template?: string | null;
		disabled?: boolean;
		filter?: Filter | null;
		enableCreate?: boolean;
	}>(),
	{
		value: () => ({ key: null, collection: '' }),
		disabled: false,
		template: () => null,
		filter: () => null,
		enableCreate: true,
	}
);

const { t } = useI18n();

const emit = defineEmits(['input']);

const { selectedCollection, template } = toRefs(props);

const collectionsStore = useCollectionsStore();
const fieldStore = useFieldsStore();
const permissionsStore = usePermissionsStore();

const loading = ref(false);
const selectDrawerOpen = ref(false);
const createDrawerOpen = ref(false);
const editDrawerOpen = ref(false);
const displayItem = ref<Record<string, any> | null>(null);

const value = computed({
	get: () => props.value,
	set: (value) => {
		if (value && typeof value === 'object' && value.key) {
			emit('input', value);
		} else {
			emit('input', null);
		}
	},
});

const primaryKey = computed(() => fieldStore.getPrimaryKeyFieldForCollection(unref(selectedCollection))?.field ?? '');

const displayTemplate = computed(() => {
	if (unref(template)) return unref(template);

	const displayTemplate = collectionsStore.getCollection(unref(selectedCollection))?.meta?.display_template;

	return displayTemplate || `{{ ${primaryKey.value || ''} }}`;
});

const requiredFields = computed(() => {
	if (!displayTemplate.value || !unref(selectedCollection)) return [];
	return adjustFieldsForDisplays(getFieldsFromTemplate(displayTemplate.value), unref(selectedCollection));
});

const createAllowed = computed(() => {
	if (!unref(selectedCollection)) return false;
	return isAllowed(unref(selectedCollection), 'create', null);
});

const updateAllowed = computed(() => {
	if (!unref(selectedCollection)) return false;
	return permissionsStore.hasPermission(unref(selectedCollection), 'update');
});

watch(value, getDisplayItem, { immediate: true });

async function getDisplayItem() {
	if (!value.value || !value.value.key) {
		displayItem.value = null;
		return;
	}

	if (!unref(selectedCollection) || !primaryKey.value) return;

	const fields = new Set(requiredFields.value);
	fields.add(primaryKey.value);

	try {
		loading.value = true;

		const response = await api.get(getEndpoint(unref(selectedCollection)), {
			params: {
				fields: Array.from(fields),
				filter: { [primaryKey.value]: { _eq: value.value.key } },
			},
		});

		displayItem.value = response.data.data?.[0] ?? null;
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		loading.value = false;
	}
}

function onSelection(selectedIds: (number | string)[]) {
	selectDrawerOpen.value = false;
	value.value = { key: Array.isArray(selectedIds) ? selectedIds[0] : null, collection: unref(selectedCollection) };
}

async function onCreateDrawerInput(edits: Record<string, any>) {
	if (!unref(selectedCollection) || !primaryKey.value) return;

	try {
		loading.value = true;

		const response = await api.post(getEndpoint(unref(selectedCollection)), edits);
		const newPk = response.data.data?.[primaryKey.value];

		if (newPk !== undefined && newPk !== null) {
			value.value = { key: newPk, collection: unref(selectedCollection) };
		}
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		loading.value = false;
	}
}

async function onEditDrawerInput(edits: Record<string, any>) {
	if (props.disabled || !updateAllowed.value || value.value?.key == null) return;

	try {
		loading.value = true;

		await api.patch(`${getEndpoint(unref(selectedCollection))}/${encodeURIComponent(value.value.key)}`, edits);
		await getDisplayItem();
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		loading.value = false;
	}
}
</script>

<style lang="scss" scoped>
.preview {
	flex-grow: 1;
}

.edit {
	margin-right: 4px;

	&:hover {
		--v-icon-color: var(--foreground-normal);
	}
}

.add:hover {
	--v-icon-color: var(--primary);
}

.deselect:hover {
	--v-icon-color: var(--danger);
}
</style>
