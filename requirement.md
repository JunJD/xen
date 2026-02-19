# 翻译布局需求说明

## 目标
在翻译元素集合增加的情况下，尽可能保持页面布局稳定、美观，不破坏父级尺寸，不挤压邻居元素。

## 核心约束
1. 不改变原节点的外层尺寸。
2. 不新增外层 padding/margin 影响布局。
3. 单行/紧凑元素优先 inline 布局。
4. 多行段落允许 three-lane 布局。
5. 译文过长时必须降噪，而不是撑开父级。

## 成功标准
1. 菜单/侧边栏类短文本不叠行、不重叠。
2. 长段落翻译可读，行距不被破坏。
3. 任何元素不出现“父级高度被扩张”的情况。

## Case 说明与测试 HTML
下面的 HTML 片段可直接粘贴到任意页面进行测试。

### Case 1：Inline 元素
期望：译文同一行显示，不换行堆叠。
```html
<a class="inline-flex h-9 items-center rounded px-2" href="#">
  <span>Applications</span>
</a>
```

### Case 2：紧凑单行 block/flex
期望：译文同一行显示，不出现三 lane 堆叠。
```html
<div style="display:flex; align-items:center; height:36px; font-size:14px; line-height:20px;">
  <span>Analytics</span>
</div>
```

### Case 3：文本截断
期望：译文 inline，且整体仍保持单行，不影响父级宽度。
```html
<div style="width:160px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
  Account Settings for Very Long Project Name
</div>
```

### Case 4：普通段落
期望：允许 three-lane；不破坏段落布局。
```html
<p style="max-width:480px;">
  This is a longer paragraph for layout testing. It should allow a multi-lane layout while staying readable.
</p>
```

### Case 5：列表项（菜单）
期望：每一项保持单行，不叠行。
```html
<ul style="list-style:none; padding:0; margin:0; width:200px;">
  <li style="height:36px; display:flex; align-items:center;">Security</li>
  <li style="height:36px; display:flex; align-items:center;">Approvals</li>
  <li style="height:36px; display:flex; align-items:center;">Billing</li>
</ul>
```

### Case 6：按钮/标签
期望：译文不改变按钮高度。
```html
<button style="height:32px; padding:0 12px; font-size:13px;">
  Save Changes
</button>
```

### Case 7：卡片标题 + 副标题
期望：标题保持一行或轻微扩展，但不破坏卡片高度约束。
```html
<div style="width:220px; border:1px solid #ddd; padding:12px;">
  <div style="font-size:16px; font-weight:600;">Personal Account</div>
  <div style="font-size:12px; color:#666;">View profile page</div>
</div>
```

## 备注
- Case 1/2/3/5/6 属于“紧凑布局”，必须优先 inline。
- Case 4 属于“段落布局”，允许 three-lane。
- 如果出现重叠或溢出，视为失败。

