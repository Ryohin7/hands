import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { TextAlign } from '@tiptap/extension-text-align';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { useCallback, useRef, useEffect, useState } from 'react';
import { ProductExtension } from './ProductExtension';

// 自定義字體大小擴展 - 使用 Global Attributes 方式綁定到 textStyle
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize }).run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});

// 自定義 A4 紙張分頁符號擴展 (列印時斷頁)
const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  selectable: true,
  draggable: true,
  parseHTML() {
    return [
      { tag: 'div[data-type="page-break"]' },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'page-break', class: 'page-break-divider' })];
  },
  addCommands() {
    return {
      setPageBreak: () => ({ chain }) => {
        return chain()
          .insertContent({ type: this.name })
          .run();
      },
    };
  },
});

const TiptapEditor = ({ content, onChange, placeholder = '請開始輸入內容...' }) => {
  const fileInputRef = useRef(null);
  
  // React Dialogs 狀態控制
  const [activeDialog, setActiveDialog] = useState(null); // 'link' | 'color' | 'image' | 'table' | 'product'
  const [linkUrl, setLinkUrl] = useState('');
  const [customColor, setCustomColor] = useState('#000000');
  const [tableRows, setTableRows] = useState('3');
  const [tableCols, setTableCols] = useState('3');
  const [imageUrl, setImageUrl] = useState('');
  const [productImg, setProductImg] = useState('');
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState('');
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontSize,
      Color,
      Placeholder.configure({
        placeholder,
      }),
      ProductExtension,
      PageBreak,
    ],
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // 強制同步父元件傳入的內容 (用於非同步載入)
  useEffect(() => {
    if (editor && content && editor.isEmpty) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  // 開啟各類內置 Dialog
  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const currentUrl = editor.getAttributes('link').href || '';
    setLinkUrl(currentUrl);
    setActiveDialog('link');
  }, [editor]);

  const openColorDialog = useCallback(() => {
    if (!editor) return;
    const currentColor = editor.getAttributes('textStyle').color || '#000000';
    setCustomColor(currentColor);
    setActiveDialog('color');
  }, [editor]);

  const openImageDialog = useCallback(() => {
    setImageUrl('');
    setActiveDialog('image');
  }, []);

  const openTableDialog = useCallback(() => {
    setTableRows('3');
    setTableCols('3');
    setActiveDialog('table');
  }, []);

  const openProductDialog = useCallback(() => {
    setProductImg('');
    setProductName('');
    setProductPrice('');
    setActiveDialog('product');
  }, []);

  // 提交對話框處理
  const handleLinkSubmit = (e) => {
    e.preventDefault();
    if (!editor) return;
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setActiveDialog(null);
  };

  const handleColorSubmit = (e) => {
    e.preventDefault();
    if (!editor) return;
    if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
      editor.chain().focus().setColor(customColor).run();
      setActiveDialog(null);
    }
  };

  const handleImageChoiceSubmit = (choice) => {
    if (choice === 'upload') {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
      setActiveDialog(null);
    } else {
      if (imageUrl) {
        editor.chain().focus().setImage({ src: imageUrl }).run();
        setActiveDialog(null);
      }
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file && editor) {
      const reader = new FileReader();
      reader.onload = (event) => {
        editor.chain().focus().setImage({ src: event.target.result }).run();
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // 重置 input
  };

  const handleTableSubmit = (e) => {
    e.preventDefault();
    if (!editor) return;
    const rows = parseInt(tableRows, 10);
    const cols = parseInt(tableCols, 10);
    if (!isNaN(rows) && !isNaN(cols) && rows > 0 && cols > 0) {
      editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
      setActiveDialog(null);
    }
  };

  const handleProductSubmit = (e) => {
    e.preventDefault();
    if (!editor) return;
    if (productImg && productName && productPrice) {
      editor.chain().focus().insertProduct({ imageUrl: productImg, name: productName, price: productPrice }).run();
      setActiveDialog(null);
    }
  };

  if (!editor) return <div className="editor-loading">正在初始化編輯器...</div>;

  return (
    <div className="tiptap-editor">
      <input 
        type="file" 
        accept="image/*" 
        style={{ display: 'none' }} 
        ref={fileInputRef} 
        onChange={onFileChange}
      />

      {/* 表格專用氣泡選單 Table Bubble Menu */}
      {editor && (
        <BubbleMenu 
          className="editor-table-bubble-menu" 
          tippyOptions={{ 
            duration: 100,
            shouldShow: ({ editor }) => editor.isActive('table'),
          }} 
          editor={editor}
        >
          <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} title="在左側插入欄">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>左欄</span>
          </button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} title="在右側插入欄">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>右欄</span>
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} title="刪除目前欄" className="btn-action-danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            <span>刪欄</span>
          </button>
          
          <div className="menu-separator" />
          
          <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} title="在上方插入列">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>上列</span>
          </button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} title="在下方插入列">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            <span>下列</span>
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} title="刪除目前列" className="btn-action-danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            <span>刪列</span>
          </button>
          
          <div className="menu-separator" />
          
          <button type="button" onClick={() => editor.chain().focus().mergeCells().run()} title="合併儲存格">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 12H3"/></svg>
            <span>合併</span>
          </button>
          <button type="button" onClick={() => editor.chain().focus().splitCell().run()} title="拆分儲存格">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18"/></svg>
            <span>拆分</span>
          </button>
          
          <div className="menu-separator" />
          
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} title="刪除整個表格" className="btn-table-delete-all">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
            <span>刪除表格</span>
          </button>
        </BubbleMenu>
      )}
      <div className="tiptap-toolbar">
        {/* 字體大小下拉選單 */}
        <div className="toolbar-group">
          <select
            onChange={(e) => {
              const size = e.target.value;
              if (size === 'default') {
                editor.chain().focus().unsetFontSize().run();
              } else {
                editor.chain().focus().setFontSize(size).run();
              }
            }}
            className="toolbar-select"
            value={editor.getAttributes('textStyle').fontSize || 'default'}
          >
            <option value="default">字級</option>
            <option value="12px">12px</option>
            <option value="14px">14px</option>
            <option value="17px">17px (內文)</option>
            <option value="21px">21px</option>
            <option value="24px">24px</option>
            <option value="28px">28px (副標)</option>
            <option value="48px">48px (主標)</option>
          </select>
        </div>

        <div className="toolbar-separator" />

        {/* 文字格式群組 */}
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'active' : ''}
            title="粗體"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'active' : ''}
            title="斜體"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={editor.isActive('underline') ? 'active' : ''}
            title="底線"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={editor.isActive('strike') ? 'active' : ''}
            title="刪除線"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h-9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={editor.isActive('highlight') ? 'active' : ''}
            title="螢光噴字 (Highlight)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18.5 4.5a2.121 2.121 0 0 1 3 3L12 17l-4 1 1-4 9.5-9.5Z"/><path d="m15 8 3 3"/></svg>
          </button>
          <button
            type="button"
            onClick={openColorDialog}
            className={editor.isActive('textStyle', { color: editor.getAttributes('textStyle').color }) && editor.getAttributes('textStyle').color !== '#000000' ? 'active' : ''}
            title="文字顏色"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16"/><path d="m6 16 6-12 6 12"/><path d="M8 12h8"/></svg>
          </button>
        </div>
        
        <div className="toolbar-separator" />

        {/* 標題與引言群組 */}
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive('heading', { level: 1 }) ? 'active' : ''}
            title="標題一"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
            title="標題二"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive('heading', { level: 3 }) ? 'active' : ''}
            title="標題三"
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive('blockquote') ? 'active' : ''}
            title="引用區塊 (Blockquote)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 2.5 1 4 3 5"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 2.5 1 4 3 5"/></svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={editor.isActive('codeBlock') ? 'active' : ''}
            title="程式碼區塊 (Code Block)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>
        </div>

        <div className="toolbar-separator" />

        {/* 對齊群組 */}
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            className={editor.isActive({ textAlign: 'left' }) ? 'active' : ''}
            title="靠左對齊"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            className={editor.isActive({ textAlign: 'center' }) ? 'active' : ''}
            title="置中對齊"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            className={editor.isActive({ textAlign: 'right' }) ? 'active' : ''}
            title="靠右對齊"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
          </button>
        </div>

        <div className="toolbar-separator" />

        {/* 清單與插入群組 */}
        <div className="toolbar-group">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'active' : ''}
            title="項目清單"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'active' : ''}
            title="編號清單"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
          </button>
          <button type="button" onClick={openLinkDialog} className={editor.isActive('link') ? 'active' : ''} title="插入連結">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          </button>
          <button type="button" onClick={openImageDialog} title="插入圖片 (上傳或網址)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          </button>
          <button type="button" onClick={openTableDialog} title="插入表格">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></svg>
          </button>
          <button type="button" onClick={openProductDialog} title="插入商品卡片">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </button>
          <button type="button" onClick={() => editor.chain().focus().setPageBreak().run()} title="插入分頁符號">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="9" y1="8" x2="15" y2="12" />
              <line x1="9" y1="16" x2="15" y2="12" />
              <line x1="15" y1="12" x2="22" y2="12" />
            </svg>
          </button>
        </div>

        <div className="toolbar-separator" />

        {/* 輔助工具群組 */}
        <div className="toolbar-group">
          <button 
            type="button" 
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} 
            title="清除所有格式"
            className="btn-clear-format"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19L19 17.5L5 3.5L3.5 5L17.5 19Z"/><path d="M11 6L9.5 7.5L3 14H7L12 9L11 6Z"/><path d="M15 11L14 12V10L15 11Z"/><path d="M18.5 7.5L13.5 12.5L14.5 14.5L19.5 9.5L18.5 7.5Z"/></svg>
          </button>
        </div>
      </div>

      <div className="editor-content-area">
        <EditorContent editor={editor} />
      </div>

      {/* 精美 Dialog 元件遮罩層與容器 */}
      {activeDialog && (
        <div className="editor-dialog-overlay" onClick={() => setActiveDialog(null)}>
          <div className="editor-dialog-container" onClick={(e) => e.stopPropagation()}>
            <div className="editor-dialog-header">
              <h3>
                {activeDialog === 'link' && '設定連結網址'}
                {activeDialog === 'color' && '選擇文字顏色'}
                {activeDialog === 'image' && '插入圖片'}
                {activeDialog === 'table' && '新增自訂表格'}
                {activeDialog === 'product' && '插入商品卡片'}
              </h3>
              <button type="button" className="editor-dialog-close" onClick={() => setActiveDialog(null)}>&times;</button>
            </div>
            <div className="editor-dialog-body">
              {activeDialog === 'link' && (
                <form onSubmit={handleLinkSubmit}>
                  <div className="form-group">
                    <label>連結網址 (URL)</label>
                    <input 
                      type="url" 
                      placeholder="https://example.com" 
                      value={linkUrl} 
                      onChange={(e) => setLinkUrl(e.target.value)} 
                      required 
                      autoFocus
                    />
                  </div>
                  <div className="editor-dialog-actions">
                    <button type="button" className="btn-secondary" onClick={() => {
                      editor.chain().focus().extendMarkRange('link').unsetLink().run();
                      setActiveDialog(null);
                    }}>取消連結</button>
                    <button type="submit" className="btn-primary">確認儲存</button>
                  </div>
                </form>
              )}

              {activeDialog === 'color' && (
                <form onSubmit={handleColorSubmit}>
                  <div className="form-group">
                    <label>調色盤選擇</label>
                    <div className="color-palette">
                      {['#000000', '#333333', '#666666', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#007130'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`color-swatch ${customColor.toLowerCase() === c.toLowerCase() ? 'selected' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setCustomColor(c)}
                          title={c}
                        />
                      ))}
                    </div>
                    <div className="color-input-wrapper">
                      <label>或輸入 HEX 自訂色碼</label>
                      <div className="color-input-fields">
                        <input 
                          type="color" 
                          value={customColor} 
                          onChange={(e) => setCustomColor(e.target.value)} 
                        />
                        <input 
                          type="text" 
                          placeholder="#000000" 
                          pattern="^#[0-9A-Fa-f]{6}$" 
                          value={customColor} 
                          onChange={(e) => setCustomColor(e.target.value)} 
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div className="editor-dialog-actions">
                    <button type="button" className="btn-secondary" onClick={() => {
                      editor.chain().focus().unsetColor().run();
                      setActiveDialog(null);
                    }}>清除顏色</button>
                    <button type="submit" className="btn-primary">確定套用</button>
                  </div>
                </form>
              )}

              {activeDialog === 'image' && (
                <div className="image-dialog-tabs">
                  <button type="button" className="btn-primary upload-trigger-btn" onClick={() => handleImageChoiceSubmit('upload')}>
                    📁 上傳電腦本機圖片
                  </button>
                  <div className="dialog-divider">
                    <span>或</span>
                  </div>
                  <div className="form-group">
                    <label>外部圖片網址 (URL)</label>
                    <input 
                      type="url" 
                      placeholder="https://example.com/image.png" 
                      value={imageUrl} 
                      onChange={(e) => setImageUrl(e.target.value)} 
                    />
                  </div>
                  <div className="editor-dialog-actions">
                    <button type="button" className="btn-secondary" onClick={() => setActiveDialog(null)}>取消</button>
                    <button type="button" className="btn-primary" onClick={() => handleImageChoiceSubmit('url')} disabled={!imageUrl}>插入網址圖片</button>
                  </div>
                </div>
              )}

              {activeDialog === 'table' && (
                <form onSubmit={handleTableSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>表格列數 (Rows)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="15" 
                        value={tableRows} 
                        onChange={(e) => setTableRows(e.target.value)} 
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>表格欄數 (Columns)</label>
                      <input 
                        type="number" 
                        min="1" 
                        max="15" 
                        value={tableCols} 
                        onChange={(e) => setTableCols(e.target.value)} 
                        required
                      />
                    </div>
                  </div>
                  <div className="editor-dialog-actions">
                    <button type="button" className="btn-secondary" onClick={() => setActiveDialog(null)}>取消</button>
                    <button type="submit" className="btn-primary">建立表格</button>
                  </div>
                </form>
              )}

              {activeDialog === 'product' && (
                <form onSubmit={handleProductSubmit}>
                  <div className="form-group">
                    <label>商品主圖網址 (URL)</label>
                    <input 
                      type="url" 
                      placeholder="https://example.com/product-thumb.jpg" 
                      value={productImg} 
                      onChange={(e) => setProductImg(e.target.value)} 
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>商品完整名稱</label>
                    <input 
                      type="text" 
                      placeholder="請輸入商品名稱" 
                      value={productName} 
                      onChange={(e) => setProductName(e.target.value)} 
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>商品售價 (價格)</label>
                    <input 
                      type="number" 
                      placeholder="例如: 1280" 
                      value={productPrice} 
                      onChange={(e) => setProductPrice(e.target.value)} 
                      required
                    />
                  </div>
                  <div className="editor-dialog-actions">
                    <button type="button" className="btn-secondary" onClick={() => setActiveDialog(null)}>取消</button>
                    <button type="submit" className="btn-primary">插入商品卡片</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TiptapEditor;
