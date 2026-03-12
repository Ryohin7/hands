import { Node, mergeAttributes } from '@tiptap/core';

export const ProductExtension = Node.create({
  name: 'productCard',
  group: 'block',
  atom: true, // as an atom, the editor won't let users edit its internal structure directly

  addAttributes() {
    return {
      imageUrl: {
        default: '',
        parseHTML: element => element.getAttribute('data-image-url') || element.querySelector('img.product-image')?.getAttribute('src') || '',
      },
      name: {
        default: '',
        parseHTML: element => element.getAttribute('data-name') || element.querySelector('.product-name')?.textContent || '',
      },
      price: {
        default: '',
        parseHTML: element => element.getAttribute('data-price') || element.querySelector('.product-price')?.textContent?.replace('NT$ ', '') || '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div.product-display-card',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({
        class: 'product-display-card',
        'data-image-url': HTMLAttributes.imageUrl,
        'data-name': HTMLAttributes.name,
        'data-price': HTMLAttributes.price,
        // Inline styles to ensure it looks good even without external CSS (which is not guaranteed across systems)
        style: 'display: flex; align-items: center; gap: 1.5rem; padding: 1.5rem; border: 1px solid #E5E7EB; border-radius: 4px; background: #F8F9FB; margin: 1.5rem 0;',
      }),
      [
        'div',
        {
          class: 'product-img-wrapper',
          style: 'flex-shrink: 0; width: 120px; height: 120px; background: #fff; border-radius: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center;',
        },
        [
          'img',
          {
            src: HTMLAttributes.imageUrl,
            alt: HTMLAttributes.name,
            class: 'product-image',
            style: 'max-width: 100%; max-height: 100%; object-fit: contain; margin: 0;',
          },
        ],
      ],
      [
        'div',
        { class: 'product-info-wrapper', style: 'flex: 1;' },
        [
          'div',
          {
            class: 'product-name',
            style: 'font-size: 1.125rem; font-weight: 600; color: #1d1d1f; margin-bottom: 0.5rem;',
          },
          HTMLAttributes.name,
        ],
        [
          'div',
          {
            class: 'product-price',
            style: 'font-size: 1.25rem; font-weight: 700; color: #d32f2f;',
          },
          `NT$ ${HTMLAttributes.price}`,
        ],
      ],
    ];
  },

  addCommands() {
    return {
      insertProduct:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
