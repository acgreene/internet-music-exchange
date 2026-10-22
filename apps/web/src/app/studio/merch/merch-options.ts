import { productTypeLabel } from '@ime/client-listening';
import { productTypeSchema, type ProductType } from '@ime/models';

/**
 * The kinds of merch, as a picker lists them.
 */
export const PRODUCT_TYPES: { value: ProductType; label: string }[] =
  productTypeSchema.options.map((value) => ({
    value,
    label: value === 'other' ? 'Other' : productTypeLabel(value),
  }));

export const typeLabel = (type: ProductType): string =>
  PRODUCT_TYPES.find((option) => option.value === type)?.label ?? type;
