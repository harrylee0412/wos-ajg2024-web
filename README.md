# WoS Advanced Search Query Generator

基于 ABS 分级与学科领域生成 Web of Science (WoS) 高级检索式的 Web 应用，支持中英文切换、期刊预览与一键复制。

## ✨ 主要功能

- **ABS 2024 分级筛选**：支持 1/2/3/4/4* 多选。
- **特殊列表**：FT50、UTD24 一键筛选。
- **研究领域筛选**：基于 ABS 领域分类，并提供中英文显示。
- **关键词补充**：自动拼接到 `TS=(...)`。
- **检索式生成**：输出可直接用于 WoS Advanced Search 的完整表达式。
- **预览分页**：匹配期刊列表分页展示。

## ✅ 使用方法

1. 选择语言（EN / 中文）。
2. 勾选 ABS 等级、FT50/UTD24、研究领域等筛选条件。
3. 可选输入关键词，建议格式示例：
   - `"artificial intelligence" OR "machine learning"`
4. 点击复制，将生成的检索式粘贴到 WoS Advanced Search 中使用。

## 🔗 高级检索式拼接逻辑

基础检索式：

```
IS=(xxxx-xxxx OR yyyy-yyyy)
```

当输入关键词时会自动拼接为：

```
(IS=(...)) AND TS=(your keywords)
```

如果需要加入其他条件，可以在末尾继续追加，例如：

```
(IS=(...)) AND TS=("supply chain" OR "logistics") AND PY=(2020-2024)
```

常见可追加字段示例：

- **作者**：`AND AU=("Smith J")`
- **标题**：`AND TI=("carbon")`
- **文献类型**：`AND DT=(Article)`
- **年份**：`AND PY=(2020-2024)`

复杂逻辑建议加括号，避免优先级歧义。
